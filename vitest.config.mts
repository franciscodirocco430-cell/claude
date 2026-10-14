import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));
const alias = { "@": resolve(root, "./src"), "@prompts": resolve(root, "./prompts") };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "prompts/**/*.test.ts",
            "worker/**/*.test.ts",
            "tests/unit/**/*.test.ts",
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          // Cada archivo crea su propia base efímera; corren en serie para no pisarse.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
