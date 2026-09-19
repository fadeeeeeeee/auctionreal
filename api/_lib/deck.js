const CATEGORY_PRESETS = {
  soccer: [
    "Lionel Messi", "Cristiano Ronaldo", "Kylian Mbappe", "Erling Haaland",
    "Vinicius Jr", "Jude Bellingham", "Kevin De Bruyne", "Mohamed Salah",
    "Bukayo Saka", "Phil Foden", "Rodri", "Robert Lewandowski",
    "Harry Kane", "Neymar", "Luka Modric", "Virgil van Dijk",
    "Son Heung-min", "Bernardo Silva", "Federico Valverde", "Pedri",
    "Jamal Musiala", "Ousmane Dembele", "Lautaro Martinez", "Declan Rice",
    "Alexia Putellas", "Aitana Bonmati", "Sam Kerr", "Marta",
    "Achraf Hakimi", "William Saliba",
  ],
  movies: [
    "Jaws", "The Godfather", "Pulp Fiction", "Heat",
    "Goodfellas", "Se7en", "The Departed", "No Country for Old Men",
    "There Will Be Blood", "Parasite", "Whiplash", "The Prestige",
    "Inception", "Interstellar", "Oldboy", "Amelie",
    "City of God", "The Dark Knight", "Fargo", "Chinatown",
    "The Shining", "Alien", "Blade Runner", "Casablanca",
    "Rear Window", "Vertigo", "Apocalypse Now", "Taxi Driver",
    "The Usual Suspects", "Memento",
  ],
  "pop icons": [
    "Beyonce", "Taylor Swift", "Rihanna", "Drake",
    "Kendrick Lamar", "Bad Bunny", "Dua Lipa", "The Weeknd",
    "Billie Eilish", "Travis Scott", "SZA", "Doja Cat",
    "Olivia Rodrigo", "Post Malone", "Frank Ocean", "Adele",
    "Ariana Grande", "Kanye West", "Lady Gaga", "Bruno Mars",
    "Chappell Roan", "Sabrina Carpenter", "Tyler, the Creator", "J. Cole",
    "Zendaya", "Harry Styles", "Megan Thee Stallion", "Lizzo",
    "Charli XCX", "Ice Spice",
  ],
};

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseCustomDeck(raw) {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildDeck(category, custom, rosterSize, numPlayers) {
  const needed = rosterSize * numPlayers;
  let pool;
  if (custom && custom.trim().length > 0) {
    pool = parseCustomDeck(custom);
  } else {
    pool = CATEGORY_PRESETS[category] || CATEGORY_PRESETS.soccer;
  }
  const shuffled = shuffle(pool);
  if (shuffled.length < needed) {
    throw new Error(
      `Need at least ${needed} names for ${numPlayers} players with a roster size of ${rosterSize} (got ${shuffled.length}).`
    );
  }
  return shuffled.slice(0, needed);
}

module.exports = { CATEGORY_PRESETS, shuffle, parseCustomDeck, buildDeck };
