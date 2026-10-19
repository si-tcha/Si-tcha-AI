import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("La variable d'environnement DATABASE_URL est requise.");
}

const parsedDatabaseUrl = new URL(databaseUrl);
if (parsedDatabaseUrl.hostname.endsWith(".render.com")
  && !parsedDatabaseUrl.searchParams.has("sslmode")) {
  parsedDatabaseUrl.searchParams.set("sslmode", "require");
}

const connectionString = parsedDatabaseUrl.toString();
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export default prisma;
