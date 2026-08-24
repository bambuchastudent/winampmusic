# Repository integrity specification

## Requirement: cleanup is behavior-preserving
Repository cleanup MUST NOT intentionally change user-visible behavior, player UX, product branding, playback/import routing, Share/QR behavior, PWA behavior, or compatibility identifiers.

### Scenario: existing production contract remains intact
- GIVEN the current Ámpula MP production player
- WHEN repository cleanup removes a proven-dead file
- THEN all current startup, playback, import, sharing, receiver, recovery, and branding contracts remain unchanged.

## Requirement: every current runtime reference resolves
Every local JavaScript target reachable from the current HTML startup graph, every current service-worker file reference, and every manifest asset reference MUST resolve to an existing repository file.

### Scenario: lazy module target
- GIVEN a current runtime module contains a lazy local JavaScript target such as `./module.js`
- WHEN repository integrity is checked
- THEN the referenced file exists even if it is loaded only in a rare scenario.

## Requirement: removal requires dependency evidence
A file MUST NOT be removed solely because of its name, age, or version number. Removal requires evidence that it is not required by runtime, lazy loading, public window APIs, tests, workflows, OpenSpec production contracts, PWA/manifest behavior, or GitHub Pages build/deploy.

### Scenario: legacy-looking but referenced file
- GIVEN an old-version file is referenced by a current runtime path, test, workflow, service worker, or compatibility contract
- WHEN cleanup candidates are classified
- THEN the file is retained.

## Requirement: removed filenames leave no executable/config references
A removed filename MUST have no remaining production runtime, test, workflow, PWA, manifest, or build/deploy reference. Historical explanatory prose may document a removal but MUST NOT be interpreted as an executable dependency.

## Requirement: ambiguous public/recovery files are retained
Files that may be externally addressable recovery or compatibility entrypoints MUST be retained unless their public URL compatibility has been explicitly retired.

## Requirement: current critical scripts remain
Repository integrity MUST verify the presence of the current core and adapter scripts, including `fast-player-v141.js`, `clean-playback-v150.js`, `apple-catalog-first-v150.js`, `apple-musickit-v150.js`, `unified-entry-v152.js`, `import-playback-guard-v159.js`, `header-visualizer-v159.js`, `fast-actions-v143.js`, and current Share/QR modules.
