import { invoke } from '@tauri-apps/api/core';
import type { Settings } from '../types/settings';

type InstalledApp = {
  bundleIdentifier?: string | null;
  name: string;
  iconDataUrl?: string | null;
};

type InitArgs = {
  listEl: HTMLDivElement;
  searchEl: HTMLInputElement | null;
  getSettings: () => Settings | null;
  setExcludedApps: (next: string[]) => void;
};

export function initExcludedApps(args: InitArgs) {
  let installedApps: InstalledApp[] | null = null;
  let loading = false;
  let loadedOnce = false;

  const render = () => {
    const settings = args.getSettings();
    args.listEl.innerHTML = '';

    if (loading) {
      const row = document.createElement('p');
      row.className = 'helper-text';
      row.textContent = 'Loading installed applications…';
      args.listEl.appendChild(row);
      return;
    }

    if (!installedApps) {
      const row = document.createElement('p');
      row.className = 'helper-text';
      row.textContent = loadedOnce
        ? 'No applications found to display.'
        : 'Open this tab to load installed apps.';
      args.listEl.appendChild(row);
      return;
    }

    const query = args.searchEl?.value?.trim().toLowerCase() ?? '';
    const excluded = new Set((settings?.excludedApps ?? []).map((value) => value.toLowerCase()));

    const filtered = installedApps.filter((app) => {
      if (!query) return true;
      const name = app.name?.toLowerCase() ?? '';
      const bundle = app.bundleIdentifier?.toLowerCase() ?? '';
      return name.includes(query) || bundle.includes(query);
    });

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'helper-text';
      empty.textContent = query ? 'No matching applications.' : 'No applications found to display.';
      args.listEl.appendChild(empty);
      return;
    }

    filtered.forEach((app) => {
      const identifier = (app.bundleIdentifier || app.name).trim();
      const key = identifier.toLowerCase();
      const isExcluded = excluded.has(key);

      const row = document.createElement('div');
      row.className = 'app-row';

      const icon = document.createElement('div');
      icon.className = 'app-icon';
      if (app.iconDataUrl) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = app.iconDataUrl;
        img.loading = 'lazy';
        icon.appendChild(img);
      } else {
        icon.textContent = app.name.slice(0, 1).toUpperCase();
      }

      const meta = document.createElement('div');
      meta.className = 'app-meta';
      const title = document.createElement('p');
      title.className = 'app-name';
      title.textContent = app.name;
      const subtitle = document.createElement('p');
      subtitle.className = 'app-subtitle';
      subtitle.textContent = app.bundleIdentifier ?? 'App';
      meta.appendChild(title);
      meta.appendChild(subtitle);

      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'app-toggle';
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = isExcluded;
      toggle.setAttribute('aria-label', `Exclude ${app.name}`);
      toggle.addEventListener('change', () => {
        const normalized = identifier.trim();
        const normalizedKey = normalized.toLowerCase();
        const current = args.getSettings()?.excludedApps ?? [];
        const next = current.filter((entry) => entry.toLowerCase() !== normalizedKey);
        if (toggle.checked) {
          next.push(normalized);
        }
        args.setExcludedApps(next);
      });
      toggleLabel.appendChild(toggle);

      row.appendChild(icon);
      row.appendChild(meta);
      row.appendChild(toggleLabel);
      args.listEl.appendChild(row);
    });
  };

  const ensureLoaded = () => {
    if (installedApps || loading) return;
    loading = true;
    render();

    // Yield a frame so the "Loading…" state paints before the invoke returns.
    requestAnimationFrame(() => {
      void (async () => {
        try {
          installedApps = (await invoke('list_installed_apps')) as InstalledApp[];
        } catch (error) {
          console.error('Failed to load installed apps', error);
          installedApps = [];
        } finally {
          loadedOnce = true;
          loading = false;
          render();
        }
      })();
    });
  };

  args.searchEl?.addEventListener('input', () => {
    render();
  });

  return { ensureLoaded, render };
}

