/**
 * Script to read package.json, filter out of un-needed elements and save in the dist folder
 */
const fs = require("node:fs/promises");
const path = require("node:path");

const filePath = path.join(__dirname, "..", "package.json");
const destinationPath = path.join(__dirname, "..", "dist", "package.json");

(async () => {
  console.group("Copying package.json");
  try {
    console.log("Source", filePath);
    console.log("Destination", destinationPath);

    const data = await fs.readFile(filePath);
    const packageJsonSrc = JSON.parse(data.toString());
    console.log(
      `The package.json for module ${packageJsonSrc.name} was loaded`,
    );
    console.log("Cleaning");
    // delete un-needed elements
    delete packageJsonSrc.devDependencies;
    delete packageJsonSrc.scripts;
    for (const dependency of Object.keys(packageJsonSrc.dependencies)) {
      if (dependency.startsWith("@repo/")) {
        delete packageJsonSrc.dependencies[dependency];
      }
    }

    // set type
    packageJsonSrc.type = "module";

    // saving
    console.log("Saving");
    await fs.writeFile(
      destinationPath,
      JSON.stringify(packageJsonSrc),
      "utf-8",
    );
    console.log("Success");
  } catch (error) {
    console.error(error);
  }
  console.groupEnd("Copying package.json");
})();
