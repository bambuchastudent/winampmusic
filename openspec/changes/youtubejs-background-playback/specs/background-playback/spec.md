# Background playback specification

## Requirement: resolved audio playback

AMPULAMP SHALL support a playback adapter that accepts a resolved audio URL and plays it through a persistent HTML audio element without changing Ámpula track identity.

### Scenario: resolved YouTube audio

Given the current track has a valid resolver result
When playback starts
Then the resolved audio source is assigned to the persistent audio element
And the visible queue remains the owner of previous/next navigation
And the received Ámpula is not mutated.

## Requirement: Media Session

When the browser supports Media Session, AMPULAMP SHALL publish current track metadata and SHALL map supported lock-screen/headset actions to the same playback and queue commands as the visible player.

### Scenario: phone is locked

Given audio playback has started after a user gesture
And the platform permits background media playback
When the application is backgrounded or the screen is locked
Then the browser may continue audio playback
And supported system media controls operate on the current AMPULAMP session.

### Scenario: platform suspends playback

Given the OS or browser disallows continued playback
When the application is backgrounded
Then AMPULAMP SHALL NOT attempt to bypass the platform restriction with fake foreground activity, wake-lock loops, or hidden interaction.

## Requirement: provider fallback

If the resolver cannot provide a usable audio source, AMPULAMP SHALL retain the existing YouTube playback path as a fallback.

## Requirement: resolver isolation

YouTube.js integration SHALL live behind a provider adapter and SHALL NOT become part of Ámpula Core or canonical track identity.
