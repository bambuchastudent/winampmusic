# Standalone TV authorization metadata page

This opt-in operator page is independent of AMPULAMP's ordinary playback. Serve `index.html` and `experiment.mjs` together over HTTPS. Configure and deploy the separate relay following [the relay operator guide](../../relay/youtube-auth/README.md), then enter its HTTPS origin and your own Google TV/Limited Input OAuth client ID and optional secret in the page. Nothing is authorized or deployed automatically.

The page requests Google's `youtube.readonly` scope, keeps codes and tokens only in tab memory, and exports a constrained JSON report. Cancel or reload discards local credentials; Sign out also attempts token revocation. It probes TV metadata only. `authorizedBearerSent` records whether the experimental transport attempted an authorized InnerTube request, while `provider: "unknown"` means an `OK` or `LOGIN_REQUIRED` status alone cannot establish whether TV accepted the token. Audio format count is metadata; stream and playback remain untested. Never enter cookies or credentials belonging to the official YouTube TV application.

Tests are mock-only: `node tests/youtube-auth-experiment-v190.mjs`. A real Google authorization and TV response require an operator-run manual experiment.
