use crate::common::http_client::HttpClient;
use crate::douyin::models::*;
use crate::douyin::utils::setup_douyin_cookies;
use reqwest::header::REFERER; // For setting referer for the API call
use tauri::command;
use serde::Deserialize; // UNCOMMENTED
use crate::common::GetStreamUrlPayload; // ADDED for the new specific payload struct
use crate::common::LiveStreamInfo; // Assuming LiveStreamInfo is also common or defined here/models

const DOUYIN_API_REFERER: &str = "https://live.douyin.com/";
const PREFERRED_QUALITIES: [&str; 4] = ["FULL_HD1", "HD1", "SD1", "SD2"]; // As in demo

// Struct to handle flexible argument deserialization - REMOVED as we use PayloadWrapperForRoomId from common
// #[derive(Deserialize, Debug)]
// pub struct GetDouyinLiveStreamUrlArgs {
//     #[serde(alias = "roomId")]
//     #[serde(alias = "roomIdStr")]
//     room_id_str: Option<String>,
// }

#[command]
pub async fn get_douyin_live_stream_url(payload: GetStreamUrlPayload) -> Result<LiveStreamInfo, String> { // CHANGED to GetStreamUrlPayload
    let room_id_str = payload.args.room_id_str; 
    println!("[Douyin Live RS] Received room_id_str via GetStreamUrlPayload: '{}'", room_id_str);

    if room_id_str.is_empty() {
        return Ok(LiveStreamInfo {
            title: None, anchor_name: None, avatar: None, stream_url: None,
            error_message: Some("Room ID cannot be empty.".to_string()),
        });
    }

    let mut http_client = HttpClient::new().map_err(|e| {
        format!("Failed to create HttpClient: {}", e)
    })?;

    if let Err(e) = setup_douyin_cookies(&mut http_client, &room_id_str).await {
        return Ok(LiveStreamInfo {
            title: None, anchor_name: None, avatar: None, stream_url: None,
            error_message: Some(format!("Cookie setup failed: {}", e)),
        });
    }

    http_client.insert_header(REFERER, DOUYIN_API_REFERER)?;
    
    println!("[Douyin Live RS] Using room_id_str to build API URL: '{}'", room_id_str);
    let api_url = format!(
        "https://live.douyin.com/webcast/room/web/enter/?aid=6383&app_name=douyin_web&live_id=1&device_platform=web&language=zh-CN&enter_from=web_live&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=zh-CN&browser_platform=MacIntel&browser_name=Chrome&browser_version=116.0.0.0&web_rid={}",
        room_id_str
    );
    println!("[Douyin Live RS] Constructed API URL: {}", api_url);

    let api_response: DouyinApiResponse = match http_client.get_json(&api_url).await {
        Ok(resp) => resp,
        Err(e) => {
            // Log the raw text response on error as well, if possible
            let raw_error_text = http_client.get_text(&api_url).await.unwrap_or_else(|_| "Failed to get raw error text".to_string());
            println!("[Douyin Live RS] API request failed. Raw error text (if any): {}", raw_error_text);
            return Ok(LiveStreamInfo {
                title: None, anchor_name: None, avatar: None, stream_url: None,
                error_message: Some(format!("API request failed: {}. URL: {}", e, api_url)),
            });
        }
    };

    if let Some(data_content) = &api_response.data { 
        println!("[Douyin Live RS DEBUG] Full api_response.data: {:?}", data_content);
    } else {
        println!("[Douyin Live RS DEBUG] api_response.data is None");
    }

    if api_response.status_code != 0 {
        let prompts = api_response.data.as_ref().and_then(|d| d.prompts.as_ref()).cloned()
            .unwrap_or_else(|| "Unknown API error".to_string());
        return Ok(LiveStreamInfo {
            title: None, anchor_name: None, avatar: None, stream_url: None,
            error_message: Some(format!("API error (status_code: {}): {}", api_response.status_code, prompts)),
        });
    }

    let main_data = match api_response.data {
        Some(d) => d,
        None => return Ok(LiveStreamInfo { 
            title: None, anchor_name: None, avatar: None, stream_url: None, 
            error_message: Some("API response contained no main 'data' object".to_string())
        }),
    };

    let room_data_entry = main_data.data.as_ref()
        .and_then(|data_vec| data_vec.first())
        .ok_or_else(|| "No room data entry (data.data[0]) found in API response".to_string())?;

    if room_data_entry.status != 2 && room_data_entry.status != 4 { 
        return Ok(LiveStreamInfo {
            title: room_data_entry.title.clone(),
            anchor_name: main_data.user.as_ref().and_then(|u| u.nickname.clone()),
            avatar: main_data.user.as_ref().and_then(|u| u.avatar_thumb.as_ref()).and_then(|at| at.url_list.as_ref()).and_then(|ul| ul.first().cloned()),
            stream_url: None,
            error_message: Some(format!("Stream is not live or replay (status: {}).", room_data_entry.status)),
        });
    }

    let stream_url_container = room_data_entry.stream_url_container.as_ref()
        .ok_or_else(|| "No stream_url object in room data".to_string())?;

    let mut final_stream_url: Option<String> = None;

    if let Some(sdk_data) = &stream_url_container.live_core_sdk_data {
        if let Some(pull_data) = &sdk_data.pull_data {
            if let Some(stream_data_str) = &pull_data.stream_data {
                if !stream_data_str.is_empty() {
                    match serde_json::from_str::<InnerStreamDataWrapper>(stream_data_str) {
                        Ok(inner_wrapper) => {
                            if let Some(qualities_map) = inner_wrapper.data {
                                let stream_options = [
                                    qualities_map.origin.as_ref(), 
                                    qualities_map.hd.as_ref(), 
                                    qualities_map.sd.as_ref()
                                ];
                                for opt_quality_detail in stream_options.iter().flatten() {
                                    if let Some(links) = &opt_quality_detail.main {
                                        if let Some(flv_url) = links.flv.as_ref().filter(|s| !s.is_empty()) {
                                            final_stream_url = Some(flv_url.clone());
                                            break;
                                        }
                                    }
                                }
                                if final_stream_url.is_none() {
                                    for opt_quality_detail in stream_options.iter().flatten() {
                                        if let Some(links) = &opt_quality_detail.main {
                                            if let Some(hls_url) = links.hls.as_ref().filter(|s| !s.is_empty()) {
                                                final_stream_url = Some(hls_url.clone());
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        Err(e) => {
                            println!("[Douyin Live RS WARN] Failed to parse inner stream_data JSON: {}. String was: {}", e, stream_data_str);
                        }
                    }
                }
            }
        }
    }
    
    if final_stream_url.is_none() {
        if let Some(flv_map) = &stream_url_container.flv_pull_url {
            for quality_key in PREFERRED_QUALITIES.iter() {
                if let Some(url) = flv_map.get(*quality_key).filter(|s| !s.is_empty()) {
                    final_stream_url = Some(url.clone());
                    break;
                }
            }
        }
    }

    Ok(LiveStreamInfo {
        title: room_data_entry.title.clone(),
        anchor_name: main_data.user.as_ref().and_then(|u| u.nickname.clone()),
        avatar: main_data.user.as_ref()
            .and_then(|u| u.avatar_thumb.as_ref())
            .and_then(|at| at.url_list.as_ref())
            .and_then(|ul| ul.first().cloned()),
        stream_url: final_stream_url,
        error_message: None,
    })
}
