# Ampula player roadmap

The current control path is stable across the YouTube iframe, direct audio, and Apple Music adapters. The next product step is to make playback continuous and source-independent:

1. Rebase and merge PR #84 (local playback continuity v1.6). It restores the same recording and position after reload and list reorder, while keeping shared Ámpulas separate from the local library.
2. Rebase PR #65 before merging. Its EQ panel is a useful deferred UI, but it must remain explicitly visual-only for provider-owned audio and be reconciled with the current player markup.
3. Merge PR #85 as a documentation-only follow-up. It records that `a/tatu200` is an acceptance fixture, not a runtime or format special case.
4. Add first-class Saved/Received playback contexts, source replacement recovery that preserves position, and a provider capability model. These are the pieces needed for queue history, resume, and reliable cross-provider playback without rewriting Ámpula Core.
5. Add a local Web Audio path only for sources the client owns. That is the point at which the equalizer can become audible; YouTube iframe and Apple Music playback should continue to advertise their provider limitation.
