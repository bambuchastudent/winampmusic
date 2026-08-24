# Ámpula / Ámpulamp — canonical product specification

Status: **canonical**

This document defines the product identity and naming for the project currently hosted in the `winampmusic` repository.

## Names

### Ámpula

**Ámpula** is the portable musical moment.

An Ámpula is transferred as a `.ampula` file. It represents a deliberately shared sequence of tracks together with enough context and track identity information for Ámpulamp to recover that moment later.

The `.ampula` file is the thing that is shared between people.

### Ámpulamp

**Ámpulamp** is the music player that creates, opens, restores and plays Ámpulas.

The ending **MP** means **Music Player**.

Ámpulamp is the application. Ámpula is the portable object handled by the application.

## Product idea

Ámpulamp is a convenient music player for passing a moment through music.

The core flow is:

1. A person has tracks in their music library or available music sources.
2. They select/order the tracks that define a moment.
3. Ámpulamp packages that moment as a `.ampula`.
4. The `.ampula` is sent to another person.
5. The recipient can open it immediately or much later.
6. Ámpulamp resolves the tracks against sources available to the recipient and reconstructs the intended listening experience.

The important object being preserved is the **moment and track selection**, not a dependency on one streaming-service URL.

## Temporal promise

A `.ampula` is designed to remain meaningful over time.

It must not treat a single provider URL as the source of truth. Provider URLs, service IDs and catalog matches are recovery hints/history. Ámpulamp should keep enough identity metadata to try other available sources when the original source is unavailable.

This is what makes an Ámpula something a recipient can keep and try to listen to later instead of a disposable link to one provider.

Actual playback at a future date still depends on whether the relevant recording can be resolved from a source available to the recipient.

## Product boundaries

Ámpulamp is **not** intended to become:

- a new streaming service;
- a universal hosted music catalog;
- a centralized store of users' music;
- a replacement for Apple Music, YouTube, Spotify or other providers;
- a social network that users must join before sharing music.

Those services can be playback/resolution sources. They are not the product's identity.

## Source model

The source used when an Ámpula is created is not necessarily the source used when it is played.

For example, a track originally selected from Apple Music may later be resolved from another source available to the recipient. A provider-specific URL should therefore be treated as provenance or a recovery candidate, not as the canonical identity of the track.

## Canonical one-line definitions

**Ámpulamp — Music Player for sharing moments through music.**

**Ámpula — the musical moment you send, stored as `.ampula`.**

## Naming rule

User-facing product naming should use **Ámpulamp** for the player and **Ámpula** for the transferable object/file format.

The repository name `winampmusic` is legacy/internal and must not redefine those product concepts.
