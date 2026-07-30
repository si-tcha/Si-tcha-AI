import app from './app';
import http from 'http';
const port = process.env.PORT || 4000;
const server = http.createServer(app);
server.listen(port, () => {
    console.log(`[server]: Le serveur tourne sur http://localhost:${port}`);
});
