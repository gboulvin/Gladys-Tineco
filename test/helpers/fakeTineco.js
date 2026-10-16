// -----------------------------------------------------------------------------
// An in-memory Tineco cloud behind a fake `fetch`: the account, open and IoT
// APIs the client talks to, with just enough behavior for the tests (new
// device verification, offline appliances, commands). No network.
// -----------------------------------------------------------------------------

import { md5 } from '../../src/tineco/api.js';

export const ACCOUNT = { email: 'me@example.com', password: 'secret' };

export const S7_FLASHDRY = {
  did: '00000000-0000-0000-0000-000000000001',
  className: '9uened',
  resource: 'T033',
  nick: 'Floor One-1580',
  productType: 'S7 Flashdry',
};

export const S5_COMBO = {
  did: '00000000-0000-4000-8000-000000000033',
  className: '4mssss',
  resource: '4HL1',
  nick: 'Kitchen',
  productType: 'Floor One S5 Combo',
};

// Captured payloads (scrubbed), see src/tineco/status.js.
export const S7_IDLE = {
  selectmode: 0,
  wheel: 2,
  cleanway: 1,
  led: 0,
  msr: 0,
  vl: 1,
  wp: 90,
  wm: 1,
  dv: 0,
  bp: 93,
  vs: 1,
  e1: 0,
  e2: 0,
  e3: 0,
};
export const S5_CHARGED = {
  cds: 0,
  wm: 2,
  scm: 0,
  cnv: 0,
  scs: 0,
  smr: 0,
  sr: 2,
  dv: 0,
  bp: 240,
  bc: 2500,
  msr: 0,
  vl: 4,
  vs: 2,
  e: 0,
  cc: 0,
};

const json = (body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/**
 * @param {object} [options]
 * @param {boolean} [options.verified] whether the app device id is already verified
 * @param {object[]} [options.devices]
 * @param {Record<string, object|null>} [options.statuses] did -> gci payload (null: offline)
 */
export function createFakeTineco({
  verified = true,
  devices = [S7_FLASHDRY],
  statuses = { [S7_FLASHDRY.did]: S7_IDLE },
} = {}) {
  const cloud = {
    verified,
    devices,
    statuses,
    code: '424242',
    calls: [],
    commands: [],
    emailsSent: 0,
    accessToken: 'account-token',
    iotToken: 'iot-token',
  };

  cloud.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams);
    cloud.calls.push({ host: url.host, path, query });

    if (url.host.endsWith('-api.tineco.com')) {
      if (path.endsWith('/user/login')) {
        if (query.account !== ACCOUNT.email || query.password !== md5(ACCOUNT.password)) {
          return json({ code: '1005', msg: 'wrong password' });
        }
        if (!cloud.verified) return json({ code: '10001', msg: 'new device' });
        return json({ code: '0000', data: { uid: 'uid-1', accessToken: cloud.accessToken } });
      }
      if (path.endsWith('/user/sendEmailVerifyCode')) {
        cloud.emailsSent += 1;
        return json({ code: '0000', data: { verifyId: `verify-${cloud.emailsSent}` } });
      }
      if (path.endsWith('/user/quickLoginByEmail')) {
        if (query.verifyCode !== cloud.code) return json({ code: '2003', msg: 'bad code' });
        cloud.verified = true;
        return json({ code: '0000', data: { uid: 'uid-1', accessToken: cloud.accessToken } });
      }
    }

    if (url.host.endsWith('-openapi.tineco.com')) {
      if (query.accessToken !== cloud.accessToken) {
        return json({ code: '1004', msg: 'token expired' });
      }
      if (path.endsWith('/auth/getAuthCode')) {
        return json({ code: '0000', data: { authCode: 'auth-code' } });
      }
      if (path.endsWith('/device/getDeviceListV2')) {
        return json({ code: '0000', payload: { deviceList: cloud.devices } });
      }
    }

    if (url.host === 'api-base.robotww.ecouser.net') {
      return json({ code: 0, data: { dc: 'eu' } });
    }
    if (url.host === 'api-base.dc-eu.ww.ecouser.net') {
      return json({ result: 'ok', token: cloud.iotToken, resource: 'res', userId: 'uid-1' });
    }
    if (url.host === 'api-ngiot.dc-eu.ww.ecouser.net') {
      const status = cloud.statuses[query.eid];
      if (!status || init.headers?.Authorization !== `Bearer ${cloud.iotToken}`) {
        return new Response('', { status: 200, headers: { 'X-NGIOT-RET': 'fail' } });
      }
      if (query.apn === 'cfp') {
        cloud.commands.push({ did: query.eid, payload: JSON.parse(init.body) });
        return json({ ret: 'ok' }, { 'X-NGIOT-RET': 'ok' });
      }
      if (query.apn === 'gav') {
        return json({ vv: '1.0.5\u0000', tv: '1.2.3' }, { 'X-NGIOT-RET': 'ok' });
      }
      return json(status, { 'X-NGIOT-RET': 'ok' });
    }

    return new Response('not found', { status: 404 });
  };

  return cloud;
}
