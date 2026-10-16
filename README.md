# Tineco — Gladys Assistant integration

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings the **Tineco floor washers** of a Tineco account (Floor One S3, S5, S7,
S7 Flashdry, S7 Stretch, iFloor…) into Gladys, through the Tineco cloud.

Built from the official
[JavaScript template](https://github.com/GladysAssistant/integration-template-js)
with [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

| Surface        | What it does                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Devices        | State, activity, battery, charging, clean / dirty water tanks, voice volume and prompts, brush light |
| Scene triggers | Cleaning started, cleaning finished, self-cleaning finished, water tank alert                        |
| Scene actions  | Read an appliance (outputs for conditions), set the voice volume, voice prompts, brush light         |
| Widgets        | One appliance (battery gauge, activity, tanks, history, refresh), overview of all appliances         |
| Transport      | `cloud` (the Tineco app protocol; no local API exists)                                               |
| Languages      | English, French, German, Spanish (manifest, messages, widgets, docs)                                 |

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

Requires **Gladys 5.1.0** or later (scene triggers, scene actions and widgets).

## How it talks to Tineco

Tineco publishes no API: [`src/tineco/api.js`](src/tineco/api.js) speaks the
protocol of the official app, as reverse-engineered by the community
([wheeller123/Tineco-HACS-Integration](https://github.com/wheeller123/Tineco-HACS-Integration)
and the payload decoding shared on the
[Gladys forum](https://community.gladysassistant.com/t/demande-d-integration-externe-pour-robot-aspirateur-laveur-tineco/11319)):

1. account sign-in (`qas-gl-<country>-api.tineco.com`), signed with the app
   keys; the first sign-in of a new "phone" asks for a code sent by e-mail;
2. auth code and device list (`qas-gl-<country>-openapi.tineco.com`);
3. IoT platform (`*.ecouser.net`): `gci` reads the status, `gav` the
   firmware, `cfp` sets values.

The app device id and the session are kept in the integration's own config
keys (`tineco_*`, outside the `config_schema`), so a restart neither signs in
again nor asks for a new code.

## Project structure

```
index.js                    SDK wiring only
src/integration.js          runtime: session, appliances, polls, commands, manifest actions
src/tineco/api.js           Tineco cloud client (fetch, no dependency)
src/tineco/session.js       sign-in, e-mail verification, IoT session renewal
src/tineco/status.js        status payload decoding + command payloads (pure)
src/devices.js              Tineco appliance <-> Gladys device and states
src/events.js               scene triggers, from two successive readings (pure)
src/scenes.js               scene actions
src/widgets.js              dashboard widgets
src/i18n.js                 en / fr / de / es texts
src/config.js               config defaults + normalization
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md       user documentation
test/                       node --test, fake Gladys (SDK) + fake Tineco cloud
```

## Development

```bash
npm install
npm test               # node --test, no network
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .   # store admission checks
```

Run against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="tineco" \
LOG_LEVEL=debug npm start
```

## Release

Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md),
then **Actions → Release → Run workflow** (`patch` / `minor` / `major`): the
workflow bumps the versions, tags, builds the `linux/amd64` + `linux/arm64`
image to `ghcr.io/gboulvin/gladys-tineco` and publishes the GitHub Release.

For the store indexer, the repository must be public with the
`gladys-assistant-integration` topic, and the GHCR package public.

## License

Apache-2.0. Tineco is a trademark of its owner; this project is not affiliated
with Tineco.
