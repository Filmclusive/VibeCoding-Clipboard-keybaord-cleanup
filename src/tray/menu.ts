import { Menu } from '@tauri-apps/api/menu';
import { TrayIcon } from '@tauri-apps/api/tray';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { getCachedSettings } from '../runtime/settings';

export interface TrayMenuActions {
  toggleCleaner: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  openSettings: () => Promise<void>;
  quit: () => Promise<void>;
}

export async function createTrayMenu(actions: TrayMenuActions) {
  let menu: Menu | null = null;

  async function updateToggleLabel() {
    if (!menu) return;
    const settings = getCachedSettings();
    const toggleItem = await menu.get('toggle');
    if (toggleItem) {
      await toggleItem.setText(settings.enabled ? 'Disable Cleaner' : 'Enable Cleaner');
    }
  }

  const toggleAction = async () => {
    await actions.toggleCleaner();
    await updateToggleLabel();
  };

  const reloadAction = async () => {
    await actions.reloadSettings();
    await updateToggleLabel();
  };

  const menuInstance = await Menu.new({
    items: [
      {
        id: 'toggle',
        text: 'Toggle Cleaner',
        action: toggleAction
      },
      {
        id: 'reload',
        text: 'Reload Settings',
        action: reloadAction
      },
      {
        id: 'settings',
        text: 'Settings\u2026',
        action: async () => {
          await actions.openSettings();
        }
      },
      {
        id: 'quit',
        text: 'Quit',
        action: async () => {
          await actions.quit();
        }
      }
    ]
  });

  menu = menuInstance;
  const icon = await defaultWindowIcon();
  const tray = await TrayIcon.new({
    icon,
    menu: menuInstance,
    tooltip: 'Clipboard Cleaner',
    showMenuOnLeftClick: true
  });

  await updateToggleLabel();

  return {
    refresh: updateToggleLabel,
    close: () => tray.close()
  };
}
