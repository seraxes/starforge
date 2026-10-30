import { buildApp } from "./app.js";
import { env } from "./config.js";

async function main() {
  const app = await buildApp();
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  app.log.info(`Starforge API listening on http://${env.API_HOST}:${env.API_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
