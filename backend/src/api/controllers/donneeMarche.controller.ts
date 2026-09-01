import { Request, Response } from 'express';
import prisma from '../../lib/prisma.js';

// 1. Création (Saisie manuelle Admin)
export async function createDonneeMarcheManuelle(req: Request, res: Response): Promise<void> {
  try {
    const { prixMin, prixMax, rentabilite, dateReleve, produitAgricoleId, bassinProductionId } = req.body;

    if (!prixMin || !prixMax || !produitAgricoleId || !bassinProductionId) {
      res.status(400).json({ 
        message: 'Prix min, prix max, produitAgricoleId et bassinProductionId sont requis.' 
      });
      return;
    }

    const min = parseFloat(prixMin);
    const max = parseFloat(prixMax);
    const moyen = (min + max) / 2;

    const nouvelleDonnee = await prisma.donneeMarche.create({
      data: {
        prixMin: min,
        prixMax: max,
        prixMoyen: moyen,
        rentabilite: rentabilite ? parseFloat(rentabilite) : 0, // Assurez-vous que rentabilite est bien un Decimal dans votre schema
        source: 'MANUEL', // Indique que la donnée a été saisie manuellement
        dateReleve: dateReleve ? new Date(dateReleve) : new Date(),
        produitAgricoleId,
        bassinProductionId
      },
      include: {
        produitAgricole: true,
        bassinProduction: true
      }
    });

    res.status(201).json({ status: 'success', data: nouvelleDonnee });
  } catch (error) {
    console.error('Erreur création donnée marché :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la création.' });
  }
}

// 2. Affichage des Prix du Marché (Pour Mobile / Front-end)
export async function getDonneesMarche(req: Request, res: Response): Promise<void> {
  try {
    const donnees = await prisma.donneeMarche.findMany({
      orderBy: { dateReleve: 'desc' },
      include: {
        produitAgricole: { select: { nom: true, categorie: true } },
        bassinProduction: { select: { nom: true, region: true } }
      }
    });

    // Formater la réponse pour inclure Min, Max et Moyen
    const resultatsFormat = donnees.map(d => ({
      id: d.id,
      produit: d.produitAgricole.nom,
      bassin: d.bassinProduction.nom,
      region: d.bassinProduction.region,
      prixMin: d.prixMin ? Number(d.prixMin) : null,
      prixMax: d.prixMax ? Number(d.prixMax) : null,
      prixMoyen: Number(d.prixMoyen),
      dateReleve: d.dateReleve
    }));

    res.status(200).json({ status: 'success', data: resultatsFormat });
  } catch (error) {
    console.error('Erreur récupération données marché :', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

// 3. Affichage du Dashboard Marché (avec tendances et conseils)
type Tendance = 'HAUSSE' | 'BAISSE' | 'STABLE';

interface MarketDataWithTrend {
  id: string;
  produit: string;
  bassin: string;
  region: string;
  prixMin: number | null;
  prixMax: number | null;
  prixMoyen: number;
  dateReleve: Date;
  tendance: Tendance;
  conseil: string;
}

function getConseil(tendance: Tendance, role: 'AGRICULTEUR' | 'ACHETEUR' | 'ADMIN', produit: string): string {
    const produitNormalise = produit.charAt(0).toUpperCase() + produit.slice(1).toLowerCase();
    if (role === 'AGRICULTEUR') {
        switch (tendance) {
            case 'HAUSSE': return `Le prix du ${produitNormalise} est en hausse. C'est peut-être un bon moment pour vendre.`;
            case 'BAISSE': return `Le prix du ${produitNormalise} chute. Envisagez de stocker si possible en attendant une meilleure offre.`;
            case 'STABLE': return `Le prix du ${produitNormalise} est stable. Évaluez vos besoins avant de vendre.`;
        }
    } else { // ACHETEUR or ADMIN
        switch (tendance) {
            case 'HAUSSE': return `Le prix du ${produitNormalise} augmente. Pensez à acheter maintenant si vous en avez besoin.`;
            case 'BAISSE': return `Le prix du ${produitNormalise} est en baisse. C'est une excellente opportunité d'achat.`;
            case 'STABLE': return `Le prix du ${produitNormalise} est stable. Planifiez vos achats en conséquence.`;
        }
    }
}

export async function getMarketDashboard(req: Request, res: Response): Promise<void> {
    try {
        const user = (req as any).user;
        if (!user || !user.role) {
            res.status(401).json({ message: "Utilisateur non authentifié." });
            return;
        }

        const allData = await prisma.donneeMarche.findMany({
            orderBy: { dateReleve: 'desc' },
            include: {
                produitAgricole: { select: { nom: true } },
                bassinProduction: { select: { nom: true, region: true } }
            }
        });

        const groupedData = new Map<string, any[]>();
        for (const d of allData) {
            const key = `${d.produitAgricoleId}-${d.bassinProductionId}`;
            if (!groupedData.has(key)) groupedData.set(key, []);
            groupedData.get(key)!.push(d);
        }

        const dashboardData: MarketDataWithTrend[] = [];
        for (const group of groupedData.values()) {
            const latest = group[0];
            const previous = group[1];
            
            let tendance: Tendance = 'STABLE';
            if (previous && latest.prixMoyen > previous.prixMoyen) tendance = 'HAUSSE';
            else if (previous && latest.prixMoyen < previous.prixMoyen) tendance = 'BAISSE';

            dashboardData.push({
                id: latest.id,
                produit: latest.produitAgricole.nom,
                bassin: latest.bassinProduction.nom,
                region: latest.bassinProduction.region,
                prixMin: latest.prixMin ? Number(latest.prixMin) : null,
                prixMax: latest.prixMax ? Number(latest.prixMax) : null,
                prixMoyen: Number(latest.prixMoyen),
                dateReleve: latest.dateReleve,
                tendance,
                conseil: getConseil(tendance, user.role, latest.produitAgricole.nom),
            });
        }

        res.status(200).json({ message: "Données du tableau de bord du marché récupérées.", data: dashboardData });
    } catch (error) {
        console.error('Erreur récupération dashboard marché :', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
}