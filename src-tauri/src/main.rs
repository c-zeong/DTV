// 在开发模式下允许控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

mod douyu;
mod danmaku;
mod proxy;
mod api;

// Assuming API commands are correctly re-exported or defined in these modules
use api::category::fetch_categories;
use api::live_list::{fetch_live_list, fetch_live_list_for_cate3};
use api::room_info::fetch_room_info;
use api::three_cate::fetch_three_cate;

#[derive(Default, Clone)]
pub struct StreamUrlStore {
    pub url: Arc<Mutex<String>>,
}

// DanmakuState remains for the danmaku listener
struct DanmakuState(Mutex<Option<mpsc::Sender<()>>>);

// This is the command that should be used for getting stream URL if it interacts with StreamUrlStore
#[tauri::command]
async fn get_stream_url_cmd(room_id: String) -> Result<String, String> {
    // Call the actual function to fetch the stream URL
    douyu::get_stream_url(&room_id).await.map_err(|e| {
        eprintln!("[Rust Error] Failed to get stream URL for room {}: {}", room_id, e.to_string());
        format!("Failed to get stream URL: {}", e.to_string())
    })
}

// This is the command that should be used for setting stream URL if it interacts with StreamUrlStore
#[tauri::command]
async fn set_stream_url_cmd(url: String, state: tauri::State<'_, StreamUrlStore>) -> Result<(), String> {
    let mut current_url = state.url.lock().unwrap();
    *current_url = url;
    // Also, we might need to inform the proxy if it's already running and needs to use the new URL.
    // However, the current proxy model re-reads the URL when it starts.
    // For a live update, a more complex mechanism (e.g., another state or a channel) would be needed.
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
        // Attempt to send shutdown signal, ignore error if receiver dropped
        let _ = tx.send(()).await;
    }

    let (tx, mut rx) = mpsc::channel(1);
    {
        let mut lock = state.0.lock().unwrap();
        *lock = Some(tx);
    }

    let window_clone = window.clone();
    tokio::spawn(async move {
        // Ensure DanmakuClient::new and .start() are correctly implemented
        let mut client = danmaku::DanmakuClient::new(&room_id, window_clone); 
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
    douyu::search_anchor(&keyword).await.map_err(|e| e.to_string())
}

// Main function corrected
fn main() { // Removed async and Result return type
    tauri::Builder::default()
        .manage(DanmakuState(Mutex::new(None)))
        .manage(StreamUrlStore::default()) // Manage the StreamUrlStore
        .manage(proxy::ProxyServerHandle::default()) // Manage the NEW proxy handle state
        .invoke_handler(tauri::generate_handler![
            // Commands from main.rs (or could be moved to douyu.rs if preferred)
            get_stream_url_cmd, 
            set_stream_url_cmd,
            search_anchor,
            
            // Danmaku command (renamed)
            start_danmaku_listener,
            
            // Proxy commands (from proxy.rs)
            proxy::start_proxy, 
            proxy::stop_proxy,
            
            // API commands (ensure these functions exist and are pub in their respective modules)
            fetch_categories, 
            fetch_live_list,
            fetch_live_list_for_cate3,
            fetch_room_info,
            fetch_three_cate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
