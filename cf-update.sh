echo "Downloading Latest Schemas"
curl https://schema.cloudformation.us-east-1.amazonaws.com/CloudformationSchema.zip --output cloudformation.zip
echo "Extracting Latest Schemas"
unzip -o cloudformation.zip -d ./serverless/resources/cloudformation
echo "Removing zip file"
rm cloudformation.zip

echo "Updating 3rd Party Resources"
git submodule update --remote

echo "Running Transformations"
node index.js
