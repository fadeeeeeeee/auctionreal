const { getListSince, appendToList } = require("./_lib/list");

const MAX_SIGNALS = 500;

function signalKey(code) {
  return `signal:${code.toUpperCase()}`;
}

module.exports = async (req, res) => {
  const code = (req.method === "GET" ? req.query.code : (req.body || {}).code || "").toString().trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Missing room code." });

  if (req.method === "GET") {
    const since = Number(req.query.since) || 0;
    const { items, nextIndex } = await getListSince(signalKey(code), since);
    return res.status(200).json({ items, nextIndex });
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      const fromSeat = Number(body.fromSeat);
      const toSeat = Number(body.toSeat);
      const kind = body.kind; // "offer" | "answer" | "ice"
      if (!["offer", "answer", "ice"].includes(kind)) return res.status(400).json({ error: "Invalid signal kind." });
      if (!Number.isInteger(fromSeat) || !Number.isInteger(toSeat)) return res.status(400).json({ error: "Invalid seats." });

      await appendToList(signalKey(code), { fromSeat, toSeat, kind, payload: body.payload }, MAX_SIGNALS);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Could not send signal." });
    }
  }

  res.status(405).json({ error: "Method not allowed." });
};
