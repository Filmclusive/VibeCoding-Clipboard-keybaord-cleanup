import './styles.css';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { loadSettings, persistSettings, reloadSettings } from './runtime/settings';
import {
  stopPoller,
  restartPoller,
  LAST_CLEANED_EVENT,
  getLastCleanedTime
} from './clipboard/poller';
import { createTrayMenu, TrayMenuActions } from './tray/menu';
import type { SanitizerRuleFlags, Settings } from './types/settings';

type RuleKey = keyof SanitizerRuleFlags;

const SANITIZER_RULES: Array<{ key: RuleKey; title: string; description: string }> = [
  {
    key: 'collapseInlineSpacing',
    title: 'Collapse inline spacing',
    description: 'Reduce repeated spaces inside a line so pasted text stays compact.'
  },
  {
    key: 'collapseBlankLines',
    title: 'Collapse blank lines',
    description: 'Squash consecutive blank lines into a single empty line.'
  },
  {
    key: 'removeTrailingSpaces',
    title: 'Remove trailing spaces',
    description: 'Strip spaces at the end of each line before saving to clipboard.'
  },
  {
    key: 'replaceNonBreakingSpaces',
    title: 'Replace non-breaking spaces',
    description: 'Swap nbsp characters with regular spaces to avoid layout issues.'
  },
  {
    key: 'removeZeroWidthSpaces',
    title: 'Remove zero-width spaces',
    description: 'Drop stealthy zero-width characters that break pasting.'
  }
];

const MIN_POLL_INTERVAL_MS = 50;

let pendingSettings: Settings | null = null;
let trayMenuHandle: Awaited<ReturnType<typeof createTrayMenu>> | null = null;

const rootPanel = buildPanel();
const appWindow = getCurrentWindow();
document.body.innerHTML = '';
document.body.appendChild(rootPanel);

const enabledToggle = rootPanel.querySelector<HTMLInputElement>('#enabledToggle');
const pollingIntervalInput = rootPanel.querySelector<HTMLInputElement>('#pollingInterval');
const pollingHint = rootPanel.querySelector<HTMLParagraphElement>('#pollingHint');
const rulesContainer = rootPanel.querySelector<HTMLDivElement>('#rulesContainer');
const phraseFiltersInput = rootPanel.querySelector<HTMLTextAreaElement>('#phraseFilters');
const excludedAppsInput = rootPanel.querySelector<HTMLTextAreaElement>('#excludedApps');
const saveButton = rootPanel.querySelector<HTMLButtonElement>('#saveButton');
const closeButton = rootPanel.querySelector<HTMLButtonElement>('#closeButton');
const saveMessage = rootPanel.querySelector<HTMLParagraphElement>('#saveMessage');
const lastCleanedValue = rootPanel.querySelector<HTMLParagraphElement>('#lastCleanedValue');
const statusDot = rootPanel.querySelector<HTMLSpanElement>('[data-status-dot]');

const ruleInputs = new Map<RuleKey, HTMLInputElement>();

SANITIZER_RULES.forEach((rule) => {
  if (!rulesContainer) return;
  const wrapper = document.createElement('label');
  wrapper.className = 'rule-toggle';
  wrapper.htmlFor = `ruleSwitch:${rule.key}`;
  wrapper.innerHTML = `
    <div>
      <p class="rule-title">${rule.title}</p>
      <p class="rule-description">${rule.description}</p>
    </div>
    <input type="checkbox" id="ruleSwitch:${rule.key}" />
  `;
  const input = wrapper.querySelector<HTMLInputElement>('input');
  if (input) {
    ruleInputs.set(rule.key, input);
    input.addEventListener('change', () => {
      if (pendingSettings) {
        pendingSettings.ruleFlags[rule.key] = input.checked;
      }
    });
  }
  rulesContainer.appendChild(wrapper);
});

if (enabledToggle) {
  enabledToggle.addEventListener('change', () => {
    if (pendingSettings) {
      pendingSettings.enabled = enabledToggle.checked;
    }
  });
}

if (pollingIntervalInput) {
  pollingIntervalInput.addEventListener('input', () => {
    if (pendingSettings) {
      const raw = Number(pollingIntervalInput.value) || MIN_POLL_INTERVAL_MS;
      pendingSettings.pollingIntervalMs = Math.max(MIN_POLL_INTERVAL_MS, raw);
      updatePollingHint(pendingSettings.pollingIntervalMs);
    }
  });
}

phraseFiltersInput?.addEventListener('input', () => {
  if (pendingSettings) {
    pendingSettings.phraseFilters = splitLines(phraseFiltersInput.value);
  }
});

excludedAppsInput?.addEventListener('input', () => {
  if (pendingSettings) {
    pendingSettings.excludedApps = splitLines(excludedAppsInput.value);
  }
});

saveButton?.addEventListener('click', () => {
  void handleSave();
});

closeButton?.addEventListener('click', () => {
  void appWindow.hide();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    void appWindow.hide();
  }
});

window.addEventListener(LAST_CLEANED_EVENT, (event) => {
  const detail = (event as CustomEvent<{ timestamp: string }>).detail;
  updateStatus(detail.timestamp);
});

updateStatus(getLastCleanedTime()?.toISOString());

async function handleSave() {
  if (!pendingSettings || !saveButton) return;
  saveButton.disabled = true;
  if (saveMessage) {
    saveMessage.textContent = 'Saving settings…';
  }
  try {
    const snapshot = cloneSettings(pendingSettings);
    await persistSettings(snapshot);
    pendingSettings = cloneSettings(snapshot);
    applyPollerState(pendingSettings);
    trayMenuHandle?.refresh();
    if (saveMessage) {
      saveMessage.textContent = `Saved ${formatTimestamp(new Date())}`;
    }
  } catch (error) {
    console.error('Failed to save settings', error);
    if (saveMessage) {
      saveMessage.textContent = 'Could not save changes.';
    }
  } finally {
    saveButton.disabled = false;
  }
}

