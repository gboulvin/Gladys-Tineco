// -----------------------------------------------------------------------------
// Tineco cloud API client.
//
// Tineco publishes no public API: this client speaks the protocol of the
// official Tineco app, as documented by the community (reverse-engineered
// clients, e.g. wheeller123/Tineco-HACS-Integration). Three services are
// involved:
//
//   1. the Tineco account API (`qas-gl-<region>-api.tineco.com`): e-mail +
//      MD5(password) login, with an e-mail code the first time a new "phone"
//      (our app device id) signs in;
//   2. the Tineco open API (`qas-gl-<region>-openapi.tineco.com`): exchanges the
//      account token for an auth code, and lists the account's devices;
//   3. the IoT platform the appliances are connected to (Ecovacs' ecouser.net):
//      login with the auth code, then one HTTP call per query / command.
//
// Every request of (1) and (2) is signed: MD5(appKey + sorted "k=v" pairs +
// appSecret). The keys below are the public ones embedded in the app.
//
// No dependency: global fetch (Node 22+) and node:crypto. `fetch` is
// injectable so the tests never touch the network.
// -----------------------------------------------------------------------------

import { createHash, randomBytes, randomUUID } from 'node:crypto';

const ACCOUNT_APP_KEY = '1538105560006';
const ACCOUNT_APP_SECRET = 'fb7045ebb8ae5297bca45cbf5a5597ab';
const OPEN_APP_KEY = '1538103661113';
const OPEN_APP_SECRET = '197472fcef3935ebc330657266992b99';

const APP_CODE = 'global_e';
const APP_VERSION = '1.7.0';
const STORE = 'google_play';
const LANG = 'EN_US';

const REQUEST_TIMEOUT_MS = 15_000;

// Success codes of the Tineco account / open APIs.
const OK = '0000';
// The account API answers this code when the app device id signs in for the
// first time: the user must confirm with a code sent by e-mail.
const NEW_DEVICE = '10001';

// Region -> timezone sent with the login (the app sends the phone's).
const REGION_TIMEZONES = {
  AT: 'Europe/Vienna',
  AU: 'Australia/Sydney',
  BE: 'Europe/Brussels',
  CA: 'America/Toronto',
  CH: 'Europe/Zurich',
  DE: 'Europe/Berlin',
  ES: 'Europe/Madrid',
  FR: 'Europe/Paris',
  GB: 'Europe/London',
  IE: 'Europe/Dublin',
  IT: 'Europe/Rome',
  LU: 'Europe/Luxembourg',
  NL: 'Europe/Amsterdam',
  PL: 'Europe/Warsaw',
  PT: 'Europe/Lisbon',
  US: 'America/New_York',
};

// IoT datacenter fallback when the lookup fails (Europe otherwise).
const REGION_DATACENTERS = { US: 'na', CA: 'na', AU: 'as' };

export class TinecoError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = 'TinecoError';
    this.code = code;
  }
}

/** Wrong e-mail or password, or an account the region does not know. */
export class TinecoAuthError extends TinecoError {
  constructor(message, options) {
    super(message, options);
    this.name = 'TinecoAuthError';
  }
}

/** Tineco wants the e-mail code confirming this new app device. */
export class TinecoVerificationRequiredError extends TinecoError {
  constructor(message = 'Tineco asks for an e-mail verification code') {
    super(message, { code: NEW_DEVICE });
    this.name = 'TinecoVerificationRequiredError';
  }
}

export const md5 = (text) => createHash('md5').update(text, 'utf8').digest('hex');

/** A random app device id (32 hex characters, the format the app uses). */
export function generateAppDeviceId() {
  return md5(randomUUID());
}

/** Short random id the IoT platform uses to match a request and its answer. */
function requestId() {
  return randomBytes(8).toString('hex');
}

/**
 * Sign the parameters of an account / open API request: MD5 of the app key,
 * the `k=v` pairs sorted as strings, and the app secret.
 */
export function sign(appKey, appSecret, params) {
  const pairs = Object.entries(params)
    .map(([key, value]) => `${key}=${value ?? ''}`)
    .sort();
  return md5(appKey + pairs.join('') + appSecret);
}

