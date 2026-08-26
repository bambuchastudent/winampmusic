# Short-link alias specification

An alias is an **optional transport shortcut**. It is not part of Ámpula Core, not a catalog, not an
account system, and not a playback source.

Two adapters implement this capability:

- `static` — same-origin files served by the app's own static host. Resolve-only from a browser.
- `relay` — a write-capable HTTP service. Implements the full contract.

## Requirement: An alias record is self-sufficient

An alias record MUST contain the complete compact transport payload, not a reference to a payload
held elsewhere.

Dereferencing an alias MUST allow the client to reconstruct the canonical self-contained `?a=` URL
locally, without any further request to the alias backend.

### Scenario: Alias record is self-sufficient

**Given** an alias created from a canonical share link
**When** the alias is dereferenced
**Then** the returned record MUST contain the full payload from that canonical link
**And** the client MUST be able to rebuild the canonical `?a=` URL from the record alone
**And** no additional backend request MUST be required to obtain the musical moment.

### Scenario: Backend disappears after a successful open

**Given** a receiver has opened an alias once
**When** the alias backend is later removed entirely
**Then** the canonical `?a=` URL the receiver already holds MUST still open the same Ámpula
**And** the sender's `.ampula` export MUST still open the same Ámpula.

## Requirement: The payload is validated but never interpreted

A backend MUST reject a payload that is not a compact Ámpula transport string, and MUST NOT decode,
decompress, rewrite, enrich, index or inspect the musical content of a valid payload.

### Scenario: Payload shape check

**Given** a submitted payload that does not match the compact transport prefix and alphabet
**When** the backend validates it
**Then** it MUST reject the submission
**And** the client MUST fall back to the self-contained link.

## Requirement: Static adapter contract

A `static` adapter MUST serve, from the application origin:

```text
GET <app>/a/<token>/            -> 200 text/html
                                   a redirect document targeting <app>/?a=<payload>

GET <app>/a/<token>.json        -> 200 application/json
                                   { "v": 1, "payload": "<encoding>.<base64url>", "expiresAt": null }
```

The redirect document MUST work without relying on the application bundle, MUST NOT load a
third-party script, and MUST target the application's own canonical `?a=` URL.

An unknown token MUST produce the static host's normal 404 rather than a partial Ámpula.

### Scenario: Static alias opens the canonical link

**Given** a committed alias for a canonical share link
**When** a browser opens `<app>/a/<token>`
**Then** it MUST arrive at `<app>/?a=<payload>` with the payload byte-identical to the canonical link
**And** the canonical receive flow MUST render the Shared music UI.

### Scenario: Static aliases are curated and disclosed

**Given** static aliases are stored in the repository and served publicly
**When** the capability is documented
**Then** the documentation MUST state that they are public, permanent until removed by a commit, and
intended for curated moments rather than private sharing
**And** the alias directory MUST be excluded from search-engine indexing.

## Requirement: Relay adapter contract v1

A conforming `relay` MUST expose:

```text
POST /a
  Content-Type: application/json
  { "v": 1, "payload": "<encoding>.<base64url>" }

  201 { "v": 1, "token": "Ab3Xk9pQ2",
        "url": "https://<relay-origin>/a/Ab3Xk9pQ2",
        "expiresAt": "<ISO-8601>" }

GET /a/<token>
  302 Location: <APP_URL>?a=<payload>

GET /a/<token>?format=json
  200 { "v": 1, "payload": "<encoding>.<base64url>", "expiresAt": "<ISO-8601>" }

GET /healthz
  200 { "ok": true, "v": 1 }
```

Error responses MUST use `400` (malformed request), `404` (unknown token), `410` (expired token),
`413` (payload too large), `429` (rate limited), `503` (storage or limiter unavailable) and `5xx`
(relay fault). Every error response MUST be safe for a client to treat as "alias unavailable".

CORS MUST allow the app origin for `POST /a` and `GET /a/<token>?format=json`.

The relay's browser redirect target is a full application URL including its path, while a browser
`Origin` header is only scheme, host and port. `Access-Control-Allow-Origin` MUST therefore be an
origin with no path, derived from the configured application URL. A relay MUST NOT emit a configured
application URL containing a path as `Access-Control-Allow-Origin`.

### Scenario: Round trip

**Given** a client posts a valid payload
**When** it then requests the returned token as JSON
**Then** the returned payload MUST be byte-identical to the posted payload.

### Scenario: CORS header carries an origin, not an application URL

