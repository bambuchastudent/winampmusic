# Tasks: CI npm cache v1.6.8

- [x] Identify workflows that install the shared jsdom test runtime.
- [x] Add a shared npm download cache without caching `node_modules`.
- [x] Prefer cached packages and disable unnecessary audit/fund network work.
- [ ] Run all affected workflow checks.
- [ ] Merge after checks pass and verify the cache is warmed on `develop`.
