const { supabaseAdmin } = require("./supabaseAdmin");

async function recordGameIfFinished(state) {
  if (state.status !== "finished") return;
  try {
    const admin = supabaseAdmin();
    await admin.from("games").insert({
      code: state.code,
      category: state.settings.category,
      num_players: state.players.length,
      players: state.players.map((p) => ({
        name: p.name, userId: p.userId, roster: p.roster, spent: p.spent,
      })),
    });
  } catch (err) {
    console.error("Failed to record game history", err);
  }
}

module.exports = { recordGameIfFinished };
