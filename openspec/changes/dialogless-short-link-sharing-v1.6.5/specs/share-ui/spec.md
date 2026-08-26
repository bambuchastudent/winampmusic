# Share UI requirements

## Requirement: Share is dialogless

The application MUST NOT present a custom share modal/dialog when the user activates `Share`.

### Scenario: sharing current music

- GIVEN the local library contains shareable tracks
- WHEN the user activates `Share`
- THEN the application builds a valid canonical Ámpula link
- AND no custom share dialog is shown
- AND a usable link is copied to the clipboard when clipboard facilities are available.

## Requirement: short link wins when available

The application MUST prefer the configured Ámpula short-link alias as the final clipboard value when alias minting succeeds.

### Scenario: short alias succeeds

- GIVEN a canonical Ámpula link has been built and copied as a fallback
- AND the configured short-link transport mints an alias
- WHEN the alias becomes ready
- THEN the short alias replaces the canonical link as the final copied value
- AND the status indicates that the short link was copied.

### Scenario: short alias is unavailable

- GIVEN the canonical Ámpula link has been built
- WHEN alias minting is unavailable, fails, or times out
- THEN sharing still succeeds with the canonical link
- AND the share flow does not block on a custom dialog.

## Requirement: received shares are inline

Opening shared music MUST NOT present the received music in a modal dialog.

### Scenario: canonical share is opened

- GIVEN the URL contains a valid `?a=` Ámpula payload
- WHEN the share is decoded
- THEN the received track surface is shown inline in the main library area
- AND the normal local-library list is temporarily hidden
- AND the received track rows remain directly playable.

### Scenario: short alias is opened

- GIVEN the URL contains a valid `?al=` alias
- WHEN that alias resolves to an Ámpula payload
- THEN the same inline received-track surface is used
- AND no receive modal is shown.

## Requirement: opening remains non-destructive

Opening or playing received music MUST NOT mutate the saved local library without an explicit user action.

### Scenario: user only listens

- GIVEN a received share is open inline
- WHEN the user plays one or more received tracks
- THEN the saved local library remains unchanged.

### Scenario: user returns to local library

- GIVEN a received share is open inline
- WHEN the user activates the return-to-library control
- THEN the received surface is dismissed
- AND the normal local-library surface is restored
- AND share routing parameters are removed from the current URL.
