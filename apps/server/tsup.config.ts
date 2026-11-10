import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node22",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // inline your workspace packages into the bundle:
  noExternal: [/^@repo\//],
  // everything else (socket.io, zod, …) stays a normal node_modules import:
  external: ["socket.io", "@socket.io/admin-ui", "nanoid"], // or just leave default + noExternal
  outExtension: () => ({ js: ".js" }),
});
