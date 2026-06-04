import prisma from '../src/lib/prisma';

async function main() {
    console.log('🚀 Démarrage du script de création de GIC...');

    // 1. Créer un Bassin de Production de test s'il n'existe pas
    let bassin = await prisma.bassinProduction.findFirst({
        where: { nom: 'Bassin de Test Mungo' },
    });

    if (!bassin) {
        console.log('Création du bassin de production de test...');
        bassin = await prisma.bassinProduction.create({
            data: {
                nom: 'Bassin de Mbouda',
                region: 'Ouest',
                latitude: 4.71,
                longitude: 9.71,
            },
        });
        console.log('✅ Bassin de production créé:', bassin);
    } else {
        console.log('ℹ️ Bassin de production de test déjà existant.');
    }

    // 2. Créer un GIC de test s'il n'existe pas
    const gicIdentifier = 'GIC-TEST-002';
    let gic = await prisma.gIC.findUnique({
        where: { identifiantREF: gicIdentifier },
    });

    if (!gic) {
        console.log('Création du GIC de test...');
        gic = await prisma.gIC.create({
            data: {
                nom: 'GIC des producteurs de pommes de terre de Mbouda',
                logoURL: 'https://example.com/logo.png',
                activitesPrincipales: 'Culture de pommes de terre, commercialisation locale',
                identifiantREF: gicIdentifier,
                statutLegalisation: 'En cours',
                timestampMaj: new Date(),
                bassinProductionId: bassin.id,
            },
        });
        console.log('✅ GIC créé:', gic);
    } else {
        console.log('ℹ️ GIC de test déjà existant.');
    }

    // 3. Créer un leader pour ce GIC s'il n'existe pas
    const leaderContact = '+237657882477';
    let leader = await prisma.agriculteur.findUnique({
        where: { contact: leaderContact },
    });

    if (!leader) {
        console.log('Création du leader pour le GIC de test...');
        leader = await prisma.agriculteur.create({
            data: {
                nom: 'Menzepoh',
                contact: leaderContact,
                isVerified: true, // On le considère vérifié pour simplifier
                estLeader: true,
                statut: 'APPROUVE', // Le leader est approuvé par défaut
                timestampMaj: new Date(),
                gicId: gic.id,
            },
        });
        console.log('✅ Leader du GIC créé:', leader);
    } else {
        console.log('ℹ️ Leader du GIC de test déjà existant.');
    }

    console.log('\n🎉 Script de création de GIC terminé avec succès.');
    console.log(`\n➡️ ID du GIC de test à utiliser: ${gic.id}`);
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