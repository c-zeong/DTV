use reqwest::cookie::Jar;
use reqwest::Client;
use serde_json;
use regex::Regex;
use std::sync::Arc;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
use tokio::net::TcpStream;
use tokio::sync::Mutex;

use super::signature; // Assuming signature.rs is in the same directory (src)

pub struct DouyinLiveWebFetcher {
    pub live_id: String,
    pub ttwid: Option<String>,
    pub room_id: Option<String>,
    pub user_agent: String,
    pub http_client: Client,
    pub(crate) _ws_stream: Option<Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>>,
}

impl DouyinLiveWebFetcher {
    pub fn new(live_id: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let cookie_jar = Arc::new(Jar::default());
        let http_client = Client::builder()
            .cookie_provider(cookie_jar)
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()?;

        Ok(DouyinLiveWebFetcher {
            live_id: live_id.to_string(),
            ttwid: None,
            room_id: None,
            user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".to_string(),
            http_client,
            _ws_stream: None,
        })
    }

    pub async fn get_ttwid(&mut self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ttwid) = &self.ttwid {
            return Ok(ttwid.clone());
        }

        let live_url = "https://live.douyin.com/";
        let response = self.http_client.get(live_url).send().await?;

        let ttwid_val = response.cookies()
            .find(|c| c.name() == "ttwid")
            .map(|c| c.value().to_string());

        if let Some(ttwid) = ttwid_val {
            self.ttwid = Some(ttwid.clone());
            println!("Fetched ttwid: {}", ttwid);
            Ok(ttwid)
        } else {
            Err("ttwid not found in cookies".into())
        }
    }

    pub async fn get_room_id(&mut self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(room_id) = &self.room_id {
            return Ok(room_id.clone());
        }

        let ttwid = self.get_ttwid().await?;
        let ms_token = signature::generate_ms_token(107); 
        let ac_nonce = "0123407cc00a9e438deb4"; 
        let cookie_header = format!("ttwid={}; msToken={}; __ac_nonce={}", ttwid, ms_token, ac_nonce);

        let url = format!("https://live.douyin.com/{}", self.live_id);
        let response = self.http_client.get(&url)
            .header("Cookie", cookie_header)
            .send()
            .await?;
        
        let text = response.text().await?;
        println!("HTML Response (first 500 chars): {}", &text[..std::cmp::min(500, text.len())]);
        
        let re = Regex::new(r#"\\"roomId\\":\\"(\d+)\\""#).unwrap();

        if let Some(caps) = re.captures(&text) {
            if let Some(room_id_match) = caps.get(1) {
                let room_id_val = room_id_match.as_str().to_string();
                self.room_id = Some(room_id_val.clone());
                println!("Fetched room_id: {}", room_id_val);
                return Ok(room_id_val);
            }
        }
        Err("roomId not found in response".into())
    }

    pub async fn get_room_status(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let room_id_val = self.get_room_id().await?;
        let ttwid_val = self.get_ttwid().await?;

        let url = format!(
            "https://live.douyin.com/webcast/room/web/enter/?aid=6383&app_name=douyin_web&live_id=1&device_platform=web&language=zh-CN&enter_from=web_live&cookie_enabled=true&screen_width=1536&screen_height=864&browser_language=zh-CN&browser_platform=Win32&browser_name=Edge&browser_version=133.0.0.0&web_rid={}&room_id_str={}&enter_source=&is_need_double_stream=false&insert_task_id=&live_reason=&msToken=&a_bogus=",
            self.live_id,
            room_id_val
        );

        let response = self.http_client.get(&url)
            .header("User-Agent", &self.user_agent)
            .header("Cookie", format!("ttwid={};", ttwid_val))
            .send()
            .await?;

        let data: serde_json::Value = response.json().await?;

        if let Some(room_data) = data.get("data") {
            let room_status_val = room_data.get("room_status").and_then(|s| s.as_i64());
            if let Some(user_data) = room_data.get("user") {
                let user_id = user_data.get("id_str").and_then(|s| s.as_str());
                let nickname = user_data.get("nickname").and_then(|s| s.as_str());

                if let (Some(status), Some(id), Some(nick)) = (room_status_val, user_id, nickname) {
                    let status_text = if status == 0 { "正在直播" } else { "已结束" };
                    println!("【{}】[{}]直播间：{}.", nick, id, status_text);
                } else {
                    println!("【X】无法解析直播间信息的部分字段");
                }
            } else {
                println!("【X】未找到用户信息 (user data)");
            }
        } else {
            println!("【X】未找到房间数据 (room data)");
        }
        Ok(())
    }

    pub async fn fetch_room_details(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.get_ttwid().await?;
        self.get_room_id().await?;
        self.get_room_status().await?; // Optional: for debugging or if status is needed before connection
        Ok(())
    }

    // pub async fn connect_websocket_placeholder(&mut self, _room_id_param: &str, _ttwid_param: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    //     println!("Connect_websocket logic will be moved elsewhere.");
    //     Ok(())
    // }
}