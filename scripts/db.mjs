// Arranca el servidor MongoDB local: npm run db
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const DATA_DIR = process.env.MONGO_DBPATH || 'C:\\data\\db';
const SERVER_DIR = 'C:\\Program Files\\MongoDB\\Server';

// Busca mongod.exe en la instalación más reciente de MongoDB Server
function findMongod() {
  if (!existsSync(SERVER_DIR)) return null;
  const versions = readdirSync(SERVER_DIR).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const v of versions) {
    const exe = join(SERVER_DIR, v, 'bin', 'mongod.exe');
    if (existsSync(exe)) return exe;
  }
  return null;
}

const mongod = findMongod();
if (!mongod) {
  console.error(`No se encontró mongod.exe en ${SERVER_DIR}. Instala MongoDB Community Server.`);
  process.exit(1);
}

mkdirSync(DATA_DIR, { recursive: true });
console.log(`Iniciando ${mongod}\nDatos: ${DATA_DIR}\nURI:   mongodb://127.0.0.1:27017`);

const proc = spawn(mongod, ['--dbpath', DATA_DIR, '--bind_ip', '127.0.0.1', '--port', '27017', '--quiet'], {
  stdio: 'inherit',
});
proc.on('exit', (code) => {
  if (code === 48) console.error('El puerto 27017 ya está en uso: MongoDB probablemente ya está corriendo.');
  process.exit(code ?? 0);
});
