const GROQ_MODEL = "openai/gpt-oss-120b";

/**
 * Asks Groq to pick a winner among the finished draft's rosters and give a
 * short, warm reason. Returns { winnerIndex, reason }. Throws if the API key
 * is missing or the response can't be parsed after a couple of tries.
 */
async function judgeWinner({ category, bankroll, players }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("The AI judge isn't set up yet — add GROQ_API_KEY in Vercel's environment variables.");
  }

  const summary = players.map((p, i) => ({
    index: i,
    name: p.name,
    drafted: p.roster.map((r) => `${r.name} ($${r.price})`),
    spent: p.spent,
    leftover: bankroll - p.spent,
  }));

  const systemPrompt =
    "You're the good-humored commissioner of a friendly $" + bankroll + " auction draft night. " +
    "Everyone drafted from the category \"" + category + "\". Look at what each person ended up with, " +
    "what they paid, and what they left on the table, and pick who had the best draft overall — use your " +
    "own judgment about star power, value, and balance, it's a fun subjective call, not a formula. " +
    "Reply with ONLY a JSON object, no markdown, no code fences, no extra text: " +
    '{"winnerIndex": <integer>, "reason": "<2-3 warm, playful sentences, addressing players by name, explaining the call>"}';

  const userPrompt = JSON.stringify({ players: summary });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.7,
      max_completion_tokens: 300,
      reasoning_format: "hidden",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI judge request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!raw) throw new Error("AI judge returned an empty response.");

  const cleaned = raw.replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Could not understand the AI judge's response.");
  }

  const winnerIndex = Number(parsed.winnerIndex);
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= players.length) {
    throw new Error("AI judge picked an invalid player.");
  }

  return { winnerIndex, reason: String(parsed.reason || "").slice(0, 600) };
}

module.exports = { judgeWinner };
