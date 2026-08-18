# Winamp Music optimization workflow

Optimization is allowed only after behavior is proven.

## Required order

1. **Specify behavior**
   - Write/update OpenSpec proposal, design, spec delta and tasks.
   - State interaction ownership and critical-path constraints.

2. **Prove functionality**
   - Run behavioral tests for Play/Pause, Previous/Next, track selection, seek/volume, filtering, import, Gift/QR, Clear, shared-playlist receive and background/media-session behavior.
   - A feature is not considered working because a selector/function exists; tests must execute the user action and assert the state transition.

3. **Run mutation tests**
   - Intentionally corrupt important behavior.
   - The normal behavioral suite must fail for each mutation.
   - A surviving mutation means the tests are too weak and the release is blocked.

4. **Measure startup/runtime cost**
   - Only after functional + mutation gates pass.
   - Keep the synchronous 183-track startup budget below 500 ms in CI.
   - Render a small initial track batch and append the remainder in idle chunks.
   - Keep network-backed/optional modules outside the synchronous startup path.

5. **Optimize without changing ownership**
   - Core playback handlers remain owned by the FAST player.
   - Optional features may call public controls/functions but may not intercept or replace core interactions.
   - Never add document-level capture/pointer interception as a performance/recovery shortcut.

6. **Re-run all three gates**
   - Functional behavior
   - Mutation score
   - Performance budget

## Critical-path rules

Normal startup must not synchronously require legacy `app.js`, service workers, recovery/failsafe layers, lyrics, comments, QR/share libraries or background/media-session code.

The first usable state is: local library read → initial rows rendered → Play/Prev/Next/track/filter controls active.

## Mutation gate policy

For release-critical mutations, the required mutation score is **100%**. Every listed mutant must be killed by at least one behavioral test. We prefer a small set of high-value domain mutations over a large count of trivial syntax mutations.

## Performance policy

Performance tests never substitute for functional tests. A faster build that changes behavior or weakens mutation coverage is a regression.
