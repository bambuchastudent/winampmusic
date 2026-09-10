# Spotify origin-only import

Spotify playlist links should behave like music sources, not embedded mini-apps inside Ámpula MP.

The current Spotify experiment renders a visible Embed/preview player. On mobile it can duplicate visually, preview-only playback is not useful as the primary provider, and the playlist tracks do not reliably become normal Ámpula library rows.

This change removes Spotify Embed UI from the active flow. A Spotify playlist is read as metadata, its track title/artist/Spotify identifiers and playlist backlink are retained as origin data, and playback is resolved to a usable provider. When Spotify only exposes preview-grade playback, Ámpula resolves a matching YouTube recording in the background without replacing the Spotify provenance.
