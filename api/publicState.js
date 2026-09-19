function toPublicState(state) {
  const { deck, ...settingsWithoutDeck } = state.settings;
  return {
    ...state,
    settings: { ...settingsWithoutDeck, deckSize: deck.length },
  };
}

module.exports = { toPublicState };
