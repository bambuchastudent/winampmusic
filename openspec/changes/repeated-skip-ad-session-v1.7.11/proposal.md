# Repeated skip, ad state, and YouTube session v1.7.11

## Problem

A production screen recording shows three playback issues after the v1.7.10 unresolved-skip fix:

1. unresolved skipping works immediately after reload, then stops after later runtime bridge installers run;
2. a YouTube pre-roll can audibly play while AMPULAMP reports `PAUSED` instead of `AD`;
3. repeated ads raise the question whether track changes recreate the YouTube player/session.

## Goal

Keep the queue bridge authoritative for navigation for the whole page lifetime, expose `AD` while YouTube is serving an advertisement even when the content player state is reported as paused, and lock in the existing single-iframe/single-player-session behavior.

Musical identity and origin metadata remain independent from the YouTube playback handle.