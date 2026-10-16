// Collapses the many ways a child might type the same word into one cache key:
// "Pokémon!", "pokemon" and "  POKEMON " all become "pokemon". Plurals are left
// alone on purpose; "mouse" and "mice" should bring back different pictures.

/** Longest query accepted. Anything beyond is a paste or a stuck key. */
export const MAX_QUERY_LENGTH = 120;

const MARK = /\p{Mn}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{Nd}]/u;

export function normalize(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return "";

  let key = "";
  let lastWasSpace = true; // skips leading separators
  for (const ch of raw.slice(0, MAX_QUERY_LENGTH).normalize("NFD")) {
    if (MARK.test(ch)) continue; // the accent split off "é"
    if (LETTER_OR_DIGIT.test(ch)) {
      key += ch.toLowerCase();
      lastWasSpace = false;
    } else if (!lastWasSpace) {
      key += " "; // any run of punctuation or spaces becomes one space
      lastWasSpace = true;
    }
  }

  return key.trimEnd().normalize("NFC");
}

/** One character is almost always mid-typing, not a search. */
export function isSearchable(normalized) {
  return normalized.length >= 2;
}
