# Acceptance artifacts

This file records non-normative, human-testable artifacts used to verify the short-link transport.

## `a/tatu200`

`a/tatu200` is a **demo / acceptance fixture only**. It exists so a maintainer can open one known short URL after deployment and verify the complete path:

`/a/<token>` → canonical `?a=<payload>` → existing Shared music receive flow.

The fixture currently represents one 12-track Ámpula for t.A.T.u. — *200 По встречной*. Its musical content is incidental to the feature.

It MUST NOT be treated as:

- a built-in playlist or bundled catalog content;
- a reserved or semantically meaningful short-link token;
- a special case in runtime routing, playback, resolution, import, or persistence;
- the mechanism by which normal users create short links;
- a required permanent part of Ámpula Core or the short-link protocol.

The fixture MAY be replaced or removed later without changing the short-link contract, provided equivalent acceptance coverage remains.

Normal product behavior is independent of this artifact: canonical `?a=` sharing remains the durable fallback, and anonymous short-link creation still requires a deployed and configured write relay.
