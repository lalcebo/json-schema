#!/usr/bin/env node
// Validates every fixture in test/ and test/fixtures/ against
// serverless/reference.json, and verifies the schema parses with no dangling
// internal $refs. Run via `npm test`.

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve, relative } from "node:path";
import yaml from "js-yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = __dirname;
const SCHEMA_PATH = resolve(ROOT, "serverless/reference.json");
const FIXTURE_DIRS = [resolve(ROOT, "test")];

// CloudFormation intrinsic-function shorthand (`!Ref`, `!GetAtt`, ...) is
// valid YAML but not in js-yaml's default schema. Register each tag for every
// kind so the parser accepts them; the constructed value is the raw payload.
const CFN_TAGS = [
  "!Ref", "!GetAtt", "!Sub", "!Join", "!Select", "!Split", "!FindInMap",
  "!Base64", "!Cidr", "!ImportValue", "!And", "!Equals", "!If", "!Not", "!Or",
  "!Condition", "!GetAZs", "!Transform",
];
const cfnTypes = [];
for (const tag of CFN_TAGS) {
  for (const kind of ["scalar", "sequence", "mapping"]) {
    cfnTypes.push(new yaml.Type(tag, { kind, construct: (data) => data }));
  }
}
const CFN_YAML_SCHEMA = yaml.DEFAULT_SCHEMA.extend(cfnTypes);

// Tolerant regex compiler: try Unicode mode (AJV default), then legacy, then
// fall back to an always-matching pattern. CFN-published schemas contain many
// patterns that aren't valid under JS Unicode regex (`(?s).*`, redundant
// escapes like `\:`, `\p{...}` without the `u` flag), and we don't want one
// bad pattern to block compilation of 1100+ schemas.
function tolerantRegExp(pattern, flags) {
  for (const candidateFlags of [flags + "u", flags]) {
    try { return new RegExp(pattern, candidateFlags); } catch { /* try next */ }
  }
  return /(?:)/;
}

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
  validateFormats: false,
  // Schemas declare $schema as draft-07, but the URL (http vs https) varies
  // file-to-file. We trust the schemas, skip meta-schema validation.
  validateSchema: false,
  code: { regExp: tolerantRegExp },
});
addFormats(ajv);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function listJson(dir) {
  if (!existsSync(dir)) return [];
  return (await readdir(dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => resolve(dir, f));
}

// Preload every sub-schema referenced from reference.json under its file URL
// so AJV resolves refs deterministically (ignoring per-file $id collisions).
// A few component files use the draft-04 `id`/`schema` keywords. AJV draft-07
// only accepts `$id`/`$schema`; drop the legacy versions so compilation succeeds.
function normalizeKeywords(schema) {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    delete schema.id;
    delete schema.schema;
  }
}

// CFN-published schemas contain some pattern values that are valid in ECMAScript-
// extended dialects (e.g. `(?s).*`, inline flag groups, `\p{...}` property
// escapes — though the latter ARE supported by JS with the `u` flag, AJV
// compiles without it). Anything JavaScript's `RegExp` constructor can't parse
// gets dropped so AJV can still compile the rest of the schema.
function stripIncompatiblePatterns(obj) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const v of obj) stripIncompatiblePatterns(v);
    return;
  }
  if (typeof obj.pattern === "string") {
    try {
      new RegExp(obj.pattern);
    } catch {
      delete obj.pattern;
    }
  }
  if (obj.patternProperties && typeof obj.patternProperties === "object") {
    for (const key of Object.keys(obj.patternProperties)) {
      try {
        new RegExp(key);
      } catch {
        delete obj.patternProperties[key];
      }
    }
  }
  for (const v of Object.values(obj)) stripIncompatiblePatterns(v);
}

async function preloadSchemas() {
  const dirs = [
    resolve(ROOT, "serverless/components"),
    resolve(ROOT, "serverless/plugin"),
    resolve(ROOT, "serverless/resources"),
    resolve(ROOT, "serverless/resources/cloudformation"),
  ];
  let count = 0;
  for (const dir of dirs) {
    for (const path of await listJson(dir)) {
      const schema = await readJson(path);
      delete schema.$id;
      normalizeKeywords(schema);
      stripIncompatiblePatterns(schema);
      const url = pathToFileURL(path).href;
      if (!ajv.getSchema(url)) {
        ajv.addSchema(schema, url);
        count++;
      }
    }
  }
  return count;
}

// Find every `$ref: "#/..."` token in the schema (internal refs only).
function collectInternalRefs(obj, out = []) {
  if (!obj || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    for (const v of obj) collectInternalRefs(v, out);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "$ref" && typeof v === "string" && v.startsWith("#/")) {
      out.push(v);
    } else {
      collectInternalRefs(v, out);
    }
  }
  return out;
}

function resolvePointer(root, pointer) {
  if (pointer === "#" || pointer === "") return root;
  const parts = pointer.replace(/^#\//, "").split("/");
  let cur = root;
  for (const raw of parts) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (cur && typeof cur === "object" && key in cur) cur = cur[key];
    else return undefined;
  }
  return cur;
}

function checkInternalRefs(schema) {
  const refs = new Set(collectInternalRefs(schema));
  const dangling = [];
  for (const ref of refs) {
    if (resolvePointer(schema, ref) === undefined) dangling.push(ref);
  }
  return [...dangling].sort();
}

async function listFixtures() {
  const out = [];
  for (const dir of FIXTURE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const f of (await readdir(dir)).sort()) {
      if (f.endsWith(".yml") || f.endsWith(".yaml")) out.push(resolve(dir, f));
    }
  }
  return out;
}

function rel(p) {
  return relative(ROOT, p);
}

async function main() {
  let failures = 0;

  // ---------- Schema sanity ----------
  const mainSchema = await readJson(SCHEMA_PATH);
  const dangling = checkInternalRefs(mainSchema);
  if (dangling.length) {
    console.log(`[FAIL] reference.json has ${dangling.length} dangling internal $ref(s):`);
    for (const r of dangling) console.log(`  - ${r}`);
    failures++;
  } else {
    console.log("[ok]   reference.json parses; all internal $refs resolve");
  }

  // ---------- AJV compile + fixture validation ----------
  const loaded = await preloadSchemas();
  console.log(`[info] preloaded ${loaded} sub-schemas`);

  delete mainSchema.$id;
  normalizeKeywords(mainSchema);
  stripIncompatiblePatterns(mainSchema);
  const mainUrl = pathToFileURL(SCHEMA_PATH).href;
  ajv.addSchema(mainSchema, mainUrl);
  const validate = ajv.getSchema(mainUrl);
  if (!validate) throw new Error("Failed to compile reference.json");

  for (const path of await listFixtures()) {
    const text = await readFile(path, "utf8");
    let doc;
    try {
      doc = yaml.load(text, { schema: CFN_YAML_SCHEMA });
    } catch (err) {
      console.log(`[FAIL] ${rel(path)} — YAML parse error: ${err.message}`);
      failures++;
      continue;
    }
    if (validate(doc)) {
      console.log(`[ok]   ${rel(path)}`);
    } else {
      console.log(`[FAIL] ${rel(path)} — ${validate.errors.length} schema error(s)`);
      for (const e of validate.errors.slice(0, 20)) {
        const loc = e.instancePath || "<root>";
        console.log(`  - ${loc} (${e.keyword}): ${e.message}`);
      }
      if (validate.errors.length > 20) {
        console.log(`  ... +${validate.errors.length - 20} more`);
      }
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
