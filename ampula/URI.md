# Ámpula URI / compact transport v1

The canonical Ámpula object is UTF-8 JSON. Links and QR codes use a compact transport representation of the same domain object; transport is not musical identity.

## Current web transport

AMPULAMP v1 uses one query parameter:

```text
?a=<encoding>.<payload>
```

Supported encodings:

- `j.` — compact JSON encoded as base64url;
- `g.` — the same compact JSON gzip-compressed, then base64url encoded.

A client MUST decode the transport back into the canonical Ámpula Core v1 object before presenting it.

The payload is self-contained. Opening or forwarding the link does not require an Ámpula account, hosted catalog, paste service, short-link service, or central resolver.

## Compact field mapping

Compact transport uses short field names only to reduce link/QR size:

```text
v -> transport version
c -> capturedAt
s -> startTrack
m -> [moment.title, moment.note]
t -> ordered tracks
```

Each compact track is an ordered tuple containing title, artists, album, version label, duration, stable IDs and historical observations. Clients must treat it as a transport encoding only and expose the canonical field semantics after decoding.

## Legacy links

Legacy provider-ID-only links such as:

```text
?p=id.id.id
```

are not Ámpula v1 and MUST NOT be generated as fallback transport. A client may report them as unsupported; it must not silently reinterpret them as a full Ámpula.

## Future custom scheme

A future registered scheme may use:

```text
ampula:<compact-payload>
```

The scheme is intentionally not required for web interoperability in v1.
