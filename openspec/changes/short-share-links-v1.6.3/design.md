# Design: Short Ámpula share links

> This change adds a transport alias. It does not add a domain model, and it does not modify
> Ámpula Core v1 (`ampula/README.md`, `ampula/schema/ampula-1.schema.json`) or the compact `?a=`
> transport described in `ampula/URI.md`.

## 1. Ownership

| Layer | Owns | Never owns |
| --- | --- | --- |
| Ámpula Core v1 object | the musical moment, ordered tracks, metadata, observations | transport |
| `?a=<payload>` link, `.ampula` file, QR | full-fidelity transport | identity |
| Alias token | a short, revocable pointer | identity, fidelity, playability |
| Local resolver | playable source selection | the Ámpula object |

## 2. The invariant that makes an alias safe

**An alias record stores the complete canonical transport payload, never a reference to one.**

Consequences:

1. Dereferencing an alias reconstructs the full `?a=` URL *locally*, in the receiver's address bar.
   After one successful open, the receiver holds a self-contained link that needs no alias service.
2. The sender's canonical link and `.ampula` export are produced **before** any alias exists, so no
   code path can create an Ámpula that lives only behind a token.
3. If every alias service dies, no musical moment is lost — only the shortcuts are.

This is the property that separates an alias from a backend, and it is enforced by test, not by
convention. A future "optimization" that stores a row id and rehydrates from a server catalog would
break scenario *Alias record is self-sufficient* in the spec delta.

## 3. Why not the obvious options

- **Public shortener (bit.ly / tinyurl / t.co / is.gd).** Hands the moment to an operator with
  unrelated privacy, retention and availability guarantees. Forbidden by the product rules; a guard
  test asserts these hosts are absent from runtime code.
- **Gist / paste service.** `ampula-native-sharing-v1.6` explicitly removed the `pastepile`
  dependency ("Remove centralized paste/short-link dependency from current sharing"). Reintroducing
  a paste store would contradict a shipped spec.
- **Only shrink the canonical link.** Zero infrastructure and zero new failure modes, but a
  multi-track moment cannot compress to `/a/Ab3Xk9` by construction. It complements this change; it
  does not replace it.
- **Relay-only design.** This was the first draft of this document and it was wrong: GitHub Pages
  deploys nothing writable, so a relay-only design ships a complete-looking client and **zero real
  short links** until somebody provisions an external account.

## 4. Two adapters, one contract

```text
alias adapter
  ├─ static  (same-origin, GitHub Pages)   resolve ✅ live   create ⛔ not from a browser
  └─ relay   (write-capable HTTP service)  resolve ✅        create ✅   (none deployed here)
```

### 4a. `static` — Pages-native, live from this repository

GitHub Pages 301-redirects `/dir` to `/dir/` and serves `dir/index.html`. A committed alias is
therefore a real short URL with no service behind it:

```text
a/<token>/index.html   ->  <meta http-equiv="refresh"> + JS redirect to ../../?a=<payload>
a/<token>.json         ->  { "v": 1, "payload": "<encoding>.<base64url>", "expiresAt": null }
```

`index.html` is the zero-JavaScript-support path: opening the short URL in any browser lands on the
canonical `?a=` URL and from there in the ordinary receive flow. `<token>.json` is the
machine-readable path used by `?al=<token>` client resolution.

Minting is a maintainer action, not an application action:

```bash
node scripts/create-short-link.mjs --url "https://…/winampmusic/?a=g.…"
# writes a/<token>/index.html + a/<token>.json, prints the short URL
```

plus a `workflow_dispatch` workflow that runs the same script and commits the result.

**Honest limits of `static`:** aliases are public, permanent and unexpirable without another commit;
they are curated (pinned, demo, press) moments, not private user sharing. `robots.txt` disallows
`/a/` so they are not indexed.

### 4b. `relay` — write-capable, contract-defined, not deployed

For anonymous end-user creation a deployment may configure a relay implementing the v1 contract in
`specs/short-link-alias/spec.md`. `relay/short-link/` contains a reference Cloudflare Worker plus
`wrangler.toml`: a single stateless handler over a KV namespace with native TTL, chosen because it is
the smallest realistic write endpoint with no server to operate.

**It is not deployed by this change.** `relay/short-link/README.md` lists the required steps.

## 5. Configuration

```text
window.AMPULA_SHORT_LINK_RELAY            // runtime override
<meta name="ampula-short-link-relay">     // static deployment override
```

Absent by default. With no configuration the alias client reports "no write backend", performs no
network work during share, and share behaviour is byte-for-byte the current behaviour. A configured
value must be an absolute `https:` origin and is rejected if it resolves to a known public shortener.

Resolution needs no configuration at all: the `static` adapter is same-origin.

## 6. Share flow

