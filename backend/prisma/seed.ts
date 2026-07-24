import prisma from '../src/lib/prisma';

async function main() {
  console.log('🌱 Démarrage de la germination des données dans PostgreSQL...');

  // 1. Bassins de production
  const bassinOuest = await prisma.bassinProduction.create({
    data: {
      nom: 'Ouest',
      region: 'Ouest (Bafoussam / Foumbot)',
      latitude: 5.4777,
      longitude: 10.4176,
    },
  });

  const bassinCentre = await prisma.bassinProduction.create({
    data: {
      nom: 'Centre',
      region: 'Centre (Yaoundé / Sa\'a)',
      latitude: 3.848,
      longitude: 11.5021,
    },
  });

  const bassinNord = await prisma.bassinProduction.create({
    data: {
      nom: 'Nord',
      region: 'Nord (Garoua / Maroua)',
      latitude: 9.3011,
      longitude: 13.3977,
    },
  });

  const bassinLittoral = await prisma.bassinProduction.create({
    data: {
      nom: 'Littoral',
      region: 'Littoral (Douala / Loum)',
      latitude: 4.0511,
      longitude: 9.7679,
    },
  });

  console.log('✅ Bassins de production créés');

  // 2. Produits Agricoles
  const pTomate = await prisma.produitAgricole.create({
    data: {
      nom: 'Tomates fraîches',
      categorie: 'Légumes',
      imageURL: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop',
    },
  });

  const pMais = await prisma.produitAgricole.create({
    data: {
      nom: 'Maïs jaune',
      categorie: 'Céréales',
      imageURL: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop',
    },
  });

  const pManioc = await prisma.produitAgricole.create({
    data: {
      nom: 'Manioc frais',
      categorie: 'Tubercules',
      imageURL: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop',
    },
  });

  const pPlantain = await prisma.produitAgricole.create({
    data: {
      nom: 'Régimes de Plantains',
      categorie: 'Fruits',
      imageURL: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=600&auto=format&fit=crop',
    },
  });

  const pPoivron = await prisma.produitAgricole.create({
    data: {
      nom: 'Poivrons rouges',
      categorie: 'Légumes',
      imageURL: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop',
    },
  });

  const pArachide = await prisma.produitAgricole.create({
    data: {
      nom: 'Arachides séchées',
      categorie: 'Légumineuses',
      imageURL: 'https://images.unsplash.com/photo-1567892906800-47120cb95dfd?w=600&auto=format&fit=crop',
    },
  });

  console.log('✅ Produits agricoles créés');

  // 3. GICs (Groupements d'Intérêt Communautaire)
  const gicAgroVallee = await prisma.gIC.create({
    data: {
      nom: 'GIC Agro-Vallée Bafoussam',
      logoURL: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=200',
      reglementInterieur: 'Assemblées mensuelles. Décisions à majorité. Leader tranche les conflits.',
      activitesPrincipales: 'Maraîchage, tubercules',
      identifiantREF: 'GIC-OUEST-2024-014',
      statutLegalisation: 'Légalisé',
      timestampMaj: new Date(),
      bassinProductionId: bassinOuest.id,
    },
  });

  const gicChampsVerts = await prisma.gIC.create({
    data: {
      nom: 'GIC Champs Verts',
      logoURL: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=200',
      reglementInterieur: 'Partage équitable des intrants et vente groupée.',
      activitesPrincipales: 'Légumes et maïs',
      identifiantREF: 'GIC-CEN-011',
      statutLegalisation: 'Légalisé',
      timestampMaj: new Date(),
      bassinProductionId: bassinCentre.id,
    },
  });

  const gicRecoltesNord = await prisma.gIC.create({
    data: {
      nom: 'GIC Récoltes du Nord',
      logoURL: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200',
      reglementInterieur: 'Gestion communautaire des stocks de céréales.',
      activitesPrincipales: 'Céréales et tubercules',
      identifiantREF: 'GIC-NORD-008',
      statutLegalisation: 'Légalisé',
      timestampMaj: new Date(),
      bassinProductionId: bassinNord.id,
    },
  });

  const gicProducteursCentre = await prisma.gIC.create({
    data: {
      nom: 'GIC Producteurs Centre',
      logoURL: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=200',
      reglementInterieur: 'Groupement spécialisé en cultures vivrières.',
      activitesPrincipales: 'Plantains et bananes',
      identifiantREF: 'GIC-CEN-022',
      statutLegalisation: 'Légalisé',
      timestampMaj: new Date(),
      bassinProductionId: bassinCentre.id,
    },
  });

  const gicTerresFertiles = await prisma.gIC.create({
    data: {
      nom: 'GIC Terres Fertiles',
      logoURL: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=200',
      reglementInterieur: 'Coopérative de femmes maraîchères.',
      activitesPrincipales: 'Poivrons et aromates',
      identifiantREF: 'GIC-OUEST-031',
      statutLegalisation: 'Légalisé',
      timestampMaj: new Date(),
      bassinProductionId: bassinOuest.id,
    },
  });

  const gicFermesCemac = await prisma.gIC.create({
    data: {
      nom: 'GIC Fermes CEMAC',
      logoURL: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=200',
      reglementInterieur: 'Exportation sous-régionale et conditionnement.',
      activitesPrincipales: 'Arachides et oléagineux',
      identifiantREF: 'GIC-LIT-019',
      statutLegalisation: 'Légalisé',
      timestampMaj: new Date(),
      bassinProductionId: bassinLittoral.id,
    },
  });

  console.log('✅ GICs créés');

  // 4. Offres de récoltes (RecolteOffre)
  await prisma.recolteOffre.createMany({
    data: [
      {
        quantiteEstimee: 3000,
        quantiteDisponible: 2400,
        dateDispoEstimee: new Date('2026-07-25'),
        maturite: 'Mature',
        timestampMaj: new Date(),
        produitAgricoleId: pTomate.id,
        gicId: gicChampsVerts.id,
      },
      {
        quantiteEstimee: 6000,
        quantiteDisponible: 5000,
        dateDispoEstimee: new Date('2026-08-10'),
        maturite: 'En maturation',
        timestampMaj: new Date(),
        produitAgricoleId: pMais.id,
        gicId: gicAgroVallee.id,
      },
      {
        quantiteEstimee: 4000,
        quantiteDisponible: 3200,
        dateDispoEstimee: new Date('2026-07-28'),
        maturite: 'Mature',
        timestampMaj: new Date(),
        produitAgricoleId: pManioc.id,
        gicId: gicRecoltesNord.id,
      },
      {
        quantiteEstimee: 600,
        quantiteDisponible: 450,
        dateDispoEstimee: new Date('2026-08-05'),
        maturite: 'Précoce',
        timestampMaj: new Date(),
        produitAgricoleId: pPlantain.id,
        gicId: gicProducteursCentre.id,
      },
      {
        quantiteEstimee: 1200,
        quantiteDisponible: 900,
        dateDispoEstimee: new Date('2026-07-22'),
        maturite: 'Mature',
        timestampMaj: new Date(),
        produitAgricoleId: pPoivron.id,
        gicId: gicTerresFertiles.id,
      },
      {
        quantiteEstimee: 2500,
        quantiteDisponible: 1800,
        dateDispoEstimee: new Date('2026-07-30'),
        maturite: 'Séché',
        timestampMaj: new Date(),
        produitAgricoleId: pArachide.id,
        gicId: gicFermesCemac.id,
      },
    ],
  });

  console.log('✅ Offres de récoltes créées');

  // 5. Données de marché (Prix & Rentabilité)
  await prisma.donneeMarche.createMany({
    data: [
      {
        prixMoyen: 480,
        rentabilite: 18,
        dateReleve: new Date('2026-07-01'),
        produitAgricoleId: pTomate.id,
        bassinProductionId: bassinOuest.id,
      },
      {
        prixMoyen: 350,
        rentabilite: 22,
        dateReleve: new Date('2026-07-01'),
        produitAgricoleId: pMais.id,
        bassinProductionId: bassinOuest.id,
      },
      {
        prixMoyen: 320,
        rentabilite: 15,
        dateReleve: new Date('2026-07-01'),
        produitAgricoleId: pMais.id,
        bassinProductionId: bassinNord.id,
      },
      {
        prixMoyen: 200,
        rentabilite: 25,
        dateReleve: new Date('2026-07-01'),
        produitAgricoleId: pManioc.id,
        bassinProductionId: bassinCentre.id,
      },
    ],
  });

  console.log('✅ Données de marché créées');

  // 6. Données Météo
  await prisma.donneesMeteo.createMany({
    data: [
      {
        temperature: 24.5,
        pluviometrie: 12.0,
        timestampMesure: new Date('2026-07-24'),
        bassinProductionId: bassinOuest.id,
      },
      {
        temperature: 27.8,
        pluviometrie: 5.5,
        timestampMesure: new Date('2026-07-24'),
        bassinProductionId: bassinCentre.id,
      },
      {
        temperature: 32.1,
        pluviometrie: 0.0,
        timestampMesure: new Date('2026-07-24'),
        bassinProductionId: bassinNord.id,
      },
    ],
  });

  console.log('✅ Données météo créées');

  // 7. Alertes Phytosanitaires
  await prisma.alertePhyto.createMany({
    data: [
      {
        ravageurMaladie: 'Mildiou de la tomate',
        protocoleUrgence: 'Retirer feuilles atteintes, appliquer fongicide à base de cuivre, espacer irrigations.',
        dateEmission: new Date('2026-07-19'),
        bassinProductionId: bassinOuest.id,
      },
      {
        ravageurMaladie: 'Chenille légionnaire du maïs',
        protocoleUrgence: 'Inspection quotidienne du verticille, application d\'un biopesticide homologué à la tombée de la nuit.',
        dateEmission: new Date('2026-07-22'),
        bassinProductionId: bassinNord.id,
      },
    ],
  });

  console.log('✅ Alertes phytosanitaires créées');

  // 8. Programmes Agricoles
  await prisma.programmeAgricole.createMany({
    data: [
      {
        nom: 'Crédit Campagne MINADER',
        description: 'Prêt saisonnier taux bonifié pour groupements agricoles',
        criteresEligibilite: 'GIC légalisé, au moins 2 ans d\'activité enregistrée',
        dateLimite: new Date('2026-09-30'),
        urlLien: 'https://minader.cm/programmes/credit-campagne',
      },
      {
        nom: 'Subvention Intrants Ouest',
        description: 'Aide et prise en charge d\'engrais NPK à 30%',
        criteresEligibilite: 'Implantation dans le Bassin Ouest, surface > 5 ha',
        dateLimite: new Date('2026-08-15'),
        urlLien: 'https://minader.cm/programmes/intrants-ouest',
      },
    ],
  });

  console.log('✅ Programmes agricoles créés');

  // 9. Acheteurs
  await prisma.acheteur.create({
    data: {
      nomEntreprise: 'Société Agro-Food Douala',
      contact: '+237 699 11 22 33',
      adresse: 'Zone Industrielle Bassa, Douala',
      preferencesAlertes: JSON.stringify({ productNames: ['Tomates fraîches', 'Maïs jaune'], bassins: ['Ouest', 'Centre'] }),
    },
  });

  console.log('🎉 Germination terminée avec succès ! Toutes les données réelles sont dans PostgreSQL.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding de la base de données:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
