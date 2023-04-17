const path = require('path');
const fs = require("fs");
/**
 * How to use this script?
 * Clone the mongodb cloudformation repo at the same level as this repo and run this script.
 * https://github.com/mongodb/mongodbatlas-cloudformation-resources
 */
(async () => {
    const mongoDir = path.join(__dirname, "../", "mongodbatlas-cloudformation-resources", "cfn-resources")
    const mongoResourcesDir = fs.readdirSync(mongoDir).forEach(r => {
        try {
            const schemaFileName = `mongodb-atlas-${r.replaceAll('-', '')}.json`
            const schema = fs.readFileSync(
                path.join(mongoDir, r, schemaFileName)
            ).toString()
            fs.writeFileSync(
                path.join(
                    __dirname,
                    "serverless/resources/cloudformation",
                    schemaFileName
                ),
                schema
            )
        } catch(err) {
            console.error(err)
            console.log("DW")
        }
    })
    console.log((mongoResourcesDir))
})()
