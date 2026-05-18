export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

You MUST respond with ONLY a JSON object, no markdown, no backticks, no explanation before or after. Just raw JSON like this:
{"name":"Garchomp","results":[{"threat":"Kingambit","outcome":"WIN","reason":"Earthquake OHKOs"}],"score":1,"summary":"Beats most physical threats"}

Now respond with only JSON:`;

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              temperature: 0.1
            }
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
      } catch (parseErr) {
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not extract JSON from response');
        }
      }
      
      results.push(parsed);
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
}
