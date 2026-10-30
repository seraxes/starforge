import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const migrationsFolder = resolve(__dirname, "../../drizzle");
  console.log(`Running migrations from ${migrationsFolder}…`);
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await pool.end();
  process.exit(1);
});
