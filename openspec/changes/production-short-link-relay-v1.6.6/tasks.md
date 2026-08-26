# Tasks: production short-link relay v1.6.6

- [x] Record the production short-link deployment contract.
- [x] Define optional-deployment and canonical-fallback requirements.
- [ ] Add executable deployment/runtime wiring tests.
- [ ] Remove account-specific KV placeholder configuration and rely on supported Wrangler provisioning.
- [ ] Keep `RATE_SALT` out of checked-in Worker vars and deliver it as a secret.
- [ ] Add inert default browser relay config and a CI generator for the production relay URL.
- [ ] Load relay runtime config before the lazy short-link adapter can run.
- [ ] Deploy the relay optionally from the Pages workflow and health-check it when available.
- [ ] Update relay deployment documentation.
- [ ] Run the repository behavioral/contract suite.
- [ ] Merge only with the dialogless canonical fallback preserved.
