# Pre-Match Value & xG Tool

Dieses Repository enthält ein kleines Frontend-Projekt, das Pre-Match-Quoten mit xG-Daten kombiniert, um mögliche *Value Bets* zu erkennen.

## Enthaltene Dateien
- `index.html` — Hauptseite
- `style.css` — Styling (dark)
- `app.js` — Client-Logik (Fetch, Value-Berechnung, Rendering)
- `server_proxy.js` — **OPTIONAL**: Node.js Proxy, der API-Sports-Anfragen serverseitig weiterleitet (sorgt dafür, dass dein API-Key nicht im Client ist)
- `package.json` — für den Proxy
- `README.md`, `.gitignore`

## WICHTIG — API Keys & CORS
- **API-Sports** (odds, fixtures) verlangt einen API-Key. **Präferiere die Verwendung des mitgelieferten Proxy (server_proxy.js)**, damit der Key nicht im Client steht.
- Understat wird clientseitig abgefragt (best-effort). Manche Seiten blockieren CORS — dann benutze die Beispieldaten (Button "Beispieldaten") oder setze einen eigenen Server-Scraper ein.

## Quickstart (lokal)
### 1) Frontend-only (Test mit Beispieldaten)
Einfach `index.html` in deinem Browser öffnen — klicke "Beispieldaten".

### 2) Mit Proxy (empfohlen)
1. Node.js installieren (>=18 empfohlen).
2. `.env` anlegen mit:
```
API_SPORTS_KEY=dein_api_sports_key
PORT=3000
```
3. Proxy starten:
```bash
npm install
node server_proxy.js
```
4. Öffne `http://localhost:3000` (server_proxy.js dient statische Dateien und Proxy).

## Hinweise zur Sicherheit
- Checke niemals deine API-Keys in ein öffentliches GitHub-Repo.
- Für echte Projekte: setze serverseitige Ratenbegrenzung, Logging und CORS-Policy.

## Weiterentwicklung
- Bessere xG-Integration (Unterstat-API oder eigener Scraper)
- Benutzerkonten / Favoriten
- Export (CSV) & Sharing
