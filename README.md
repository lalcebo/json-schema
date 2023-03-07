# JSON Schema

[![Software License][ico-license]][link-license]

## Introduction

Collection of JSON schemas for use in command line validators, editors auto-completion, etc.

## List of schemas

- [Serverless Framework Reference](serverless/reference.json), [Official Docs](https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml), [Raw Link](https://raw.githubusercontent.com/lalcebo/json-schema/master/serverless/reference.json)

## Editors Support

- VsCode:- Using the [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)
    **Note:- Set `yaml.schemaStore.enable` to true in settings to pull**
- IntelliJ:- Editors in the IntelliJ family

## About

I'll try to maintain this project as simple as possible, but Pull Requests are welcomed!

## Building AWS resources

This project uses Cloudformation as the source of truth and hence the definitions for individual functions is taken from Cloudformation and maintained into their individual definition files, see [here](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-type-schemas.html)
It's absolutely necessary that these files be kept to up to date.

## Supported Plugins

- [Serverless ESbuild](https://www.npmjs.com/package/serverless-esbuild)
- [Serverless Prune Plugin](https://www.npmjs.com/package/serverless-prune-plugin)
- [Serverless Python Requirements](https://www.npmjs.com/package/serverless-python-requirements)
- [Serverless WSGI](https://github.com/logandk/serverless-wsgi)
- [Serverless Split Stacks](https://www.npmjs.com/package/serverless-plugin-split-stacks)
- [Serverless Step Functions](https://github.com/serverless-operations/serverless-step-functions)
- [Serverless SSM Publish](https://github.com/mysense-ai/ServerlessPlugin-SSMPublish)
- [Serverless Webpack](https://www.npmjs.com/package/serverless-webpack)

## License

The MIT License (MIT). Please see [License File][link-license] for more information.

[ico-license]: https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square

[link-license]: LICENSE
