// -----------------------------------------------------------------------------
// Tineco session: sign-in, e-mail verification, IoT session and its renewal.
//
// Tineco treats the integration like a phone running its app, identified by
// an "app device id". The first sign-in of an id needs a code Tineco e-mails
// to the account; the id is therefore generated ONCE and kept, with the
// account session, in the integration's own config keys (gladys.setConfig,
// keys outside the config_schema: never displayed, kept across container
// re-creations, unlike memory). Losing the id would ask for a new code.
//
// The account token survives restarts; the IoT token is short-lived and
// re-derived from it (getAuthCode + iotLogin) when the appliances stop
// answering for a while.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  TinecoApi,
  TinecoAuthError,
  TinecoError,
  TinecoVerificationRequiredError,
  generateAppDeviceId,
} from './api.js';

const logger = createLogger({ name: 'tineco-session' });

// Internal config keys (NOT in the config_schema).
export const STORE_KEYS = {
  APP_DEVICE_ID: 'tineco_app_device_id',
  ACCOUNT: 'tineco_account',
  UID: 'tineco_uid',
  ACCESS_TOKEN: 'tineco_access_token',
  VERIFY_ID: 'tineco_verify_id',
  VERIFY_SENT_AT: 'tineco_verify_sent_at',
};

// One verification e-mail per quarter-hour at most: reconnections and
// restarts must not flood the user's mailbox.
const VERIFICATION_RESEND_MS = 15 * 60 * 1000;
// Renew the IoT session when a device stops answering, at most this often.
const IOT_RENEW_MIN_MS = 10 * 60 * 1000;

export class MissingCredentialsError extends TinecoError {
  constructor() {
    super('Tineco e-mail or password missing');
    this.name = 'MissingCredentialsError';
  }
}

/** Tineco refused the code typed by the user. */
export class VerificationRefusedError extends TinecoAuthError {
  constructor(message) {
    super(message);
    this.name = 'VerificationRefusedError';
  }
}

export class TinecoSession {
  /**
   * @param {object} options
   * @param {object} options.gladys   the SDK instance (setConfig)
   * @param {object} options.config   normalized config (internal keys included)
   * @param {Function} [options.fetch]
   * @param {Function} [options.now]
   */
  constructor({ gladys, config, fetch, now = Date.now }) {
    this.gladys = gladys;
    this.config = { ...config };
    this.fetch = fetch;
    this.now = now;
    this.api = null;
    this.account = null; // { uid, accessToken }
    this.iot = null; // { token, resource, userId, at }
    this.devices = [];
    this.connecting = null;
  }

  accountKey() {
    return `${this.config.email.toLowerCase()}|${this.config.region}`;
  }

  async store(values) {
    Object.assign(this.config, values);
    await this.gladys.setConfig(values);
  }

