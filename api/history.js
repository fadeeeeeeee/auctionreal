const { supabaseAdmin } = require("./supabaseAdmin");

async function recordGameIfFinished(state) {
  if (state.status !== "finished") return;
  try {
    const admin = supabaseAdmin();
    await admin.from("games").insert({
      code: state.code,
      category: state.settings.category,
      host_name: state.hostName,
      guest_name: state.guestName,
      host_user_id: state.hostUserId,
      guest_user_id: state.guestUserId,
      settings: { ...state.settings, deck: undefined },
      rosters: state.rosters,
      spent: state.spent,
    });
  } catch (err) {
    console.error("Failed to record game history", err);
  }
}

module.exports = { recordGameIfFinished };
