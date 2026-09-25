# YouTube.js audio resolution diagnostics

## Problem

A playable YouTube iframe can follow `YouTube.js: Streaming data not available`. The current adapter immediately falls back and exposes no durable indication of where native audio failed.

## Goal

Distinguish player access, missing audio formats, request failures and media-element errors without disclosing signed stream URLs or credentials. Attempt one alternate supported music client for an otherwise playable video whose primary client supplies no audio format.

## Scope and success

The normal iframe fallback remains. A short expandable diagnostic on the page records the video ID, request stage, client, playability status, audio-format count, and a fixed error code; it can be read without developer tools. Alternate resolution is bounded and never attempted after an explicit non-OK playability response. Tests cover client retry, denial, sanitization, and fallback.

## Non-goals

Making YouTube guarantee extractable streams, bypassing restrictions, recording signed playback URLs, or promising Android lockscreen controls for iframe playback.
