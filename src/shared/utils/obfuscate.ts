export const simpleObsfuscate = (value, lastCharacters = 4) => {
  if (value) {
    let valueObsfuscated = value.toString();
    if (valueObsfuscated.length >= lastCharacters) {
      const charactersToObsfuscate = valueObsfuscated.length - lastCharacters;
      const obsfuscatedSlice = 'X'.repeat(lastCharacters);
      valueObsfuscated = `${valueObsfuscated.slice(0, charactersToObsfuscate)}${obsfuscatedSlice}`;
    }
    return valueObsfuscated;
  } else {
    return value;
  }
};
