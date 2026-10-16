// -----------------------------------------------------------------------------
// The integration's runtime: one Tineco account, its appliances, their last
// status. index.js only wires the SDK events to the methods of this class.
// -----------------------------------------------------------------------------

import {
  DEVICE_POLL_FREQUENCIES,
  DEVICE_TRANSPORTS,
  createLogger,
} from '@gladysassistant/integration-sdk';
import { DEFAULT_CONFIG, normalizeConfig } from './config.js';
import { MESSAGES, devicesFound } from './i18n.js';
import { TinecoAuthError, TinecoVerificationRequiredError } from './tineco/api.js';
import {
  MissingCredentialsError,
  TinecoSession,
  VerificationRefusedError,
} from './tineco/session.js';
import { capabilitiesOf, parseFirmware, parseStatus } from './tineco/status.js';
import {
  buildDevice,
  commandOf,
  deviceIds,
  displayName,
  featureKeyOf,
  refOfDevice,
  statesOf,
  tinecoRef,
} from './devices.js';
import { trackStatus } from './events.js';

const logger = createLogger({ name: 'tineco' });

// An unchanged value is re-sent this often, so it stays recently dated.
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;
// Gladys' poll ticks drift by a few ms: a read due within half a poll period
// runs now, so a 60 s interval does not slip to 90 s.
const POLL_TOLERANCE_MS = DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS / 2;

/** The message shown in the Configuration screen for a failure. */
export function connectionMessage(err) {
  if (err instanceof MissingCredentialsError) return MESSAGES.missingCredentials;
  if (err instanceof VerificationRefusedError) return MESSAGES.verificationRefused;
  if (err instanceof TinecoVerificationRequiredError) return MESSAGES.verificationSent;
  if (err instanceof TinecoAuthError) return MESSAGES.authFailed;
  return MESSAGES.cloudUnreachable;
}

// Failures only the user can fix: no automatic retry until the config changes.
const needsUser = (err) =>
  err instanceof MissingCredentialsError ||
  err instanceof TinecoAuthError ||
  err instanceof TinecoVerificationRequiredError;

