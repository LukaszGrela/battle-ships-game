import fs from "fs/promises";
import { isDev } from "./isDev";

export const getVersion = async () => {
  const filePath = "./package.json";
  if (isDev()) {
    return "Local dev";
  }
  try {
    const data = await fs.readFile(filePath);
    const packagejson = JSON.parse(data.toString());

    return packagejson.version;
  } catch (error) {
    console.log(error);
    return "version not found";
  }
};
