# Apple Music paste-to-play v0.6.4

Expected flow:

1. Paste an Apple Music track URL into the top Music Import field.
2. Read the Apple track ID and metadata through the iTunes lookup JSONP endpoint.
3. Search multiple public Piped YouTube API instances, then Invidious fallbacks, for the same artist/title.
4. Rank matches by title, artist and duration.
5. Persist exactly one matched YouTube track through the existing local library.
6. Start that track immediately and clear the pasted URL.

Target regression case:

`https://music.apple.com/tr/album/mantis-lords/1263341718?i=1263341726`

The flow must not depend on song.link and must not require the user to press Search after pasting.
