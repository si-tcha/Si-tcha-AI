import cron from 'node-cron';
import { scrapeOnccPrices } from '../services/onccScraper.service.js';

// Exécution tous les jours à 08h00 du matin
export function initMarketDataCron(): void {
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Lancement du CRON : Mise à jour des données du marché');
    await scrapeOnccPrices();
  });
}