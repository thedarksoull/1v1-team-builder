export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pool, threats, apiKey } = req.body;

    if (!pool || !threats || !apiKey) {
      return res.status(400).json({ error: 'Missing pool, threats, or apiKey' });
    }

    const results = [];

    for (const entry of pool) {
      const prompt = `You are a Pokemon 1v1 metagame expert. Analyze this Pokemon set against the given threatlist.

POKEMON SET:
${entry.set}

THREATLIST:
${threats.map((t, i) => `Threat ${i + 1} - ${t.name}:\n${t.sets.join('\n---\n')}`).join('\n\n')}

For each threat, determine if this Pokemon set wins, loses, or ties.

Respond with ONLY raw JSON, no markdown, no backticks, no extra text:
{"name":"PokemonName","results":[{"threat":"ThreatName","outcome":"WIN","reason":"short reason"}],"score":0,"summary":"one sentence"}`;

      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1 }
            })
          }
        );

        const geminiData = await geminiRes.json();

        if (geminiData.error) {
          results.push({
            name: entry.label || 'Unknown',
            results: [],
            score: 0,
            summary: `API Error: ${geminiData.error.message}`
          });
          continue;
        }

        const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const clean = raw.replace(/```json|```/g, '').trim();

        let parsed;
        try {
          parsed = JSON.parse(clean);
        } catch (e) {
          const match = clean.match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : {
            name: entry.label,
            results: [],
            score: 0,
            summary: 'Could not parse response.'
          };
        }

        results.push(parsed);
        await new Promise(r => setTimeout(r, 1500));
        
      } catch (err) {
        results.push({
          name: entry.label || 'Unknown',
          results: [],
          score: 0,
          summary: `Error: ${err.message}`
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return res.status(200).json({ results });

  } catch (outerErr) {
    return res.status(500).json({ error: outerErr.message });
  }
}
