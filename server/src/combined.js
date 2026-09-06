import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { config } from './config.js';

// ==================================================================
//  Serveur « tout-en-un » pour le déploiement production.
//  Sert le front PWA (dist/) + l'API sur le MÊME port → même origine,
//  donc aucun CORS. Render / Fly / Railway / VPS utilisent ce fichier.
// ==================================================================
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', '..', 'dist');

const app = await createApp({ staticDir: distDir });

app.listen(config.port, '0.0.0.0', () => {
  console.log(`\n🟣  Cabine En Ligne — mono-service`);
  console.log(`    Port        : ${config.port}`);
  console.log(`    Front       : ${distDir}`);
  console.log(`    Mode Wave   : ${config.waveMode}  ${config.waveMode === 'live' ? '(API réelle api.wave.com)' : '(simulation locale)'}`);
  console.log(`    Base        : ${process.env.DATABASE_URL ? 'PostgreSQL' : 'fichier JSON (dev)'}`);
  console.log(`    Écoute      : http://localhost:${config.port}\n`);
});
