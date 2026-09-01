import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';
async function main() {
    console.log('🚀 Démarrage du script de seeding...');
    const adminPassword = await bcrypt.hash('admin00', 10);
    const adminUsername = 'admin';
    await prisma.admin.upsert({
        where: { nom: adminUsername },
        update: {
            password: adminPassword,
        },
        create: {
            nom: adminUsername,
            contact: 'admin@sitcha.ai',
            password: adminPassword,
        },
    });
    console.log(`✅ Utilisateur admin '${adminUsername}' créé/mis à jour avec succès.`);
    console.log('\n🎉 Seeding terminé.');
}
main()
    .catch((e) => {
    console.error("❌ Une erreur est survenue durant l'exécution du script:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