// The account API expects this light encoding (not a full URI encoding: an
// `@` stays as is), the one the app produces.
function encodeValue(value) {
  return String(value ?? '')
    .replace(/%/g, '%25')
    .replace(/ /g, '%20')
    .replace(/\+/g, '%2B')
    .replace(/\//g, '%2F')
    .replace(/&/g, '%26');
}

function queryString(params) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeValue(value)}`)
    .join('&');
}

export class TinecoApi {
  /**
   * @param {object} options
   * @param {string} options.region       ISO country of the Tineco account (e.g. 'FR')
   * @param {string} options.appDeviceId  stable id of this "phone" (see generateAppDeviceId)
   * @param {Function} [options.fetch]    fetch implementation (tests)
   * @param {Function} [options.now]      clock in ms (tests)
   */
  constructor({ region, appDeviceId, fetch: fetchImpl = globalThis.fetch, now = Date.now }) {
    this.region = String(region || 'FR').toUpperCase();
    this.appDeviceId = appDeviceId;
    this.fetch = fetchImpl;
    this.now = now;
    this.timezone = REGION_TIMEZONES[this.region] ?? 'Europe/Paris';
    this.accountHost = `https://qas-gl-${this.region.toLowerCase()}-api.tineco.com`;
    this.openHost = `https://qas-gl-${this.region.toLowerCase()}-openapi.tineco.com`;
    this.datacenter = null;
  }

  async request(url, init = {}) {
    let response;
    try {
      response = await this.fetch(url, {
        ...init,
        headers: { 'User-Agent': 'okhttp/3.12.0', ...init.headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new TinecoError(`Tineco cloud unreachable: ${err.message}`);
    }
    if (!response.ok) {
      throw new TinecoError(`Tineco cloud answered HTTP ${response.status}`, {
        code: response.status,
      });
    }
    return response;
  }

  async requestJson(url, init) {
    const response = await this.request(url, init);
    const text = await response.text();
    try {
      return { response, body: text ? JSON.parse(text) : {} };
    } catch {
      throw new TinecoError('Tineco cloud answered an invalid JSON body');
    }
  }

  // --- Account API ------------------------------------------------------------

  // Common signed parameters of the account API, part of the signature but
  // carried by the URL path rather than the query string.
  accountContext() {
    return {
      authTimespan: this.now(),
      authTimeZone: this.timezone,
      country: this.region,
      lang: LANG,
      appCode: APP_CODE,
      appVersion: APP_VERSION,
      deviceId: this.appDeviceId,
      channel: STORE,
      deviceType: 1,
    };
  }

  async accountCall(endpoint, params) {
    const context = this.accountContext();
    const authSign = sign(ACCOUNT_APP_KEY, ACCOUNT_APP_SECRET, { ...context, ...params });
    const path =
      `/v1/private/${this.region}/${LANG}/${this.appDeviceId}/${APP_CODE}/` +
      `${APP_VERSION}/${STORE}/1${endpoint}`;
    const query = queryString({
      authAppkey: ACCOUNT_APP_KEY,
      authSign,
      authTimeZone: context.authTimeZone,
      authTimespan: context.authTimespan,
      ...params,
    });
    const { body } = await this.requestJson(`${this.accountHost}${path}?${query}`);
    return body;
  }

  static session(body) {
    const data = body.data ?? body;
    if (!data.accessToken || !data.uid) {
      throw new TinecoError('Tineco login answered without a session');
    }
    return { uid: data.uid, accessToken: data.accessToken };
  }

  /**
   * Sign in with the account e-mail and password.
   * @returns {Promise<{ uid: string, accessToken: string }>}
   * @throws {TinecoVerificationRequiredError} first sign-in of this app device id
   * @throws {TinecoAuthError} wrong credentials
   */
  async login(email, password) {
    const body = await this.accountCall('/user/login', {
      account: email,
      password: md5(password),
      uid: '',
      accessToken: '',
    });
    const code = String(body.code);
    if (code === OK) {
      return TinecoApi.session(body);
    }
    if (code === NEW_DEVICE) {
      throw new TinecoVerificationRequiredError();
    }
    throw new TinecoAuthError(body.msg || `Tineco login refused (code ${code})`, { code });
  }

  /**
   * Ask Tineco to e-mail the code confirming this app device.
   * @returns {Promise<string>} the verifyId to send back with the code
   */
  async sendVerificationCode(email) {
    const body = await this.accountCall('/user/sendEmailVerifyCode', {
      requestId: requestId(),
      email,
      verifyType: 'EMAIL_NEW_DEVICE',
    });
    const verifyId = body.data?.verifyId;
    if (String(body.code) !== OK || !verifyId) {
      throw new TinecoError(body.msg || 'Tineco refused to send a verification code', {
        code: body.code,
      });
    }
    return verifyId;
  }

  /**
   * Finish the first sign-in with the e-mailed code.
   * @returns {Promise<{ uid: string, accessToken: string }>}
   */
  async loginWithCode(email, verifyId, verifyCode) {
    const body = await this.accountCall('/user/quickLoginByEmail', {
      requestId: requestId(),
      email,
      verifyId,
      verifyCode: String(verifyCode).trim(),
    });
    if (String(body.code) !== OK) {
      throw new TinecoAuthError(body.msg || 'Tineco refused the verification code', {
        code: body.code,
      });
    }
    return TinecoApi.session(body);
  }

  // --- Open API ---------------------------------------------------------------

  async openCall(endpoint, params) {
    const signed = {
      authTimespan: this.now(),
      appCode: APP_CODE,
      appVersion: APP_VERSION,
      deviceId: this.appDeviceId,
      openId: 'global',
      ...params,
    };
    const authSign = sign(OPEN_APP_KEY, OPEN_APP_SECRET, signed);
    const { openId: _openId, ...sent } = signed;
    const query = new URLSearchParams({ authAppkey: OPEN_APP_KEY, authSign, ...sent });
    const { body } = await this.requestJson(`${this.openHost}/v1/global${endpoint}?${query}`);
    return body;
  }

  /**
   * Exchange the account session for the auth code of the IoT login.
   * @throws {TinecoAuthError} expired session
   */
  async getAuthCode({ uid, accessToken }) {
    const body = await this.openCall('/auth/getAuthCode', { uid, accessToken });
    const data = body.data ?? body;
    const authCode = typeof data === 'string' ? data : data?.authCode;
    if (String(body.code) !== OK || !authCode) {
      throw new TinecoAuthError(body.msg || 'Tineco session expired', { code: body.code });
    }
    return authCode;
  }

  /**
   * List the appliances of the account.
   * @returns {Promise<object[]>} raw Tineco devices (`did`, `className`, `resource`, `nick`...)
   */
  async getDevices({ uid, accessToken }, iot) {
    const body = await this.openCall('/device/getDeviceListV2', {
      uid,
      accessToken,
      resource: iot.resource,
      token: iot.token,
      userId: uid,
      lang: LANG,
      deviceType: '1',
      refresh: 'false',
    });
    if (String(body.code) !== OK) {
      throw new TinecoAuthError(body.msg || 'Tineco refused the device list', {
        code: body.code,
      });
    }
    const payload = body.payload ?? body.data ?? body;
    if (Array.isArray(payload)) {
      return payload;
    }
    return payload.deviceList ?? payload.userDeviceList ?? [];
  }

  // --- IoT platform -------------------------------------------------------------

  async resolveDatacenter() {
    if (this.datacenter) {
      return this.datacenter;
    }
    const url =
      'https://api-base.robotww.ecouser.net/api/basis/dc/get-by-area?area=' +
      this.region.toLowerCase();
    try {
      const { body } = await this.requestJson(url);
      const dc = body?.data?.dc;
      if (body?.code === 0 && ['eu', 'na', 'as'].includes(dc)) {
        this.datacenter = dc;
        return dc;
      }
    } catch {
      // Static fallback below: the lookup is a convenience, not a requirement.
    }
    this.datacenter = REGION_DATACENTERS[this.region] ?? 'eu';
    return this.datacenter;
  }

  /**
   * Sign in to the IoT platform with the auth code.
   * @returns {Promise<{ token: string, resource: string, userId: string }>}
   */
  async iotLogin(uid, authCode) {
    const dc = await this.resolveDatacenter();
    const resource = randomUUID();
    const { body } = await this.requestJson(
      `https://api-base.dc-${dc}.ww.ecouser.net/api/users/user.do`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todo: 'loginByItToken',
          userId: uid,
          token: authCode,
          realm: 'ecouser.net',
          edition: 'default',
          resource,
          last: '',
          country: this.region,
          org: 'TEKWW',
        }),
      },
    );
    if (body.result !== 'ok' || !body.token) {
      throw new TinecoAuthError(`Tineco IoT login refused (${body.error ?? body.errno ?? '?'})`, {
        code: body.errno,
      });
    }
    return { token: body.token, resource: body.resource ?? resource, userId: body.userId ?? uid };
  }

  /**
   * Query or command one appliance.
   * @param {object} iot      the IoT session ({ token })
   * @param {object} device   { did, className, resource }
   * @param {string} apn      'gci' (status), 'gav' (versions), 'cfp' (set values)...
   * @param {object} [payload] command body
   * @returns {Promise<object|null>} the answer, null when the appliance did not answer
   */
  async iotCall(iot, { did, className, resource }, apn, payload) {
    const dc = await this.resolveDatacenter();
    const si = requestId();
    const params = new URLSearchParams({ ct: 'q', eid: did, fmt: 'j', apn, si });
    if (className) params.set('et', className);
    if (resource) params.set('er', resource);
    const response = await this.request(
      `https://api-ngiot.dc-${dc}.ww.ecouser.net/api/iot/endpoint/control?${params}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${iot.token}`,
          'X-ECO-REQUEST-ID': si,
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      },
    );
    // The platform says whether the appliance answered in a header: anything
    // but "ok" means offline (a handheld only connects while in use) or a
    // refused session.
    const ret = response.headers.get('X-NGIOT-RET');
    const text = await response.text();
    if (ret !== 'ok') {
      return null;
    }
    if (!text.trim()) {
      return {};
    }
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
}
