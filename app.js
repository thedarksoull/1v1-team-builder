function parseSets(text) {
  return text
    .split(/\n\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => {
      const firstLine = s.split('\n')[0];
      const name = firstLine.split('@')[0].replace(/\(.*?\)/g, '').trim();
      return { label: name, set: s };
    });
}

function groupThreats(sets) {
  const map = {};
  for (const entry of sets) {
    if (!map[entry.label]) map[entry.label] = { name: entry.label, sets: [] };
    map[entry.label].sets.push(entry.set);
  }
  return Object.values(map);
}

function updateProgress(current, total) {
  document.getElementById('progressText').textContent = `Analyzing set ${current} of ${total}...`;
}

async function analyzeOne(entry, threats, apiKey) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pool: [entry], threats, apiKey })
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return data.results?.[0] || null;
  } catch(e) {
    return { name: entry.label, results: [], score: 0, summary: 'Server error.' };
  }
}

async function analyze() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const poolText = document.getElementById('pool').value.trim();
  const threatsText = document.getElementById('threats').value.trim();

  if (!apiKey || !poolText || !threatsText) {
    alert('Please fill in all three fields!');
    return;
  }

  const pool = parseSets(poolText);
  const threatSets = parseSets(threatsText);
  const threats = groupThreats(threatSets);

  if (pool.length === 0 || threats.length === 0) {
    alert('Could not parse sets — make sure sets are separated by blank lines.');
    return;
  }

  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('progressText').textContent = `Analyzing set 1 of ${pool.length}...`;

  const allResults = [];

  for (let i = 0; i < pool.length; i++) {
    updateProgress(i + 1, pool.length);
    const result = await analyzeOne(pool[i], threats, apiKey);
    if (result) allResults.push(result);
    await new Promise(r => setTimeout(r, 500));
  }

  allResults.sort((a, b) => b.score - a.score);
  const top5 = allResults.slice(0, 5);

  renderResults(top5, threats.length);

  document.getElementById('analyzeBtn').disabled = false;
  document.getElementById('loading').classList.add('hidden');
}

function renderResults(results, totalThreats) {
  const container = document.getElementById('resultsTable');
  container.innerHTML = '';

  results.forEach((r, i) => {
    const isPerfect = r.score === totalThreats;
    const isTop = i === 0;

    const card = document.createElement('div');
    card.className = `result-card${isTop ? ' top' : ''}`;

    const matchupRows = (r.results || []).map(m => `
      <div class="matchup-row">
        <div>
          <span class="threat-name">${m.threat}</span>
          <div class="reason">${m.reason}</div>
        </div>
        <span class="outcome ${m.outcome}">${m.outcome}</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="result-header">
        <span class="result-name">${i + 1}. ${r.name}</span>
        <span class="result-score${isPerfect ? ' perfect' : ''}">${r.score}/${totalThreats} threats beaten</span>
      </div>
      ${matchupRows}
      <div class="summary">${r.summary}</div>
    `;

    container.appendChild(card);
  });

  document.getElementById('results').classList.remove('hidden');
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}
