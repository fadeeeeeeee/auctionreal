class GameError extends Error {}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

function bump(state) {
  state.version += 1;
  state.updatedAt = Date.now();
}

function createInitialState(code, input) {
  const now = Date.now();
  return {
    code,
    version: 1,
    settings: input.settings, // { rosterSize, bankroll, minBid, clockSeconds, givesEach, category, deck, numPlayers }
    players: [
      { name: input.hostName, userId: input.hostUserId || null, roster: [], spent: 0, givesLeft: input.settings.givesEach },
    ],
    turn: 0,
    deckIndex: 0,
    active: null,
    status: "waiting",
    createdAt: now,
    updatedAt: now,
  };
}

function dealNext(state) {
  const allFull = state.players.every((p) => p.roster.length >= state.settings.rosterSize);
  if (allFull || state.deckIndex >= state.settings.deck.length) {
    state.status = "finished";
    state.active = null;
    return;
  }
  const name = state.settings.deck[state.deckIndex];
  state.active = { name, status: "deciding", holder: state.turn, price: 0, deadline: null, passedBy: [] };
}

function addPlayer(state, name, userId) {
  const next = clone(state);
  if (next.status !== "waiting") throw new GameError("Room already started.");
  if (next.players.length >= next.settings.numPlayers) throw new GameError("Room is full.");
  next.players.push({ name, userId: userId || null, roster: [], spent: 0, givesLeft: next.settings.givesEach });
  if (next.players.length === next.settings.numPlayers) {
    next.status = "playing";
    dealNext(next);
  }
  bump(next);
  return next;
}

function reserveFor(state, seat, countsCurrentCard) {
  const filled = state.players[seat].roster.length + (countsCurrentCard ? 1 : 0);
  const remainingSlots = Math.max(0, state.settings.rosterSize - filled);
  return remainingSlots * state.settings.minBid;
}

function maxBidFor(state, seat) {
  const bankrollLeft = state.settings.bankroll - state.players[seat].spent;
  const reserve = reserveFor(state, seat, true);
  return Math.max(0, bankrollLeft - reserve);
}

function contendersFor(state, holder) {
  const out = [];
  state.players.forEach((p, idx) => {
    if (idx !== holder && p.roster.length < state.settings.rosterSize) out.push(idx);
  });
  return out;
}

function advanceTurn(state) {
  for (let i = 0; i < state.players.length; i++) {
    const candidate = (state.turn + 1 + i) % state.players.length;
    if (state.players[candidate].roster.length < state.settings.rosterSize) {
      state.turn = candidate;
      return;
    }
  }
  // everyone's full — dealNext() will end the game right after this
}

function lockCurrentCard(state) {
  const active = state.active;
  if (!active) return;
  const winner = state.players[active.holder];
  winner.roster.push({ name: active.name, price: active.price });
  winner.spent += active.price;
  state.deckIndex += 1;
  advanceTurn(state);
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

function decide(state, seat, action, targetSeat) {
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
    active.passedBy = [];
    if (contendersFor(next, seat).length === 0) {
      lockCurrentCard(next); // nobody else has room left to bid — no point waiting
    }
  } else if (action === "give") {
    if (targetSeat === undefined || targetSeat === null || targetSeat === seat) {
      throw new GameError("Pick who gets it.");
    }
    if (targetSeat < 0 || targetSeat >= next.players.length) throw new GameError("Invalid recipient.");
    if (next.players[targetSeat].roster.length >= next.settings.rosterSize) {
      throw new GameError("That player's roster is already full.");
    }
    if (next.players[seat].givesLeft <= 0) throw new GameError("No gives left.");
    next.players[seat].givesLeft -= 1;
    active.holder = targetSeat;
    active.price = 0;
    lockCurrentCard(next);
  } else {
    throw new GameError("Unknown decision.");
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
  if (next.players[seat].roster.length >= next.settings.rosterSize) throw new GameError("Your roster is already full.");
  if (amount <= active.price) throw new GameError("Bid must be higher than the current price.");
  const max = maxBidFor(next, seat);
  if (amount > max) throw new GameError("That bid would leave you short for the rest of your roster.");

  active.price = amount;
  active.holder = seat;
  active.deadline = Date.now() + next.settings.clockSeconds * 1000;
  active.passedBy = [];
  if (contendersFor(next, seat).length === 0) {
    lockCurrentCard(next);
  }
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
  if (!active.passedBy.includes(seat)) active.passedBy.push(seat);

  const contenders = contendersFor(next, active.holder);
  const stillWaitingOn = contenders.filter((idx) => !active.passedBy.includes(idx));
  if (stillWaitingOn.length === 0) {
    lockCurrentCard(next);
  }
  bump(next);
  return next;
}

module.exports = {
  GameError, generateRoomCode, createInitialState, addPlayer,
  resolveExpired, decide, placeBid, passBid, maxBidFor,
};
