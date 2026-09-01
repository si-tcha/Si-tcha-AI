import axios from 'axios';
import * as cheerio from 'cheerio';
import prisma from '../lib/prisma.js';

// Helper pour nettoyer et convertir les prix (ex: "1 400" -> 1400)
function parsePrice(priceStr: string): number {
    if (!priceStr || priceStr.trim() === '-') return 0;
    // Enlève les espaces et convertit en nombre
    return parseFloat(priceStr.replace(/\s/g, ''));
}

export async function scrapeOnccPrices(): Promise<void> {
  try {
    console.log('🔄 Début du scraping des prix depuis ONCC...');
    const response = await axios.get('https://oncc.cm/prices', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const $ = cheerio.load(response.data);
    const scrapedDate = new Date(); // Date unique pour toutes les entrées de ce scraping

    // Sélectionne toutes les lignes <tr> dans le corps <tbody> de la table
    const rows = $('table.table.table-bordered.table-striped > tbody > tr');
    
    console.log(`🔍 ${rows.length} lignes de données trouvées sur oncc.cm.`);
    let count = 0;

    for (const row of rows) {
        const columns = $(row).find('td');
        if (columns.length < 4) continue; // Ignore les lignes malformées

        const produitNom = $(columns[0]).text().trim().toUpperCase();
        const zoneNom = $(columns[1]).text().trim().toUpperCase();
        const prixMinStr = $(columns[2]).text().trim();
        const prixMaxStr = $(columns[3]).text().trim();

        if (!produitNom || !zoneNom || produitNom === '' || zoneNom === '') continue;

        const prixMin = parsePrice(prixMinStr);
        const prixMax = parsePrice(prixMaxStr);
        
        // Si les deux prix sont à 0, on ignore la ligne
        if (prixMin === 0 && prixMax === 0) {
            continue;
        }

        const prixMoyen = (prixMin + prixMax) / 2;

        // Crée le produit s'il n'existe pas (upsert)
        const produit = await prisma.produitAgricole.upsert({
            where: { nom: produitNom },
            update: {},
            create: {
                nom: produitNom,
                categorie: 'A DEFINIR', // Catégorie par défaut pour les produits scrapés
                unite: 'kg',
            },
        });

        const bassinNom = `Bassin de ${zoneNom}`;

        // Crée le bassin de production s'il n'existe pas (upsert)
        const bassin = await prisma.bassinProduction.upsert({
            where: { nom: bassinNom },
            update: {},
            create: {
                nom: bassinNom,
                region: zoneNom,
                latitude: 0,  // Valeur par défaut, à mettre à jour si possible
                longitude: 0, // Valeur par défaut, à mettre à jour si possible
            },
        });

        // Crée la nouvelle donnée de marché
        await prisma.donneeMarche.create({
            data: {
                prixMin,
                prixMax,
                prixMoyen,
                dateReleve: scrapedDate,
                rentabilite: 0, // Valeur par défaut, car non fournie par le scraper
                source: 'ONCC_SCRAPER', // Indique que la donnée vient du scraper ONCC
                produitAgricoleId: produit.id,
                bassinProductionId: bassin.id,
            }
        });
        count++;
    }

    console.log(`✅ ${count} données de marché ONCC ont été enregistrées avec succès.`);

  } catch (error: any) {
    console.error('❌ Erreur majeure lors du scraping ONCC :', error.message);
  }
}