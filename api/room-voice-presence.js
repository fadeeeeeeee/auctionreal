const { addToVoicePresence, removeFromVoicePresence, getVoicePresence } = require("./_lib/redis");

module.exports = async (req, res) => {
  const code = (req.method === "GET" ? req.query.code : (req.body || {}).code || "").toString().trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Missing room code." });

  if (req.method === "GET") {
    const seats = await getVoicePresence(code);
    return res.status(200).json({ seats });
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      const seat = Number(body.seat);
      if (!Number.isInteger(seat)) return res.status(400).json({ error: "Invalid seat." });
      if (body.action === "join") await addToVoicePresence(code, seat);
      else if (body.action === "leave") await removeFromVoicePresence(code, seat);
      else return res.status(400).json({ error: "Invalid action." });
      const seats = await getVoicePresence(code);
      return res.status(200).json({ seats });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Could not update voice presence." });
    }
  }

  res.status(405).json({ error: "Method not allowed." });
};