  /** Sign in (if needed) and list the appliances. Concurrent calls share one attempt. */
  connect() {
    if (!this.connecting) {
      this.connecting = this.doConnect().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  async doConnect() {
    const { email, password } = this.config;
    if (!email || !password) {
      throw new MissingCredentialsError();
    }
    if (!this.config[STORE_KEYS.APP_DEVICE_ID]) {
      await this.store({ [STORE_KEYS.APP_DEVICE_ID]: generateAppDeviceId() });
    }
    this.api = new TinecoApi({
      region: this.config.region,
      appDeviceId: this.config[STORE_KEYS.APP_DEVICE_ID],
      fetch: this.fetch,
      now: this.now,
    });

    // 1) The stored account session, if it belongs to this account.
    const storedUid = this.config[STORE_KEYS.UID];
    const storedToken = this.config[STORE_KEYS.ACCESS_TOKEN];
    if (storedUid && storedToken && this.config[STORE_KEYS.ACCOUNT] === this.accountKey()) {
      try {
        this.account = { uid: storedUid, accessToken: storedToken };
        await this.openIot();
        return this.devices;
      } catch (err) {
        if (!(err instanceof TinecoAuthError)) {
          throw err;
        }
        logger.info('Stored Tineco session expired, signing in again');
      }
    }

    // 2) A fresh sign-in.
    this.account = await this.signIn();
    await this.store({
      [STORE_KEYS.ACCOUNT]: this.accountKey(),
      [STORE_KEYS.UID]: this.account.uid,
      [STORE_KEYS.ACCESS_TOKEN]: this.account.accessToken,
    });
    await this.openIot();
    return this.devices;
  }

  async signIn() {
    const { email, password, verification_code: code } = this.config;
    try {
      return await this.api.login(email, password);
    } catch (err) {
      if (!(err instanceof TinecoVerificationRequiredError)) {
        throw err;
      }
    }
    // First sign-in of this app device id: Tineco wants the e-mailed code.
    const verifyId = this.config[STORE_KEYS.VERIFY_ID];
    if (code && verifyId) {
      try {
        const account = await this.api.loginWithCode(email, verifyId, code);
        // The code is single-use: forget it, so the form does not keep a stale one.
        await this.store({ [STORE_KEYS.VERIFY_ID]: '', verification_code: '' });
        logger.info('Tineco app device verified');
        return account;
      } catch (err) {
        if (err instanceof TinecoAuthError) {
          throw new VerificationRefusedError(err.message);
        }
        throw err;
      }
    }
    const sentAt = Number(this.config[STORE_KEYS.VERIFY_SENT_AT]) || 0;
    if (!verifyId || this.now() - sentAt > VERIFICATION_RESEND_MS) {
      await this.sendVerificationCode();
    }
    throw new TinecoVerificationRequiredError();
  }

  /** E-mail a new verification code (the "Send a new code" button). */
  async sendVerificationCode() {
    if (!this.api) {
      throw new MissingCredentialsError();
    }
    const verifyId = await this.api.sendVerificationCode(this.config.email);
    await this.store({
      [STORE_KEYS.VERIFY_ID]: verifyId,
      [STORE_KEYS.VERIFY_SENT_AT]: this.now(),
    });
    logger.info('Tineco verification code sent by e-mail');
  }

  async openIot() {
    const authCode = await this.api.getAuthCode(this.account);
    const iot = await this.api.iotLogin(this.account.uid, authCode);
    this.iot = { ...iot, at: this.now() };
    this.devices = await this.api.getDevices(this.account, this.iot);
    logger.info(`Tineco session open, ${this.devices.length} appliance(s)`);
  }

  async ensureConnected() {
    if (!this.iot) {
      await this.connect();
    }
  }

  /** Renew the IoT session, unless it is recent. Resolves true when renewed. */
  async renewIot() {
    if (this.iot && this.now() - this.iot.at < IOT_RENEW_MIN_MS) {
      return false;
    }
    try {
      await this.openIot();
    } catch (err) {
      if (!(err instanceof TinecoAuthError)) {
        throw err;
      }
      // The account token itself expired: full sign-in.
      this.iot = null;
      await this.connect();
    }
    return true;
  }

  /**
   * Query (or command, with a payload) one appliance.
   * @param {{ did: string, className?: string, resource?: string }} device
   * @returns {Promise<object|null>} null when the appliance did not answer
   */
  async call(device, apn, payload) {
    await this.ensureConnected();
    const answer = await this.api.iotCall(this.iot, device, apn, payload);
    if (answer !== null) {
      return answer;
    }
    // No answer: the appliance is offline, or the IoT token expired (the
    // platform does not tell them apart). Renew once in a while and retry.
    if (await this.renewIot()) {
      return this.api.iotCall(this.iot, device, apn, payload);
    }
    return null;
  }

  /** The status payload (`gci`) of an appliance, null when offline. */
  status(device) {
    return this.call(device, 'gci');
  }

  /** The firmware versions (`gav`) of an appliance, null when offline. */
  versions(device) {
    return this.call(device, 'gav');
  }

  /** Set values on an appliance (`cfp`). Resolves false when it did not answer. */
  async command(device, values) {
    const answer = await this.call(device, 'cfp', values);
    return answer !== null;
  }
}
