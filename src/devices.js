// -----------------------------------------------------------------------------
// Tineco appliance <-> Gladys device.
//
// The appliances come from the account (getDeviceListV2), so the devices are
// built at runtime, one per Tineco `did`. Their external ids derive from that
// cloud id — never from a name — and so do the feature ids: both are forever,
// Gladys keys history, scenes and dashboards on them.
//
// The Tineco ids the IoT calls need (did, class, resource) are stored as
// device params, so a poll or a command never needs the device list.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { ACTIVITY_LABELS, NAMES, name } from './i18n.js';
import {
  ACTIVITIES,
  LIQUID_STATE,
  brushLightCommand,
  voicePromptsCommand,
  volumeCommand,
} from './tineco/status.js';
import { OFFLINE } from './events.js';

// Device type namespace of the external ids.
export const DEVICE_TYPE = 'appliance';

// Feature keys: the suffix of the feature external ids. Forever.
export const FEATURES = {
  STATE: 'state',
  ACTIVITY: 'activity',
  BATTERY: 'battery',
  CHARGING: 'charging',
  FRESH_WATER: 'fresh-water',
  WASTE_WATER: 'waste-water',
  VOLUME: 'volume',
  VOICE_PROMPTS: 'voice-prompts',
  BRUSH_LIGHT: 'brush-light',
};

const PARAMS = { DID: 'tineco_did', CLASS: 'tineco_class', RESOURCE: 'tineco_resource' };

const ACTIVITY_VALUES = [...Object.values(ACTIVITIES), OFFLINE];

/** The fields of a raw Tineco device the integration relies on. */
export function tinecoRef(raw) {
  return {
    did: raw.did ?? raw.deviceId,
    className: raw.className ?? '',
    resource: raw.resource ?? '',
  };
}

/** Display name of an appliance: the user's nickname, else the model. */
export function displayName(raw) {
  return raw.nick || raw.productType || raw.productName || raw.deviceName || 'Tineco';
}

/** Model of an appliance (the nickname may embed an internal project code). */
export function modelOf(raw) {
  return raw.productType || raw.productName || raw.deviceName || raw.nick || '';
}

export function deviceIds(gladys, did) {
  return gladys.externalIds(DEVICE_TYPE, did);
}

/** The Tineco ids of a Gladys device (params first, external id as fallback). */
export function refOfDevice(gladys, device) {
  const param = (key) => device.params?.find((p) => p.name === key)?.value;
  const prefix = gladys.externalId(`${DEVICE_TYPE}:`);
  const did =
    param(PARAMS.DID) ??
    (device.external_id?.startsWith(prefix) ? device.external_id.slice(prefix.length) : undefined);
  return { did, className: param(PARAMS.CLASS) ?? '', resource: param(PARAMS.RESOURCE) ?? '' };
}

/** The feature key of a feature external id (`...:<did>:<key>`). */
export function featureKeyOf(featureExternalId) {
  return featureExternalId.split(':').at(-1);
}

/**
 * Discovery payload of one appliance.
 * @param {object} raw          Tineco device (getDeviceListV2)
 * @param {object} capabilities capabilitiesOf() of its last status
 * @param {string} language     language of the names
 */
