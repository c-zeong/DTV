use std::collections::HashMap;
use tokio_tungstenite::{connect_async_tls_with_config, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use tokio::time::Duration;
use url::Url;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tauri::{Window, Emitter};

pub struct DanmakuClient {
    room_id: String,
    window: Window,
}

impl DanmakuClient {
    pub fn new(room_id: &str, window: Window) -> Self {
        Self {
            room_id: room_id.to_string(),
            window,
        }
    }

    fn encode_msg(&self, msg: &str) -> Vec<u8> {
        let msg_bytes = msg.as_bytes();
        let packet_len = msg_bytes.len() + 9;
        
        let mut result = Vec::new();
        result.extend_from_slice(&(packet_len as u32).to_le_bytes());
        result.extend_from_slice(&(packet_len as u32).to_le_bytes());
        result.extend_from_slice(&689u16.to_le_bytes());
        result.push(0);
        result.push(0);
        result.extend_from_slice(msg_bytes);
        result.push(0);
        
        result
    }

    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let url = Url::parse("wss://danmuproxy.douyu.com:8506/")?;
        let mut request = url.into_client_request()?;
        request.headers_mut().insert(
            "Sec-WebSocket-Protocol",
            "binary".parse()?
        );

        let (ws_stream, _) = connect_async_tls_with_config(
            request,
            None,
            false,
            None
        ).await?;

        let (mut write, mut read) = ws_stream.split();

        // 发送登录请求
        let login_msg = format!("type@=loginreq/roomid@={}/", self.room_id);
        let login_data = self.encode_msg(&login_msg);
        write.send(Message::Binary(login_data)).await?;

        // 发送加入房间请求
        let join_msg = format!("type@=joingroup/rid@={}/gid@=1/", self.room_id);
        let join_data = self.encode_msg(&join_msg);
        write.send(Message::Binary(join_data)).await?;

        // 创建消息通道
        let (tx, mut rx) = mpsc::channel(32);
        
        // 启动心跳任务
        let heartbeat_msg = "type@=mrkl/";
        let heartbeat_data = self.encode_msg(heartbeat_msg);
        let tx_clone = tx.clone();
        
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(45)).await;
                if let Err(_) = tx_clone.send(Message::Binary(heartbeat_data.clone())).await {
                    break;
                }
            }
        });

        // 消息发送任务
        let send_task = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if let Err(_) = write.send(msg).await {
                    break;
                }
            }
        });

        let window = self.window.clone();

        // 处理接收到的消息
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    if data.len() < 13 {
                        continue;
                    }

                    let content = String::from_utf8_lossy(&data[12..data.len()-1]);
                    let mut result = HashMap::new();
                    for item in content.split('/') {
                        if item.is_empty() {
                            continue;
                        }
                        if let Some((key, value)) = item.split_once("@=") {
                            result.insert(
                                key.to_string(),
                                value.replace("@S", "/").replace("@A", "@")
                            );
                        }
                    }

                    if result.get("type").map_or(false, |t| t == "chatmsg") {
                        let unknown = "unknown".to_string();
                        let empty = "".to_string();
                        let zero = "0".to_string();
                        
                        let danmaku = serde_json::json!({
                            "nickname": result.get("nn").unwrap_or(&unknown),
                            "content": result.get("txt").unwrap_or(&empty),
                            "level": result.get("level").unwrap_or(&zero),
                            "badgeName": result.get("bnn").unwrap_or(&empty),
                            "badgeLevel": result.get("bl").unwrap_or(&zero)
                        });

                        let _ = window.emit("danmaku", danmaku);
                    }
                }
                Ok(Message::Close(_)) | Err(_) => {
                    break;
                }
                _ => {}
            }
        }

        // 取消发送任务
        send_task.abort();

        Ok(())
    }
} 