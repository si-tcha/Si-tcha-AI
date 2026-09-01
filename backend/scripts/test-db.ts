import prisma from '../src/lib/prisma';


async function main() {
  console.log('🚀 Démarrage du script de test de base de données...');

  // --- 1. CREATE (Équivalent de INSERT) ---
  console.log('\n1. Création d\'un nouvel acheteur...');
  const newAcheteur = await prisma.acheteur.create({
    data: {
      nom: 'Lengue',
      nomEntreprise: 'Lengue Agro',
      nui: `M${Date.now()}`, // NUI unique pour le test
      secteur_activite: 'Agro-industrie',
      contact: '+237699007766',
      // Le champ `preferences` est de type `Json`. On peut lui passer un objet JS.
      preferences: {
        produits: ['mangues', 'avocats', 'oranges'],
        zones: ['Mungo', 'Littoral', 'Mbouda']
      },
    },
  });
  console.log('✅ Acheteur créé:', newAcheteur);

  // --- 2. READ (Équivalent de SELECT) ---
  console.log('\n2. Lecture de tous les acheteurs...');
  const allAcheteurs = await prisma.acheteur.findMany();
  console.log(`✅ ${allAcheteurs.length} acheteur(s) trouvé(s):`, allAcheteurs);

  // --- 3. UPDATE (Équivalent de UPDATE) ---
  console.log(`\n3. Mise à jour de l'acheteur avec l'ID: ${newAcheteur.id}...`);
  const updatedAcheteur = await prisma.acheteur.update({
    where: { id: newAcheteur.id },
    data: {
      contact: '+237655003322', // Nouveau numéro de contact
    },
  });
  console.log('✅ Acheteur mis à jour:', updatedAcheteur);

  // --- 4. DELETE (Équivalent de DELETE) ---
  console.log(`\n4. Suppression de l'acheteur avec l'ID: ${newAcheteur.id}...`);
  const deletedAcheteur = await prisma.acheteur.delete({
    where: { id: newAcheteur.id },
  });
  console.log('✅ Acheteur supprimé:', deletedAcheteur);

  // --- 5. Vérification finale ---
  console.log('\n5. Vérification finale, liste des acheteurs après suppression...');
  const finalAcheteurs = await prisma.acheteur.findMany();
  console.log('✅ Liste finale:', finalAcheteurs);
}

main()
  .catch((e) => {
    console.error('❌ Une erreur est survenue durant l\'exécution du script:', e);
    process.exit(1);
  })
  .finally(async () => {
    console.log('\n👋 Déconnexion du client Prisma...');
    await prisma.$disconnect();
  });
