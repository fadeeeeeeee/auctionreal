const { getRoom, updateRoom } = require("./_lib/redis");
const { addPlayer } = require("./_lib/gameLogic");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const body = req.body || {};
    const code = (body.code || "").trim().toUpperCase();
    const guestName = (body.guestName || "").trim() || "Player";
    const guestUserId = body.guestUserId || null;

    const existing = await getRoom(code);
    if (!existing) return res.status(404).json({ error: "Room not found." });
    if (existing.status !== "waiting") return res.status(200).json({ ok: true, full: true });

    let seatIndex = -1;
    const next = await updateRoom(code, (current) => {
      const result = addPlayer(current, guestName, guestUserId);
      seatIndex = result.players.length - 1;
      return result;
    });

    res.status(200).json({ ok: true, seat: seatIndex });
  } catch (err) {
    res.status(400).json({ error: err.message || "Could not join room." });
  }
};
