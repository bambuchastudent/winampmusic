# Design

The existing YouTube.js adapter owns diagnostics. On `Streaming data not available`, inspect `getBasicInfo` from the default WEB client. Only if playability is `OK` and no audio formats are present, retry once with the supported `YTMUSIC` client. An access rejection or other error immediately preserves the iframe fallback. The normal audio element path and provider-independent library identity stay unchanged.

The diagnostic view is populated from explicit allowlisted fields and fixed error categories, never from raw upstream JSON, URLs, cookies, tokens or exception stacks. Resolve attempt IDs prevent late requests from overwriting a newer track's diagnostic. No new remote telemetry or storage is added. In diagnostic-only mode the same view remains available and iframe fallback remains disabled.
