use crate::platforms::common::http_client::HttpClient;
use crate::platforms::douyin::models::*;
use crate::platforms::douyin::utils::setup_douyin_cookies;
use reqwest::header::REFERER; // For setting referer for the API call
use tauri::command;
use reqwest; // 确保 reqwest 被导入
// use serde::Deserialize; // Removed unused import
// use crate::platforms::common::GetStreamUrlPayload; // Will use full path
// use crate::platforms::common::LiveStreamInfo; // Will use full path

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
pub async fn get_douyin_live_stream_url(payload: crate::platforms::common::GetStreamUrlPayload) -> Result<crate::platforms::common::LiveStreamInfo, String> { 
    let room_id_str = payload.args.room_id_str; 
    println!("[Douyin Live RS] Received room_id_str via GetStreamUrlPayload: '{}'", room_id_str);

    if room_id_str.is_empty() {
        return Ok(crate::platforms::common::LiveStreamInfo {
            title: None, anchor_name: None, avatar: None, stream_url: None, status: None,
            error_message: Some("Room ID cannot be empty.".to_string()),
        });
    }

    let mut http_client = HttpClient::new().map_err(|e| {
        format!("Failed to create HttpClient: {}", e)
    })?;

    if let Err(e) = setup_douyin_cookies(&mut http_client, &room_id_str).await {
        return Ok(crate::platforms::common::LiveStreamInfo {
            title: None, anchor_name: None, avatar: None, stream_url: None, status: None,
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
            return Ok(crate::platforms::common::LiveStreamInfo {
                title: None, anchor_name: None, avatar: None, stream_url: None, status: None,
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
        return Ok(crate::platforms::common::LiveStreamInfo {
            title: None, anchor_name: None, avatar: None, stream_url: None, status: None,
            error_message: Some(format!("API error (status_code: {}): {}", api_response.status_code, prompts)),
        });
    }

    let main_data = match api_response.data {
        Some(d) => d,
        None => return Ok(crate::platforms::common::LiveStreamInfo { 
            title: None, anchor_name: None, avatar: None, stream_url: None, status: None,
            error_message: Some("API response contained no main 'data' object".to_string())
        }),
    };

    let room_data_entry = main_data.data.as_ref()
        .and_then(|data_vec| data_vec.first())
        .ok_or_else(|| "No room data entry (data.data[0]) found in API response".to_string())?;

    let current_status = room_data_entry.status;

    // If the streamer is not live (status != 2), we should still return their basic info
    // but with no stream_url and a relevant message or no error if it's just for info.
    // For the follows list, we just need the status and basic info.
    if current_status != 2 {
        println!("[Douyin Live RS INFO] Streamer status is {} (not live). Returning info without stream URL.", current_status);
        return Ok(crate::platforms::common::LiveStreamInfo {
            title: room_data_entry.title.clone(),
            anchor_name: main_data.user.as_ref().and_then(|u| u.nickname.clone()),
            avatar: main_data.user.as_ref().and_then(|u| u.avatar_thumb.as_ref()).and_then(|at| at.url_list.as_ref()).and_then(|ul| ul.first().cloned()),
            stream_url: None, // Explicitly None as not live
            status: Some(current_status),
            error_message: None, // No error, just not live for streaming purposes. Client can interpret status.
        });
    }

    // Only proceed to get stream_url_container if the streamer is live (status == 2)
    let stream_url_container = room_data_entry.stream_url_container.as_ref()
        .ok_or_else(|| {
            // This case should ideally not be hit if status is 2, but as a fallback:
            println!("[Douyin Live RS WARN] Streamer status is 2 (live) but no stream_url_container found. This is unexpected.");
            "Stream is live but stream URL container is missing".to_string()
        })?;

    let mut final_stream_url: Option<String> = None;

    // Try to get FLV stream from live_core_sdk_data
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
                                            println!("[Douyin Live RS INFO] Found FLV URL from sdk_data: {}", flv_url);
                                            break; // Found an FLV URL, stop searching in sdk_data
                                        }
                                    }
                                }
                                // HLS lookup from sdk_data is intentionally omitted here,
                                // as the primary HLS fallback is from hls_pull_url_map.
                            }
                        },
                        Err(e) => {
                            println!("[Douyin Live RS WARN] Failed to parse inner stream_data JSON from live_core_sdk_data: {}. String was: {}", e, stream_data_str);
                        }
                    }
                } else {
                    println!("[Douyin Live RS INFO] stream_data string is empty in live_core_sdk_data.pull_data.");
                }
            } else {
                println!("[Douyin Live RS INFO] stream_data is None in live_core_sdk_data.pull_data.");
            }
        } else {
            println!("[Douyin Live RS INFO] pull_data is None in live_core_sdk_data.");
        }
    } else {
        println!("[Douyin Live RS INFO] live_core_sdk_data is None in stream_url_container.");
    }

    // If an FLV URL was found from sdk_data, process it.
    // It might need a redirect if it doesn't contain "pull-flv".
    if let Some(initial_flv_url_candidate) = final_stream_url.clone() { // 使用 clone 来获取 owned String
        if initial_flv_url_candidate.contains("pull-flv") {
            println!("[Douyin Live RS INFO] 初始 FLV URL 来自 sdk_data，已包含 'pull-flv': {}. 将使用此链接.", initial_flv_url_candidate);
            // final_stream_url 已经是 Some(initial_flv_url_candidate)，无需更改
        } else {
            println!("[Douyin Live RS INFO] 初始 FLV URL ('{}') 不含 'pull-flv'. 尝试解析重定向.", initial_flv_url_candidate);
            
            // 为重定向解析构建 HTTP 客户端
            let client_result = reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none()) // 禁止自动重定向
                .build();

            match client_result {
                Ok(http_client_for_redirect) => {
                    match http_client_for_redirect.get(&initial_flv_url_candidate).send().await {
                        Ok(response) => {
                            if response.status().is_redirection() { // 检查是否为重定向状态
                                if let Some(location_header) = response.headers().get(reqwest::header::LOCATION) {
                                    if let Ok(redirected_url_str) = location_header.to_str() {
                                        println!("[Douyin Live RS INFO] 重定向到: {}. 将此作为最终 FLV URL.", redirected_url_str);
                                        final_stream_url = Some(redirected_url_str.to_string());
                                        // 成功获取新链接，不需要在新链接中检查 "pull-flv"
                                    } else {
                                        println!("[Douyin Live RS WARN] 转换 Location header 为字符串失败. 放弃 FLV URL.");
                                        final_stream_url = None;
                                    }
                                } else {
                                    println!("[Douyin Live RS WARN] 重定向响应中未找到 Location header. 放弃 FLV URL.");
                                    final_stream_url = None;
                                }
                            } else {
                                println!("[Douyin Live RS WARN] 请求 '{}' 未导致重定向 (状态: {}). 放弃 FLV URL.", initial_flv_url_candidate, response.status());
                                final_stream_url = None;
                            }
                        }
                        Err(e) => {
                            println!("[Douyin Live RS WARN] 解析 '{}' 的重定向请求失败: {}. 放弃 FLV URL.", initial_flv_url_candidate, e);
                            final_stream_url = None;
                        }
                    }
                }
                Err(e) => {
                    println!("[Douyin Live RS WARN] 构建 reqwest 客户端用于重定向失败: {}. 放弃 FLV URL.", e);
                    final_stream_url = None;
                }
            }
        }
    }
    // 如果 final_stream_url 在此之后为 None (由于上述逻辑或初始就为None), 则会尝试 HLS

    // If no valid FLV stream (with "pull-flv" or successfully redirected) was found from sdk_data, try HLS stream from hls_pull_url_map
    if final_stream_url.is_none() {
        println!("[Douyin Live RS INFO] No valid FLV stream from sdk_data, or it was discarded. Attempting HLS from hls_pull_url_map.");
        if let Some(hls_map) = &stream_url_container.hls_pull_url_map {
            // Try to get FULL_HD1
            if let Some(full_hd_url) = hls_map.get("FULL_HD1") {
                if !full_hd_url.is_empty() {
                    final_stream_url = Some(full_hd_url.clone());
                }
            }

            // If FULL_HD1 was not found or its URL was empty, try HD1
            if final_stream_url.is_none() {
                if let Some(hd_url) = hls_map.get("HD1") {
                    if !hd_url.is_empty() {
                        final_stream_url = Some(hd_url.clone());
                    }
                }
            }

            // Optional: log if no suitable URL was found in the map
            if final_stream_url.is_none() {
                println!("[Douyin Live RS INFO] No suitable HLS stream (FULL_HD1, HD1) found in hls_pull_url_map. Map content: {:?}", hls_map);
            }
        } else {
            println!("[Douyin Live RS INFO] hls_pull_url_map not found or is None in stream_url_container.");
        }
    }

    Ok(crate::platforms::common::LiveStreamInfo {
        title: room_data_entry.title.clone(),
        anchor_name: main_data.user.as_ref().and_then(|u| u.nickname.clone()),
        avatar: main_data.user.as_ref()
            .and_then(|u| u.avatar_thumb.as_ref())
            .and_then(|at| at.url_list.as_ref())
            .and_then(|ul| ul.first().cloned()),
        stream_url: final_stream_url,
        status: Some(current_status),
        error_message: None,
    })
}
