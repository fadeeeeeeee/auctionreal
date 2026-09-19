const { Redis } = require("@upstash/redis");

let _redis = null;
function redis() {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN env vars.");
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const ROOM_TTL_SECONDS = 60 * 60 * 12;
const key = (code) => `room:${code.toUpperCase()}`;

async function getRoom(code) {
  const val = await redis().get(key(code));
  return val || null;
}

async function createRoom(state) {
  const ok = await redis().set(key(state.code), state, { nx: true, ex: ROOM_TTL_SECONDS });
  if (!ok) throw new Error("Room code collision, try again.");
}

async function updateRoom(code, updater) {
  const script = `
    local current = redis.call("GET", KEYS[1])
    if not current then
      return redis.error_reply("room-not-found")
    end
    local decoded = cjson.decode(current)
    if tostring(decoded.version) ~= ARGV[1] then
      return current
    end
    redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
    return ARGV[2]
  `;

  for (let attempt = 0; attempt < 5; attempt++) {
    const currentRaw = await redis().get(key(code));
    if (!currentRaw) throw new Error("Room not found.");
    const next = updater(currentRaw);
    const result = await redis().eval(
      script,
      [key(code)],
      [String(currentRaw.version), JSON.stringify(next), String(ROOM_TTL_SECONDS)]
    );
    const resultState = typeof result === "string" ? JSON.parse(result) : result;
    if (resultState.version === next.version) return next;
  }
  throw new Error("Could not update room — too much contention, try again.");
}

module.exports = { redis, getRoom, createRoom, updateRoom };
