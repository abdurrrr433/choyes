import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const useHttps = process.env.VITE_DEV_HTTPS === "true" || process.env.npm_lifecycle_event === "start:https";

  return {
    server: {
      host: "::",
      port: 8080,
      allowedHosts: true,
      https: useHttps,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), useHttps && basicSsl(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
