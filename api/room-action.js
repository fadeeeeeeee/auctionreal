const { updateRoom } = require("./_lib/redis");
const { decide, placeBid, passBid } = require("./_lib/gameLogic");
const { toPublicState } = require("./_lib/publicState");
const { recordGameIfFinished } = require("./_lib/history");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const body = req.body || {};
    const code = (body.code || "").trim().toUpperCase();
    let becameFinished = false;

    const next = await updateRoom(code, (current) => {
      const wasFinished = current.status === "finished";
      let result;
      if (body.type === "decide") {
        result = decide(current, body.seat, body.choice, body.targetSeat);
      } else if (body.type === "bid") {
        result = placeBid(current, body.seat, body.amount);
      } else if (body.type === "pass") {
        result = passBid(current, body.seat);
      } else {
        throw new Error("Unknown action.");
      }
      if (!wasFinished && result.status === "finished") becameFinished = true;
      return result;
    });

    if (becameFinished) await recordGameIfFinished(next);

    res.status(200).json(toPublicState(next));
  } catch (err) {
    res.status(400).json({ error: err.message || "Action failed." });
  }
};
