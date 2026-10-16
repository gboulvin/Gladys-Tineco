// -----------------------------------------------------------------------------
// Decoding of the status payload (`gci`) of a Tineco floor washer.
//
// The payload is a flat object of short keys; which keys exist depends on the
// model and firmware. What is known (decompiled app + captured payloads of the
// Floor One S5 / S5 Combo / S7 / S7 Flashdry, see wheeller123/Tineco-HACS-
// Integration, and the decoding shared on the Gladys forum: "Demande
// d'intégration externe pour robot aspirateur laveur Tineco"):
//
//   bp   battery: 0-100 %, above 100 while charging / fully charged (240);
//        `battery` on some firmware
//   vs   online flag
//   wm   work mode: 1 standby, 2 charging, 3 cleaning, 8 self-cleaning,
//        9 firmware update, 13 drying (other values: idle)
//   selfclean_process  progress of the self-cleaning (station models): only
//        5..16 is the actual cleaning, below is pre-charging, 17 post-charging
//   e1, e2, e3, e    error / warning bitmasks: e2 & 256 = waste tank full,
//        e2 & 64 = fresh water tank empty, e3 bit 12 / 13 = the same warnings
//        on other firmware
//   wp   water level: 239 / 240 = no water
//   vl   voice volume (0 muted, 1 low, 2 medium, 3 high)
//   ms   voice muted (1) on firmware that has a separate mute
//   led  floor brush light, INVERTED: 0 = on, 1 = off (absent: no light)
//
// Everything here is pure: the tests feed it captured payloads.
// -----------------------------------------------------------------------------

// Gladys' standard values (server/utils/constants.js), sent as integers.
export const VACUUM_CLEANER_STATE = {
  STOPPED: 0,
  RUNNING: 1,
  PAUSED: 2,
  ERROR: 3,
  RETURNING_TO_DOCK: 4,
  CHARGING: 5,
  DOCKED: 6,
};

export const LIQUID_STATE = { LOW: 0, NORMAL: 1, HIGH: 2 };

// What the appliance is doing, finer than the standard vacuum state: the
// values of the `activity` text/select feature and of the scene variables.
export const ACTIVITIES = {
  CLEANING: 'cleaning',
  SELF_CLEANING: 'self_cleaning',
  DRYING: 'drying',
  CHARGING: 'charging',
  UPDATING: 'updating',
  STANDBY: 'standby',
};

const WORK_MODE = {
  STANDBY: 1,
  CHARGING: 2,
  CLEANING: 3,
  SELF_CLEANING: 8,
  UPDATING: 9,
  DRYING: 13,
};

const WASTE_TANK_FULL_E2 = 256;
const FRESH_WATER_EMPTY_E2 = 64;
const WASTE_TANK_FULL_E3 = 1 << 12;
const FRESH_WATER_EMPTY_E3 = 1 << 13;
const NO_WATER_LEVELS = [239, 240];

const toInt = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : undefined;
};

/** The status object of an answer: some firmware wrap it in `payload` / `data`. */
export function unwrapPayload(answer) {
  if (!answer || typeof answer !== 'object') {
    return null;
  }
  for (const key of ['payload', 'data']) {
    if (answer[key] && typeof answer[key] === 'object' && !Array.isArray(answer[key])) {
      return answer[key];
    }
  }
  return answer;
}

function activityOf(payload) {
  const wm = toInt(payload.wm);
  switch (wm) {
    case WORK_MODE.CLEANING:
      return ACTIVITIES.CLEANING;
    case WORK_MODE.CHARGING:
      return ACTIVITIES.CHARGING;
    case WORK_MODE.SELF_CLEANING: {
      const process = toInt(payload.selfclean_process);
      // No progress field (S7 Flashdry): the mode alone means self-cleaning.
      if (process === undefined || (process >= 5 && process !== 17)) {
        return ACTIVITIES.SELF_CLEANING;
      }
      return ACTIVITIES.CHARGING;
    }
    case WORK_MODE.DRYING:
      return ACTIVITIES.DRYING;
    case WORK_MODE.UPDATING:
      return ACTIVITIES.UPDATING;
    default:
      return ACTIVITIES.STANDBY;
  }
}