export class TinecoIntegration {
  /**
   * @param {object} gladys the SDK instance
   * @param {object} [options] { fetch, now, onChange } — `onChange` is called
   *   when a computed widget content changed (see src/widgets.js)
   */
  constructor(gladys, { fetch, now = Date.now, onChange = () => {} } = {}) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.now = now;
    this.onChange = onChange;
    this.config = normalizeConfig();
    this.session = null;
    this.blocked = false;
    this.connected = undefined;
    // did -> { raw, capabilities, firmware }
    this.appliances = new Map();
    // did -> last parseStatus() (null: offline)
    this.statuses = new Map();
    // did -> state tracked for the scene triggers (src/events.js)
    this.tracked = new Map();
    this.transports = new Map();
    this.lastReads = new Map();
  }

  /**
   * (Re)start with a configuration: sign in, list the appliances, publish
   * them. Called on every (re)connection and configuration update. Never
   * throws: the outcome is the connection status shown to the user.
   */
  async start(rawConfig) {
    this.config = normalizeConfig(rawConfig);
    this.session = new TinecoSession({
      gladys: this.gladys,
      config: this.config,
      fetch: this.fetch,
      now: this.now,
    });
    this.blocked = false;
    this.lastError = null;
    try {
      await this.loadAppliances();
      await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
      await this.publishTransports();
      await this.setConnected(true);
    } catch (err) {
      await this.fail(err);
    }
    this.onChange();
  }

  /**
   * onConfigUpdated: restart only when the user changed a setting. The
   * integration's own writes (session keys, the cleared verification code)
   * must not restart it, should the core echo them back.
   */
  async configUpdated(rawConfig) {
    const next = normalizeConfig(rawConfig);
    const current = this.session?.config ?? this.config;
    const changed = Object.keys(DEFAULT_CONFIG).some((key) => next[key] !== current[key]);
    if (!changed && this.session) {
      Object.assign(this.session.config, next);
      this.config = { ...this.config, ...next };
      return false;
    }
    await this.start(rawConfig);
    return true;
  }

  async setConnected(connected, message) {
    if (this.connected === connected && connected) {
      return;
    }
    this.connected = connected;
    await this.gladys.setConnectionStatus(connected, message);
  }

  async fail(err) {
    this.lastError = err;
    this.blocked = needsUser(err);
    if (err instanceof TinecoVerificationRequiredError) {
      logger.info('Waiting for the Tineco verification code');
    } else {
      logger.error(`Tineco: ${err.message}`);
    }
    this.connected = undefined;
    await this.setConnected(false, connectionMessage(err)).catch(() => {});
  }

  /** Fetch the appliances, and one status each: it decides the optional features. */
  async loadAppliances() {
    const devices = await this.session.connect();
    const known = new Set();
    for (const raw of devices) {
      const ref = tinecoRef(raw);
      if (!ref.did) continue;
      known.add(ref.did);
      const answer = await this.session.status(ref).catch(() => null);
      const previous = this.appliances.get(ref.did);
      const firmware = await this.session
        .versions(ref)
        .then(parseFirmware)
        .catch(() => undefined);
      this.appliances.set(ref.did, {
        raw,
        // Offline at startup: keep what an earlier read found, else the common set.
        capabilities: answer
          ? capabilitiesOf(answer)
          : (previous?.capabilities ?? capabilitiesOf(null)),
        firmware: firmware ?? previous?.firmware,
      });
      await this.applyStatus(ref.did, parseStatus(answer));
    }
    for (const did of this.appliances.keys()) {
      if (!known.has(did)) this.appliances.delete(did);
    }
  }

  discoveredDevices() {
    return [...this.appliances.values()].map(({ raw, capabilities, firmware }) => {
      const device = buildDevice(this.gladys, raw, capabilities, this.config.language);
      if (firmware) device.params.push({ name: 'firmware', value: firmware });
      return device;
    });
  }

  /** Discovery requested by the user: list again, so new appliances show up. */
  async scan() {
    try {
      await this.loadAppliances();
      await this.setConnected(true);
    } catch (err) {
      await this.fail(err);
    }
    await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
  }

  async publishTransports() {
    const entries = [...this.appliances.keys()].map((did) => ({
      external_id: deviceIds(this.gladys, did).device,
      transport: this.transports.get(did) ?? DEVICE_TRANSPORTS.CLOUD,
    }));
    if (entries.length > 0) {
      await this.gladys.publishTransports(entries);
    }
  }

  /**
   * Publish a reading: changed states, transport badge, scene events.
   * @param {object|null} status parseStatus() result, null when offline
   */
  async applyStatus(did, status) {
    const externalId = deviceIds(this.gladys, did).device;
    const previousStatus = this.statuses.get(did);
    this.statuses.set(did, status);

    await this.gladys.publishChangedStates(statesOf(this.gladys, did, status), {
      heartbeat: STATE_HEARTBEAT_MS,
    });

    const transport = status ? DEVICE_TRANSPORTS.CLOUD : DEVICE_TRANSPORTS.UNREACHABLE;
    if (this.transports.get(did) !== transport) {
      this.transports.set(did, transport);
      await this.gladys.publishTransports([{ external_id: externalId, transport }]);
    }

    const { state, events } = trackStatus(this.tracked.get(did), status, this.now(), externalId);
    this.tracked.set(did, state);
    for (const { key, data } of events) {
      logger.info(`Scene event ${key} <- ${externalId}`);
      await this.gladys.publishSceneEvent(key, data);
    }

    if (
      previousStatus === undefined ||
      previousStatus?.activity !== status?.activity ||
      previousStatus?.wasteTankFull !== status?.wasteTankFull ||
      previousStatus?.freshWaterEmpty !== status?.freshWaterEmpty
    ) {
      this.onChange();
    }
  }

  /** Read one appliance now and publish the result. */
  async read(did) {
    const appliance = this.appliances.get(did);
    const ref = appliance ? tinecoRef(appliance.raw) : { did };
    const status = parseStatus(await this.session.status(ref));
    await this.applyStatus(did, status);
    this.lastReads.set(did, this.now());
    return status;
  }

  /**
   * onPoll: read the device at the interval the user chose. Gladys polls
   * every 30 s; the reads in between are skipped. Resolves true when read.
   */
  async poll(device) {
    if (this.blocked || !this.session) {
      return false;
    }
    const { did } = refOfDevice(this.gladys, device);
    if (!did) {
      return false;
    }
    const lastRead = this.lastReads.get(did);
    if (
      lastRead !== undefined &&
      this.now() - lastRead < this.config.poll_frequency * 1000 - POLL_TOLERANCE_MS
    ) {
      return false;
    }
    try {
      await this.read(did);
      await this.setConnected(true);
    } catch (err) {
      // Tried again at the next poll (or after a config change for the
      // failures only the user can fix).
      this.lastReads.set(did, this.now());
      await this.fail(err);
    }
    return true;
  }

  /** onSetValue: send a command, then publish the value the appliance accepted. */
  async setValue(device, feature, value) {
    const key = featureKeyOf(feature.external_id);
    const payload = commandOf(key, value);
    if (!payload) {
      throw new Error(`The feature ${key} cannot be controlled`);
    }
    const ref = refOfDevice(this.gladys, device);
    await this.command(ref.did, payload);
    await this.gladys.publishState(feature.external_id, Number(value));
  }

  /**
   * Send a `cfp` command to an appliance.
   * @throws when the appliance is unknown or did not answer
   */
  async command(did, payload) {
    if (!this.session) {
      throw new Error(MESSAGES.missingCredentials.en);
    }
    const appliance = this.appliances.get(did);
    const ref = appliance ? tinecoRef(appliance.raw) : { did };
    logger.info(`Command ${JSON.stringify(payload)} -> ${did}`);
    if (!(await this.session.command(ref, payload))) {
      throw new Error(MESSAGES.deviceOffline.en);
    }
  }

  /** The did of a device external_id chosen in a `"source": "devices"` select. */
  didOf(externalId) {
    return refOfDevice(this.gladys, { external_id: externalId }).did;
  }

  // --- Manifest actions (Configuration screen) ---------------------------------

  /** `test_connection`: sign in again and say what was found. */
  async testConnection() {
    await this.start(this.config);
    if (!this.connected) {
      return this.lastError ? connectionMessage(this.lastError) : MESSAGES.cloudUnreachable;
    }
    const names = [...this.appliances.values()].map(({ raw }) => displayName(raw));
    return names.length > 0 ? devicesFound(names) : MESSAGES.noDevice;
  }

  /** `send_verification_code`: e-mail a new code. */
  async sendVerificationCode() {
    if (!this.session) {
      return MESSAGES.missingCredentials;
    }
    try {
      await this.session.connect();
      await this.setConnected(true);
      return MESSAGES.noCodeNeeded;
    } catch (err) {
      if (err instanceof TinecoVerificationRequiredError) {
        // connect() only sends a code when none is recent: the user asked.
        await this.session.sendVerificationCode();
        await this.setConnected(false, MESSAGES.verificationSent);
        return MESSAGES.codeSent;
      }
      if (err instanceof VerificationRefusedError) {
        await this.session.store({ verification_code: '' });
        await this.session.sendVerificationCode();
        await this.setConnected(false, MESSAGES.verificationSent);
        return MESSAGES.codeSent;
      }
      await this.fail(err);
      return connectionMessage(err);
    }
  }
}
