/**
 * Simple proxy + static file server for local development.
 * - Serves files from the current directory on PORT (default 3000).
 * - Proxies requests starting with /api to https://v3.football.api-sports.io
 *
 * Usage:
 * 1. npm install express node-fetch dotenv
 * 2. node server_proxy.js
 *
 * NOTE: This is a minimal dev helper. Do NOT use as-is in production.
 */
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const API_KEY = "c6ad1210c71b17cca24284ab8a9873b4";
const PORT = process.env.PORT || 3000;
const API_BASE = 'https://v3.football.api-sports.io';

if (!API_KEY) { console.error('ERROR: API_SPORTS_KEY not set'); process.exit(1); }

const app = express();
app.use(express.static(path.join(__dirname)));

app.use('/api', async (req, res) => {
  try { const target = API_BASE + req.originalUrl.replace(/^\/api/, ''); const resp = await fetch(target, { headers: { 'x-apisports-key': API_KEY, 'accept': 'application/json' } });
    const text = await resp.text(); res.status(resp.status).send(text);
  } catch (err) { console.error('Proxy error', err); res.status(500).json({ error: 'proxy_error' }); }
});

app.listen(PORT, () => console.log(`Dev server + proxy running on http://localhost:${PORT}`));
