// -----------------------------------------------------------------------------
// Entry point of the Tineco integration for Gladys Assistant.
//
// This file only wires the SDK events to the runtime (src/integration.js):
// handlers are registered BEFORE connect(). The SDK reads the environment the
// Gladys supervisor injects (GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN,
// GLADYS_INTEGRATION_SELECTOR) and handles authentication and reconnection.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { TinecoIntegration } from './src/integration.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();
const tineco = new TinecoIntegration(gladys, { onChange: () => refreshWidgets(gladys) });

// --- Discovery: the user opens the Discovery tab -----------------------------
gladys.onScanRequest(() => tineco.scan());

// --- Status reads: Gladys polls every created appliance ----------------------
gladys.onPoll(async (device) => {
  if (!(await tineco.poll(device))) {
    logger.debug(`onPoll skipped for ${device.external_id}`);
  }
});

// --- Commands: volume, voice prompts, brush light -----------------------------
gladys.onSetValue((device, feature, value) => tineco.setValue(device, feature, value));

// --- Configuration screen buttons ----------------------------------------------
gladys.onAction('test_connection', () => tineco.testConnection());
gladys.onAction('send_verification_code', () => tineco.sendVerificationCode());

// --- Scene actions (scene triggers are fired by the reads, src/events.js) -----
for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(key, (fields) => handler(tineco, { fields }));
}

// --- Dashboard widgets ----------------------------------------------------------
for (const [key, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(key, (request) => widget.get(tineco, request));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
      widget.action(tineco, { actionKey, params, settings }),
    );
  }
}

// --- Configuration saved by the user (account, code, language...) -------------
gladys.onConfigUpdated((config) => tineco.configUpdated(config));

// --- Connection lifecycle --------------------------------------------------------
gladys.on('connected', async () => {
  try {
    await tineco.start(await gladys.getConfig());
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
  }
});

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

logger.info('Starting the Tineco integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
