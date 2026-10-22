# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.4] - 2026-10-22

### Security

- `brace-expansion`, pulled in by ESLint, raised to 5.0.12 against the
  high-severity denial-of-service advisories (GHSA-mh99-v99m-4gvg and
  related). A development tool only: the published image never shipped it.
- The image is rebuilt on the latest `node:24-alpine` (Node.js and Alpine
  security patches); development tools and CI actions up to date.

## [1.0.3] - 2026-10-16

### Fixed

- No appliance found although the Tineco app shows them: the device list is
  now asked for the user id the Tineco IoT login answers, like the app does,
  instead of the account uid (which Tineco answers with an empty list).

## [1.0.2] - 2026-10-16

### Fixed

- Appliances missing from the Discovery tab although the Tineco app shows
  them: an empty device list is asked again without the Tineco cache, and the
  appliances are found wherever the answer puts them (grouped lists, `data`,
  `deviceId`).

### Changed

- When Tineco lists no appliance, the test button points to the account
  country, and the logs describe the shape of the answer (never its values).

## [1.0.1] - 2026-10-16

### Changed

- Dependency updates (Prettier, GitHub Actions).

## [1.0.0] - 2026-10-16

### Added

- Tineco account connection through the Tineco cloud, with the e-mail
  verification code Tineco asks for on the first sign-in, and the session kept
  across restarts.
- One Gladys device per Tineco floor washer of the account: state, activity,
  battery, charging, clean and dirty water tanks, voice volume, voice prompts
  and brush light (on the models that have one).
- Scene triggers: cleaning started, cleaning finished (with its duration),
  self-cleaning finished, water tank alert.
- Scene actions: read an appliance (outputs for the conditions), set the voice
  volume, turn the voice prompts or the brush light on or off.
- Dashboard widgets: one appliance, and an overview of every appliance.
- Unreachable badge and offline activity when an appliance does not answer.
- English, French, German and Spanish everywhere: manifest, messages, widgets,
  device names and documentation.

[Unreleased]: https://github.com/gboulvin/Gladys-Tineco/compare/v1.0.4...HEAD
[1.0.4]: https://github.com/gboulvin/Gladys-Tineco/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/gboulvin/Gladys-Tineco/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/gboulvin/Gladys-Tineco/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/gboulvin/Gladys-Tineco/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/gboulvin/Gladys-Tineco/releases/tag/v1.0.0
