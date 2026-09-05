# Requirements

- GIVEN an Apple track playing through direct fallback WHEN Play/Pause is pressed THEN the same audio pauses and resumes without resolving or restarting it.
- GIVEN a warmed but unloaded YouTube player WHEN Play is pressed THEN the selected recording is loaded.
- GIVEN rapid selections while YouTube initializes WHEN initialization finishes THEN only the latest selected recording loads.
- GIVEN a pending direct resolution WHEN another recording is selected THEN the obsolete resolution cannot start audio or fall back.
- GIVEN a provider change WHEN the new recording starts THEN the previous provider is suspended and cannot overwrite progress/status.
- GIVEN core next/previous/ended navigation WHEN the target is Apple Music THEN preferred routing is used.
- GIVEN a provider-specific PLAYING or PAUSED status WHEN a media-session action fires THEN pause/play is idempotent.
