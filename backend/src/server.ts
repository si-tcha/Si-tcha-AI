import 'dotenv/config';
import * as http from 'http';
import app from './app.js';
import { getConfig } from './config/env.js';
import { logger } from './middlewares/logger.js';
import { registerProcessLifecycle } from './lifecycle.js';
import { startAgroCronJobs } from './jobs/agroMonitoring.cron.js';
import { initMarketDataCron } from './jobs/marketData.cron.js';
import { startMarketSmsCronJob } from './jobs/marketSms.cron.js';

// Validation stricte des variables d'environnement au démarrage
const config = getConfig();

const server = http.createServer(app);

// Enregistrer les écouteurs de cycle de vie (SIGTERM, SIGINT, exceptions)
registerProcessLifecycle(server);

server.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      pid: process.pid,
    },
    `Serveur SI-TCHA AI prêt et à l'écoute sur le port ${config.PORT}`
  );

  // Lancer les cron jobs uniquement hors environnement de test
  if (config.NODE_ENV !== 'test') {
    startAgroCronJobs();
    initMarketDataCron();
    startMarketSmsCronJob();
  }
});

export default server;
