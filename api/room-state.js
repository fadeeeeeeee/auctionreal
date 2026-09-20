const { getRoom, updateRoom } = require("./_lib/redis");
const { resolveExpired, applyAiVerdict } = require("./_lib/gameLogic");
const { toPublicState } = require("./_lib/publicState");
const { recordGameIfFinished } = require("./_lib/history");
const { judgeWinner } = require("./_lib/judge");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const code = (req.query.code || "").toString().trim().toUpperCase();
  const existing = await getRoom(code);
  if (!existing) return res.status(404).json({ error: "Room not found." });

  let state = existing;
  const wasFinished = existing.status === "finished";
  const maybeExpired = resolveExpired(existing);
  if (maybeExpired.version !== existing.version) {
    state = await updateRoom(code, () => maybeExpired);
  }

  // If a previous AI-judge call failed (transient network error, key just added, etc.),
  // retry it on every poll until it succeeds — no user action needed to unstick this.
  if (state.votePhase === "ai_pending") {
    try {
      const { winnerIndex, reason } = await judgeWinner({
        category: state.settings.category,
        bankroll: state.settings.bankroll,
        players: state.players,
      });
      state = await updateRoom(code, (current) => applyAiVerdict(current, winnerIndex, reason));
    } catch (aiErr) {
      console.error("AI judge retry failed:", aiErr.message);
    }
  }

  if (!wasFinished && state.status === "finished") {
    await recordGameIfFinished(state);
  }

  res.status(200).json(toPublicState(state));
};
