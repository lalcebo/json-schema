#!/usr/bin/env bash
set -euo pipefail

# Run relative to the repo root regardless of where the script is invoked from.
cd "$(dirname "$0")"

readonly SCHEMA_URL="https://schema.cloudformation.us-east-1.amazonaws.com/CloudformationSchema.zip"
readonly DEST_DIR="serverless/resources/cloudformation"
readonly ZIP_FILE="cloudformation.zip"

cleanup() { rm -f "$ZIP_FILE"; }
trap cleanup EXIT

echo "Downloading latest CloudFormation schemas..."
curl -fSL --retry 3 --retry-delay 2 "$SCHEMA_URL" --output "$ZIP_FILE"

echo "Extracting into $DEST_DIR..."
mkdir -p "$DEST_DIR"
unzip -oq "$ZIP_FILE" -d "$DEST_DIR"

echo "Updating third-party CloudFormation resource submodules..."
git submodule update --init --remote

echo "Running transformations..."
node index.js

echo "Done."
