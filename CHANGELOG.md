# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Fixed

- Appliances missing from the Discovery tab although the Tineco app shows
  them: an empty device list is asked again without the Tineco cache, and the
  appliances are found wherever the answer puts them (grouped lists, `data`,
  `deviceId`).

### Changed

- When Tineco lists no appliance, the test button points to the account
  country, and the logs describe the shape of the answer (never its values).

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

[Unreleased]: https://github.com/gboulvin/Gladys-Tineco/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gboulvin/Gladys-Tineco/releases/tag/v1.0.0
