// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// Each handler receives the RESOLVED fields (a `"source": "devices"` field is
// the chosen device external_id) and returns the declared scalar outputs.
// An offline appliance is an output (`success: false`, `online: false`), not
// a failure: a scene action is never a condition, the scene author gates the
// following actions on the outputs. Commands never fire scene events, so a
// scene bound to a trigger cannot loop through the integration.
//
// The scene TRIGGERS are fired by the status reads, see src/events.js.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { OFFLINE } from './events.js';
import { brushLightCommand, voicePromptsCommand, volumeCommand } from './tineco/status.js';

const logger = createLogger({ name: 'scenes' });

const asBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

async function runCommand(integration, fields, payload) {
  try {
    await integration.command(integration.didOf(fields.device), payload);
    return { success: true };
  } catch (err) {
    logger.warn(`Scene command failed: ${err.message}`);
    return { success: false };
  }
}

export const SCENE_ACTIONS = {
  // Read the appliance now: the outputs feed the scene's conditions
  // ("if the dirty water tank is full, send a notification").
  async refresh_status(integration, { fields }) {
    let status = null;
    try {
      status = await integration.read(integration.didOf(fields.device));
    } catch (err) {
      logger.warn(`Scene refresh failed: ${err.message}`);
    }
    return {
      online: status !== null,
      activity: status?.activity ?? OFFLINE,
      battery: status?.battery ?? null,
      waste_tank_full: status?.wasteTankFull ?? false,
      fresh_water_empty: status?.freshWaterEmpty ?? false,
    };
  },

  async set_volume(integration, { fields }) {
    return runCommand(integration, fields, volumeCommand(Number(fields.level)));
  },

  async set_voice_prompts(integration, { fields }) {
    return runCommand(integration, fields, voicePromptsCommand(asBoolean(fields.enabled)));
  },

  async set_brush_light(integration, { fields }) {
    return runCommand(integration, fields, brushLightCommand(asBoolean(fields.on)));
  },
};
