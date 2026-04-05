const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\uFEFF]/g;
const MULTI_SPACE_REGEX = /[ \t]{2,}/g;
const TRIM_TRAILING_SPACES_REGEX = /[ \t]+(?=\r?\n)/g;
const BLANK_LINE_REGEX = /(\r?\n){3,}/g;

export function normalizeInvisibleCharacters(input: string, replaceNbsp: boolean, removeZeroWidth: boolean): string {
  let value = input;
  if (replaceNbsp) {
    value = value.replace(/\u00A0/g, ' ');
  }
  if (removeZeroWidth) {
    value = value.replace(ZERO_WIDTH_REGEX, '');
  }
  return value;
}

export function removeConfiguredPhrases(input: string, phrases: string[]): string {
  if (!phrases.length) {
    return input;
  }
  return phrases.reduce((acc, phrase) => {
    if (!phrase) return acc;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return acc.replace(new RegExp(escaped, 'g'), '');
  }, input);
}

export function collapseInlineSpacing(input: string): string {
  return input.replace(MULTI_SPACE_REGEX, ' ');
}

export function collapseBlankLines(input: string): string {
  return input.replace(BLANK_LINE_REGEX, '\n\n');
}

export function removeTrailingSpaces(input: string): string {
  return input.replace(TRIM_TRAILING_SPACES_REGEX, '');
}
