import fs from 'fs/promises';

export const getVersion = async () => {
  const filePath = './package.json';
  if (process.env.NODE_ENV !== 'production') {
    return 'Local dev';
  }
  try {
    const data = await fs.readFile(filePath);
    const packagejson = JSON.parse(data.toString());

    return packagejson.version;
  } catch (error) {
    console.log(error);
    return 'version not found';
  }
};
