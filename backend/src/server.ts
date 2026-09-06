import 'dotenv/config';
import * as http from 'http';
import app from './app.js';
import { startAgroCronJobs } from './jobs/agroMonitoring.cron.js';
import { initMarketDataCron } from './jobs/marketData.cron.js';
import { startMarketSmsCronJob } from './jobs/marketSms.cron.js';

const port = process.env.PORT || 4000;
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`[server]: Le serveur tourne sur http://localhost:${port}`);

  startAgroCronJobs();
  initMarketDataCron();
  startMarketSmsCronJob();
});
