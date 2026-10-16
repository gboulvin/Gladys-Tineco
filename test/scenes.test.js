import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { TinecoIntegration } from '../src/integration.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { TRIGGERS, trackStatus } from '../src/events.js';
import { deviceIds } from '../src/devices.js';
import { parseStatus } from '../src/tineco/status.js';
import { ACCOUNT, S7_FLASHDRY, createFakeTineco } from './helpers/fakeTineco.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const CONFIG = { email: ACCOUNT.email, password: ACCOUNT.password, region: 'FR' };
const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const declared = (list, key) => manifest[list].find((entry) => entry.key === key);

async function started(cloud = createFakeTineco()) {
  const gladys = createFakeGladys({ config: CONFIG });
  await gladys.connect();
  const tineco = new TinecoIntegration(gladys, { fetch: cloud.fetch });
  await tineco.start(CONFIG);
  return { tineco, cloud, device: deviceIds(gladys, S7_FLASHDRY.did).device };
}

test('every scene action returns exactly its declared outputs', async () => {
  const { tineco, device } = await started();
  const fields = { device, level: '3', enabled: false, on: true };
  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    const outputs = await handler(tineco, { fields });
    assert.deepEqual(
      Object.keys(outputs).sort(),
      keysOf(declared('scene_actions', key).outputs).sort(),
      `outputs of ${key}`,
    );
  }
});

test('the scene commands reach the appliance', async () => {
  const { tineco, cloud, device } = await started();
  assert.deepEqual(await SCENE_ACTIONS.set_volume(tineco, { fields: { device, level: '1' } }), {
    success: true,
  });
  await SCENE_ACTIONS.set_voice_prompts(tineco, { fields: { device, enabled: 'false' } });
  await SCENE_ACTIONS.set_brush_light(tineco, { fields: { device, on: true } });
  assert.deepEqual(
    cloud.commands.map((c) => c.payload),
    [{ vl: 1 }, { ms: 1 }, { led: 0 }],
  );
});

test('an offline appliance is an output, never a failure', async () => {
  const cloud = createFakeTineco();
  const { tineco, device } = await started(cloud);
  delete cloud.statuses[S7_FLASHDRY.did];
  assert.deepEqual(await SCENE_ACTIONS.set_volume(tineco, { fields: { device, level: '2' } }), {
    success: false,
  });
  const status = await SCENE_ACTIONS.refresh_status(tineco, { fields: { device } });
  assert.equal(status.online, false);
  assert.equal(status.activity, 'offline');
});

test('scene events only carry keys their trigger declares', () => {
  const sequence = [{ wm: 1 }, { wm: 3, bp: 50 }, { wm: 8, e2: 256 | 64 }, { wm: 2, e2: 256 | 64 }];
  let state;
  const events = [];
  sequence.forEach((payload, i) => {
    const result = trackStatus(state, parseStatus(payload), i * 60_000, 'ext:x:appliance:1');
    state = result.state;
    events.push(...result.events);
  });
  assert.deepEqual(
    [...new Set(events.map((e) => e.key))].sort(),
    Object.values(TRIGGERS).sort(),
    'the sequence fires every trigger',
  );
  for (const { key, data } of events) {
    const trigger = declared('scene_triggers', key);
    assert.ok(trigger, `trigger ${key} is not declared`);
    const allowed = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    for (const [name, value] of Object.entries(data)) {
      assert.ok(allowed.includes(name), `${key}.${name} is not declared`);
      assert.ok(value === null || typeof value !== 'object', `${key}.${name} must be a primitive`);
    }
    const alert = trigger.fields.find((f) => f.key === 'alert');
    if (alert) {
      assert.ok(alert.options.some((o) => o.value === data.alert));
    }
  }
});
