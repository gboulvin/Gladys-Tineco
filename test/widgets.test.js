import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { TinecoIntegration } from '../src/integration.js';
import { APPLIANCE_WIDGET, OVERVIEW_WIDGET, WIDGETS, refreshWidgets } from '../src/widgets.js';
import { deviceIds } from '../src/devices.js';
import { MESSAGES } from '../src/i18n.js';
import { ACCOUNT, S7_FLASHDRY, S7_IDLE, createFakeTineco } from './helpers/fakeTineco.js';

const CONFIG = { email: ACCOUNT.email, password: ACCOUNT.password, region: 'FR' };
const LANGUAGES = ['en', 'fr', 'de', 'es'];

async function started(cloud = createFakeTineco()) {
  const gladys = createFakeGladys({ config: CONFIG });
  await gladys.connect();
  const tineco = new TinecoIntegration(gladys, { fetch: cloud.fetch });
  await tineco.start(CONFIG);
  return { gladys, tineco, cloud };
}

const request = (settings = {}) => ({ settings, language: 'fr', units: 'metric' });

// Every multi-language text of a content speaks the four languages.
function assertTranslated(node, path = 'content') {
  if (Array.isArray(node)) {
    node.forEach((item, i) => assertTranslated(item, `${path}[${i}]`));
  } else if (node && typeof node === 'object') {
    if (typeof node.en === 'string') {
      for (const lang of LANGUAGES) assert.ok(node[lang], `${path} misses "${lang}"`);
      return;
    }
    for (const [key, value] of Object.entries(node)) assertTranslated(value, `${path}.${key}`);
  }
}

for (const key of [APPLIANCE_WIDGET, OVERVIEW_WIDGET]) {
  test(`the ${key} content is rendered exactly as sent, in four languages`, async () => {
    const { tineco } = await started();
    const content = await WIDGETS[key].get(tineco, request());
    assert.deepEqual(validateWidgetContent(content), []);
    assertTranslated(content);
  });

  test(`the ${key} content without appliance is a valid empty state`, async () => {
    const { tineco } = await started(createFakeTineco({ devices: [] }));
    const content = await WIDGETS[key].get(tineco, request());
    assert.deepEqual(validateWidgetContent(content), []);
  });
}

test('the appliance widget follows its device setting and the published features', async () => {
  const { gladys, tineco } = await started();
  const ids = deviceIds(gladys, S7_FLASHDRY.did);
  const content = await WIDGETS[APPLIANCE_WIDGET].get(tineco, request({ device: ids.device }));
  const published = new Set(gladys.fake.discoveredDevices[0].features.map((f) => f.external_id));
  for (const component of content.components) {
    for (const id of [component.device_feature, ...(component.device_features ?? [])]) {
      if (id) assert.ok(published.has(id), `unknown feature ${id}`);
    }
  }
});

test('the refresh button reads the appliance and answers a toast', async () => {
  const { gladys, tineco, cloud } = await started();
  const widget = WIDGETS[APPLIANCE_WIDGET];
  const [button] = (await widget.get(tineco, request())).components.filter((c) => c.action);
  const reads = () => cloud.calls.filter((c) => c.query.apn === 'gci').length;
  const before = reads();
  const toast = await widget.action(tineco, {
    actionKey: button.action.key,
    params: button.action.params,
  });
  assert.deepEqual(toast, MESSAGES.statusRefreshed);
  assert.equal(reads(), before + 1);

  delete cloud.statuses[S7_FLASHDRY.did];
  const offline = await widget.action(tineco, {
    actionKey: button.action.key,
    params: button.action.params,
  });
  assert.deepEqual(offline, MESSAGES.deviceOffline);
  await assert.rejects(widget.action(tineco, { actionKey: 'nope', params: {} }), /Unknown/);
  assert.ok(gladys);
});

test('the overview flags an appliance with a tank alert', async () => {
  const cloud = createFakeTineco({ statuses: { [S7_FLASHDRY.did]: { ...S7_IDLE, e2: 256 } } });
  const { tineco } = await started(cloud);
  const content = await WIDGETS[OVERVIEW_WIDGET].get(tineco, request());
  assert.equal(content.components[0].items[0].color, 'warning');
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
