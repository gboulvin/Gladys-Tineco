# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainer for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove e-mails, tokens, passwords and device ids
  first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## How the integration handles your Tineco account

- The password is stored by Gladys as a `secret` configuration field. It is
  sent to Tineco only as its MD5 hash, as the official app does, and only over
  HTTPS.
- The Tineco session (account token, user id) and the app device id are kept
  in the integration's own configuration keys, never shown in the form.
- Passwords, tokens and verification codes are never written to the logs.
- The container only talks to the Tineco servers (`*.tineco.com`) and to the
  IoT platform they rely on (`*.ecouser.net`).

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the Tineco cloud, app and appliances.
