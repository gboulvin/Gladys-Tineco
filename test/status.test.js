import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITIES,
  VACUUM_CLEANER_STATE,
  brushLightCommand,
  capabilitiesOf,
  parseFirmware,
  parseStatus,
  voicePromptsCommand,
  volumeCommand,
} from '../src/tineco/status.js';
import { S5_CHARGED, S7_IDLE } from './helpers/fakeTineco.js';

test('an idle S7 Flashdry reads standby, tanks OK, light on', () => {
  const status = parseStatus(S7_IDLE);
  assert.equal(status.activity, ACTIVITIES.STANDBY);
  assert.equal(status.state, VACUUM_CLEANER_STATE.STOPPED);
  assert.equal(status.battery, 93);
  assert.equal(status.charging, false);
  assert.equal(status.wasteTankFull, false);
  assert.equal(status.freshWaterEmpty, false);
  assert.equal(status.brushLight, true, 'led 0 means on');
  assert.equal(status.volume, 1);
});

test('a charged S5 Combo reads 100 % and charging, without light', () => {
  const status = parseStatus(S5_CHARGED);
  assert.equal(status.battery, 100, 'bp 240 means fully charged');
  assert.equal(status.charging, true);
  assert.equal(status.state, VACUUM_CLEANER_STATE.CHARGING);
  assert.equal(status.brushLight, undefined);
  assert.equal(status.volume, 3, 'clamped to the 1-3 range');
  assert.deepEqual(capabilitiesOf(S5_CHARGED), { brushLight: false, volume: true });
});

test('the tank bitmasks of e2 and e3 are decoded', () => {
  assert.equal(parseStatus({ wm: 10, e2: 256 }).wasteTankFull, true);
  assert.equal(parseStatus({ wm: 10, e2: 64 }).freshWaterEmpty, true);
  const e3 = parseStatus({ wm: 8, e3: 4096 | 8192 });
  assert.equal(e3.wasteTankFull, true);
  assert.equal(e3.freshWaterEmpty, true);
  assert.equal(parseStatus({ wm: 3, wp: 239 }).freshWaterEmpty, true);
  assert.equal(parseStatus({ wm: 3, wp: 238 }).freshWaterEmpty, false);
});

test('work modes map to activities', () => {
  assert.equal(parseStatus({ wm: 3 }).activity, ACTIVITIES.CLEANING);
  assert.equal(parseStatus({ wm: 3 }).state, VACUUM_CLEANER_STATE.RUNNING);
  assert.equal(parseStatus({ wm: 8 }).activity, ACTIVITIES.SELF_CLEANING);
  assert.equal(parseStatus({ wm: 8, selfclean_process: 6 }).activity, ACTIVITIES.SELF_CLEANING);
  assert.equal(parseStatus({ wm: 8, selfclean_process: 2 }).activity, ACTIVITIES.CHARGING);
  assert.equal(parseStatus({ wm: 8, selfclean_process: 17 }).activity, ACTIVITIES.CHARGING);
  assert.equal(parseStatus({ wm: 13 }).activity, ACTIVITIES.DRYING);
  assert.equal(parseStatus({ wm: 9 }).activity, ACTIVITIES.UPDATING);
});

test('the battery key and wrapped payloads are understood', () => {
  assert.equal(parseStatus({ payload: { battery: 42, wm: 1 } }).battery, 42);
  assert.equal(parseStatus({ ret: 'ok' }), null, 'no known key: no status');
  assert.equal(parseStatus(null), null);
});

test('voice prompts follow ms when present, the volume otherwise', () => {
  assert.equal(parseStatus({ wm: 1, ms: 1, vl: 2 }).voicePrompts, false);
  assert.equal(parseStatus({ wm: 1, ms: 0, vl: 2 }).voicePrompts, true);
  assert.equal(parseStatus({ wm: 1, vl: 0 }).voicePrompts, false);
});

test('commands use the wire encoding of the app', () => {
  assert.deepEqual(volumeCommand(5), { vl: 3 });
  assert.deepEqual(volumeCommand(0), { vl: 1 });
  assert.deepEqual(voicePromptsCommand(false), { ms: 1 });
  assert.deepEqual(brushLightCommand(true), { led: 0 });
});

test('the firmware version is cleaned', () => {
  assert.equal(parseFirmware({ vv: '1.0.5\u0000', tv: '1.2.3' }), '1.2.3');
  assert.equal(parseFirmware({ vv: '1.0.5\u0000\u0001' }), '1.0.5');
  assert.equal(parseFirmware(null), undefined);
});
