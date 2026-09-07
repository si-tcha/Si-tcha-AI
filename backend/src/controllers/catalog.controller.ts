import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { getEmojiForCategory, getImageUrlForProduct } from '../utils/productUtils.js';

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, skip } = getPagination(req);

    // Seules les offres avec du stock disponible (> 0) et un prix serveur défini sont proposées
    const whereClause = {
      quantiteDisponible: { gt: 0 },
      produitAgricole: {
        prix: { not: null },
      },
    };

    const [offers, total] = await Promise.all([
      prisma.recolteOffre.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ id: 'asc' }],
        include: {
          produitAgricole: true,
          gic: {
            include: { bassinProduction: true },
          },
        },
      }),
      prisma.recolteOffre.count({ where: whereClause }),
    ]);

    const products = offers.map((offer) => {
      const serverPrice = offer.produitAgricole.prix ? offer.produitAgricole.prix.toString() : '';
      const serverUnit = offer.produitAgricole.unite || 'kg';

      return {
        id: offer.id.toString(),
        name: offer.produitAgricole.nom,
        category: offer.produitAgricole.categorie,
        gicId: offer.gicId.toString(),
        gicName: offer.gic.nom,
        gicRef: offer.gic.identifiantREF,
        price: serverPrice,
        unit: serverUnit,
        emoji: getEmojiForCategory(offer.produitAgricole.categorie, offer.produitAgricole.nom),
        imageUrl: offer.photoURL ?? offer.produitAgricole.imageURL ?? getImageUrlForProduct(offer.produitAgricole.nom),
        bassin: offer.gic?.bassinProduction?.nom ?? 'Ouest',
        maturite: offer.maturite,
        volumeDisponible: Number(offer.quantiteDisponible),
        dateDispo: offer.dateDispoEstimee ? offer.dateDispoEstimee.toISOString().slice(0, 10) : '',
      };
    });

    res.json({
      products,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getGicsPublic(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, skip } = getPagination(req);

    const [gicsDb, total] = await Promise.all([
      prisma.gIC.findMany({
        skip,
        take: limit,
        orderBy: [{ id: 'asc' }],
        include: { bassinProduction: true, gicNeedEntries: true },
      }),
      prisma.gIC.count(),
    ]);

    const gics = gicsDb.map((gic) => ({
      id: gic.id.toString(),
      name: gic.nom,
      identifiantREF: gic.identifiantREF,
      emoji: '🌿',
      bassin: gic.bassinProduction?.nom ?? 'Ouest',
      logoUrl: gic.logoURL,
      needs: gic.gicNeedEntries.map((n) => ({
        id: n.id,
        category: n.category,
        description: n.description,
        updatedAt: n.updatedAt.toISOString(),
      })),
    }));

    res.json({
      gics,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getTerrain(req: Request, res: Response) {
  try {
    const [meteoDb, marcheDb, phytoDb, progDb] = await Promise.all([
      prisma.donneesMeteo.findMany({ include: { bassinProduction: true } }),
      prisma.donneeMarche.findMany({ include: { bassinProduction: true, produitAgricole: true } }),
      prisma.alertePhyto.findMany({ include: { bassinProduction: true } }),
      prisma.programmeAgricole.findMany(),
    ]);

    // OpenWeatherMap Integration (P2.14)
    const OWM_KEY = process.env.OPENWEATHER_API_KEY;
    const cityMap: Record<string, string> = {
      'Ouest': 'Bafoussam',
      'Littoral': 'Douala',
      'Centre': 'Yaounde',
      'Nord': 'Garoua',
      'Sud-Ouest': 'Buea'
    };

    let weather = meteoDb.map((m) => ({
      id: m.id.toString(),
      bassin: m.bassinProduction?.nom ?? 'Ouest',
      temperature: Number(m.temperature),
      pluviometrie: Number(m.pluviometrie),
      humidity: 70, // Fallback
      description: 'Partiellement nuageux', // Fallback
      date: m.timestampMesure.toISOString().slice(0, 10),
      icon: '04d',
    }));

    if (OWM_KEY) {
      try {
        const uniqueBassins: string[] = [...new Set(meteoDb.map((m: any) => m.bassinProduction?.nom as string).filter(Boolean))];
        const owmWeather = await Promise.all(uniqueBassins.map(async (bassin: string) => {
          const city = cityMap[bassin] || 'Yaounde';
          const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city},CM&units=metric&lang=fr&appid=${OWM_KEY}`);
          if (!response.ok) return null;
          const data = await response.json();
          return {
            id: `owm-${bassin}`,
            bassin: bassin,
            temperature: Math.round(data.main.temp),
            pluviometrie: data.rain ? data.rain['1h'] || 0 : 0,
            humidity: data.main.humidity,
            description: data.weather[0]?.description || 'Nuageux',
            date: new Date().toISOString().slice(0, 10),
            icon: data.weather[0]?.icon
          };
        }));

        const validOwmWeather = owmWeather.filter(w => w !== null);
        if (validOwmWeather.length > 0) {
          weather = validOwmWeather as any;
        }
      } catch (e) {
        console.error("OpenWeatherMap fetch failed:", e);
      }
    }

    const market = marcheDb.map((mk) => ({
      id: mk.id.toString(),
      product: mk.produitAgricole.nom,
      bassin: mk.bassinProduction.nom,
      prixMoyen: Number(mk.prixMoyen),
      rentabilite: Number(mk.rentabilite),
      date: mk.dateReleve.toISOString().slice(0, 10),
    }));

    const phytoAlerts = phytoDb.map((p) => ({
      id: p.id.toString(),
      bassin: p.bassinProduction.nom,
      ravageurMaladie: p.ravageurMaladie,
      protocoleUrgence: p.protocoleUrgence,
      dateEmission: p.dateEmission.toISOString().slice(0, 10),
    }));

    const programs = progDb.map((pr) => ({
      id: pr.id.toString(),
      nom: pr.nom,
      description: pr.description,
      criteresEligibilite: pr.criteresEligibilite,
      dateLimite: pr.dateLimite.toISOString().slice(0, 10),
    }));

    res.json({ weather, market, phytoAlerts, programs });
  } catch (error) {
    res.json({ weather: [], market: [], phytoAlerts: [], programs: [] });
  }
}
