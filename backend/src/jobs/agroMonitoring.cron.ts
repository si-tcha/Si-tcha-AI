import cron from 'node-cron';
import axios from 'axios';
import prisma from '../lib/prisma.js';
import { sendSms } from '../services/notification.service.js';

const AGRO_API_KEY = process.env.AGROMONITORING_API_KEY;
const BASE_URL = 'http://api.agromonitoring.com/agro/1.0';

export const startAgroCronJobs = () => {
  // S'exécute toutes les 4 heures (ex: 0h, 4h, 8h, 12h...)
  cron.schedule('0 */4 * * *', async () => {
    console.log('⏳ [CRON] Démarrage de la synchronisation AgroMonitoring...');

    try {
      // 1. Récupérer tous les GICs qui ont un polygone défini
      const gics = await prisma.gIC.findMany({
        where: { polygonId: { not: null } }
      });

      for (const gic of gics) {
        const polyId = gic.polygonId;
        
        // --- A. CURRENT WEATHER & FORECAST ---
        const weatherRes = await axios.get(`${BASE_URL}/weather?polyid=${polyId}&appid=${AGRO_API_KEY}&units=metric`);
        const forecastRes = await axios.get(`${BASE_URL}/weather/forecast?polyid=${polyId}&appid=${AGRO_API_KEY}&units=metric`);
        
        // 1. Sauvegarde Météo Actuelle
        await prisma.donneesMeteo.create({
          data: {
            temperature: weatherRes.data.main.temp,
            humidite: weatherRes.data.main.humidity,
            pluviometrie: weatherRes.data.rain ? weatherRes.data.rain['1h'] || 0 : 0,
            probabilitePluie: forecastRes.data[0]?.pop || 0, // Probability of Precipitation (0 à 1)
            vitesseVent: weatherRes.data.wind.speed,
            description: weatherRes.data.weather[0].description,
            timestampMesure: new Date(),
            gicId: gic.id
          }
        });

        // 2. AJOUT : Sauvegarde des prévisions sur 8 jours directement dans le modèle GIC
        await prisma.gIC.update({
          where: { id: gic.id },
          data: { 
            previsionsMeteo: forecastRes.data // Stocke le tableau complet sous forme de JSON
          }
        });

        // Analyse pour générer une Alerte Météo (Exemple de règle métier)
        const pop = forecastRes.data[0]?.pop || 0;
        if (pop > 0.7) { // Plus de 70% de chance de pluie
          const alerte = await prisma.alerteMeteo.create({
            data: {
              messageCourt: "Risque élevé de pluie dans les prochaines heures, reportez l'épandage d'engrais.",
              detailsTechniques: forecastRes.data[0],
              type: "PLUIE",
              gicId: gic.id
            }
          });

          // ENVOI DE L'ALERTE PAR SMS AUX AGRICULTEURS DU GIC
          const agriculteurs = await prisma.agriculteur.findMany({
            where: { gicId: gic.id, statut: 'APPROUVE' }
          });

          console.log(`📲 Envoi de l'alerte '${alerte.type}' à ${agriculteurs.length} agriculteur(s) du GIC ${gic.nom}.`);
          for (const agriculteur of agriculteurs) {
            try {
              await sendSms(agriculteur.contact, alerte.messageCourt);
            } catch (smsError) {
              console.error(`Erreur envoi SMS à ${agriculteur.contact}:`, smsError);
            }
          }
        }

        // --- B. CURRENT SOIL DATA ---
        const soilRes = await axios.get(`${BASE_URL}/soil?polyid=${polyId}&appid=${AGRO_API_KEY}`);
        
        // Convertir les Kelvin en Celsius (AgroMonitoring renvoie la température du sol en Kelvin par défaut)
        const tempSolSurfaceCelsius = soilRes.data.t0 - 273.15;
        const moisture = soilRes.data.moisture;

        await prisma.donneesSol.create({
          data: {
            temperatureSurface: tempSolSurfaceCelsius,
            temperature10cm: soilRes.data.t10 - 273.15,
            humidite: moisture,
            timestampMesure: new Date(),
            gicId: gic.id
          }
        });

        // Analyse du sol (Exemple: Sol prêt pour semis)
        if (tempSolSurfaceCelsius > 15 && moisture > 0.2) {
            const alerte = await prisma.alerteMeteo.create({
                data: {
                  messageCourt: "Le sol a atteint une température et une humidité optimales. C'est le moment idéal pour les semis.",
                  detailsTechniques: soilRes.data,
                  type: "SEMIS_OPTIMAL",
                  gicId: gic.id
                }
            });

            // ENVOI DE L'ALERTE PAR SMS AUX AGRICULTEURS DU GIC
            const agriculteurs = await prisma.agriculteur.findMany({
              where: { gicId: gic.id, statut: 'APPROUVE' }
            });

            console.log(`📲 Envoi de l'alerte '${alerte.type}' à ${agriculteurs.length} agriculteur(s) du GIC ${gic.nom}.`);
            for (const agriculteur of agriculteurs) {
              try {
                await sendSms(agriculteur.contact, alerte.messageCourt);
              } catch (smsError) {
                console.error(`Erreur envoi SMS à ${agriculteur.contact}:`, smsError);
              }
            }
        }

        // Note: Le module NDVI (Satellite) est plus complexe car les images ne sont pas générées tous les jours. 
        // Il nécessite une route spécifique pour vérifier si une nouvelle image est disponible avant de l'analyser.
      }
      
      console.log('✅ [CRON] Synchronisation AgroMonitoring terminée avec succès.');

    } catch (error: any) {
      console.error('❌ [CRON] Erreur lors de la synchronisation :', error.message);
    }
  });
};