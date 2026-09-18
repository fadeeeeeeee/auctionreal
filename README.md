# Auction Draft

A head-to-head "$20 auction draft" game: the server shuffles a hidden deck and
flips one name at a time. Whoever's up decides to take it for the minimum or
give it away free; the other player can then bid it up against a live
countdown clock, bounded by a bankroll wall so nobody can bid themselves short
for the rest of their roster. Finishes with a shareable, downloadable results
board.

Built the same way as Docket: a single static `index.html` (vanilla JS, no
build step) plus serverless functions under `api/`, deployed via GitHub ->
Vercel. Live room state lives in Upstash Redis; accounts and game history use
Supabase.

## Files

```
index.html              the whole frontend - routing, views, polling, all in one file
api/config.js            hands the public Supabase URL/anon key to the browser
api/room-create.js       POST - create a room with the host's settings
api/room-join.js         POST - join a room with a code
api/room-state.js        GET  - poll current room state (also resolves expired bid timers)
api/room-action.js       POST - decide / bid / pass
api/_lib/gameLogic.js    pure game rules (deal, decide, bid, pass, wall math)
api/_lib/redis.js        Upstash Redis storage + compare-and-set updates
api/_lib/deck.js         category presets + custom deck parsing
api/_lib/publicState.js  strips the un-dealt deck before sending state to the browser
api/_lib/history.js      writes a finished game to Supabase
api/_lib/supabaseAdmin.js service-role Supabase client (server only)
supabase-schema.sql       games history table + row-level security
```

Files under `api/_lib/` start with an underscore so Vercel treats them as
shared code, not routable endpoints — same convention Docket uses.

## 1. Push it to GitHub

```bash
git init
git add .
git commit -m "Initial commit: auction draft game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 2. Import into Vercel

Go to https://vercel.com/new and import the repo. There's no framework to
detect and no build step — Vercel serves `index.html` as a static file and
turns each file in `api/` into a serverless function automatically.

## 3. Add the environment variables in Vercel

Project Settings -> Environment Variables. Add all five:

| Variable | Where to get it |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash console -> your database -> REST API tab |
| `UPSTASH_REDIS_REST_TOKEN` | same tab |
| `SUPABASE_URL` | Supabase project -> Settings -> API -> Project URL |
| `SUPABASE_ANON_KEY` | same page -> anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | same page -> service_role key (keep secret — server only) |

No Upstash or Supabase project yet?
- Upstash: console.upstash.com -> Create Database -> pick a region -> Create, then open the REST API tab.
- Supabase: supabase.com/dashboard -> New project -> pick a name/password/region -> Create (~2 min to provision).

Deploy (or redeploy if you already deployed once) after adding the variables.

## 4. Set up the Supabase side

1. In the Supabase SQL Editor, paste and run `supabase-schema.sql`. This creates
   the `games` history table with row-level security so each player can only
   read games they were in.
2. Confirm Authentication -> Providers -> Email is enabled (on by default).
3. Authentication -> URL Configuration -> add your Vercel URL (e.g.
   `https://your-app.vercel.app`) to Redirect URLs, so the magic-link sign-in
   redirects back to the right place.

Accounts are optional — anyone can create or join a room without signing in;
signing in just saves finished games to `#/history`.

## How the game works

- Host picks: roster size, bankroll, minimum bid, counter-bid clock length,
  how many free "gives" each player gets, and a category (built-in football /
  movies / pop icons decks, or paste a custom list of names).
- Cards deal one at a time; turns alternate on who's "up" to decide.
- Take it for the minimum bid, or give it to your opponent for free (uses one
  of your gives).
- If taken, the opponent can raise. Every raise resets the clock. Passing (or
  the clock running out) locks the card to whoever's currently holding the bid.
- The server enforces a wall: you can never bid or take yourself into a
  position where you can't afford the minimum for the rest of your roster.
- When both rosters are full, the game ends and shows a downloadable results
  board.

## Making changes later

Same pattern as Docket: tell me what to change, I'll hand you back just the
files that changed (not a full re-zip of everything) so you can drop them
into your existing repo and redeploy.
