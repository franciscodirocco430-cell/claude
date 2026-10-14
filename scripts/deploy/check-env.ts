import "dotenv/config";
import { checkProductionEnv, type DeployTarget } from "../../src/lib/deploy-check";

/**
 * Uso: pnpm deploy:check app|worker
 * Lee las variables del entorno (y de .env si existe) y avisa qué falta para producción.
 */
const target = process.argv[2] as DeployTarget;
if (target !== "app" && target !== "worker") {
  console.error("Uso: pnpm deploy:check app|worker");
  process.exit(2);
}
const { errors, warnings } = checkProductionEnv(process.env, target);
for (const w of warnings) console.log(`⚠️  ${w}`);
for (const e of errors) console.log(`❌ ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(es): no deployes así.`);
  process.exit(1);
}
console.log(
  `\n✅ Variables de ${target === "app" ? "la app" : "el worker"} listas para producción.`,
);
