const { redis, ROOM_TTL_SECONDS } = require("./redis");

/** Append one item (any JSON-serializable value) to a list key. */
async function appendToList(listKey, item, maxLen) {
  const r = redis();
  await r.rpush(listKey, JSON.stringify(item));
  if (maxLen) await r.ltrim(listKey, -maxLen, -1);
  await r.expire(listKey, ROOM_TTL_SECONDS);
}

/**
 * Fetch every item from `since` (an index cursor the caller keeps and passes
 * back next time) to the end. Returns { items, nextIndex } — pass nextIndex
 * as `since` on the following poll to only get what's new.
 */
async function getListSince(listKey, since) {
  const r = redis();
  const len = await r.llen(listKey);
  const from = Math.max(0, since || 0);
  if (from >= len) return { items: [], nextIndex: len };
  const raw = await r.lrange(listKey, from, -1);
  const items = raw.map((x) => (typeof x === "string" ? JSON.parse(x) : x));
  return { items, nextIndex: len };
}

module.exports = { appendToList, getListSince };