**Given** the relay is configured with the application URL `https://example.test/winampmusic/`
**And** a browser sends requests with `Origin: https://example.test`
**When** the relay responds to a preflight or a cross-origin request
**Then** `Access-Control-Allow-Origin` MUST be exactly `https://example.test`
**And** it MUST NOT contain a path
**And** the browser redirect target MUST still be `https://example.test/winampmusic/?a=<payload>`.

### Scenario: Redirect target is the app, not the relay

**Given** a browser opens `GET /a/<token>` without `format=json`
**When** the token exists
**Then** the relay MUST redirect to the configured application URL with `?a=<payload>`
**And** the relay MUST NOT render its own player, catalog or track listing.

## Requirement: Declared limits

A conforming `relay` MUST declare and enforce:

- maximum payload size: 64 KB (`413` above the limit);
- token entropy: at least 48 bits from a cryptographic random source;
- creation rate limit: at most 30 registrations per hour per client (`429` above the limit);
- default retention: 180 days, not extended by reads.

A `static` alias MAY use a shorter, human-chosen token because a maintainer explicitly decides to
publish it; the documentation MUST disclose that such tokens are guessable.

### Scenario: Oversized payload

**Given** a payload larger than the declared maximum
**When** the client attempts registration
**Then** the backend MUST reject it
**And** sharing MUST continue with the self-contained link.

## Requirement: The creation rate limit is atomically enforced

The creation rate limit MUST be enforced with a primitive that is atomic under concurrency.

A relay MUST NOT implement it as a read-modify-write over an eventually consistent store without
compare-and-set, because concurrent requests then read the same stale counter and all pass.

The limit MUST hold when requests arrive concurrently, not only when they arrive one at a time.

The limiter MUST be isolated from Ámpula payload storage and MUST NOT have access to a payload.

### Scenario: Concurrent creation attempts

**Given** a client bucket with a declared limit of N registrations per window
**When** more than N registration requests are made concurrently rather than sequentially
**Then** at most N MUST be accepted
**And** every further request MUST be refused with `429`.

### Scenario: Rate limiter is unavailable

**Given** the rate limiter is not configured, or fails
**When** a client attempts registration
**Then** the relay MUST refuse the registration with `503` rather than accept it unlimited
**And** the client MUST fall back to the self-contained link.

### Scenario: Independent clients are not coupled

**Given** one client bucket has reached its limit
**When** a different client bucket registers a payload
**Then** that registration MUST be accepted.

## Requirement: Durability is explicitly weak

A backend MAY delete any token at any time, and a `relay` MUST expire tokens no later than the
declared retention.

Loss of a token MUST NOT be recoverable from the backend and MUST NOT be treated as loss of the
musical moment.

### Scenario: Token expires

**Given** a token whose retention has elapsed
**When** a receiver opens the alias
**Then** the backend MUST report it as gone
**And** the client MUST fail non-destructively
**And** the equivalent self-contained link MUST still open the same Ámpula.

## Requirement: Backends store no identity

A backend record MUST contain only the transport payload and, for a `relay`, creation and expiration
timestamps.

A backend MUST NOT store user identity, account data, device identifiers, request logs tied to a
payload, playback events, or derived musical metadata.

A rate-limit counter MUST NOT be stored beside a payload, MUST be named by a value that is not
reversible to a client address, and MUST be discarded when its window closes.

### Scenario: Record shape

**Given** a payload is registered with a relay
**When** the record is written
**Then** it MUST contain exactly the payload, `createdAt` and `expiresAt`
**And** it MUST NOT contain a user, device or session identifier.

## Requirement: Alias code is isolated from the player

Backend code MUST live outside the player runtime graph, MUST NOT be loaded by `index.html`, and
MUST NOT be required for startup, playback, import, saving, or opening `?a=`, `.ampula` or legacy
`?p=` / `?s=` links.

### Scenario: Backend absent

**Given** no alias backend is configured or reachable
**When** the application is used normally
**Then** every non-alias feature MUST behave exactly as before this change.

## Requirement: Deployment status is stated, not implied

The repository MUST contain a deployable relay implementation and configuration, and MUST NOT
represent it as an already running production service.

Documentation MUST distinguish capabilities that are live from this repository from capabilities that
require external infrastructure.

Enabling anonymous short-link creation MUST require an explicit configuration step.

### Scenario: Default repository state

**Given** the repository as committed
**When** the application runs
**Then** no write relay MUST be configured
**And** sharing MUST produce self-contained links only
**And** the documentation MUST say so.
