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
    const prompt = `
You are a Pokemon 1v1 metagame expert. Analyze this Pokemon set against the given threatlist.

POKEMON SET:
${entry.set}

THREATLIST (each threat may have multiple sets):
${threats.map((t, i) => `Threat ${i + 1}:\n${t.sets.join('\n---\n')}`).join('\n\n')}

For each threat, determine:
1. Does this Pokemon set WIN, LOSE, or TIE against each of the threat's sets?
2. If a threat has multiple sets, does this Pokemon win against MOST of them?

Reply ONLY in this exact JSON format, no extra text:
{
  "name": "<pokemon name and set label>",
  "results": [
    { "threat": "<threat name>", "outcome": "WIN" or "LOSE" or "TIE", "reason": "<one line explanation>" }
  ],
  "score": <number of threats beaten>,
  "summary": "<one sentence overall summary>"
}
`;

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
      const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      results.push(parsed);
    } catch (err) {
      results.push({
        name: entry.label || 'Unknown',
        results: [],
        score: 0,
        summary: 'Error analyzing this set.'
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return res.status(200).json({ results });
}
