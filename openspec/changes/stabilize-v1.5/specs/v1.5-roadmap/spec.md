# AmpMusic 1.5 roadmap specification

## Requirement: public release line remains 1.5
AmpMusic SHALL remain on the public `1.5` release line until an explicitly approved specification authorizes a version change.

### Scenario: feature work continues
- GIVEN new capabilities are planned or implemented
- WHEN they are shipped without an explicitly approved version-change spec
- THEN the public product version SHALL remain `1.5`
- AND the product SHALL NOT advertise `2.0` or another major version.

## Requirement: next 1.5 stage is import expansion plus Telegram interface
The next planned product stage after stabilization SHALL remain part of the AmpMusic 1.5 roadmap and SHALL include:
- improved track and playlist import flows;
- a Telegram interface for using AmpMusic from Telegram.

Telegram implementation is roadmap-only in the stabilization change and SHALL NOT be implemented as part of the current fix.

### Scenario: stabilization release
- WHEN the current stabilization work is merged
- THEN no Telegram runtime/UI code is required
- AND the roadmap SHALL retain Telegram interface work as a next 1.5 stage.

## Requirement: evaluate an agent-friendly universal UI framework before any UI rewrite
The 1.5 checklist SHALL include a research spike evaluating whether AmpMusic should migrate from the current lightweight HTML/CSS/JS UI to a mainstream, portable component framework that is easy for AI coding agents to understand, modify, test and generate interfaces for.

The evaluation SHALL preserve the existing interface as the UX reference baseline. A migration SHALL NOT be approved merely because a framework is newer or more popular.

The spike SHALL compare at least these concerns:
- compatibility with static/PWA deployment and the current GitHub Pages model;
- component/declarative structure that AI agents can edit reliably;
- TypeScript/schema friendliness and automated testability;
- mobile Chrome/Safari performance and startup cost;
- ability to reuse UI logic in a future Telegram Mini App/interface;
- accessibility and responsive-layout support;
- migration complexity and risk to the current working player UI;
- ability to keep the current visual identity and interaction model essentially unchanged.

### Scenario: framework evaluation completes
- WHEN the research spike is completed
- THEN it SHALL produce a short recommendation with candidate framework(s), migration cost, expected benefits, risks and a keep-current-stack option
- AND no migration SHALL start automatically
- AND the existing AmpMusic 1.5 UI SHALL remain the reference implementation unless a separate approved spec selects a migration path.