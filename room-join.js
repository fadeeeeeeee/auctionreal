const { getRoom, updateRoom } = require("./_lib/redis");
const { joinGuest } = require("./_lib/gameLogic");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const body = req.body || {};
    const code = (body.code || "").trim().toUpperCase();
    const guestName = (body.guestName || "").trim() || "Guest";
    const guestUserId = body.guestUserId || null;

    const existing = await getRoom(code);
    if (!existing) return res.status(404).json({ error: "Room not found." });
    if (existing.status !== "waiting") return res.status(200).json({ ok: true });

    await updateRoom(code, (current) => joinGuest(current, guestName, guestUserId));
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Could not join room." });
  }
};
