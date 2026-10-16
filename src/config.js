// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user from the `config_schema` of the manifest. This module
// provides the defaults and normalizes the received object, so the rest of the
// code never deals with `undefined` or with numbers typed as strings.
//
// The keys prefixed with `tineco_` are NOT in the config_schema: they are the
// integration's own storage (Tineco session, app device id), written with
// gladys.setConfig and never shown in the form — see src/tineco/session.js.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  email: '',
  password: '',
  region: 'FR',
  verification_code: '',
  language: 'en',
  // Seconds between two status reads. Gladys polls a device at most every
  // 30 s here (DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS): slower intervals
  // are applied by skipping polls (see createPoller in src/integration.js).
  poll_frequency: 60,
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG, ...raw };
  return {
    ...config,
    email: String(config.email ?? '').trim(),
    password: String(config.password ?? ''),
    region: String(config.region || DEFAULT_CONFIG.region).toUpperCase(),
    verification_code: String(config.verification_code ?? '').trim(),
    language: ['en', 'fr', 'de', 'es'].includes(config.language)
      ? config.language
      : DEFAULT_CONFIG.language,
    poll_frequency: Math.max(30, Number(config.poll_frequency) || DEFAULT_CONFIG.poll_frequency),
  };
}
