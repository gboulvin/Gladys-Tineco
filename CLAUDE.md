# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for **Tineco floor washers**: a
Node.js service (Node 22+, ESM, no build step) that runs in its own sandboxed
Docker container, talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
(its only runtime dependency) and to the **Tineco cloud** with the global
`fetch`. It started from the official JavaScript template.

## Commands

```bash
npm install
npm test                                  # node --test test/*.test.js
node --test test/status.test.js           # one file
node --test --test-name-pattern "offline" test/*.test.js
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                 SDK wiring only: handlers registered before connect()
src/integration.js       runtime (TinecoIntegration): start, scan, poll, setValue, manifest actions
src/tineco/api.js        Tineco cloud client: account API, open API, IoT platform
src/tineco/session.js    sign-in, e-mail verification, stored session, IoT renewal
src/tineco/status.js     `gci` payload decoding and `cfp` command payloads — pure
src/devices.js           appliance -> Gladys device, status -> states, feature -> command
src/events.js            scene triggers from two successive readings — pure
src/scenes.js            scene action handlers (manifest `scene_actions`)
src/widgets.js           dashboard widget handlers (manifest `widgets`)
src/i18n.js              every user-facing text, en / fr / de / es
src/config.js            DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md    user documentation, re-hosted by Gladys
test/helpers/fakeTineco.js          in-memory Tineco cloud behind a fake fetch
```

## The Tineco protocol

- No public API: the protocol is the official app's, reverse-engineered by
  the community (see README). Keep `api.js` faithful to it: signatures are
  MD5(app key + sorted `k=v` pairs + app secret); the query string of the
  account API uses the app's light encoding.
- The **app device id** (`tineco_app_device_id`) is generated once and
  stored: a new id means a new e-mail verification for the user. Never
  regenerate it, never derive it from something that changes.
- Status keys (`wm`, `bp`, `e2`, `e3`, `vl`, `ms`, `led`…) differ per model:
  decode defensively in `status.js`, a missing key means "not reported", and
  add a captured payload to the tests for every model-specific fix.
- An IoT answer without `X-NGIOT-RET: ok` means the appliance did not answer
  (offline) — or an expired IoT token, which `session.js` renews at most every
  10 minutes.
- Never send the verification e-mail in a loop: one per quarter-hour
  automatically, more only from the button.

## Rules

- **External ids are forever.** Built with `gladys.externalIds('appliance',
did)`, `did` being the Tineco cloud id. Feature keys (`FEATURES` in
  `devices.js`), manifest `config_schema` / `actions` / scene / widget keys,
  and the internal `tineco_*` config keys are forever too.
- **The container rootfs is read-only.** Persist through `gladys.setConfig`
  (internal keys) — never log passwords, tokens or verification codes.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand — except on the hand-pushed tag path (all three together).
  `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading by hand.
- **Four languages.** Every user-facing text is `{ en, fr, de, es }`: manifest
  texts, connection messages, action answers, widget contents (`src/i18n.js`)
  and the four `docs/*.md`, kept in sync. `test/manifest.test.js` and
  `test/widgets.test.js` refuse a missing language.
- **Manifest.** Catalog `description`: 10 to 100 characters per language.
  `scene_triggers`, `scene_actions`, `widgets` need `gladys_version` ≥ 5.1.0.
  The tests tie the manifest to the code (defaults, action / scene / widget
  handlers, fired triggers): change both sides together.
- **Transport tag.** The manifest declares `"transports": ["cloud"]`: there is
  no local API. Appliances report `cloud`, or `unreachable` when offline.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
