/* Pre-Match Value & xG Tool - app.js
   IMPORTANT:
   - Do NOT embed your API-Sports key directly in client-side code for production.
   - The package includes a simple Node proxy (server_proxy.js) that forwards requests to API-Sports.
   - See README.md for setup instructions.
*/

const CONFIG = {
  BASE_PROXY: "/api",            // Proxy base (when running the included server)
  CACHE_DURATION: 5 * 60 * 1000,
  MAX_RETRIES: 2,
  RETRY_DELAY: 1500
};

let state = { cachedData: {}, understat: {}, useSample: false };

const qs = (s) => document.querySelector(s);
const debounce = (f, d = 300) => { let t; return (...a) => (clearTimeout(t), t = setTimeout(() => f(...a), d)); };

const cacheData = (k, d) => { state.cachedData[k] = { data: d, timestamp: Date.now() }; try { localStorage.setItem(k, JSON.stringify(state.cachedData[k])); } catch(e){} };
const getCachedData = (k) => { try { const c = JSON.parse(localStorage.getItem(k)) || {}; return (Date.now() - (c.timestamp || 0)) < CONFIG.CACHE_DURATION ? c.data : null; } catch(e){ return null; } };

const setStatus = (t, isError = false) => { const s = qs('#status'); s.textContent = t; s.style.color = isError ? '#ff9b9b' : ''; };

const fetchUnderstatLeague = async (league, season = '2024') => {
  const key = `understat_${league}_${season}`, c = getCachedData(key); if (c) return c;
  try { const res = await fetch(`https://understat.com/league/${encodeURIComponent(league)}/${season}`); if (!res.ok) throw new Error('Understat fetch failed');
    const text = await res.text(), match = text.match(/var teamsData\s*=\s*JSON.parse\('(.*?)'\)/); if (!match) throw new Error('No teamsData found');
    const parsed = JSON.parse(decodeURIComponent(JSON.parse('"' + match[1] + '"'))); cacheData(key, parsed); return parsed;
  } catch (err) { console.warn('Understat error for', league, err); return null; }
};

const proxyFetch = async (path, retries = CONFIG.MAX_RETRIES) => {
  const key = `proxy_${path.replace(/[/?=&]/g, '_')}`, c = getCachedData(key); if (c) return c;
  try { const res = await fetch(`${CONFIG.BASE_PROXY}${path}`); if (!res.ok) { if (res.status === 429 && retries > 0) { await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY)); return proxyFetch(path, retries - 1); } throw new Error('Proxy HTTP ' + res.status); }
    const j = await res.json(); cacheData(key, j); return j;
  } catch (err) { console.error('proxyFetch error', err); throw err; }
};

const calculateValue = (p, o) => o > 0 ? p * o - 1 : -1;

const leagueFromName = (name) => !name ? null : name.includes('England') ? 'EPL' : name.includes('Germany') ? 'Bundesliga' : name.includes('Spain') ? 'La_Liga' : name.includes('Italy') ? 'Serie_A' : name.includes('France') ? 'Ligue_1' : name.includes('Champions League') ? 'UCL' : null;

const getLeagueId = (filter) => {
  const ids = { 'EPL': 39, 'Bundesliga': 78, 'La_Liga': 140, 'Serie_A': 135, 'Ligue_1': 61, 'UCL': 2 };
  return filter === 'all' ? '' : `&league=${ids[filter]}`;
};

const loadData = async () => {
  setStatus('Lade Daten...');
  const date = qs('#match-date').value || new Date().toISOString().split('T')[0], minV = parseFloat(qs('#filter-value').value) || 0, leagueFilter = qs('#league-select').value;
  try { const leagues = ['Bundesliga', 'EPL', 'La_Liga', 'Serie_A', 'Ligue_1']; // UCL hat kein Understat, also überspringen
    const understatPromises = leagues.map(l => fetchUnderstatLeague(l, '2024'));
    const understatResults = await Promise.all(understatPromises); state.understat = Object.fromEntries(leagues.map((l, i) => [l, understatResults[i]]));
  } catch(e) { console.warn('Understat overall error', e); }
  try { const leagueParam = getLeagueId(leagueFilter);
    const fixturesResp = await proxyFetch(`/fixtures?date=${date}&status=NS${leagueParam}`), oddsResp = await proxyFetch(`/odds?date=${date}${leagueParam}`);
    const fixtures = fixturesResp.response || [], odds = oddsResp.response || []; renderMatches(fixtures, odds, minV, leagueFilter); setStatus(`Fertig — ${fixtures.length} Spiele geladen.`);
  } catch (err) { console.error(err); if (state.useSample) { setStatus('Fehler beim Laden externer APIs — zeige Beispieldaten.', true); renderSample(); return; }
    setStatus('Fehler beim Laden der APIs. Siehe Konsole. (Du kannst "Beispieldaten" aktivieren)', true); }
};

function computeMatchValue(match, oddsEntry) { if (!oddsEntry || !oddsEntry.values) return { maxVal: -Infinity, values: [] };
  const oddsArr = oddsEntry.values.map(v => parseFloat(v.odd) || 0), implied = oddsArr.map(o => o > 0 ? 1 / o : 0), sum = implied.reduce((a,b) => a + b, 0) || 1,
  probs = implied.map(p => p / sum), values = oddsArr.map((o,i) => ({ label: oddsEntry.values[i].value, odd: o, prob: probs[i], val: calculateValue(probs[i], o) }));
  return { maxVal: Math.max(...values.map(v => v.val)), values }; }

