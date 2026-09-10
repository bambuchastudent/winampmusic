# Proposal: Timestamped footer build revision v1.6.6

## Problem

The production footer currently shows only `1.5`, so a user cannot tell which GitHub Pages deployment is actually open in a browser. Commit SHA revisions are precise but awkward to read and compare on mobile.

## Goal

Show a compact human-readable deployment revision in the footer using the Madrid-local deployment timestamp.

## Scope

- Keep the public product version at `v1.5`.
- Stamp the deployed Pages artifact with `rYYMMDDHHMM`.
- Use `Europe/Madrid` as the revision timezone.
- Example: `v1.5 r2609110005`.
- Generate the value during the Pages deploy job rather than committing a new timestamp for every build.
- Fail the deploy if the footer stamp cannot be applied cleanly.

## Non-goals

- Replacing semantic/product versioning.
- Using commit SHA as the visible revision.
- Maintaining a separate monotonically increasing build counter.

## Success criteria

1. A production Pages artifact displays `v1.5 rYYMMDDHHMM` in the existing footer.
2. The revision is derived from deployment time in `Europe/Madrid`.
3. Two deployments in different minutes produce different visible revisions.
4. The stamping step validates the 10-digit revision and refuses malformed values.
5. Existing footer link behavior remains intact.
