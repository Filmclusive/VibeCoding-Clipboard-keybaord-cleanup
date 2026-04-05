import { Settings } from '../types/settings';

export interface FrontmostAppInfo {
  bundleIdentifier: string | null;
  name: string | null;
}

function normalize(entry: string | null | undefined): string {
  if (!entry) return '';
  return entry.trim().toLowerCase();
}

export function isAppExcluded(frontmost: FrontmostAppInfo, settings: Settings): boolean {
  const normalizedTargets = [normalize(frontmost.bundleIdentifier), normalize(frontmost.name)].filter(Boolean) as string[];
  if (!normalizedTargets.length) {
    return false;
  }
  return normalizedTargets.some((target) =>
    settings.excludedApps.some((rule) => {
      const normalizedRule = normalize(rule);
      return !!normalizedRule && target === normalizedRule;
    })
  );
}
