const { getRoom, updateRoom } = require("./_lib/redis");
const {
  decide, placeBid, passBid, castMethodVote, castWinnerVote,
  applyAiVerdict, setAiError, beginAiJudging, GameError,
} = require("./_lib/gameLogic");
const { toPublicState } = require("./_lib/publicState");
const { recordGameIfFinished } = require("./_lib/history");
const { judgeWinner } = require("./_lib/judge");

// Runs the Groq call at most once per invocation, guarded by the aiJudging
// lock so concurrent requests (multiple players polling/voting at once)
// can't all fire it simultaneously and blow through the rate limit.
async function tryClaimAndJudge(code) {
  let claimed;
  try {
    claimed = await updateRoom(code, (current) => beginAiJudging(current));
  } catch (err) {
    return null; // someone else already has the lock, or nothing's pending — not our job
  }
  try {
    const { winnerIndex, reason } = await judgeWinner({
      category: claimed.settings.category,
      bankroll: claimed.settings.bankroll,
      players: claimed.players,
    });
    return await updateRoom(code, (current) => applyAiVerdict(current, winnerIndex, reason));
  } catch (aiErr) {
    try {
      return await updateRoom(code, (current) => setAiError(current, aiErr.message));
    } catch {
      return claimed;
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const body = req.body || {};
    const code = (body.code || "").trim().toUpperCase();
    let becameFinished = false;

    if (body.type === "retry-ai") {
      const result = await tryClaimAndJudge(code);
      if (result) {
        if (result.status === "finished") await recordGameIfFinished(result);
        return res.status(200).json(toPublicState(result));
      }
      // someone else is already handling it — just return current state
      const current = await getRoom(code);
      return res.status(200).json(toPublicState(current));
    }

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

    // A vote just tipped things to "let the AI decide" — claim the lock and
    // judge right here, in this same request, exactly once.
    if (next.votePhase === "ai_pending" && !next.aiJudging) {
      const judged = await tryClaimAndJudge(code);
      if (judged) {
        next = judged;
        if (next.status === "finished") becameFinished = true;
      }
    }

    if (becameFinished) await recordGameIfFinished(next);

    res.status(200).json(toPublicState(next));
  } catch (err) {
    res.status(400).json({ error: err.message || "Action failed." });
  }
};
