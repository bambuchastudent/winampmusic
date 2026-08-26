# Proposal: Short Ámpula share links

## Problem

An Ámpula share link is self-contained. The whole musical moment travels inside `?a=<payload>`, so an
18-track Ámpula produces a link of several kilobytes.

That is excellent for portability and bad for human transport. Long links are truncated by chat
clients, wrap badly, produce dense QR codes, and look untrustworthy when pasted into a message.

The naive fix — a URL shortener — is dangerous here, because it silently moves the musical moment
into somebody else's server and makes every previously shared Ámpula depend on that server staying
alive.

## Goal

Give sharing an optional short link such as `https://bambuchastudent.github.io/winampmusic/a/Ab3Xk9`
while keeping the Ámpula Core object the only canonical data and keeping the current self-contained
`?a=` link fully working as the automatic fallback.

## What this change actually ships

This repository deploys to **GitHub Pages** (`.github/workflows/pages.yml` uploads `path: .`). That
is a read-only static host: it can *serve* an alias, but a browser cannot *write* one to it.

The change is therefore split honestly:

| Capability | Status after this change |
| --- | --- |
| Short-link **resolution** | **Live from this repository.** Same-origin static aliases under `a/` are served by Pages with no external service. |
| Curated short-link **creation** | **Live from this repository.** A maintainer-run script/workflow mints an alias and commits it. |
| Anonymous end-user short-link **creation** | **Not live.** Requires a write-capable relay. The client is fully implemented and contract-tested, but the repository configures no relay and deploys none. |

A reference relay implementation is committed so a deployment *can* enable anonymous creation. It is
not deployed by this change and is not represented as a running service.

## Scope

- Define one alias contract with two adapters: same-origin `static` and write-capable `relay`.
- Add an optional, lazily loaded alias client that upgrades a share link when possible.
- Route an incoming alias into the existing canonical receive flow.
- Add a maintainer tool and workflow that mint a static alias from a canonical share link.
- Commit a deployable reference relay plus configuration, clearly marked as not deployed.
- Define limits, failure modes, privacy, expiration and durability for both adapters.

## Non-goals

- Making an alias a catalog, account system, analytics endpoint, or social backend.
- Making a token an Ámpula identity, track identity, or a playback source.
- Using a public third-party URL shortener (`bit.ly`, `tinyurl`, `t.co`, `is.gd`, …) as a source of truth.
- Reintroducing the paste-service dependency removed by `ampula-native-sharing-v1.6`.
- Changing Ámpula Core v1 or the compact `?a=` transport encoding.
- Changing local playback/track resolution, which stays entirely client-side.
- Enabling a write relay by default in this repository.

## Success criteria

- A committed static alias opens the same ordered Ámpula Core object as its `?a=` equivalent, on
  GitHub Pages, with no external service.
- With a write relay configured and reachable, Share presents a short link.
- With no relay configured, or a relay that is offline, slow, rate limited or erroring, Share still
  presents the self-contained `?a=` link and still reports success.
- An Ámpula already shared as `?a=`, `.ampula` or QR never depends on any alias service.
- Opening a short link never mutates `Your library` and always renders the existing Shared music UI.
- Legacy receive-only `?p=` and `?s=` recovery is unchanged.
- Alias support stays off the startup critical path: startup, playback and the Share dialog never
  wait on an alias before becoming usable.
