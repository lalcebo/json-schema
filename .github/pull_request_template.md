<!--
Thanks for the contribution! Fill in the relevant sections; delete anything that
doesn't apply. CI runs `pnpm test` on every push — see .github/workflows/test.yml.
-->

## Summary

<!-- 1–2 sentences: what changed and why. -->

## Type of change

<!-- Tick all that apply. -->

- [ ] **Serverless Framework reference** — `serverless/reference.json` (top-level keys, provider, functions, events…)
- [ ] **Shared component** — `serverless/components/*.json`
- [ ] **Plugin schema** — `serverless/plugin/*.json`
- [ ] **CFN resources regenerated** — ran `./cf-update.sh` (commit the resulting `serverless/resources/cloudformation/*` + `resources.schema.json` diff)
- [ ] **Third-party CFN submodule bump** — `serverless/resources/third-party/*`
- [ ] **Test fixture** — `test/*.yml`
- [ ] **Tooling / CI / docs** — `index.js`, `cf-update.sh`, `validate.mjs`, `.github/`, `CLAUDE.md`, `README.md`

## Change kind

- [ ] New field / resource / plugin
- [ ] Update to an existing field (type, enum, description, default)
- [ ] Bug fix (wrong type, broken `$ref`, ambiguous `oneOf`, etc.)
- [ ] Deprecation / removal
- [ ] Refactor (no behaviour change)

## Scope

<!-- Which AWS services / providers / plugins does this touch? -->

## References

<!-- AWS docs, Serverless Framework docs, GitHub issues, forum threads. -->

## How was this tested?

- [ ] `pnpm test` passes locally
- [ ] Added or updated a fixture in `test/` that exercises the change
- [ ] Validated against a real `serverless.yml` in an editor (VS Code YAML extension / IntelliJ)
- [ ] For CFN regenerations: ran `./cf-update.sh` and reviewed the diff

<!-- Anything else reviewers should know about your verification. -->
