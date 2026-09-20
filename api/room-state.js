const { getRoom, updateRoom } = require("./_lib/redis");
const { resolveExpired } = require("./_lib/gameLogic");
const { toPublicState } = require("./_lib/publicState");
const { recordGameIfFinished } = require("./_lib/history");

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

  // Deliberately no automatic AI-judge retry here: this endpoint is polled by
  // every connected player once a second, and each of those requests would
  // otherwise try to call Groq simultaneously, blowing through the per-minute
  // rate limit almost instantly. The AI call happens exactly once, from the
  // vote action that triggers it (see room-action.js), guarded by a lock so
  // only one attempt is ever in flight. If it fails, the client shows a
  // manual "Try again" button that calls the same locked path deliberately.

  if (!wasFinished && state.status === "finished") {
    await recordGameIfFinished(state);
  }

  res.status(200).json(toPublicState(state));
};
