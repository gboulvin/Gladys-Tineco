// -----------------------------------------------------------------------------
// The whole runtime against the SDK's fake Gladys (which refuses the payloads
// the real host API refuses) and a fake Tineco cloud.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { TinecoIntegration } from '../src/integration.js';
import { FEATURES, deviceIds } from '../src/devices.js';
import { STORE_KEYS } from '../src/tineco/session.js';
import { MESSAGES } from '../src/i18n.js';
import {
  ACCOUNT,
  S5_CHARGED,
  S5_COMBO,
  S7_FLASHDRY,
  S7_IDLE,
  createFakeTineco,
} from './helpers/fakeTineco.js';

const CONFIG = { email: ACCOUNT.email, password: ACCOUNT.password, region: 'FR' };

async function setup({ cloud = createFakeTineco(), config = CONFIG } = {}) {
  const gladys = createFakeGladys({ config });
  await gladys.connect();
  let clock = 1_000_000;
  const changes = [];
  const tineco = new TinecoIntegration(gladys, {
    fetch: cloud.fetch,
    now: () => clock,
    onChange: () => changes.push(clock),
  });
  return {
    gladys,
    cloud,
    tineco,
    changes,
    tick: (ms) => {
      clock += ms;
    },
  };
}

const createdDevice = (gladys) => gladys.fake.discoveredDevices[0];
const feature = (gladys, key) =>
  createdDevice(gladys).features.find((f) => f.external_id.endsWith(`:${key}`));

test('start signs in, publishes the appliances Gladys accepts, and reports connected', async () => {
  const { gladys, tineco } = await setup({
    cloud: createFakeTineco({
      devices: [S7_FLASHDRY, S5_COMBO],
      statuses: { [S7_FLASHDRY.did]: S7_IDLE, [S5_COMBO.did]: S5_CHARGED },
    }),
  });
  await tineco.start(CONFIG);

  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  const devices = gladys.fake.discoveredDevices;
  assert.equal(devices.length, 2);
  assert.equal(devices[0].name, 'Floor One-1580');
  assert.equal(devices[0].model, 'S7 Flashdry');
  // The S5 Combo has no brush light: no such feature.
  const keys = (device) => device.features.map((f) => f.external_id.split(':').at(-1));
  assert.ok(keys(devices[0]).includes(FEATURES.BRUSH_LIGHT));
  assert.ok(!keys(devices[1]).includes(FEATURES.BRUSH_LIGHT));
  assert.ok(devices[0].params.some((p) => p.name === 'firmware' && p.value === '1.2.3'));

  // The app device id and the session are kept for the next start.
  assert.match(gladys.fake.config[STORE_KEYS.APP_DEVICE_ID], /^[0-9a-f]{32}$/);
  assert.equal(gladys.fake.config[STORE_KEYS.ACCESS_TOKEN], 'account-token');
});

test('the device names follow the configured language', async () => {
  const { gladys, tineco } = await setup();
  await tineco.start({ ...CONFIG, language: 'fr' });
  assert.equal(feature(gladys, FEATURES.BATTERY).name, 'Batterie');
  const activity = feature(gladys, FEATURES.ACTIVITY);
  assert.ok(activity.supported_options.some((o) => o.label === 'Auto-nettoyage'));
});

test('a restart reuses the stored session instead of signing in again', async () => {
  const { gladys, cloud, tineco } = await setup();
  await tineco.start(CONFIG);
  const logins = () => cloud.calls.filter((c) => c.path.endsWith('/user/login')).length;
  assert.equal(logins(), 1);
  await tineco.start(gladys.fake.config);
  assert.equal(logins(), 1);
});

test('first sign-in: a code is e-mailed once, then the typed code connects', async () => {
  const cloud = createFakeTineco({ verified: false });
  const { gladys, tineco, tick } = await setup({ cloud });

  await tineco.start(CONFIG);
  assert.equal(cloud.emailsSent, 1);
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: MESSAGES.verificationSent,
  });

  // Blocked until the user acts: polls do not hammer the cloud.
  const calls = cloud.calls.length;
  assert.equal(await tineco.poll({ external_id: 'x', params: [] }), false);
  // A restart within the quarter-hour does not send another e-mail.
  tick(60_000);
  await tineco.start(gladys.fake.config);
  assert.equal(cloud.emailsSent, 1);
  assert.ok(cloud.calls.length > calls);

  // A wrong code is refused with a clear message.
  await tineco.start({ ...gladys.fake.config, verification_code: '000000' });
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.verificationRefused);

  await tineco.start({ ...gladys.fake.config, verification_code: '424242' });
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  assert.equal(gladys.fake.config.verification_code, '', 'the single-use code is cleared');
});

