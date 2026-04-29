import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: path.join(projectRoot, "node_modules/tailwindcss"),
    },
  },
};

export default nextConfig;
