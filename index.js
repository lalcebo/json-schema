const fs = require("fs/promises");
const path = require("path");

const CLOUDFORMATION_DIR = path.join(__dirname, "serverless/resources/cloudformation");
const THIRD_PARTY_DIR = path.join(__dirname, "serverless/resources/third-party-resources");
const AGGREGATE_OUTPUT = path.join(__dirname, "serverless/resources/resources.schema.json");

const CF_FUNCTION_STRING_REF = "../../components/cf.functions.json#/Aws_CF_FunctionString";

const SHARED_ATTRIBUTES = {
  DeletionPolicy: {
    description: "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-deletionpolicy.html",
    type: "string",
    enum: ["Delete", "Retain", "Snapshot"],
  },
  UpdateReplacePolicy: {
    description: "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatereplacepolicy.html",
    type: "string",
    enum: ["Delete", "Retain", "Snapshot"],
  },
  Metadata: {
    description: "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-metadata.html",
    type: "object",
  },
  CreationPolicy: {
    description: "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-creationpolicy.html",
    type: "object",
  },
  UpdatePolicy: {
    description: "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatepolicy.html",
    type: "object",
  },
  DependsOn: {
    type: ["string", "array"],
    items: { type: "string" },
  },
};

const THIRD_PARTY_SOURCES = [
  {
    dir: path.join(THIRD_PARTY_DIR, "mongodbatlas-cloudformation-resources"),
    outputName: (subdir) => `mongodb-atlas-${subdir.replaceAll("-", "")}.json`,
  },
  {
    dir: path.join(THIRD_PARTY_DIR, "datadog-cloudformation-resources"),
    outputName: (subdir) => `${subdir.replaceAll("-handler", "")}.json`,
  },
];

const SUBSCHEMA_MAP_KEYS = ["properties", "patternProperties", "definitions"];
const SUBSCHEMA_OBJECT_KEYS = ["items", "additionalProperties", "contains", "not", "if", "then", "else"];
const SUBSCHEMA_ARRAY_KEYS = ["oneOf", "anyOf", "allOf"];

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function importThirdPartySchemas() {
  for (const { dir, outputName } of THIRD_PARTY_SOURCES) {
    let subdirs;
    try {
      subdirs = await fs.readdir(dir);
    } catch (err) {
      throw new Error(
        `Third-party submodule not available at ${dir}. ` +
        `Run "git submodule update --init --recursive" first. (${err.message})`
      );
    }
    for (const subdir of subdirs) {
      const fileName = outputName(subdir);
      const sourceFile = path.join(dir, subdir, fileName);
      try {
        const contents = await fs.readFile(sourceFile, "utf8");
        await fs.writeFile(path.join(CLOUDFORMATION_DIR, fileName), contents);
      } catch (err) {
        console.warn(`Skipped third-party resource ${sourceFile}: ${err.code || err.message}`);
      }
    }
  }
}

function wrapStringWithCfFunctions(schema) {
  const { description, ...rest } = schema;
  const wrapped = { oneOf: [rest, { $ref: CF_FUNCTION_STRING_REF }] };
  if (description) wrapped.description = description;
  return wrapped;
}

// True when a schema is the exact oneOf wrap this script produces — used to
// keep transformSchema idempotent so running the script on already-modified
// files (e.g. without re-downloading the raw CFN zip first) doesn't re-wrap
// the inner string and produce nested oneOf chains.
function isCfWrappedString(schema) {
  const branches = schema.oneOf;
  return (
    Array.isArray(branches) &&
    branches.length === 2 &&
    branches[0] && branches[0].type === "string" &&
    branches[1] && branches[1].$ref === CF_FUNCTION_STRING_REF
  );
}