test('the "send a new code" button e-mails a code on demand', async () => {
  const cloud = createFakeTineco({ verified: false });
  const { gladys, tineco } = await setup({ cloud });
  await tineco.start(CONFIG);
  const message = await tineco.sendVerificationCode();
  assert.deepEqual(message, MESSAGES.codeSent);
  assert.equal(cloud.emailsSent, 2);
  assert.equal(gladys.fake.connectionStatus.connected, false);
});

test('wrong credentials and missing credentials are reported', async () => {
  const { gladys, tineco } = await setup();
  await tineco.start({ ...CONFIG, password: 'nope' });
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.authFailed);
  await tineco.start({ region: 'FR' });
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.missingCredentials);
});

test('polls follow the refresh interval and publish the states', async () => {
  const cloud = createFakeTineco();
  const { gladys, tineco, tick } = await setup({ cloud });
  await tineco.start(CONFIG);
  const device = createdDevice(gladys);

  // Already read at start: the next poll is due after the interval.
  tineco.lastReads.set(S7_FLASHDRY.did, 1_000_000);
  tick(30_000);
  assert.equal(await tineco.poll(device), false);
  tick(30_000);
  cloud.statuses[S7_FLASHDRY.did] = { ...S7_IDLE, wm: 3, bp: 80, e2: 256 };
  assert.equal(await tineco.poll(device), true);

  const ids = deviceIds(gladys, S7_FLASHDRY.did);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.BATTERY)), 80);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.STATE)), 1);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.ACTIVITY)), 'cleaning');
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.WASTE_WATER)), 2);
  assert.deepEqual(
    gladys.fake.sceneEvents.map((e) => e.key),
    ['cleaning_started', 'tank_alert'],
  );
});

test('an appliance going offline gets the unreachable badge and the offline activity', async () => {
  const cloud = createFakeTineco();
  const { gladys, tineco, tick } = await setup({ cloud });
  await tineco.start(CONFIG);
  delete cloud.statuses[S7_FLASHDRY.did];
  tick(120_000);
  await tineco.poll(createdDevice(gladys));
  const ids = deviceIds(gladys, S7_FLASHDRY.did);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.ACTIVITY)), 'offline');
  assert.equal(gladys.fake.transports.at(-1).transport, 'unreachable');
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true }, 'the account is fine');
});

test('an expired account token is renewed by a fresh sign-in', async () => {
  const cloud = createFakeTineco();
  const { gladys, tineco, tick } = await setup({ cloud });
  await tineco.start(CONFIG);
  // Tineco rotates both tokens: the stored ones are now refused.
  cloud.accessToken = 'account-token-2';
  cloud.iotToken = 'iot-token-2';
  tick(15 * 60_000);
  await tineco.poll(createdDevice(gladys));
  assert.equal(gladys.fake.config[STORE_KEYS.ACCESS_TOKEN], 'account-token-2');
  const ids = deviceIds(gladys, S7_FLASHDRY.did);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.ACTIVITY)), 'standby');
});

test('commands go to the appliance and the accepted value is published', async () => {
  const cloud = createFakeTineco();
  const { gladys, tineco } = await setup({ cloud });
  await tineco.start(CONFIG);
  const device = createdDevice(gladys);
  await tineco.setValue(device, feature(gladys, FEATURES.BRUSH_LIGHT), 0);
  await tineco.setValue(device, feature(gladys, FEATURES.VOLUME), 3);
  await tineco.setValue(device, feature(gladys, FEATURES.VOICE_PROMPTS), 0);
  assert.deepEqual(
    cloud.commands.map((c) => c.payload),
    [{ led: 1 }, { vl: 3 }, { ms: 1 }],
  );
  assert.equal(gladys.fake.lastState(feature(gladys, FEATURES.VOLUME).external_id), 3);
  await assert.rejects(tineco.setValue(device, feature(gladys, FEATURES.BATTERY), 1));
});

test('a command to an offline appliance fails with a clear message', async () => {
  const cloud = createFakeTineco();
  const { gladys, tineco } = await setup({ cloud });
  await tineco.start(CONFIG);
  delete cloud.statuses[S7_FLASHDRY.did];
  await assert.rejects(
    tineco.setValue(createdDevice(gladys), feature(gladys, FEATURES.VOLUME), 2),
    new RegExp(MESSAGES.deviceOffline.en),
  );
});

test('the test button lists the appliances', async () => {
  const { tineco } = await setup();
  await tineco.start(CONFIG);
  const message = await tineco.testConnection();
  assert.match(message.fr, /1 appareil\(s\) trouvé\(s\) \(Floor One-1580\)/);
});

test("a config update that only echoes the integration's own keys does not restart it", async () => {
  const { gladys, cloud, tineco } = await setup();
  await tineco.start(CONFIG);
  const calls = cloud.calls.length;
  assert.equal(await tineco.configUpdated({ ...gladys.fake.config }), false);
  assert.equal(cloud.calls.length, calls);
  assert.equal(await tineco.configUpdated({ ...gladys.fake.config, poll_frequency: 120 }), true);
  assert.equal(tineco.config.poll_frequency, 120);
});
