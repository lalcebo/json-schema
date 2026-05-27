# JSON Schema

[![Software License][ico-license]][link-license]

## Introduction

JSON Schemas (draft-07) for **Serverless Framework v4** `serverless.yml` files
and the AWS CloudFormation resources they compose. Editors such as the VS Code
YAML extension and the IntelliJ family use these schemas to validate and
auto-complete configuration.

There is no runtime — the artifacts are the schema files themselves.

## List of schemas

- [Serverless Framework Reference](serverless/reference.json) — [official docs](https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml) · [raw link](https://raw.githubusercontent.com/lalcebo/json-schema/master/serverless/reference.json)

## Editor support

- **VS Code** — install the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) and set `yaml.schemaStore.enable: true`.
- **IntelliJ** — all editors in the IntelliJ family auto-detect the schema via [JSON Schema Store](https://www.schemastore.org/).

## Repository layout

- `serverless/reference.json` — entry-point schema, bound to `serverless.yml` / `serverless.yaml`.
- `serverless/components/` — hand-maintained shared definitions (CloudFormation
  intrinsic functions, IAM, Lambda, API Gateway v1/v2, ALB, events, conditions,
  outputs, parameters, mappings, etc.).
- `serverless/plugins/` — schemas for supported Serverless Framework plugins
  (see [Supported plugins](#supported-plugins) below).
- `serverless/resources/cloudformation/` — **generated** per-resource CFN
  schemas (~1100 files). Do not edit by hand; see [Regenerating CFN schemas](#regenerating-cfn-schemas).
- `serverless/resources/resources.schema.json` — **generated** aggregate
  resource schema. Do not edit by hand.
- `serverless/resources/third-party/` — git submodules for MongoDB Atlas and
  Datadog CloudFormation resources.
- `test/` — YAML fixtures validated against `reference.json` by CI.

## Getting started

Node version is pinned via `.tool-versions` (`nodejs 26.0.0`); pnpm version is
pinned via `packageManager` in `package.json`.

```sh
git submodule update --init --recursive
pnpm install
pnpm test
```

`pnpm test` runs [`validate.mjs`](validate.mjs), which validates every fixture
under `test/` against `serverless/reference.json` and checks for dangling
internal `$ref`s. CI runs the same command on push and on PRs to `master`
(`.github/workflows/test.yml`).

## Regenerating CFN schemas

```sh
./cf-update.sh
```

This is the only build command. It:

1. Downloads the latest CloudFormation resource type schemas from AWS into
   `serverless/resources/cloudformation/`.
2. Updates the MongoDB Atlas and Datadog submodules.
3. Runs `node index.js` to transform the raw schemas in place and regenerate
   `serverless/resources/resources.schema.json`.

The transform is idempotent — strings already wrapped to accept CloudFormation
intrinsic functions are detected and skipped, so re-running won't produce
nested wrappers.

To run just the transformation step (no download): `node index.js`.

CFN resource fixes must go in `index.js` (transformation logic) or be filed
upstream — direct edits to files in `cloudformation/` are overwritten on the
next run.

## Supported plugins

- [Serverless ESBuild](https://www.npmjs.com/package/serverless-esbuild)
- [Serverless Prune Plugin](https://www.npmjs.com/package/serverless-prune-plugin)
- [Serverless Python Requirements](https://www.npmjs.com/package/serverless-python-requirements)
- [Serverless WSGI](https://github.com/logandk/serverless-wsgi)
- [Serverless Split Stacks](https://www.npmjs.com/package/serverless-plugin-split-stacks)
- [Serverless Step Functions](https://github.com/serverless-operations/serverless-step-functions)
- [Serverless SSM Publish](https://github.com/mysense-ai/ServerlessPlugin-SSMPublish)
- [Serverless Webpack](https://www.npmjs.com/package/serverless-webpack)

## Contributing

Pull requests are welcome. See [`.github/pull_request_template.md`](.github/pull_request_template.md)
for the expected checklist (change type, scope, references, test plan).

## License

The MIT License (MIT). Please see [License File][link-license] for more information.

[ico-license]: https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square

[link-license]: LICENSE
