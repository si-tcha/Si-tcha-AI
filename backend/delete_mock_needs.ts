import prisma from './src/lib/prisma.js';

async function main() {
  await prisma.gicNeedEntry.deleteMany({
    where: {
      OR: [
        { description: { contains: 'NPK 20 sacs' } },
        { description: { contains: 'Crédit campagne' } }
      ]
    }
  });
  console.log("Mock needs deleted from database");
}
main().catch(console.error).finally(() => prisma.$disconnect());
