import prisma from '../src/lib/prisma';

async function main() {
    console.log('🚀 Démarrage du script de seeding des bassins de production...');

    const bassins = [
        {
            nom: 'Bassin des hauts plateaux de l\'Ouest',
            region: 'Ouest',
            latitude: 5.47,
            longitude: 10.42,
        },
        {
            nom: 'Bassin des forêts humides (monomodale)',
            region: 'Littoral',
            latitude: 4.05,
            longitude: 9.70,
        },
        {
            nom: 'Bassin des forêts humides (bimodale)',
            region: 'Centre',
            latitude: 3.84,
            longitude: 11.50,
        },
        {
            nom: 'Bassin des savanes guinéennes',
            region: 'Adamaoua',
            latitude: 7.32,
            longitude: 13.58,
        },
        {
            nom: 'Bassin soudano-sahélien',
            region: 'Extrême-Nord',
            latitude: 10.59,
            longitude: 14.32,
        },
    ];

    for (const bassinData of bassins) {
        const bassin = await prisma.bassinProduction.upsert({
            where: { nom: bassinData.nom },
            update: {},
            create: bassinData,
        });
        console.log(`✅ Bassin "${bassin.nom}" créé/vérifié.`);
    }

    console.log('\n🎉 Seeding des bassins de production terminé avec succès.');
}

main()
    .catch((e) => {
        console.error("❌ Une erreur est survenue durant l'exécution du script:", e);
        process.exit(1);
    })
    .finally(async () => {
        console.log('\n👋 Déconnexion du client Prisma...');
        await prisma.$disconnect();
    });