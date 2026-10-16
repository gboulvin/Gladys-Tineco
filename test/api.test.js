import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TinecoApi,
  TinecoAuthError,
  TinecoVerificationRequiredError,
  generateAppDeviceId,
  md5,
  sign,
} from '../src/tineco/api.js';
import { ACCOUNT, S7_FLASHDRY, S7_IDLE, createFakeTineco } from './helpers/fakeTineco.js';

const api = (cloud, region = 'FR') =>
  new TinecoApi({ region, appDeviceId: 'a'.repeat(32), fetch: cloud.fetch, now: () => 1_000 });

test('the signature is the MD5 of key, sorted pairs and secret', () => {
  assert.equal(sign('K', 'S', { b: 2, a: 1 }), md5('Ka=1b=2S'));
  assert.match(generateAppDeviceId(), /^[0-9a-f]{32}$/);
});

test('login reaches the regional host and sends the MD5 of the password', async () => {
  const cloud = createFakeTineco();
  const session = await api(cloud).login(ACCOUNT.email, ACCOUNT.password);
  assert.deepEqual(session, { uid: 'uid-1', accessToken: 'account-token' });
  const [call] = cloud.calls;
  assert.equal(call.host, 'qas-gl-fr-api.tineco.com');
  assert.equal(call.query.password, md5(ACCOUNT.password));
  assert.equal(call.query.account, ACCOUNT.email);
  assert.ok(call.query.authSign);
});

test('a wrong password is an auth error, a new device asks for verification', async () => {
  const cloud = createFakeTineco({ verified: false });
  await assert.rejects(api(cloud).login(ACCOUNT.email, 'nope'), TinecoAuthError);
  await assert.rejects(
    api(cloud).login(ACCOUNT.email, ACCOUNT.password),
    TinecoVerificationRequiredError,
  );
  const verifyId = await api(cloud).sendVerificationCode(ACCOUNT.email);
  await assert.rejects(
    api(cloud).loginWithCode(ACCOUNT.email, verifyId, '000000'),
    TinecoAuthError,
  );
  const session = await api(cloud).loginWithCode(ACCOUNT.email, verifyId, ' 424242 ');
  assert.equal(session.uid, 'uid-1');
});

test('the IoT chain lists the devices and reads a status', async () => {
  const cloud = createFakeTineco();
  const client = api(cloud);
  const account = await client.login(ACCOUNT.email, ACCOUNT.password);
  const iot = await client.iotLogin(account.uid, await client.getAuthCode(account));
  const devices = await client.getDevices(account, iot);
  assert.deepEqual(devices, [S7_FLASHDRY]);
  assert.deepEqual(await client.iotCall(iot, S7_FLASHDRY, 'gci'), S7_IDLE);
  const query = cloud.calls.at(-1).query;
  assert.equal(query.eid, S7_FLASHDRY.did);
  assert.equal(query.et, S7_FLASHDRY.className);
  assert.equal(query.er, S7_FLASHDRY.resource);
});

test('an appliance that does not answer reads null', async () => {
  const cloud = createFakeTineco({ statuses: {} });
  const client = api(cloud);
  assert.equal(await client.iotCall({ token: 'iot-token' }, S7_FLASHDRY, 'gci'), null);
});

test('an expired account token is an auth error', async () => {
  const cloud = createFakeTineco();
  await assert.rejects(
    api(cloud).getAuthCode({ uid: 'uid-1', accessToken: 'old' }),
    TinecoAuthError,
  );
});

test('the datacenter falls back to the region when the lookup fails', async () => {
  const client = new TinecoApi({
    region: 'US',
    appDeviceId: 'a'.repeat(32),
    fetch: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(await client.resolveDatacenter(), 'na');
});