function applyPollerState(settings: Settings) {
  if (settings.enabled) {
    restartPoller();
  } else {
    stopPoller();
  }
}

function updateStatus(timestamp?: string) {
  if (!lastCleanedValue || !statusDot) return;
  if (timestamp) {
    statusDot.classList.add('is-active');
    statusDot.setAttribute('aria-label', 'cleaned recently');
    lastCleanedValue.textContent = formatRelativeTime(new Date(timestamp));
  } else {
    statusDot.classList.remove('is-active');
    statusDot.setAttribute('aria-label', 'no clean yet logged');
    lastCleanedValue.textContent = 'Not cleaned yet';
  }
}

function updatePollingHint(value: number) {
  if (!pollingHint) return;
  pollingHint.textContent = `Current target ${value} ms (${describeInterval(value)}).`;
}

function splitLines(value: string): string[] {
  return value
    .split('\\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function describeInterval(ms: number) {
  if (ms < 1000) {
    return `${ms} ms between polls`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1).replace(/\\.0$/, '')} s between polls`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} min between polls`;
}

function formatRelativeTime(date: Date) {
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) return 'Just a moment ago';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} minutes ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} hours ago`;
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTimestamp(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function cloneSettings(value: Settings): Settings {
  return JSON.parse(JSON.stringify(value)) as Settings;
}

function syncUi(settings: Settings) {
  pendingSettings = cloneSettings(settings);
  if (enabledToggle) {
    enabledToggle.checked = settings.enabled;
  }
  if (pollingIntervalInput) {
    pollingIntervalInput.value = String(settings.pollingIntervalMs);
    updatePollingHint(settings.pollingIntervalMs);
  }
  ruleInputs.forEach((input, key) => {
    input.checked = Boolean(settings.ruleFlags[key]);
  });
  if (phraseFiltersInput) {
    phraseFiltersInput.value = settings.phraseFilters.join('\\n');
  }
  if (excludedAppsInput) {
    excludedAppsInput.value = settings.excludedApps.join('\\n');
  }
}

async function showSettingsWindow() {
  await appWindow.show();
  await appWindow.setFocus();
}

async function bootstrap() {
  const settings = await loadSettings();
  syncUi(settings);
  applyPollerState(settings);
  const actions: TrayMenuActions = {
    toggleCleaner: async () => {
      const current = await reloadSettings();
      const next = { ...current, enabled: !current.enabled };
      await persistSettings(next);
      applyPollerState(next);
      trayMenuHandle?.refresh();
      syncUi(next);
    },
    reloadSettings: async () => {
      const loaded = await reloadSettings();
      applyPollerState(loaded);
      syncUi(loaded);
      trayMenuHandle?.refresh();
    },
    openSettings: showSettingsWindow,
    quit: async () => {
      await invoke('exit_app');
    }
  };
  trayMenuHandle = await createTrayMenu(actions);
  trayMenuHandle.refresh();
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap clipboard cleaner', error);
});

function buildPanel() {
  const container = document.createElement('div');
  container.className = 'settings-panel';
  container.innerHTML = `
    <header class="panel-header">
      <div>
        <p class="panel-kicker">Clipboard Cleaner</p>
        <h1 class="panel-title">Cleaner settings</h1>
      </div>
    </header>
    <div class="status-row">
      <span class="status-dot" data-status-dot></span>
      <div class="status-copy">
        <p class="status-label">Last cleaned</p>
        <p class="status-value" id="lastCleanedValue">Not cleaned yet</p>
      </div>
    </div>
    <section class="panel-section">
      <div class="section-heading">
        <p class="section-title">Cleaner</p>
        <p class="helper-text">Run the sanitizer on clipboard changes and control how often it polls.</p>
      </div>
      <label class="toggle-row" for="enabledToggle">
        <span>Cleaner enabled</span>
        <input type="checkbox" id="enabledToggle" />
      </label>
      <label class="field-group" for="pollingInterval">
        <span class="field-label">Polling interval</span>
        <div class="input-with-suffix">
          <input type="number" id="pollingInterval" min="${MIN_POLL_INTERVAL_MS}" step="10" />
          <span class="input-suffix">ms</span>
        </div>
        <p class="helper-text" id="pollingHint"></p>
      </label>
    </section>
    <section class="panel-section">
      <div class="section-heading">
        <p class="section-title">Sanitizer rules</p>
        <p class="helper-text">Toggle individual cleanup rules that match your workflow.</p>
      </div>
      <div id="rulesContainer" class="rule-grid"></div>
    </section>
    <section class="panel-section">
      <div class="section-heading">
        <p class="section-title">Phrase filters</p>
        <p class="helper-text">List exact phrases to skip. One per line.</p>
      </div>
      <textarea id="phraseFilters" rows="3" placeholder="Add phrase to ignore"></textarea>
    </section>
    <section class="panel-section">
      <div class="section-heading">
        <p class="section-title">Excluded apps</p>
        <p class="helper-text">Most apps are already excluded. Add bundle IDs or names to skip them.</p>
      </div>
      <textarea id="excludedApps" rows="4" placeholder="com.example.MyApp"></textarea>
    </section>
    <footer class="panel-footer">
      <p class="helper-text" id="saveMessage"></p>
      <div class="button-row">
        <button type="button" id="closeButton" class="ghost">Close</button>
        <button type="button" id="saveButton" class="primary">Save settings</button>
      </div>
    </footer>
  `;
  return container;
}
