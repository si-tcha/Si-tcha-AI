import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { sendSms } from '../services/notification.service.js';

// Fonction pour formater le message SMS
function formatMarketSms(data: any[]): string {
    if (data.length === 0) {
        return "Aucune donnée de marché récente disponible aujourd'hui.";
    }
    
    const summary = data.slice(0, 3) // Limite à 3 produits pour un SMS concis
        .map(d => {
            const tendanceSymbol = d.tendance === 'HAUSSE' ? '📈' : d.tendance === 'BAISSE' ? '📉' : '📊';
            return `${d.produit}: ${Math.round(d.prixMoyen)}FCFA ${tendanceSymbol}`;
        })
        .join(' | ');
    
    return `Bulletin marché Si-tcha: ${summary}`;
}

export const startMarketSmsCronJob = () => {
    // S'exécute tous les jours à 8h00 du matin
    cron.schedule('0 8 * * *', async () => {
        console.log('⏳ [CRON] Démarrage de l\'envoi du bulletin de marché par SMS...');

        try {
            // 1. Récupérer les données du marché (similaire au dashboard)
            const allData = await prisma.donneeMarche.findMany({
                orderBy: { dateReleve: 'desc' },
                include: { produitAgricole: { select: { nom: true } } }
            });

            const groupedData = new Map<string, any[]>();
            for (const d of allData) {
                const key = d.produitAgricoleId;
                if (!groupedData.has(key)) groupedData.set(key, []);
                groupedData.get(key)!.push(d);
            }

            const marketSummaryData: any[] = [];
            for (const group of groupedData.values()) {
                const latest = group[0];
                const previous = group[1];
                let tendance = 'STABLE';
                if (previous && latest.prixMoyen > previous.prixMoyen) tendance = 'HAUSSE';
                else if (previous && latest.prixMoyen < previous.prixMoyen) tendance = 'BAISSE';
                marketSummaryData.push({ produit: latest.produitAgricole.nom, prixMoyen: Number(latest.prixMoyen), tendance });
            }

            const smsMessage = formatMarketSms(marketSummaryData);
            const agriculteurs = await prisma.agriculteur.findMany({ where: { statut: 'APPROUVE', isVerified: true } });

            console.log(`📲 Envoi du bulletin de marché à ${agriculteurs.length} agriculteur(s)...`);
            for (const agriculteur of agriculteurs) {
                await sendSms(agriculteur.contact, smsMessage);
            }
            console.log('✅ [CRON] Envoi du bulletin de marché par SMS terminé.');
        } catch (error: any) {
            console.error('❌ [CRON] Erreur lors de l\'envoi du bulletin de marché par SMS :', error.message);
        }
    }, { timezone: "Africa/Douala" });
};