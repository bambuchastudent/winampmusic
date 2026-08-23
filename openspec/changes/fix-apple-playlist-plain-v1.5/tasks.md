# Tasks

- [x] Reproduce `pl.u-BpUq1XGL0` against the current public Apple reader output.
- [x] Confirm the regression cause: the reader returns plain table rows with no `/song/` links.
- [x] Add a plain `Song / Artist / Album / Time` fallback parser.
- [x] Preserve existing linked-playlist parsing.
- [x] Fix playlist title extraction for Apple pages without the `- Apple Music` suffix.
- [x] Keep ordered partial success when individual YouTube matches fail.
- [x] Bound large-playlist matching concurrency and reuse duplicate title+artist lookups.
- [x] Add regression coverage using the supplied playlist URL and observed row shape.
- [x] Run the AmpMusic 1.5 release gate and Spec-driven guard.
- [x] Remove the temporary live probe files before merge.
- [ ] Merge to `develop` only after the current 1.5 gates pass.
