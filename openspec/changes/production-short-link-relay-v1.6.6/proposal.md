# Proposal: production short-link relay v1.6.6

## Problem

AMPULAMP already has a short-link alias contract and a Cloudflare Worker implementation, but the production player does not configure or deploy that relay. As a result, the v1.6.5 dialogless Share flow can only guarantee the long self-contained `?a=` URL.

That defeats the intended primary sharing UX: a user should normally get a compact link, while the self-contained Ámpula URL remains the failure-safe representation.

## Goal

Make short-link creation operational in the production Pages deployment when Cloudflare deployment credentials are configured, without making the relay a dependency of Ámpula or of the player.

The normal product flow remains:

`Share` → copy compact link → recipient opens → listen inline.

## Scope

- Deploy the existing `relay/short-link` Worker from the Pages delivery workflow when Cloudflare credentials are available.
- Provision the relay's KV binding automatically instead of committing an account-specific namespace ID.
- Keep `RATE_SALT` out of source control and deliver it to the Worker as a secret.
- Generate a public runtime config containing only the deployed relay origin.
- Load that config before the short-link adapter can run.
- Health-check a successfully deployed relay.
- Preserve the canonical self-contained `?a=` URL whenever relay configuration, deployment, health, creation, or resolution is unavailable.

## Non-goals

- No user accounts, analytics, catalog, social graph, or music storage beyond opaque alias payloads.
- No change to Ámpula Core identity or resolver semantics.
- No share/receive modal.
- No requirement that a relay exist for `.ampula`, canonical links, static aliases, playback, or local library use.

## Success criteria

1. A Pages deployment with valid Cloudflare credentials deploys the relay and injects its HTTPS origin into the player runtime config.
2. No Cloudflare account-specific KV ID or rate-limit salt is committed to the repository.
3. A Pages deployment without valid relay credentials still deploys a fully usable player with the relay disabled.
4. Relay failure never invalidates or replaces the already-created canonical `?a=` fallback.
5. The production workflow and runtime wiring are covered by executable repository tests.
