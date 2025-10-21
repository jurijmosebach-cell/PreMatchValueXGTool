/* Simple xG & Value Tool — Live Version */

const CONFIG = {
  CACHE_DURATION: 5 * 60 * 1000,
  API_KEY: 'c6ad1210c71b17cca24284ab8a9873b4', // <-- Trage hier deinen echten API-Schlüssel ein
  API_BASE: 'https://v3.football.api-sports.io'
};

const qs = (s) => document.querySelector(s);
const debounce = (f, d = 300) => { let t; return (...a) => (clearTimeout(t), t = setTimeout(() => f(...a), d)); };
const setStatus = (t, isError = false) => {
  const s = qs('#status');
  s.textContent = t;
  s.style.color = isError ? '#ff9b9b' : '';
};

/* --- Echte API-Abfragen --- */
async function fetchFixtures(date) {
  const res = await fetch(`${CONFIG.API_BASE}/fixtures?date=${date}`, {
    headers: { 'x-apisports-key': CONFIG.API_KEY }
  });
  if (!res.ok) throw new Error('Fehler beim Abrufen der Fixtures');
  const data = await res.json();
  return data.response || [];
}

async function fetchOdds(date) {
  const res = await fetch(`${CONFIG.API_BASE}/odds?date=${date}`, {
    headers: { 'x-apisports-key': CONFIG.API_KEY }
  });
  if (!res.ok) throw new Error('Fehler beim Abrufen der Quoten');
  const data = await res.json();
  return data.response || [];
}

const calculateValue = (p, o) => o > 0 ? p * o - 1 : -1;

const leagueFromName = (name) => {
  if (!name) return null;
  if (name.includes('England')) return 'EPL';
  if (name.includes('Germany')) return 'Bundesliga';
  if (name.includes('Spain')) return 'La Liga';
  if (name.includes('Italy')) return 'Serie A';
  if (name.includes('France')) return 'Ligue 1';
  return name;
};

async function loadData() {
  setStatus('Lade Daten...');
  const date = qs('#match-date').value || new Date().toISOString().split('T')[0];
  const minV = parseFloat(qs('#filter-value').value) || 0;
  const leagueFilter = qs('#league-select').value;

  try {
    const fixtures = await fetchFixtures(date);
    const odds = await fetchOdds(date);
    renderMatches(fixtures, odds, minV, leagueFilter);
    setStatus(`Fertig — ${fixtures.length} Spiele geladen.`);
  } catch (err) {
    console.error(err);
    setStatus('Fehler beim Laden der Daten', true);
  }
}

function computeMatchValue(match, oddsEntry) {
  if (!oddsEntry || !oddsEntry.values) return { maxVal: -Infinity, values: [] };
  const oddsArr = oddsEntry.values.map(v => parseFloat(v.odd) || 0);
  const implied = oddsArr.map(o => o > 0 ? 1 / o : 0);
  const sum = implied.reduce((a,b) => a + b, 0) || 1;
  const probs = implied.map(p => p / sum);
  const values = oddsArr.map((o,i) => ({
    label: oddsEntry.values[i].value,
    odd: o,
    prob: probs[i],
    val: calculateValue(probs[i], o)
  }));
  const maxVal = Math.max(...values.map(v => v.val));
  return { maxVal, values };
}

const renderMatches = (fixtures, oddsList, minV = 0, leagueFilter = 'all') => {
  const container = qs('#match-list');
  container.innerHTML = '';

  if (!fixtures || fixtures.length === 0) {
    container.innerHTML = '<div class="no-data">Keine Spiele gefunden.</div>';
    return;
  }

  const enriched = fixtures.map(fx => {
    const oddsEntry = oddsList.find(o => o.fixture?.id === fx.fixture?.id);
    const matchLeague = leagueFromName(fx.league?.name);
    const homeName = fx.teams?.home?.name || '';
    const awayName = fx.teams?.away?.name || '';
    const bet = oddsEntry?.bookmakers?.[0]?.bets?.find(b => b.name === 'Match Winner') || null;
    const { maxVal, values } = computeMatchValue(fx, bet);
    return { fx, matchLeague, homeName, awayName, maxVal, values };
  });

  const filtered = enriched.filter(m => leagueFilter === 'all' ? true : m.matchLeague === leagueFilter);
  const aboveMin = filtered.filter(m => m.maxVal >= minV).sort((a,b) => b.maxVal - a.maxVal);

  if (aboveMin.length === 0) {
    container.innerHTML = '<div class="no-data">Keine Spiele entsprechen dem Filter.</div>';
    return;
  }

  aboveMin.forEach(m => {
    const div = document.createElement('div'); div.className = 'match-card';
    const header = document.createElement('div'); header.className = 'match-header';
    const teams = document.createElement('div'); teams.className = 'teams';
    teams.innerHTML = `<span class="team-name">${m.homeName}</span> vs <span class="team-name">${m.awayName}</span>`;
    header.appendChild(teams);
    const leagueSpan = document.createElement('div');
    leagueSpan.textContent = `${m.matchLeague} · ${(m.maxVal * 100).toFixed(1)}%`;
    leagueSpan.className = m.maxVal >= 0.1 ? 'value-high' : (m.maxVal >= 0 ? 'value-mid' : 'value-low');
    header.appendChild(leagueSpan);
    div.appendChild(header);

    const oddsWrap = document.createElement('div'); oddsWrap.className = 'odds-list';
    if (m.values.length) {
      m.values.forEach(v => {
        const it = document.createElement('div'); it.className = 'odds-item';
        it.innerHTML = `<div>${v.label} @ ${v.odd}</div><div class="${v.val >= 0.1 ? 'value-high' : (v.val >= 0 ? 'value-mid' : 'value-low')}">${(v.val * 100).toFixed(1)}%</div>`;
        oddsWrap.appendChild(it);
      });
    } else {
      oddsWrap.innerHTML = '<div class="no-data">Keine Quoten verfügbar</div>';
    }

    div.appendChild(oddsWrap);
    container.appendChild(div);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  qs('#match-date').value = new Date().toISOString().split('T')[0];
  qs('#refresh').addEventListener('click', debounce(loadData, 250));
  qs('#filter-value').addEventListener('change', debounce(loadData, 250));
  qs('#match-date').addEventListener('change', debounce(loadData, 250));
  qs('#league-select').addEventListener('change', debounce(loadData, 250));
  loadData();
});