const STATE_BY_ACTIVITY = {
  [ACTIVITIES.CLEANING]: VACUUM_CLEANER_STATE.RUNNING,
  [ACTIVITIES.CHARGING]: VACUUM_CLEANER_STATE.CHARGING,
  [ACTIVITIES.SELF_CLEANING]: VACUUM_CLEANER_STATE.DOCKED,
  [ACTIVITIES.DRYING]: VACUUM_CLEANER_STATE.DOCKED,
  [ACTIVITIES.UPDATING]: VACUUM_CLEANER_STATE.DOCKED,
  [ACTIVITIES.STANDBY]: VACUUM_CLEANER_STATE.STOPPED,
};

const hasBit = (value, bit) => {
  const number = toInt(value);
  return number !== undefined && (number & bit) !== 0;
};

/**
 * Decode a `gci` answer.
 * @returns {object|null} null when the payload carries no known key
 *   { battery, charging, activity, state, wasteTankFull, freshWaterEmpty,
 *     volume, voicePrompts, brushLight } — a value is undefined when the
 *   model does not report it.
 */
export function parseStatus(answer) {
  const payload = unwrapPayload(answer);
  if (
    !payload ||
    (payload.wm === undefined && payload.bp === undefined && payload.battery === undefined)
  ) {
    return null;
  }

  const rawBattery = toInt(payload.bp ?? payload.battery);
  const activity = activityOf(payload);
  // Above 100 the battery field is a charging / fully-charged marker.
  const battery = rawBattery === undefined ? undefined : Math.max(0, Math.min(100, rawBattery));
  const charging =
    activity === ACTIVITIES.CHARGING || (rawBattery !== undefined && rawBattery > 100);

  const wasteTankFull =
    hasBit(payload.e2, WASTE_TANK_FULL_E2) || hasBit(payload.e3, WASTE_TANK_FULL_E3);
  const freshWaterEmpty =
    hasBit(payload.e2, FRESH_WATER_EMPTY_E2) ||
    hasBit(payload.e3, FRESH_WATER_EMPTY_E3) ||
    NO_WATER_LEVELS.includes(toInt(payload.wp));

  const volume = toInt(payload.vl);
  const muted = toInt(payload.ms);
  let voicePrompts;
  if (muted !== undefined) {
    voicePrompts = muted === 0;
  } else if (volume !== undefined) {
    voicePrompts = volume > 0;
  }
  const led = toInt(payload.led);

  return {
    battery,
    charging,
    activity,
    state: STATE_BY_ACTIVITY[activity],
    wasteTankFull,
    freshWaterEmpty,
    volume: volume === undefined ? undefined : Math.max(0, Math.min(3, volume)),
    voicePrompts,
    brushLight: led === undefined ? undefined : led === 0,
  };
}

/**
 * What a model supports, from one status payload: decides the optional
 * features of the device. Unknown (no payload yet) means the common set.
 */
export function capabilitiesOf(answer) {
  const payload = unwrapPayload(answer) ?? {};
  return {
    brushLight: payload.led !== undefined,
    volume: payload.vl !== undefined || Object.keys(payload).length === 0,
  };
}

/** Firmware version from a `gav` answer, cleaned of the garbage some firmware append. */
export function parseFirmware(answer) {
  const payload = unwrapPayload(answer);
  const raw = payload?.tv ?? payload?.vv ?? payload?.pv;
  if (!raw) {
    return undefined;
  }
  const cleaned = String(raw).replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || undefined;
}

// --- Commands -------------------------------------------------------------------

/** `cfp` payload setting the voice volume (1 low .. 3 high). */
export const volumeCommand = (level) => ({ vl: Math.max(1, Math.min(3, Math.round(level))) });

/** `cfp` payload muting / unmuting the voice prompts. */
export const voicePromptsCommand = (enabled) => ({ ms: enabled ? 0 : 1 });

/** `cfp` payload of the floor brush light (inverted on the wire). */
export const brushLightCommand = (on) => ({ led: on ? 0 : 1 });
