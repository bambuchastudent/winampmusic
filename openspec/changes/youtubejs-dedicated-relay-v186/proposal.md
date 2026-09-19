# Proposal: dedicated YouTube.js relay

## Problem

The first-party browser transport was added to the short-link Worker. The full Pages suite correctly rejected this because the short-link relay is required to be an opaque Ámpula alias service that never knows about music providers.

## Goal

Keep the short-link relay completely provider-agnostic and move browser YouTube.js transport into its own optional Worker and runtime configuration.

## Scope

- restore `relay/short-link/worker.js` and its README to the provider-agnostic alias contract;
- add a separate `relay/youtubejs/` Worker with a narrow YouTube-owned host allowlist;
- add a separate generated `youtubejs-relay-config.js`;
- make the YouTube.js adapter read only `window.AMPULA_YOUTUBEJS_RELAY`;
- load that config before the deferred YouTube.js adapter;
- deploy/health-check the playback relay independently in the Pages workflow;
- keep Pages deployable when Cloudflare credentials are absent.

## Non-goals

- no weakening of short-link invariants or tests;
- no general-purpose proxy;
- no YouTube login/account forwarding;
- no audio-byte proxy in the normal resolved path;
- no change to Ámpula Core identity.

## Success criteria

The full Pages suite passes, including the existing short-link invariant that its Worker contains no provider-specific logic. When Cloudflare credentials are available, the dedicated relay is published and the browser receives only its public HTTPS URL.
