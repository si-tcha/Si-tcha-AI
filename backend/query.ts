import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const agris = await prisma.agriculteur.findMany();
  console.log("Agriculteurs:", agris);
  const acheteurs = await prisma.acheteur.findMany();
  console.log("Acheteurs:", acheteurs);
}
main();
