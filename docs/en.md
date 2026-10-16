# Tineco for Gladys Assistant

Connects the Tineco floor washers of your Tineco account (Floor One S3, S5,
S7, S7 Flashdry, S7 Stretch, iFloor… — every model the **Tineco** app shows)
to Gladys: battery, activity, water tanks, voice prompts and brush light, plus
scene triggers, scene actions and dashboard widgets.

The integration goes through the **Tineco cloud**, the same way as the app:
the appliance must be set up in the Tineco app and connected to Wi-Fi.

## Setup

1. In Gladys, install the **Tineco** integration and open its
   **Configuration** tab.
2. Enter the **e-mail** and **password** of your Tineco account, and the
   **country** chosen when the account was created. Save.
3. On the first connection Tineco treats Gladys as a new phone and **e-mails
   you a verification code**. Enter it in **Verification code** and save
   again. This only happens once. No e-mail? Use **Send a new verification
   code** (one e-mail per quarter-hour at most is sent automatically).
4. **Test the connection** lists the appliances found.
5. Open the **Discovery** tab and create your appliances.

| Setting          | Role                                                      |
| ---------------- | --------------------------------------------------------- |
| Account country  | Selects the Tineco servers of your account.               |
| Language         | Language of the device and feature names at creation.     |
| Refresh interval | Seconds between two reads of each appliance (30 minimum). |

## What you get

| Feature          | Values                                                                |
| ---------------- | --------------------------------------------------------------------- |
| State            | Standard vacuum state: stopped, running, charging, docked             |
| Activity         | Cleaning, self-cleaning, drying, charging, updating, standby, offline |
| Battery          | 0–100 %                                                               |
| Charging         | Yes / no                                                              |
| Clean water tank | Normal / low (empty)                                                  |
| Dirty water tank | Normal / high (full)                                                  |
| Voice volume     | 1 (low) to 3 (high), controllable                                     |
| Voice prompts    | On / off, controllable                                                |
| Brush light      | On / off, controllable — only on the models that have one             |

When an appliance does not answer (switched off, out of Wi-Fi range — a
handheld model only connects while in use), its badge turns to
**unreachable**, its activity to **offline**, and the last values are kept.

## Scenes

**Triggers**

- **Cleaning started** — variable: battery.
- **Cleaning finished** — variables: duration (minutes), battery.
- **Self-cleaning finished** — the moment to empty the dirty water tank.
- **Water tank alert** — dirty water tank full or clean water tank empty;
  filter on the alert, variable: alert.

Each trigger can be filtered on one appliance.

**Actions**

- **Read a Tineco appliance** — reads it now; outputs: online, activity,
  battery, dirty water tank full, clean water tank empty (for the conditions
  of the following actions).
- **Set the voice volume**, **Turn the voice prompts on or off**, **Turn
  the brush light on or off** — output: command accepted.

An offline appliance never fails a scene: the outputs say so.

## Dashboard widgets

- **Tineco appliance** — the battery gauge, the activity, the water tanks,
  the battery over 24 h and a **Refresh** button. Pick the appliance in the
  widget settings (the first one otherwise).
- **Tineco overview** — one line per appliance, in orange when a tank needs
  attention.

## Limits

- Tineco publishes no API: the integration uses the protocol of the app,
  which Tineco may change. Not every model reports every value; the brush
  light only appears on the models that report it.
- Starting a cleaning remotely is not possible: a floor washer is pushed by
  hand.
- Chinese mainland accounts (SMS sign-in) are not supported.

## Troubleshooting

- **"Tineco refused the sign-in"**: check the e-mail, the password, and above
  all the **country** of the account.
- **"Tineco refused the verification code"**: codes expire; use **Send a new
  verification code** and type the new one.
- **"Tineco lists no appliance"**: the list comes from the Tineco servers of
  the chosen country. Pick the country shown in the Tineco app (Profile >
  Settings), save, and test again. Still empty? Share the "Answer shape" line
  of the logs (it holds no personal data) in an issue.
- Integration logs: Gladys → Integrations → Tineco → logs. Passwords and
  tokens are never logged.