export function buildDevice(gladys, raw, capabilities, language) {
  const ref = tinecoRef(raw);
  const ids = deviceIds(gladys, ref.did);
  const label = (key) => name(NAMES[key], language);
  const sensor = (key, nameKey, category, type, extra) => ({
    name: label(nameKey),
    external_id: ids.feature(key),
    category,
    type,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    ...extra,
  });

  const features = [
    sensor(
      FEATURES.STATE,
      'state',
      DEVICE_FEATURE_CATEGORIES.VACUUM_CLEANER,
      DEVICE_FEATURE_TYPES.VACUUM_CLEANER.STATE,
      { min: 0, max: 6 },
    ),
    sensor(
      FEATURES.ACTIVITY,
      'activity',
      DEVICE_FEATURE_CATEGORIES.TEXT,
      DEVICE_FEATURE_TYPES.TEXT.SELECT,
      {
        min: 0,
        max: 0,
        keep_history: false,
        supported_options: ACTIVITY_VALUES.map((value, index) => ({
          value,
          label: name(ACTIVITY_LABELS[value], language),
          sort_order: index,
        })),
      },
    ),
    sensor(
      FEATURES.BATTERY,
      'battery',
      DEVICE_FEATURE_CATEGORIES.BATTERY,
      DEVICE_FEATURE_TYPES.BATTERY.INTEGER,
      { unit: DEVICE_FEATURE_UNITS.PERCENT, min: 0, max: 100 },
    ),
    sensor(
      FEATURES.CHARGING,
      'charging',
      DEVICE_FEATURE_CATEGORIES.BATTERY,
      DEVICE_FEATURE_TYPES.BATTERY.CHARGING,
      { min: 0, max: 1 },
    ),
    sensor(
      FEATURES.FRESH_WATER,
      'freshWater',
      DEVICE_FEATURE_CATEGORIES.LEVEL_SENSOR,
      DEVICE_FEATURE_TYPES.LEVEL_SENSOR.LIQUID_STATE,
      { min: 0, max: 2 },
    ),
    sensor(
      FEATURES.WASTE_WATER,
      'wasteWater',
      DEVICE_FEATURE_CATEGORIES.LEVEL_SENSOR,
      DEVICE_FEATURE_TYPES.LEVEL_SENSOR.LIQUID_STATE,
      { min: 0, max: 2 },
    ),
  ];
  if (capabilities.volume) {
    features.push(
      sensor(
        FEATURES.VOLUME,
        'volume',
        DEVICE_FEATURE_CATEGORIES.MUSIC,
        DEVICE_FEATURE_TYPES.MUSIC.VOLUME,
        { min: 1, max: 3, read_only: false, has_feedback: true, keep_history: false },
      ),
      sensor(
        FEATURES.VOICE_PROMPTS,
        'voicePrompts',
        DEVICE_FEATURE_CATEGORIES.SWITCH,
        DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        { min: 0, max: 1, read_only: false, has_feedback: true, keep_history: false },
      ),
    );
  }
  if (capabilities.brushLight) {
    features.push(
      sensor(
        FEATURES.BRUSH_LIGHT,
        'brushLight',
        DEVICE_FEATURE_CATEGORIES.LIGHT,
        DEVICE_FEATURE_TYPES.LIGHT.BINARY,
        { min: 0, max: 1, read_only: false, has_feedback: true, keep_history: false },
      ),
    );
  }

  return {
    name: displayName(raw),
    external_id: ids.device,
    model: modelOf(raw),
    // Polled for its status; the refresh interval of the config is applied
    // by skipping polls (see createPoller in src/integration.js).
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS,
    params: [
      { name: PARAMS.DID, value: ref.did },
      { name: PARAMS.CLASS, value: ref.className },
      { name: PARAMS.RESOURCE, value: ref.resource },
    ],
    features,
  };
}

const bool = (value) => (value ? 1 : 0);

/**
 * The states of a status, as `publishChangedStates` entries. Values the model
 * does not report are skipped; offline, only the activity changes.
 * @param {object|null} status parseStatus() result, null when offline
 */
export function statesOf(gladys, did, status) {
  const ids = deviceIds(gladys, did);
  const value = (key, state) => ({ device_feature_external_id: ids.feature(key), state });
  const text = (key, string) => ({ device_feature_external_id: ids.feature(key), text: string });
  if (!status) {
    return [text(FEATURES.ACTIVITY, OFFLINE)];
  }
  const states = [
    value(FEATURES.STATE, status.state),
    text(FEATURES.ACTIVITY, status.activity),
    value(FEATURES.CHARGING, bool(status.charging)),
    value(FEATURES.FRESH_WATER, status.freshWaterEmpty ? LIQUID_STATE.LOW : LIQUID_STATE.NORMAL),
    value(FEATURES.WASTE_WATER, status.wasteTankFull ? LIQUID_STATE.HIGH : LIQUID_STATE.NORMAL),
  ];
  if (status.battery !== undefined) states.push(value(FEATURES.BATTERY, status.battery));
  // 0 is "muted" on some firmware: the volume feature ranges 1-3.
  if (status.volume) states.push(value(FEATURES.VOLUME, status.volume));
  if (status.voicePrompts !== undefined) {
    states.push(value(FEATURES.VOICE_PROMPTS, bool(status.voicePrompts)));
  }
  if (status.brushLight !== undefined) {
    states.push(value(FEATURES.BRUSH_LIGHT, bool(status.brushLight)));
  }
  return states;
}

/**
 * The `cfp` payload of a user command on a feature, undefined when the
 * feature is read-only.
 */
export function commandOf(featureKey, value) {
  switch (featureKey) {
    case FEATURES.VOLUME:
      return volumeCommand(Number(value));
    case FEATURES.VOICE_PROMPTS:
      return voicePromptsCommand(Number(value) === 1);
    case FEATURES.BRUSH_LIGHT:
      return brushLightCommand(Number(value) === 1);
    default:
      return undefined;
  }
}
