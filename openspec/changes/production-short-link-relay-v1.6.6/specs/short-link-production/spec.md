# Production short-link relay requirements

## Requirement: production relay deployment is optional

The production Pages delivery MUST attempt to deploy the Ámpula short-link relay when the required Cloudflare credentials are configured, and MUST preserve a deployable player when they are absent or the optional relay deployment fails.

### Scenario: credentials are configured

- GIVEN production delivery has Cloudflare API credentials
- WHEN the Pages deploy job runs
- THEN it attempts to deploy `relay/short-link`
- AND no account-specific KV namespace id is required in source control.

### Scenario: credentials are absent

- GIVEN one or both Cloudflare deployment credentials are absent
- WHEN the Pages deploy job runs
- THEN relay deployment is skipped
- AND the Pages application still deploys
- AND the client keeps using canonical self-contained `?a=` sharing.

### Scenario: optional relay deployment fails

- GIVEN Cloudflare deployment was attempted
- WHEN that optional deployment fails
- THEN Pages delivery can continue with relay runtime configuration disabled
- AND normal playback and canonical sharing remain available.

## Requirement: relay runtime configuration contains no private deployment state

The browser runtime configuration MUST contain only the public HTTPS relay base URL and MUST NOT contain Cloudflare credentials, `RATE_SALT`, KV identifiers, or other secrets.

### Scenario: relay URL is valid

- GIVEN Wrangler reports a valid HTTPS deployment URL
- WHEN runtime configuration is generated
- THEN `window.AMPULA_SHORT_LINK_RELAY` is set to its normalized HTTPS base URL.

### Scenario: relay URL is unusable

- GIVEN the deployment URL is empty, malformed, or not HTTPS
- WHEN runtime configuration is generated
- THEN the resulting configuration leaves the relay disabled.

## Requirement: rate-limit salt is deployment-private

`RATE_SALT` MUST NOT be committed as a usable value in Worker variables and MUST be supplied as private deployment state whenever production relay deployment is attempted.

### Scenario: repository configuration is inspected

- WHEN `relay/short-link/wrangler.toml` is read
- THEN no placeholder or production rate-limit salt is stored in `[vars]`
- AND production delivery supplies `RATE_SALT` through the Worker secret mechanism.

### Scenario: secret delivery fails

- GIVEN relay deployment cannot deliver its required private deployment state
- WHEN the optional relay deployment does not complete successfully
- THEN the Pages artifact leaves relay runtime configuration disabled
- AND canonical sharing remains available.

## Requirement: client wiring is available before alias use

The runtime relay configuration MUST load before the application executes the short-link adapter, while remaining outside normal playback startup.

### Scenario: user shares music

- GIVEN production CI generated a relay config
- WHEN the user activates Share
- THEN `fast-actions-v143.js` loads the config before it loads `ampula-short-link-v163.js`
- AND the alias adapter can attempt short-link creation.

### Scenario: user opens a short alias

- GIVEN the URL contains `?al=`
- WHEN the receive path starts
- THEN the same runtime config loads before the short-link adapter
- AND alias resolution can use the configured relay.

## Requirement: relay failure never replaces the canonical fallback

The relay remains optional transport convenience.

### Scenario: relay is unhealthy at share time

- GIVEN a canonical `?a=` URL was created
- AND relay creation times out or fails
- WHEN Share completes
- THEN the canonical URL remains usable
- AND no share/receive modal is introduced.
