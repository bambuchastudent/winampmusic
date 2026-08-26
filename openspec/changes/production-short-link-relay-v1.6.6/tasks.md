# Tasks: production short-link relay v1.6.6

- [x] Record the production short-link deployment contract.
- [x] Define optional-deployment and canonical-fallback requirements.
- [x] Add executable deployment/runtime wiring tests.
- [x] Remove account-specific KV placeholder configuration and rely on supported Wrangler provisioning.
- [x] Keep `RATE_SALT` out of checked-in Worker vars and deliver it as a secret.
- [x] Add inert default browser relay config and a CI generator for the production relay URL.
- [x] Load relay runtime config before the lazy short-link adapter can run.
- [x] Deploy the relay optionally from the Pages workflow and health-check it when available.
- [x] Update root and relay deployment documentation.
- [ ] Run the repository behavioral/contract suite.
- [ ] Merge only with the dialogless canonical fallback preserved.