const renderMatches = (fixtures, oddsList, minV = 0, leagueFilter = 'all') => {
  const container = qs('#match-list'); container.innerHTML = '';
  if (!fixtures || !fixtures.length) { container.innerHTML = '<div class="no-data">Keine Spiele für das gewählte Datum.</div>'; return; }
  const enriched = fixtures.map(fx => {
    const oddsEntry = oddsList.find(o => o.fixture?.id === fx.fixture.id), matchLeague = leagueFromName(fx.league?.name), under = (matchLeague !== 'UCL' ? state.understat[matchLeague] : null),
    homeName = fx.teams.home?.name || '', awayName = fx.teams.away?.name || '', homeXG = 'N/A', awayXG = 'N/A';
    try { if (under?.teams) { const teamObj = under.teams || under, findTeam = (n) => Object.values(teamObj).find(t => (t.title || t.name || '').toLowerCase().includes(n.toLowerCase()));
      const th = findTeam(homeName), ta = findTeam(awayName); if (th?.xG) homeXG = Number(th.xG).toFixed(2); if (ta?.xG) awayXG = Number(ta.xG).toFixed(2); }
    } catch(e) {}
    const bet = oddsEntry?.bookmakers?.[0]?.bets?.find(b => b.name === 'Match Winner') || null, { maxVal, values } = computeMatchValue(fx, bet);
    return { fx, oddsEntry, matchLeague, homeName, awayName, homeXG, awayXG, maxVal, values };
  }).filter(m => m.matchLeague);
  const filtered = enriched.filter(m => leagueFilter === 'all' || m.matchLeague === leagueFilter), aboveMin = filtered.filter(m => m.maxVal >= minV);
  aboveMin.sort((a,b) => b.maxVal - a.maxVal); if (!aboveMin.length) { container.innerHTML = '<div class="no-data">Keine Spiele entsprechen dem Filter.</div>'; return; }
  aboveMin.forEach(m => {
    const div = document.createElement('div'); div.className = 'match-card';
    const header = document.createElement('div'); header.className = 'match-header';
    const teams = document.createElement('div'); teams.className = 'teams'; teams.innerHTML = `<span class="team-name">${m.homeName}</span> <span style="opacity:0.8">vs</span> <span class="team-name">${m.awayName}</span>`;
    header.appendChild(teams); const leagueSpan = document.createElement('div'); leagueSpan.textContent = `${m.matchLeague || 'UCL'} · ${(m.maxVal*100).toFixed(1)}%`;
    leagueSpan.className = m.maxVal >= 0.1 ? 'value-high' : m.maxVal >= 0 ? 'value-mid' : 'value-low'; header.appendChild(leagueSpan); div.appendChild(header);
    const oddsWrap = document.createElement('div'); oddsWrap.className = 'odds-list';
    if (m.values?.length) m.values.forEach(v => { const it = document.createElement('div'); it.className = 'odds-item';
      it.appendChild(Object.assign(document.createElement('div'), { textContent: `${v.label} @ ${v.odd}` })); const valspan = document.createElement('div'); valspan.textContent = (v.val*100).toFixed(1) + '%';
      valspan.className = v.val >= 0.1 ? 'value-high' : v.val >= 0 ? 'value-mid' : 'value-low'; it.appendChild(valspan); oddsWrap.appendChild(it); });
    else oddsWrap.innerHTML = '<div class="no-data">Keine Quoten verfügbar</div>';
    const xg = document.createElement('div'); xg.className = 'xg-info'; xg.textContent = `xG: ${m.homeXG} (H) | ${m.awayXG} (A)`; oddsWrap.appendChild(xg); div.appendChild(oddsWrap);
    container.appendChild(div);
  });
};

function renderSample() { const sampleFixtures = [{"fixture":{"id":1,"date":"2025-10-20"},"league":{"name":"UEFA Champions League"},"teams":{"home":{"name":"Team UCL A","logo":""},"away":{"name":"Team UCL B","logo":""}}}].concat([{"fixture":{"id":2,"date":"2025-10-20"},"league":{"name":"England - Premier League"},"teams":{"home":{"name":"Team A","logo":""},"away":{"name":"Team B","logo":""}}}]),
sampleOdds = [{"fixture":{"id":1},"bookmakers":[{"bets":[{"name":"Match Winner","values":[{"value":"Home","odd":"1.90"},{"value":"Draw","odd":"3.60"},{"value":"Away","odd":"4.10"}]}]}]},
{"fixture":{"id":2},"bookmakers":[{"bets":[{"name":"Match Winner","values":[{"value":"Home","odd":"2.50"},{"value":"Draw","odd":"3.10"},{"value":"Away","odd":"2.80"}]}]}]}];
renderMatches(sampleFixtures, sampleOdds, 0, 'all'); }

document.addEventListener('DOMContentLoaded', () => {
  qs('#match-date').value = new Date().toISOString().split('T')[0];
  qs('#refresh').addEventListener('click', debounce(loadData, 250));
  qs('#filter-value').addEventListener('change', debounce(loadData, 250));
  qs('#match-date').addEventListener('change', debounce(loadData, 250));
  qs('#league-select').addEventListener('change', debounce(loadData, 250)); // Neu: UCL-Filter
  qs('#toggle-sample').addEventListener('click', () => { state.useSample = !state.useSample; qs('#toggle-sample').textContent = state.useSample ? 'Live Daten' : 'Beispieldaten';
    state.useSample ? renderSample() : loadData(); });
  loadData();
});
