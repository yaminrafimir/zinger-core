'use strict';
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { openDb } = require('./db');
const { createApp } = require('./app');
const { seed } = require('./seed');

const root = path.resolve(__dirname, '..');
const dataDir = process.env.SAKINAH_DATA || path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbFile = path.join(dataDir, 'sakinah.db');
const fresh = !fs.existsSync(dbFile);
const db = openDb(dbFile);
if (fresh && process.env.SAKINAH_SEED !== '0') {
  seed(db);
  console.log('Seeded demo data (password for every demo account: bismillah123)');
}

const handler = createApp({ db, uploadDir: path.join(dataDir, 'uploads'), publicDir: path.join(root, 'public') });
const port = Number(process.env.PORT || 3000);
http.createServer(handler).listen(port, () => {
  console.log(`Sakinah is running at http://localhost:${port}`);
});
