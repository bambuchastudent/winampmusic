# Build revision capability

## Requirement: Visible deployment revision

The production footer SHALL display the product version followed by a deployment revision in the form `v1.5 rYYMMDDHHMM`.

### Scenario: Example deployment

- GIVEN revision `2609110005`
- WHEN the Pages artifact is stamped
- THEN the footer text is `v1.5 r2609110005`
- AND the existing repository link remains unchanged.

## Requirement: Madrid-local timestamp

The Pages deployment SHALL derive the revision from `Europe/Madrid` local time using `%y%m%d%H%M`.

### Scenario: Distinct minute

- GIVEN two deployments occur in different Madrid-local minutes
- WHEN each artifact is stamped
- THEN each visible revision differs.

## Requirement: Fail closed on invalid revision

The stamping process SHALL reject a revision that is not exactly ten decimal digits.

### Scenario: Invalid input

- GIVEN revision `bad-revision`
- WHEN the stamping script runs
- THEN it exits with failure
- AND does not publish an ambiguous revision.
