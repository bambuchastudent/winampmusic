# Design: Timestamped footer build revision v1.6.6

## Ownership

The revision belongs to the deployed artifact, not to source control. The repository source therefore keeps the existing footer markup, while the Pages workflow stamps a copy immediately before upload.

## Format

Visible footer text is:

`v1.5 rYYMMDDHHMM`

Example: `v1.5 r2609110005`.

The timestamp timezone is explicitly `Europe/Madrid` so the value matches the user's local operational context rather than the GitHub runner's UTC clock.

## Stamping

A small Node script accepts:

1. path to `index.html`;
2. an explicit 10-digit revision string.

It validates `/^\d{10}$/`, finds the existing `.app-version-link` anchor, and replaces only its visible text. The href and all other footer attributes remain unchanged.

The Pages workflow computes the timestamp with:

`TZ=Europe/Madrid date +%y%m%d%H%M`

and passes it to the stamping script before `actions/upload-pages-artifact`.

## Failure behavior

The script exits non-zero when the revision is malformed, the footer anchor is missing, or the expected source text cannot be changed. A broken stamp therefore prevents publication instead of silently deploying an ambiguous footer.

## Verification

A behavioral test runs the stamper against a temporary HTML fixture and verifies:

- `2609110005` produces `v1.5 r2609110005`;
- the footer link target survives unchanged;
- malformed revisions fail;
- workflow configuration declares `Europe/Madrid` and `%y%m%d%H%M` before upload.
