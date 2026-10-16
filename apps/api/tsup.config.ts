import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  // Pacotes internos entram no bundle; dependências externas ficam em node_modules.
  noExternal: [/^@app\//],
});
