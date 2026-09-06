import { createApp } from './app.js';
import { config } from './config.js';

const app = await createApp();

app.listen(config.port, () => {
  console.log(`\n🟣  Cabine En Ligne — API démarrée`);
  console.log(`    Port        : ${config.port}`);
  console.log(`    Mode Wave   : ${config.waveMode}  ${config.waveMode === 'live' ? '(API réelle api.wave.com)' : '(simulation locale)'}`);
  console.log(`    Base        : ${process.env.DATABASE_URL ? 'PostgreSQL' : 'fichier JSON (dev)'}`);
  console.log(`    Écoute      : http://localhost:${config.port}\n`);
});
