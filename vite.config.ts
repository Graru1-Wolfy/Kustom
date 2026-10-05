import { defineConfig, type Plugin } from "vite";

function devEntry(): Plugin {
  return {
    name: "dev-entry",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "";
        if (url === "/" || url.startsWith("/?")) req.url = "/dev.html";
        else if (url === "/index.html" || url.startsWith("/index.html?")) req.url = "/dev.html";
        next();
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [devEntry()],
  build: { rollupOptions: { input: "dev.html" } },
  server: { host: "0.0.0.0", port: 5173 },
  preview: { host: "0.0.0.0", port: 4173 },
});
