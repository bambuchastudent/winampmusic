# Proposal: resolver final trust gate v1.6.7

## Problem
A production diagnostic captured `Madigan — The News` being persisted as trusted YouTube id `vuJwrcKQ7Sg` (`News in the Past: Kathleen Madigan`) even though the returned candidate duration was 262s versus the canonical 279s. The current matcher contract says candidates outside ±15s are rejected, so a consumer must not blindly trust a matcher result or stamp it as trusted.

## Goal
Add an independent final trust gate at the persistence boundary for current-track resolution and two-track prefetch. A candidate can receive the trusted resolver marker only after the final gate validates its id, duration, title identity, and artist identity against canonical origin metadata.

## Scope
- Add a shared final trust gate runtime.
- Require current-track and prefetch persistence paths to use it.
- Bump trusted marker to `music-only-v1.6.7` so prior v1.6.4 matches are revalidated when they become current.
- Cache-bust the resolver/trust loading chain.
- Record final-gate rejection reasons in diagnostics.

## Non-goals
- Do not change canonical Spotify/Apple title or artist.
- Do not eagerly resolve whole playlists.
- Do not loosen the two-track prefetch window.

## Success criteria
- `Madigan — The News` cannot persist `News in the Past: Kathleen Madigan` as a trusted match.
- A 17-second duration mismatch is rejected when canonical duration is known.
- Short ambiguous titles require stronger title identity than a single shared keyword.
- A rejected matcher result never receives the trusted resolver marker.
- Existing correct Topic/official music matches continue to pass.
