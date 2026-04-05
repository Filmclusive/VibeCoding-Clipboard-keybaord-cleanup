use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontmostAppInfo {
  pub bundle_identifier: Option<String>,
  pub name: Option<String>
}

#[tauri::command]
fn get_frontmost_app() -> FrontmostAppInfo {
  capture_frontmost()
}

#[tauri::command]
fn exit_app(handle: AppHandle) {
  handle.exit(0);
}

#[cfg(target_os = "macos")]
fn capture_frontmost() -> FrontmostAppInfo {
  use objc2::rc::autoreleasepool;
  use objc2_app_kit::NSWorkspace;

  autoreleasepool(|_| {
    let workspace = NSWorkspace::sharedWorkspace();
    if let Some(frontmost) = workspace.frontmostApplication() {
      let bundle_identifier = frontmost
        .bundleIdentifier()
        .map(|value| value.to_string());
      let name = frontmost.localizedName().map(|value| value.to_string());
      FrontmostAppInfo {
        bundle_identifier,
        name
      }
    } else {
      FrontmostAppInfo {
        bundle_identifier: None,
        name: None
      }
    }
  })
}

#[cfg(not(target_os = "macos"))]
fn capture_frontmost() -> FrontmostAppInfo {
  FrontmostAppInfo {
    bundle_identifier: None,
    name: None
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_clipboard_manager::init())
    .invoke_handler(tauri::generate_handler![get_frontmost_app, exit_app])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
