# YouTube authorization experiment — stage 1 agent journal

## Scope and evidence

User request: run stage 1 with Sol/Luna subagents, maintain a journal, and deliver a pull request containing diagnostics and an authorization experiment.

Base: `origin/develop` at `2aa2e7ab4d136ac2d118c479c55e84a723eee731`.
Working branch: `feat/youtube-auth-experiment-v190`.

This is a coordinator-maintained audit trail, not a provider-signed model attestation. Agent identifiers below are the canonical task names returned by the actual spawn tool. Model and effort fields record the explicit parameters requested at spawn. Git commits and CI establish code and test outcomes, not the identity of the model that generated them.

## Actual agent launches

| Agent task identifier | Requested model | Reasoning | Assigned scope | State |
| --- | --- | --- | --- | --- |
| `/root/auth_experiment` | `gpt-6-sol` | `high` | Isolated TV authorization experiment, dedicated transport, specification and tests | Interrupted; partial implementation and tests retained |
| `/root/playback_diagnostics` | `gpt-6-luna` | `high` | Safe failure categories, timestamp, request-correlated transport, specification and tests | Interrupted; partial implementation and tests retained |
| `/root/relay_audit` | `gpt-6-luna` | `high` | Read-only audit of anonymous relay, authentication boundaries and verification gates | Completed; no files changed |
| `/root/auth_experiment_resume` | `gpt-6-sol` | `high` | Complete and verify the retained authorization experiment | Completed; mock controller, relay and UI contracts passed |
| `/root/diagnostics_resume` | `gpt-6-luna` | `high` | Complete and verify the retained playback diagnostics | Completed; targeted tests and final overlap fix retained |
| `/root/stage1_review` | `gpt-6-sol` | `high` | Independent read-only review of authentication, relay and diagnostics | Findings delivered; stopped by usage limit before final diagnostics recheck |

Each agent received a bounded task with `fork_turns: none`. Implementation ownership is disjoint in the same worktree; the coordinator alone integrates, versions and publishes the branch. The audit agent has been instructed not to write files.

On the user's continuation request (2026-09-26), the live agent registry contained only `/root`. The coordinator inspected the retained files and launched the two explicit resume tasks above. The previous workers were not described as continuing in the background. Their partial artifacts are being reviewed before acceptance.

## Acceptance boundaries

- Normal playback must remain anonymous and preserve iframe fallback.
- The experiment is opt-in and isolated from the normal player.
- OAuth success, acceptance by InnerTube, stream availability and actual media playback are separate observations.
- No real account login, credential import, production deployment or PR merge is part of the automated stage.
- No secrets, authorization codes, raw upstream reasons or signed media URLs belong in exported diagnostics or this journal.
- Provider account confirmation must be performed by the user on the provider's own page.

## Results and verification

Implementation and coordinator verification of final review fixes are complete. Live personal authorization and phone lockscreen behavior have not been tested.

- First full run: 66/73 passed. All seven failures were exact assertions for the old service-worker build after the intended v1.9.0 cache bump. The assertions were updated without changing their behavior checks.
- Second full behavioral run: 73/73 passed with four workers.
- Final full run after review fixes: 73/73 passed with four workers in 7.594 s. Syntax checks and `git diff --check` passed.
- Isolated mutation gate: 5/5 mutants killed (100%).
- Isolated performance gate: passed; 33.6 ms synchronous startup in this workspace (not a phone benchmark).
- Auth page controls are exercised with jsdom and fake network responses. No visual browser or live Google account trial has been claimed.

### Review changes

Coordinator review caught a UI secret being cleared before controller creation, coercive relay token validation, missing refresh-token rotation handling, and empty successful revocation responses. The implementation agent fixed these and added regressions.

Independent Sol review caught an unsupported inference from `LOGIN_REQUIRED` to bearer rejection, late authorized requests after cancel/logout, ambiguity when same-video lookups overlap after one request completes, and a poll interval cap that could be faster than Google's requested interval. Fixes keep provider acceptance unknown, cancel TV requests, conservatively mark overlapping attribution unknown, and preserve the provider interval. The reviewer inspected the authentication fixes and reported no additional auth blocker, then hit its usage limit before independently rechecking the last diagnostics fix. The coordinator inspected the retained active-lookup-context fix and reran the full suite. This is not recorded as an independent final sign-off.


### Relay audit findings checked by coordinator

- `requestCandidates()` includes public CORS fallback services. Authenticated requests must not enter it.
- Both the browser adapter and `relay/youtubejs/worker.js` remove Cookie and Authorization. The existing relay is intentionally anonymous.
- Media playback uses the resolved URL directly in `Audio.src`; relay metadata success does not establish media playback success from the user's network.
- Diagnostics currently collapse errors to stable codes; the new fields must preserve that privacy boundary.
- The audit raised a possible stale diagnostic concern. Coordinator inspection found an existing identity check (`lastDiagnostics === report`) before failure display; the concern is not recorded as a confirmed bug. New transport attribution includes explicit overlapping-request tests.

### Source verification

Coordinator retrieved the pinned `youtubei.js@18.0.0` OAuth implementation from `https://cdn.jsdelivr.net/npm/youtubei.js@18.0.0/dist/src/core/OAuth2.js` for the auth agent to verify credential initialization. No credentials were used in this retrieval.
