# Proposal

Keep AmpMusic as the playback surface for Apple Music links.

The regression introduced by source-URL routing opens Apple Music outside AmpMusic and bypasses playlist/album import. AmpMusic 1.5 should instead prefer Apple Music subscription playback inside the web player when MusicKit is configured and the listener authorizes access. If MusicKit is unavailable, declined, or not configured, the existing strict YouTube match/direct-audio path remains the fallback. No Play action may navigate to `music.apple.com` or launch the native Music app.

Public version remains AmpMusic 1.5 and the current UI stays the UX baseline.