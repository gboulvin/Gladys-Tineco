import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TinecoApi,
  TinecoAuthError,
  TinecoVerificationRequiredError,
  describeShape,
  extractDevices,
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

async function listDevices(cloud) {
  const client = api(cloud);
  const account = await client.login(ACCOUNT.email, ACCOUNT.password);
  const iot = await client.iotLogin(account.uid, await client.getAuthCode(account));
  return { client, devices: await client.getDevices(account, iot) };
}

test('an empty cached device list is asked again with refresh=true', async () => {
  const cloud = createFakeTineco();
  cloud.deviceListAnswer = (refresh) =>
    refresh
      ? { code: '0000', payload: { deviceList: [S7_FLASHDRY] } }
      : { code: '0000', payload: { deviceList: [] } };
  const { devices } = await listDevices(cloud);
  assert.deepEqual(devices, [S7_FLASHDRY]);
  const refreshes = cloud.calls
    .filter((c) => c.path.endsWith('/getDeviceListV2'))
    .map((c) => c.query.refresh);
  assert.deepEqual(refreshes, ['false', 'true']);
});

test('the devices are listed for the IoT user id, not the account uid', async () => {
  const cloud = createFakeTineco();
  const { devices } = await listDevices(cloud);
  assert.deepEqual(devices, [S7_FLASHDRY]);
  const call = cloud.calls.find((c) => c.path.endsWith('/getDeviceListV2'));
  assert.equal(call.query.uid, 'iot-uid-1');
  assert.equal(call.query.userId, 'iot-uid-1');
});

test('an IoT login answering the account uid itself still lists the devices', async () => {
  const cloud = createFakeTineco();
  cloud.iotUserId = 'uid-1'; // the IoT login answers the account uid itself
  const { devices } = await listDevices(cloud);
  assert.deepEqual(devices, [S7_FLASHDRY]);
});

test('appliances are found under data, grouped, or keyed deviceId', () => {
  const grouped = {
    code: '0000',
    payload: {},
    data: {
      groups: [
        { name: 'Home', userDeviceList: [S7_FLASHDRY] },
        { name: 'Flat', list: [{ deviceId: 'abc', nick: 'Other' }, S7_FLASHDRY] },
      ],
    },
  };
  assert.deepEqual(extractDevices(grouped), [
    S7_FLASHDRY,
    { deviceId: 'abc', nick: 'Other', did: 'abc' },
  ]);
  assert.deepEqual(extractDevices({ code: '0000', payload: { deviceList: [] } }), []);
});

test('an empty list keeps a value-free description of the answer for the logs', async () => {
  const cloud = createFakeTineco();
  cloud.deviceListAnswer = () => ({
    code: '0000',
    msg: 'success',
    payload: { deviceList: [], shareList: [{ owner: 'me@example.com' }] },
  });
  const { client, devices } = await listDevices(cloud);
  assert.deepEqual(devices, []);
  assert.equal(
    client.lastDeviceListShape,
    '{ code: "0000", msg: "success", payload: { deviceList: [], shareList: [1 x { owner: string }] } } (user ids tried: 2)',
  );
  assert.ok(!client.lastDeviceListShape.includes('example.com'));
  assert.equal(describeShape(null), 'null');
});
