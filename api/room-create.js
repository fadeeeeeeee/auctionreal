const { createRoom, getRoom } = require("./_lib/redis");
const { createInitialState, generateRoomCode } = require("./_lib/gameLogic");
const { buildDeck } = require("./_lib/deck");

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const body = req.body || {};
    const hostName = (body.hostName || "").trim() || "Host";
    const numPlayers = clampInt(body.numPlayers, 2, 5, 2);
    const rosterSize = clampInt(body.rosterSize, 3, 15, 5);
    const bankroll = clampInt(body.bankroll, 5, 1000, 20);
    const minBid = clampInt(body.minBid, 1, 50, 1);
    const clockSeconds = [10, 15, 20, 30].includes(body.clockSeconds) ? body.clockSeconds : 15;
    const givesEach = clampInt(body.givesEach, 0, 10, 2);
    const category = body.category || "football";
    const custom = body.customDeck || null;

    const deck = buildDeck(category, custom, rosterSize, numPlayers);

    const settings = {
      numPlayers, rosterSize, bankroll, minBid, clockSeconds, givesEach,
      category: custom ? "custom" : category,
      deck,
    };

    let code = generateRoomCode();
    for (let i = 0; i < 5 && (await getRoom(code)); i++) code = generateRoomCode();

    const hostUserId = body.hostUserId || null;

    const state = createInitialState(code, { hostName, hostUserId, settings });
    await createRoom(state);

    res.status(200).json({ code });
  } catch (err) {
    res.status(400).json({ error: err.message || "Could not create room." });
  }
};
