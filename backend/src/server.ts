import * as http from 'http';
import { startAgroCronJobs } from './jobs/agroMonitoring.cron.js';

async function startServer() {
  // Utilisation de l'importation dynamique pour une meilleure compatibilité des modules
  const { default: app } = await import('./app');

  const port = process.env.PORT || 8080;
  const server = http.createServer(app);

  
  server.listen(port, () => {
    console.log(`[server]: Le serveur tourne sur http://localhost:${port}`);
    
    startAgroCronJobs(); // Démarrer les tâches cron pour AgroMonitoring
  });
}

startServer();