```text
Share button
  └─ lazy load share-ui-cleanup + compact-share        (unchanged)
  └─ compact-share.share()  ->  long ?a= URL, dialog open, status ÁMPULA LINK READY
  └─ lazy load ampula-short-link-v163.js               (optional, failures ignored)
  └─ shortLink.apply(longUrl)
       ├─ no write backend configured   -> null, dialog keeps the long link
       ├─ payload above the limit       -> null, dialog keeps the long link
       ├─ timeout / offline / non-2xx   -> null, dialog keeps the long link
       └─ 2xx + valid token             -> #winampShareUrl becomes the short URL
  └─ lazy load qr-share-v1.js                          (renders whichever link won)
```

The dialog is open and copyable **before** the alias is attempted, so a slow backend degrades link
length, never the Share UI. The attempt is bounded by an `AbortController` deadline
(`TIMEOUT_MS = 2500`). The alias client rewrites only `#winampShareUrl`; the note element stays owned
by `share-ui-cleanup-v162.js`, preserving the v1.6.2 Received-Share UI contract.

## 7. Receive flow

Two paths, one canonical terminus.

**Path A — static redirect (no client support required):**

```text
GET <app>/a/Ab3Xk9  -> 301 /a/Ab3Xk9/ -> index.html -> <app>/?a=<payload>
                    -> existing canonical ?a= receive flow, untouched
```

**Path B — client-resolved alias:**

```text
<app>/?al=Ab3Xk9
  -> fast-actions lazily loads compact-share + ampula-short-link
  -> resolve: same-origin ./a/Ab3Xk9.json   (static, needs no config)
     then:    <relay>/a/Ab3Xk9?format=json  (only if configured)
  -> history.replaceState -> <app>/?a=<payload>
  -> window.winampMusicCompactShare.load()          <-- canonical receiver
```

In both paths the object is produced by `compact-share.js`, so a short link and its long equivalent
yield an identical Core object, the same Shared music dialog, and the same non-destructive
semantics. The token is used once to fetch a payload; it is never written to
`winampmusic.library.v1`, never written to `winampmusic.ampulas.v1`, and never added to the Core
object.

## 8. Compatibility

- `?a=` generation, encoding, decoding and rendering are unchanged.
- `.ampula` export/open is unchanged.
- Receive-only legacy `?p=` / `?s=` recovery in `legacy-share-v1.js` is unchanged. `al` is a new
  parameter and cannot collide with `a`, `p`, `s` or `playlist`.
- `al` joins the parameters stripped when the app rebuilds its own base URL
  (`compact-share.appUrl`, `ampula-file-open-v1.js`, the Clear action), so a stale token is never
  re-shared or persisted.
- No storage key is added, removed or migrated.

## 9. Critical-path constraints

The FAST invariant holds:

- `index.html` is unchanged; no startup script is added.
- `ampula-short-link-v163.js` loads only after a Share tap or when `?al=` is present.
- The module is inert when no write backend is configured.
- No alias request blocks playback controls, library rendering, or opening the Share dialog.

## 10. Failure modes

| Failure | Behaviour |
| --- | --- |
| No write backend configured | Share returns the canonical long link. No network call. |
| Backend offline / DNS / TLS failure | Bounded fetch rejects, long link retained, no user-facing error. |
| Backend slow | `AbortController` fires at 2500 ms, long link retained. |
| Backend 4xx/5xx, malformed body, bad token | Treated as unavailable, long link retained. |
| Payload above the limit | Alias skipped locally before any request. |
| `?al=` token unknown/expired (404/410) | Non-destructive `SHORT LINK EXPIRED OR UNAVAILABLE`; library untouched; player usable. |
| `?al=` backend unreachable | Same non-destructive status; the sender's long link and `.ampula` remain valid. |
| Backend returns a payload failing Core validation | Rejected by the canonical decoder exactly like an invalid `?a=`. |
| Static alias file deleted from the repository | The short URL 404s; every canonical link keeps working. |

## 11. Privacy, expiration, durability

| | `static` | `relay` |
| --- | --- | --- |
| Who can create | maintainer (commit) | anyone with app access |
| Visibility | public, in git history | operator-visible |
| Expiration | none without a commit | 180 days default TTL |
| Revocation | delete the files, redeploy | delete the key |
| Stored fields | `payload` only | `payload`, `createdAt`, `expiresAt` |
| Identifiers stored | none | none |

Neither adapter stores a user identifier, account, device id, playback telemetry or referrer. Tokens
are random and never derived from payload content. Read requests never extend retention. A backend
may drop any token at any time; by the §2 invariant that never loses a musical moment.

The client never sends a backend anything that is not already inside the shareable link itself.

## 12. Adversarial notes kept on record

- *"Two adapters with different durability is a leaky abstraction."* Accepted. Mitigated by never
  promising alias durability in UI or spec, and by the fact that a user cannot accidentally mint a
  permanent `static` alias — only a maintainer can.
- *"You committed share payloads into git forever."* Accepted and bounded: curated use only,
  documented as public and permanent, excluded from indexing.
- *"The relay could become mandatory."* Structurally prevented by §2 and enforced by test.
