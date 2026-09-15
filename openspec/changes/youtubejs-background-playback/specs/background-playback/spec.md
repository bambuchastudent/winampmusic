# Background playback specification

## Requirement: YouTube.js audio-first playback

For a track with a usable YouTube playback observation, AMPULAMP SHALL attempt to resolve an audio-only representation through the YouTube.js playback adapter before starting the YouTube iframe player.

### Scenario: YouTube.js audio resolves

Given the current track has a usable YouTube video id
When playback starts
Then AMPULAMP resolves an audio-only representation first
And plays it through one persistent HTMLAudioElement
And the status visibly identifies the active playback provider as `YOUTUBEJS`
And the YouTube iframe is not started for that track
And title, artist, and origin remain the canonical Ámpula identity.

### Scenario: YouTube.js audio cannot resolve or play

Given the current track has a usable YouTube video id
When audio-only resolution or native audio playback fails
Then AMPULAMP falls back to the existing YouTube iframe playback path
And the status identifies YouTube rather than YouTube.js as the active playback provider.

## Requirement: resolved audio playback

AMPULAMP SHALL use a persistent HTML audio element for resolved direct audio so ordinary focus loss/backgrounding can use the browser's native media playback behavior. Direct stream URLs are ephemeral playback state and SHALL NOT be persisted into Ámpula Core or overwrite provider observations.

## Requirement: Media Session

When the browser supports Media Session, AMPULAMP SHALL publish the canonical current track title/artist and SHALL map supported lock-screen/headset actions to the same playback and queue commands as the visible player.

### Scenario: phone is locked or application loses focus

Given native audio playback has started after a user gesture
And the platform permits background media playback
When the application is backgrounded or the screen is locked
Then native audio may continue
And supported system media controls operate on the current AMPULAMP session.

### Scenario: page is closed or platform terminates it

When the browser destroys the page or installed web app process
Then AMPULAMP SHALL NOT claim playback can continue because its HTMLAudioElement and JavaScript context no longer exist.

### Scenario: platform suspends playback

Given the OS or browser disallows continued playback
When the application is backgrounded
Then AMPULAMP SHALL NOT attempt to bypass the platform restriction with fake foreground activity, wake-lock loops, or hidden interaction.

## Requirement: resolver isolation

YouTube.js integration SHALL live behind a provider adapter and SHALL NOT become part of Ámpula Core or canonical track identity.
