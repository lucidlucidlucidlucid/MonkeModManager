use std::{fs, io, path::Path, process::Command};

fn extract_zip(bytes: &[u8], dest: &Path) -> Result<(), String> {
    let cursor = io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let file_name = file.name().to_string();

        if file_name.contains("..") {
            continue;
        }

        let outpath = dest.join(&file_name);

        if file_name.ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

async fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("MonkeModManager/0.1")
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn check_bepinex(game_path: String) -> bool {
    let Some(game_dir) = Path::new(&game_path).parent() else {
        return false;
    };
    game_dir.join("BepInEx").exists()
}

#[tauri::command]
async fn check_melonloader(game_path: String) -> bool {
    let Some(game_dir) = Path::new(&game_path).parent() else {
        return false;
    };
    game_dir.join("MelonLoader").exists()
}

#[tauri::command]
async fn install_bepinex(game_path: String) -> Result<(), String> {
    let game_dir = Path::new(&game_path).parent().ok_or("Invalid game path")?;
    let client = build_client().await?;

    let releases: serde_json::Value = client
        .get("https://api.github.com/repos/BepInEx/BepInEx/releases")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let download_url = releases
        .as_array()
        .and_then(|list| {
            list.iter()
                .filter(|r| !r["prerelease"].as_bool().unwrap_or(true))
                .find(|r| r["tag_name"].as_str().map(|t| t.starts_with("v5.")).unwrap_or(false))
        })
        .and_then(|release| release["assets"].as_array())
        .and_then(|assets| assets.iter().find(|a| a["name"].as_str().map(|n| n.contains("win_x64")).unwrap_or(false)))
        .and_then(|a| a["browser_download_url"].as_str())
        .ok_or("Could not find BepInEx 5.x Windows x64 release")?
        .to_string();

    let bytes = client.get(&download_url).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    extract_zip(&bytes, game_dir)
}

#[tauri::command]
async fn install_melonloader(game_path: String) -> Result<(), String> {
    let game_dir = Path::new(&game_path).parent().ok_or("Invalid game path")?;
    let client = build_client().await?;

    let release: serde_json::Value = client
        .get("https://api.github.com/repos/LavaGang/MelonLoader/releases/latest")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let download_url = release["assets"]
        .as_array()
        .and_then(|assets| assets.iter().find(|a| {
            a["name"].as_str().map(|n| n == "MelonLoader.x64.zip").unwrap_or(false)
        }))
        .and_then(|a| a["browser_download_url"].as_str())
        .ok_or("Could not find MelonLoader Windows x64 release")?
        .to_string();

    let bytes = client.get(&download_url).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    extract_zip(&bytes, game_dir)
}

#[tauri::command]
async fn install_mod(game_path: String, download_url: String, mod_name: String, loader: String) -> Result<(), String> {
    let game_dir = Path::new(&game_path).parent().ok_or("Invalid game path")?;

    let mods_dir = if loader == "melonloader" {
        game_dir.join("Mods")
    } else {
        game_dir.join("BepInEx").join("plugins")
    };
    fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

    let client = build_client().await?;
    let bytes = client.get(&download_url).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;

    if download_url.ends_with(".zip") {
        extract_zip(&bytes, game_dir)
    } else {
        let filename = download_url.split('/').last().filter(|s| !s.is_empty()).unwrap_or(&mod_name);
        fs::write(mods_dir.join(filename), &bytes).map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn uninstall_bepinex(game_path: String) -> Result<(), String> {
    let game_dir = Path::new(&game_path).parent().ok_or("Invalid game path")?;

    let bepinex_dir = game_dir.join("BepInEx");
    if bepinex_dir.exists() {
        fs::remove_dir_all(&bepinex_dir).map_err(|e| e.to_string())?;
    }

    for file in &["winhttp.dll", "doorstop_config.ini", ".doorstop_version", "changelog.txt"] {
        let path = game_dir.join(file);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn uninstall_melonloader(game_path: String) -> Result<(), String> {
    let game_dir = Path::new(&game_path).parent().ok_or("Invalid game path")?;

    for dir in &["MelonLoader", "UserData", "UserLibs", "Plugins", "Mods"] {
        let path = game_dir.join(dir);
        if path.exists() {
            fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }

    for file in &["version.dll", "MelonLoader.Bootstrap.so", "dobby.dll"] {
        let path = game_dir.join(file);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            open_folder,
            check_bepinex,
            check_melonloader,
            install_bepinex,
            install_melonloader,
            install_mod,
            uninstall_bepinex,
            uninstall_melonloader,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
