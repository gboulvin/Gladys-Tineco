import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFLINE, TANK_ALERTS, TRIGGERS, trackStatus } from '../src/events.js';
import { parseStatus } from '../src/tineco/status.js';

const DEVICE = 'ext:tineco:appliance:1';
const MINUTE = 60_000;

// Feed a sequence of gci payloads (null = offline), one per minute.
function run(payloads) {
  let state;
  const events = [];
  payloads.forEach((payload, index) => {
    const result = trackStatus(state, payload && parseStatus(payload), index * MINUTE, DEVICE);
    state = result.state;
    events.push(...result.events);
  });
  return events;
}

test('the first read fires nothing, even mid-cleaning', () => {
  assert.deepEqual(run([{ wm: 3, e2: 256 }]), []);
});

test('a cleaning fires started then finished, with its duration', () => {
  const events = run([
    { wm: 1, bp: 90 },
    { wm: 3, bp: 89 },
    { wm: 3 },
    { wm: 3 },
    { wm: 8, bp: 70 },
  ]);
  assert.deepEqual(events[0], {
    key: TRIGGERS.CLEANING_STARTED,
    data: { device: DEVICE, battery: 89 },
  });
  assert.deepEqual(events[1], {
    key: TRIGGERS.CLEANING_FINISHED,
    data: { device: DEVICE, duration_minutes: 3, battery: 70 },
  });
  assert.equal(events.length, 2);
});

test('the end of the self-cleaning fires once', () => {
  const events = run([{ wm: 8 }, { wm: 8 }, { wm: 13 }, { wm: 2 }]);
  assert.deepEqual(events, [{ key: TRIGGERS.SELF_CLEANING_FINISHED, data: { device: DEVICE } }]);
});

test('a handheld going offline right after use ends its cleaning', () => {
  const events = run([{ wm: 1 }, { wm: 3 }, null]);
  assert.equal(events.at(-1).key, TRIGGERS.CLEANING_FINISHED);
});

test('tank alerts fire on the transition only, and not again after an offline spell', () => {
  const events = run([{ wm: 1 }, { wm: 3, e2: 256 }, { wm: 3, e2: 256 }, null, { wm: 1, e2: 256 }]);
  const alerts = events.filter((event) => event.key === TRIGGERS.TANK_ALERT);
  assert.deepEqual(alerts, [
    { key: TRIGGERS.TANK_ALERT, data: { device: DEVICE, alert: TANK_ALERTS.WASTE_TANK_FULL } },
  ]);
});

test('offline is tracked as an activity', () => {
  const { state } = trackStatus(undefined, null, 0, DEVICE);
  assert.equal(state.activity, OFFLINE);
});
