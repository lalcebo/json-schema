mkdir -p ".data/cloudformation"

echo "Downloading Latest Schemas"
curl https://schema.cloudformation.us-east-1.amazonaws.com/CloudformationSchema.zip --output .data/cloudformation.zip

echo "Extracting Latest Schemas"
unzip -o .data/cloudformation.zip -d .data/cloudformation

echo "Removing zip file"
rm .data/cloudformation.zip

#echo "Updating 3rd Party Resources"
#git submodule update --remote

#echo "Running Transformations"
node index.js
