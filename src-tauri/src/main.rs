// 在开发模式下允许控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use reqwest;

// mod douyu; // Removed old direct module
mod proxy;
mod platforms; // Added platforms module
// use platforms::douyu; // No longer need this specific use if functions are directly available via platforms::douyu::* from main

// Assuming API commands are correctly re-exported or defined in these modules
use platforms::douyu::fetch_categories;
use platforms::douyu::{fetch_live_list, fetch_live_list_for_cate3};
use platforms::douyu::fetch_douyu_room_info;
use platforms::douyu::fetch_three_cate;
// get_stream_url and search_anchor will be directly available via platforms::douyu now

#[derive(Default, Clone)]
pub struct StreamUrlStore {
    pub url: Arc<Mutex<String>>,
}

// DanmakuState remains for the danmaku listener
struct DanmakuState(Mutex<Option<mpsc::Sender<()>>>);

// This is the command that should be used for getting stream URL if it interacts with StreamUrlStore
#[tauri::command]
async fn get_stream_url_cmd(room_id: String) -> Result<String, String> {
    // Call the actual function to fetch the stream URL from the new location
    platforms::douyu::get_stream_url(&room_id).await.map_err(|e| {
        eprintln!("[Rust Error] Failed to get stream URL for room {}: {}", room_id, e.to_string());
        format!("Failed to get stream URL: {}", e.to_string())
    })
}

// This is the command that should be used for setting stream URL if it interacts with StreamUrlStore
#[tauri::command]
async fn set_stream_url_cmd(url: String, state: tauri::State<'_, StreamUrlStore>) -> Result<(), String> {
    let mut current_url = state.url.lock().unwrap();
    *current_url = url;
    Ok(())
}


// Renamed from start_danmaku to match frontend call
#[tauri::command]
async fn start_danmaku_listener(
    room_id: String,
    window: tauri::Window,
    state: tauri::State<'_, DanmakuState>,
) -> Result<(), String> {
    let tx = {
        let mut lock = state.0.lock().unwrap();
        lock.take()
    };

    if let Some(tx) = tx {
        let _ = tx.send(()).await;
    }

    let (tx, mut rx) = mpsc::channel(1);
    {
        let mut lock = state.0.lock().unwrap();
        *lock = Some(tx);
    }

    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut client = platforms::douyu::danmu_start::DanmakuClient::new(&room_id, window_clone);
        tokio::select! {
            _ = client.start() => { println!("[Rust] Danmaku client for room {} finished or errored.", room_id); },
            _ = rx.recv() => { println!("[Rust] Danmaku client for room {} received shutdown signal.", room_id); },
        }
        println!("[Rust] Danmaku listener task for {} completed.", room_id);
    });

    Ok(())
}

// search_anchor seems fine, assuming douyu::search_anchor is correct
#[tauri::command]
async fn search_anchor(keyword: String) -> Result<String, String> {
    platforms::douyu::perform_anchor_search(&keyword).await.map_err(|e| e.to_string())
}

// Main function corrected
fn main() { 
    // Create a new HTTP client instance to be managed by Tauri
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .expect("Failed to create reqwest client");

    tauri::Builder::default()
        .manage(client) // Manage the reqwest client
        .manage(DanmakuState(Mutex::new(None)))
        .manage(StreamUrlStore::default()) 
        .manage(proxy::ProxyServerHandle::default()) 
        .invoke_handler(tauri::generate_handler![
            get_stream_url_cmd, 
            set_stream_url_cmd,
            search_anchor,
            start_danmaku_listener,
            proxy::start_proxy, 
            proxy::stop_proxy,
            fetch_categories, 
            fetch_live_list,
            fetch_live_list_for_cate3,
            fetch_douyu_room_info,
            fetch_three_cate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
