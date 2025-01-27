// 在开发模式下允许控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::generate_handler;
use std::sync::Mutex;
use tokio::sync::mpsc;
use std::sync::Arc;
use reqwest::header::{HeaderMap, HeaderValue};

mod douyu;
mod danmaku;
mod proxy;

struct DanmakuState(Mutex<Option<mpsc::Sender<()>>>);
struct ProxyState(Arc<proxy::ProxyServer>);

#[tauri::command]
async fn get_stream_url(room_id: String) -> Result<String, String> {
    douyu::get_stream_url(&room_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_danmaku(
    room_id: String,
    window: tauri::Window,
    state: tauri::State<'_, DanmakuState>,
) -> Result<(), String> {
    // 停止现有的弹幕任务
    let tx = {
        let mut lock = state.0.lock().unwrap();
        lock.take()
    };

    if let Some(tx) = tx {
        let _ = tx.send(()).await;
    }

    // 创建新的停止通道
    let (tx, mut rx) = mpsc::channel(1);
    {
        let mut lock = state.0.lock().unwrap();
        *lock = Some(tx);
    }

    // 启动新的弹幕任务
    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut client = danmaku::DanmakuClient::new(&room_id, window_clone);
        tokio::select! {
            _ = client.start() => {},
            _ = rx.recv() => {},
        }
    });

    Ok(())
}

#[tauri::command]
async fn search_anchor(keyword: String) -> Result<String, String> {
    douyu::search_anchor(&keyword).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_proxy(state: tauri::State<'_, ProxyState>) -> Result<String, String> {
    let proxy = state.0.clone();
    
    // 在新线程启动代理服务
    tokio::spawn(async move {
        if let Err(e) = proxy.start().await {
            eprintln!("Proxy server error: {}", e);
        }
    });

    Ok(state.0.get_proxy_url())
}

#[tauri::command]
async fn set_stream_url(url: String, state: tauri::State<'_, ProxyState>) -> Result<(), String> {
    state.0.set_stream(url).await;
    Ok(())
}

#[tauri::command]
async fn fetch_room_info(room_id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    
    let mut headers = HeaderMap::new();
    headers.insert("Accept", HeaderValue::from_static("application/json, text/plain, */*"));
    headers.insert("Accept-Language", HeaderValue::from_static("zh-CN,zh;q=0.9"));
    headers.insert("Cache-Control", HeaderValue::from_static("no-cache"));
    headers.insert("Pragma", HeaderValue::from_static("no-cache"));
    headers.insert("Referer", HeaderValue::from_str(&format!("https://www.douyu.com/{}", room_id)).unwrap());
    headers.insert("User-Agent", HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"));

    let response = client
        .get(format!("https://www.douyu.com/betard/{}", room_id))
        .headers(headers)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;

    Ok(data)
}

fn main() {
    let proxy_server = Arc::new(proxy::ProxyServer::new());

    tauri::Builder::default()
        .manage(DanmakuState(Mutex::new(None)))
        .manage(ProxyState(proxy_server))
        .invoke_handler(generate_handler![
            get_stream_url,
            start_danmaku,
            search_anchor,
            start_proxy,
            set_stream_url,
            fetch_room_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
