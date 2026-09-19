class GameError extends Error {}

function otherSeat(seat) {
  return seat === "host" ? "guest" : "host";
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function createInitialState(code, input) {
  const now = Date.now();
  return {
    code,
    version: 1,
    settings: input.settings,
    hostName: input.hostName,
    guestName: null,
    hostUserId: input.hostUserId || null,
    guestUserId: null,
    turn: "host",
    deckIndex: 0,
    active: null,
    rosters: { host: [], guest: [] },
    spent: { host: 0, guest: 0 },
    givesLeft: { host: input.settings.givesEach, guest: input.settings.givesEach },
    status: "waiting",
    createdAt: now,
    updatedAt: now,
  };
}

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

function bump(state) {
  state.version += 1;
  state.updatedAt = Date.now();
}

function dealNext(state) {
  const bothFull =
    state.rosters.host.length >= state.settings.rosterSize &&
    state.rosters.guest.length >= state.settings.rosterSize;
  if (bothFull || state.deckIndex >= state.settings.deck.length) {
    state.status = "finished";
    state.active = null;
    return;
  }
  const name = state.settings.deck[state.deckIndex];
  state.active = { name, status: "deciding", holder: state.turn, price: 0, deadline: null };
}

function joinGuest(state, guestName, guestUserId) {
  const next = clone(state);
  if (next.status !== "waiting") throw new GameError("Room already started.");
  next.guestName = guestName;
  next.guestUserId = guestUserId;
  next.status = "playing";
  dealNext(next);
  bump(next);
  return next;
}

function reserveFor(state, seat, countsCurrentCard) {
  const filled = state.rosters[seat].length + (countsCurrentCard ? 1 : 0);
  const remainingSlots = Math.max(0, state.settings.rosterSize - filled);
  return remainingSlots * state.settings.minBid;
}

function maxBidFor(state, seat) {
  const bankrollLeft = state.settings.bankroll - state.spent[seat];
  const reserve = reserveFor(state, seat, true);
  return Math.max(0, bankrollLeft - reserve);
}

function lockCurrentCard(state) {
  const active = state.active;
  if (!active) return;
  const winner = active.holder;
  state.rosters[winner].push({ name: active.name, price: active.price });
  state.spent[winner] += active.price;
  state.deckIndex += 1;
  state.turn = otherSeat(state.turn);
  state.active = null;
  dealNext(state);
}

function resolveExpired(state) {
  const active = state.active;
  if (!active || active.status !== "bidding" || active.deadline === null) return state;
  if (Date.now() < active.deadline) return state;
  const next = clone(state);
  lockCurrentCard(next);
  bump(next);
  return next;
}

function decide(state, seat, action) {
  const next = clone(state);
  const active = next.active;
  if (!active || active.status !== "deciding") throw new GameError("No card is waiting on a decision.");
  if (seat !== next.turn) throw new GameError("It's not your turn to decide.");

  if (action === "take") {
    const min = next.settings.minBid;
    if (min > maxBidFor(next, seat)) {
      throw new GameError("Taking this would leave you short for the rest of your roster.");
    }
    active.status = "bidding";
    active.holder = seat;
    active.price = min;
    active.deadline = Date.now() + next.settings.clockSeconds * 1000;
  } else {
    if (next.givesLeft[seat] <= 0) throw new GameError("No gives left.");
    next.givesLeft[seat] -= 1;
    active.holder = otherSeat(seat);
    active.price = 0;
    lockCurrentCard(next);
  }
  bump(next);
  return next;
}

function placeBid(state, seat, amount) {
  const resolved = resolveExpired(state);
  if (resolved.version !== state.version) return resolved;
  const next = clone(resolved);
  const active = next.active;
  if (!active || active.status !== "bidding") throw new GameError("No open bidding right now.");
  if (seat === active.holder) throw new GameError("You already hold the high bid — wait for a raise.");
  if (amount <= active.price) throw new GameError("Bid must be higher than the current price.");
  const max = maxBidFor(next, seat);
  if (amount > max) throw new GameError("That bid would leave you short for the rest of your roster.");

  active.price = amount;
  active.holder = seat;
  active.deadline = Date.now() + next.settings.clockSeconds * 1000;
  bump(next);
  return next;
}

function passBid(state, seat) {
  const resolved = resolveExpired(state);
  if (resolved.version !== state.version) return resolved;
  const next = clone(resolved);
  const active = next.active;
  if (!active || active.status !== "bidding") throw new GameError("No open bidding right now.");
  if (seat === active.holder) throw new GameError("You hold the bid — nothing to pass on.");
  lockCurrentCard(next);
  bump(next);
  return next;
}

module.exports = {
  GameError, otherSeat, generateRoomCode, createInitialState, joinGuest,
  resolveExpired, decide, placeBid, passBid, maxBidFor,
};
