import { Settings } from '../types/settings';
import {
  collapseBlankLines,
  collapseInlineSpacing,
  normalizeInvisibleCharacters,
  removeConfiguredPhrases,
  removeTrailingSpaces
} from './rules';

export function sanitizeClipboardText(input: string, settings: Settings): string {
  let result = input;
  result = normalizeInvisibleCharacters(result, settings.ruleFlags.replaceNonBreakingSpaces, settings.ruleFlags.removeZeroWidthSpaces);
  result = removeConfiguredPhrases(result, settings.phraseFilters);
  if (settings.ruleFlags.collapseInlineSpacing) {
    result = collapseInlineSpacing(result);
  }
  if (settings.ruleFlags.collapseBlankLines) {
    result = collapseBlankLines(result);
  }
  if (settings.ruleFlags.removeTrailingSpaces) {
    result = removeTrailingSpaces(result);
  }
  if (settings.trimWhitespace) {
    result = result.trim();
  }
  return result;
}
