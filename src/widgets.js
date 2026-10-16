// -----------------------------------------------------------------------------
// Dashboard widgets (manifest `widgets`, Gladys 5.1+).
//
//   - `appliance`: one appliance — live battery gauge, activity and tanks,
//     battery history, and a "Refresh" button;
//   - `overview`: one status row per appliance of the account.
//
// The content is declarative (the core renders it with its theme, dark mode
// and the viewer's language: every text is a { en, fr, de, es } object).
// Computed rows are cached by the core until `ttl_seconds`; the integration
// nudges the widgets whenever a reading changes them (refreshWidgets).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS, createLogger } from '@gladysassistant/integration-sdk';
import { ACTIVITY_LABELS, MESSAGES } from './i18n.js';
import { FEATURES, deviceIds, displayName } from './devices.js';
import { OFFLINE } from './events.js';
import { ACTIVITIES } from './tineco/status.js';

const logger = createLogger({ name: 'widgets' });

export const APPLIANCE_WIDGET = 'appliance';
export const OVERVIEW_WIDGET = 'overview';

const ACTIONS = { REFRESH: 'refresh' };

const TEXTS = {
  battery: { en: 'Battery', fr: 'Batterie', de: 'Akku', es: 'Batería' },
  activity: { en: 'Activity', fr: 'Activité', de: 'Aktivität', es: 'Actividad' },
  cleanWater: { en: 'Clean water', fr: 'Eau propre', de: 'Frischwasser', es: 'Agua limpia' },
  dirtyWater: { en: 'Dirty water', fr: 'Eau sale', de: 'Schmutzwasser', es: 'Agua sucia' },
  ok: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
  empty: { en: 'Empty', fr: 'Vide', de: 'Leer', es: 'Vacío' },
  full: { en: 'Full', fr: 'Plein', de: 'Voll', es: 'Lleno' },
  unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  batteryHistory: {
    en: 'Battery (24 h)',
    fr: 'Batterie (24 h)',
    de: 'Akku (24 Std.)',
    es: 'Batería (24 h)',
  },
  noAppliance: {
    en: 'No Tineco appliance yet: create them from the Discovery tab of the integration.',
    fr: 'Aucun appareil Tineco : créez-les depuis l’onglet Découverte de l’intégration.',
    de: 'Noch kein Tineco-Gerät: Legen Sie es im Tab „Erkennung“ der Integration an.',
    es: 'Ningún aparato Tineco: créelos desde la pestaña Descubrimiento de la integración.',
  },
};

const ACTIVITY_COLORS = {
  [ACTIVITIES.CLEANING]: WIDGET_COLORS.PRIMARY,
  [ACTIVITIES.SELF_CLEANING]: WIDGET_COLORS.INFO,
  [ACTIVITIES.DRYING]: WIDGET_COLORS.INFO,
  [ACTIVITIES.CHARGING]: WIDGET_COLORS.SUCCESS,
  [ACTIVITIES.UPDATING]: WIDGET_COLORS.INFO,
  [ACTIVITIES.STANDBY]: WIDGET_COLORS.NEUTRAL,
  [OFFLINE]: WIDGET_COLORS.DANGER,
};

/** The status of an appliance, `undefined` before its first read. */
function activityItem(integration, did) {
  const status = integration.statuses.get(did);
  if (status === undefined) {
    return { value: TEXTS.unknown, color: WIDGET_COLORS.NEUTRAL };
  }
  const activity = status?.activity ?? OFFLINE;
  return { value: ACTIVITY_LABELS[activity], color: ACTIVITY_COLORS[activity] };
}

// Tanks: the last known values stay meaningful while the appliance is offline.
function tankItems(integration, did) {
  const tracked = integration.tracked.get(did);
  if (!tracked) {
    return [
      {
        label: TEXTS.cleanWater,
        icon: 'droplet',
        value: TEXTS.unknown,
        color: WIDGET_COLORS.NEUTRAL,
      },
      {
        label: TEXTS.dirtyWater,
        icon: 'trash-2',
        value: TEXTS.unknown,
        color: WIDGET_COLORS.NEUTRAL,
      },
    ];
  }
  return [
    {
      label: TEXTS.cleanWater,
      icon: 'droplet',
      value: tracked.freshWaterEmpty ? TEXTS.empty : TEXTS.ok,
      color: tracked.freshWaterEmpty ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    },
    {
      label: TEXTS.dirtyWater,
      icon: 'trash-2',
      value: tracked.wasteTankFull ? TEXTS.full : TEXTS.ok,
      color: tracked.wasteTankFull ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    },
  ];
}

/** The appliance a widget shows: its `device` setting, else the first one. */
function pickAppliance(integration, settings) {
  const chosen = settings?.device ? integration.didOf(settings.device) : undefined;
  if (chosen && integration.appliances.has(chosen)) {
    return chosen;
  }
  return integration.appliances.keys().next().value;
}

const emptyContent = () => ({
  ttl_seconds: 300,
  components: [{ type: 'text', text: TEXTS.noAppliance, variant: 'body' }],
});

export const WIDGETS = {
  [APPLIANCE_WIDGET]: {
    async get(integration, { settings }) {
      const did = pickAppliance(integration, settings);
      if (!did) {
        return emptyContent();
      }
      const ids = deviceIds(integration.gladys, did);
      const { raw } = integration.appliances.get(did);
      return {
        // Nudged on every change (see refreshWidgets): the TTL is a safety net.
        ttl_seconds: 120,
        components: [
          { type: 'text', text: displayName(raw), variant: 'heading' },
          // Live: follows the published states, nothing to refresh.
          {
            type: 'gauge',
            label: TEXTS.battery,
            device_feature: ids.feature(FEATURES.BATTERY),
          },
          {
            type: 'status',
            items: [
              { label: TEXTS.activity, icon: 'activity', ...activityItem(integration, did) },
              ...tankItems(integration, did),
            ],
          },
          {
            type: 'chart',
            title: TEXTS.batteryHistory,
            device_features: [ids.feature(FEATURES.BATTERY)],
            interval: 'last-day',
            chart_type: 'line',
          },
          // `params` are declared here and sent back as is: never user input.
          {
            type: 'button',
            label: TEXTS.refresh,
            icon: 'refresh-cw',
            style: 'secondary',
            action: { key: ACTIONS.REFRESH, params: { device: ids.device } },
          },
        ],
      };
    },

    async action(integration, { actionKey, params }) {
      logger.info(`Widget action ${actionKey}`);
      if (actionKey !== ACTIONS.REFRESH) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      const status = await integration.read(integration.didOf(params.device));
      return status ? MESSAGES.statusRefreshed : MESSAGES.deviceOffline;
    },
  },

  [OVERVIEW_WIDGET]: {
    async get(integration) {
      const dids = [...integration.appliances.keys()].slice(0, 10);
      if (dids.length === 0) {
        return emptyContent();
      }
      return {
        ttl_seconds: 120,
        components: [
          {
            type: 'status',
            items: dids.map((did) => {
              const tracked = integration.tracked.get(did);
              const item = activityItem(integration, did);
              const alert = tracked?.wasteTankFull || tracked?.freshWaterEmpty;
              return {
                label: displayName(integration.appliances.get(did).raw).slice(0, 40),
                icon: 'wind',
                value: item.value,
                color: alert ? WIDGET_COLORS.WARNING : item.color,
              };
            }),
          },
        ],
      };
    },
  },
};

/**
 * Ask the core to re-pull every widget now. Fire-and-forget: rate-limited
 * core-side (1 per 10 s per widget) and dropped while disconnected, hence
 * also called after every (re)connection.
 */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
