// -----------------------------------------------------------------------------
// Scene triggers: what HAPPENED between two status reads of an appliance.
//
// The values themselves (battery, tanks, state) are device features that the
// standard "device state" trigger already covers; these events add what a
// state cannot say on its own — "the cleaning just ended, after 23 minutes",
// "the self-cleaning cycle is over" (the most requested one: empty the dirty
// water tank once the brush is clean).
//
// One event per TRANSITION, never on the first read (no previous state to
// compare), and pure: the tests drive it with fabricated statuses.
// -----------------------------------------------------------------------------

import { ACTIVITIES } from './tineco/status.js';

// Keys of the manifest `scene_triggers`. Keys are forever: scenes store them.
export const TRIGGERS = {
  CLEANING_STARTED: 'cleaning_started',
  CLEANING_FINISHED: 'cleaning_finished',
  SELF_CLEANING_FINISHED: 'self_cleaning_finished',
  TANK_ALERT: 'tank_alert',
};

export const TANK_ALERTS = {
  WASTE_TANK_FULL: 'waste_tank_full',
  FRESH_WATER_EMPTY: 'fresh_water_empty',
};

export const OFFLINE = 'offline';

/**
 * Fold a new reading into the tracked state of an appliance.
 * @param {object|undefined} previous  tracked state ({ activity, wasteTankFull,
 *   freshWaterEmpty, cleaningSince }), undefined on the first read
 * @param {object|null} status  parseStatus() result, null when offline
 * @param {number} now  ms timestamp
 * @param {string} device  device external_id (the `device` filter of every trigger)
 * @returns {{ state: object, events: { key: string, data: object }[] }}
 */
export function trackStatus(previous, status, now, device) {
  // Offline: the activity becomes `offline`, the tank flags are kept (a tank
  // alert must not fire again when the appliance comes back).
  const next = status
    ? {
        activity: status.activity,
        wasteTankFull: status.wasteTankFull,
        freshWaterEmpty: status.freshWaterEmpty,
        battery: status.battery,
      }
    : {
        activity: OFFLINE,
        wasteTankFull: previous?.wasteTankFull ?? false,
        freshWaterEmpty: previous?.freshWaterEmpty ?? false,
        battery: previous?.battery,
      };
  next.cleaningSince = previous?.cleaningSince;

  const events = [];
  if (!previous) {
    if (next.activity === ACTIVITIES.CLEANING) next.cleaningSince = now;
    return { state: next, events };
  }

  const was = previous.activity;
  const is = next.activity;
  if (is === ACTIVITIES.CLEANING && was !== ACTIVITIES.CLEANING) {
    next.cleaningSince = now;
    events.push({
      key: TRIGGERS.CLEANING_STARTED,
      data: { device, battery: next.battery ?? null },
    });
  }
  // A handheld that goes offline right after use also ended its cleaning.
  if (was === ACTIVITIES.CLEANING && is !== ACTIVITIES.CLEANING) {
    const since = previous.cleaningSince;
    next.cleaningSince = undefined;
    events.push({
      key: TRIGGERS.CLEANING_FINISHED,
      data: {
        device,
        duration_minutes: since ? Math.max(0, Math.round((now - since) / 60_000)) : null,
        battery: next.battery ?? null,
      },
    });
  }
  if (was === ACTIVITIES.SELF_CLEANING && is !== ACTIVITIES.SELF_CLEANING) {
    events.push({ key: TRIGGERS.SELF_CLEANING_FINISHED, data: { device } });
  }
  if (status) {
    if (next.wasteTankFull && !previous.wasteTankFull) {
      events.push({
        key: TRIGGERS.TANK_ALERT,
        data: { device, alert: TANK_ALERTS.WASTE_TANK_FULL },
      });
    }
    if (next.freshWaterEmpty && !previous.freshWaterEmpty) {
      events.push({
        key: TRIGGERS.TANK_ALERT,
        data: { device, alert: TANK_ALERTS.FRESH_WATER_EMPTY },
      });
    }
  }
  return { state: next, events };
}
