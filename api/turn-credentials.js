// Provider-agnostic: paste whatever ICE servers JSON your TURN provider's
// dashboard gives you (ExpressTURN, Cloudflare, Metered, etc.) into the
// TURN_ICE_SERVERS_JSON env var as-is. No signup requires this app to call
// out to anyone at request time — it just hands back what you configured.
module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const fallback = [{ urls: "stun:stun.l.google.com:19302" }];
  const raw = process.env.TURN_ICE_SERVERS_JSON;

  if (!raw) {
    // Not configured yet — voice chat still works over STUN alone for plenty
    // of networks, it just won't traverse the toughest NATs/firewalls.
    return res.status(200).json({ iceServers: fallback, turnConfigured: false });
  }

  try {
    const parsed = JSON.parse(raw);
    const iceServers = Array.isArray(parsed) ? parsed : [parsed];
    if (iceServers.length === 0) throw new Error("Empty ice server list.");
    return res.status(200).json({ iceServers, turnConfigured: true });
  } catch (err) {
    console.error("TURN_ICE_SERVERS_JSON is not valid JSON, falling back to STUN-only:", err.message);
    return res.status(200).json({ iceServers: fallback, turnConfigured: false });
  }
};
