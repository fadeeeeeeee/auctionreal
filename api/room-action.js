const { getRoom, updateRoom } = require("./_lib/redis");
const { decide, placeBid, passBid, castMethodVote, castWinnerVote, applyAiVerdict } = require("./_lib/gameLogic");
const { toPublicState } = require("./_lib/publicState");
const { recordGameIfFinished } = require("./_lib/history");
const { judgeWinner } = require("./_lib/judge");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const body = req.body || {};
    const code = (body.code || "").trim().toUpperCase();
    let becameFinished = false;

    let next = await updateRoom(code, (current) => {
      const wasFinished = current.status === "finished";
      let result;
      if (body.type === "decide") {
        result = decide(current, body.seat, body.choice, body.targetSeat);
      } else if (body.type === "bid") {
        result = placeBid(current, body.seat, body.amount);
      } else if (body.type === "pass") {
        result = passBid(current, body.seat);
      } else if (body.type === "vote-method") {
        result = castMethodVote(current, body.seat, body.choice);
      } else if (body.type === "vote-winner") {
        result = castWinnerVote(current, body.seat, body.targetSeat);
      } else {
        throw new Error("Unknown action.");
      }
      if (!wasFinished && result.status === "finished") becameFinished = true;
      return result;
    });

    // A vote just tipped things over to "let the AI decide" (outright or by a tie).
    // Ask Groq right here, in this same request, and fold the verdict straight in.
    if (next.votePhase === "ai_pending") {
      try {
        const { winnerIndex, reason } = await judgeWinner({
          category: next.settings.category,
          bankroll: next.settings.bankroll,
          players: next.players,
        });
        next = await updateRoom(code, (current) => applyAiVerdict(current, winnerIndex, reason));
        becameFinished = true;
      } catch (aiErr) {
        // Leave votePhase as "ai_pending" — the next state poll or action will retry judgeWinner.
        console.error("AI judge failed:", aiErr.message);
      }
    }

    if (becameFinished) await recordGameIfFinished(next);

    res.status(200).json(toPublicState(next));
  } catch (err) {
    res.status(400).json({ error: err.message || "Action failed." });
  }
};
