const { getRoom } = require("./_lib/redis");
const { appendToList, getListSince } = require("./_lib/list");

const MAX_MESSAGES = 200;
const MAX_TEXT_LEN = 500;

function chatKey(code) {
  return `chat:${code.toUpperCase()}`;
}

module.exports = async (req, res) => {
  const code = (req.method === "GET" ? req.query.code : (req.body || {}).code || "").toString().trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Missing room code." });

  if (req.method === "GET") {
    const since = Number(req.query.since) || 0;
    const { items, nextIndex } = await getListSince(chatKey(code), since);
    return res.status(200).json({ items, nextIndex });
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      const seat = Number(body.seat);
      const text = (body.text || "").toString().trim().slice(0, MAX_TEXT_LEN);
      if (!text) return res.status(400).json({ error: "Empty message." });

      const room = await getRoom(code);
      if (!room) return res.status(404).json({ error: "Room not found." });
      const player = room.players[seat];
      if (!player) return res.status(400).json({ error: "Invalid seat." });

      const message = { seat, name: player.name, text, ts: Date.now() };
      await appendToList(chatKey(code), message, MAX_MESSAGES);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Could not send message." });
    }
  }

  res.status(405).json({ error: "Method not allowed." });
};