// Recursively transform a schema: wrap string-typed leaves with a oneOf that
// also accepts a CloudFormation intrinsic function string, otherwise descend
// into every keyword that holds a subschema.
function transformSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;
  if (isCfWrappedString(schema)) return schema;
  if (schema.type === "string") return wrapStringWithCfFunctions(schema);

  const result = { ...schema };

  for (const key of SUBSCHEMA_MAP_KEYS) {
    const value = result[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, transformSchema(v)])
      );
    }
  }

  for (const key of SUBSCHEMA_OBJECT_KEYS) {
    const value = result[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = transformSchema(value);
    }
  }

  for (const key of SUBSCHEMA_ARRAY_KEYS) {
    if (Array.isArray(result[key])) {
      result[key] = result[key].map(transformSchema);
    }
  }

  return result;
}

// CloudFormation readOnlyProperties are JSON pointers like /properties/Foo or
// /properties/Foo/Bar. Only strip exact top-level entries — descending into
// nested paths would require resolving $refs, and matching by leaf name (the
// previous behavior) silently deletes unrelated top-level properties that
// share a name with a nested leaf.
function stripTopLevelReadOnlyProperties(schema) {
  if (!Array.isArray(schema.readOnlyProperties) || !schema.properties) return schema;
  const properties = { ...schema.properties };
  for (const pointer of schema.readOnlyProperties) {
    const parts = pointer.trim().split("/").filter(Boolean);
    if (parts.length === 2 && parts[0] === "properties") {
      delete properties[parts[1]];
    }
  }
  return { ...schema, properties };
}

function titleDefinitions(schema, resourceName) {
  if (!schema.definitions || typeof schema.definitions !== "object") return schema;
  const definitions = {};
  for (const [key, value] of Object.entries(schema.definitions)) {
    if (value && typeof value === "object" && !value.title) {
      let title = `${resourceName}${key}`;
      if (!title.toLowerCase().trim().endsWith("definition")) title += "Definition";
      definitions[key] = { ...value, title };
    } else {
      definitions[key] = value;
    }
  }
  return { ...schema, definitions };
}

async function transformResource(fileName) {
  const raw = await readJson(path.join(CLOUDFORMATION_DIR, fileName));
  const resourceName = raw.typeName.split("::").join("");
  const description = raw.description || "No description available";
  const sourceUrl = raw.sourceUrl || "No source definition found, add manually please";

  let modified = {
    ...raw,
    type: "object",
    description: `${description}. Source:- ${sourceUrl}`,
    title: `${resourceName}Properties`,
  };
  delete modified.handlers;

  modified = transformSchema(modified);
  modified = stripTopLevelReadOnlyProperties(modified);
  modified = titleDefinitions(modified, resourceName);

  await writeJson(path.join(CLOUDFORMATION_DIR, fileName), modified);

  return { fileName, resourceName, typeName: raw.typeName };
}

function buildAggregateSchema(resources) {
  const definitions = {};
  for (const { resourceName, typeName, fileName } of resources) {
    definitions[resourceName] = {
      title: resourceName,
      type: "object",
      additionalProperties: false,
      properties: {
        Type: { type: "string", enum: [typeName] },
        Condition: { type: "string" },
        Properties: { $ref: `cloudformation/${fileName}` },
        ...SHARED_ATTRIBUTES,
      },
      required: ["Type", "Properties"],
    };
  }

  return {
    $comment: "DO NOT EDIT THIS FILE DIRECTLY! PLEASE CHANGE THE INDIVIDUAL RESOURCE FILES AND THEN RUN THE SCRIPT TO GENERATE THIS FILE",
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://aws.amazon.com/cloudformation/resources.schema.json",
    definitions,
    description: "Auto generated schema from individual resource definition from Cloudformation",
    type: "object",
    properties: {
      Resources: {
        type: "object",
        minProperties: 1,
        patternProperties: {
          "^[a-zA-Z0-9]{1,255}$": {
            oneOf: Object.keys(definitions).map((d) => ({ $ref: `#/definitions/${d}` })),
          },
        },
      },
    },
  };
}

async function main() {
  await importThirdPartySchemas();

  const files = (await fs.readdir(CLOUDFORMATION_DIR)).filter((f) => f.endsWith(".json"));
  const resources = await Promise.all(files.map(transformResource));

  await writeJson(AGGREGATE_OUTPUT, buildAggregateSchema(resources));
  console.log(`Transformed ${resources.length} resources.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
