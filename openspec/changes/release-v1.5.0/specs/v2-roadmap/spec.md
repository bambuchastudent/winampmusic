# 1.5 roadmap version lock

## Requirement: future work remains on 1.5 unless explicitly approved
AmpMusic 1.5 SHALL NOT show a `Version 2.0` teaser or otherwise advertise a future major release merely because roadmap work exists.

The next planned work remains inside the 1.5 roadmap and includes improved track/playlist import plus a Telegram interface. Telegram implementation is not part of the current stabilization change.

### Scenario: user views the 1.5 import surface
- WHEN the canonical 1.5 player renders
- THEN current 1.5 import controls remain immediately usable
- AND no unapproved 2.0 teaser is shown.

### Scenario: future roadmap work starts
- WHEN import expansion, Telegram interface work or UI-framework research begins
- THEN the public version remains 1.5 unless a separate explicitly approved version-change spec exists.
