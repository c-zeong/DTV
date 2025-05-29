use serde::{Deserialize, Serialize};
use tauri::State;
use crate::platforms::common::http_client::DEFAULT_USER_AGENT;
// use crate::platforms::douyin::signature; // Removed: ms_token is passed as a parameter, not generated here.
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, SET_COOKIE}; // Ensure SET_COOKIE is imported

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DouyinRoomCover {
    pub url_list: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DouyinRoomOwner {
    pub nickname: String,
    pub avatar_thumb: Option<DouyinRoomCover>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DouyinRoomStats {
    pub total_user_str: String,
    pub user_count_str: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DouyinRoom {
    #[serde(rename = "id_str")] // id_str is inside the JSON room object and contains the correct ID
    pub web_rid: String,        // This field in DouyinRoom will hold the value from JSON's room.id_str

    pub title: String,
    pub cover: DouyinRoomCover,
    pub owner: DouyinRoomOwner,
    pub stats: DouyinRoomStats,
    // Add other fields from the JSON room object if necessary
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DouyinPartitionRoomData {
    #[serde(rename = "web_rid")] // Capture the top-level web_rid from JSON
    pub actual_web_rid_for_frontend: String, // Field to hold the true web_rid

    pub room: DouyinRoom, // The nested room object

    // You can also add other fields from this level if needed, e.g.:
    // pub uniq_id: Option<String>,
    // pub tag_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DouyinPartitionDataWrapper {
    pub data: Vec<DouyinPartitionRoomData>,
    pub count: i32,
    pub offset: i32,
    pub has_more: Option<bool>, // Added for pagination
    // pub total: Option<i32>, // If available and needed
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DouyinPartitionApiResponse {
    pub data: DouyinPartitionDataWrapper,
    pub status_code: i32,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LiveRoomFrontend {
    pub web_rid: String,
    pub title: String,
    pub cover_url: String,
    pub owner_nickname: String,
    pub user_count_str: String,
    pub avatar_url: String,
}

// This struct will wrap the list of rooms and the has_more flag for the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DouyinLiveListResponse {
    pub rooms: Vec<LiveRoomFrontend>,
    pub has_more: bool,
    pub next_offset: i32, // The offset to use for the next request
}

// Helper function to fetch ttwid (simplified from web_fetcher)
async fn fetch_ttwid_internal(client: &reqwest::Client) -> Result<String, String> {
    let live_url = "https://live.douyin.com/";
    match client.get(live_url).header("User-Agent", DEFAULT_USER_AGENT).send().await {
        Ok(response) => {
            if response.status().is_success() {
                println!("Headers received from {}:", live_url);
                let mut ttwid_val: Option<String> = None;
                
                // Iterate over Set-Cookie headers
                for header_value in response.headers().get_all(SET_COOKIE) {
                    if let Ok(cookie_str) = header_value.to_str() {
                        // Simple parsing for "ttwid=value;" pattern
                        // For robust parsing, consider using a cookie parsing crate
                        if let Some(name_value_pair) = cookie_str.split(';').next() {
                            let parts: Vec<&str> = name_value_pair.splitn(2, '=').collect();
                            if parts.len() == 2 {
                                let name = parts[0].trim();
                                let value = parts[1].trim();
                                println!("  Found cookie: Name: {}, Value: {}", name, value);
                                if name == "ttwid" {
                                    ttwid_val = Some(value.to_string());
                                    // break; // Found ttwid, can stop iterating if it's the only one needed
                                }
                            }
                        }
                    }
                }

                if let Some(ttwid) = ttwid_val {
                    Ok(ttwid)
                } else {
                    Err("ttwid not found in Set-Cookie headers from live.douyin.com".to_string())
                }
            } else {
                Err(format!("Failed to fetch from live.douyin.com for ttwid, status: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Network error fetching ttwid: {}", e)),
    }
}

#[tauri::command]
pub async fn fetch_douyin_partition_rooms(
    _http_client: State<'_, reqwest::Client>, 
    partition: String,
    partition_type: String,
    offset: i32, // This is the offset for the current request (0, 15, 30...)
    ms_token: String, 
) -> Result<DouyinLiveListResponse, String> {
    let count: i32 = 15; // Number of items requested per page, explicitly typed as i32

    // For this test, create a new client, similar to the user's test snippet
    let local_client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("Failed to build local reqwest client: {}", e))?;

    // Use hardcoded ttwid and odin_tt from the user's working test for now
    let hardcoded_odin_tt = "54c68ba8fa8ce792ad017c55272d171c283baedc87b2f6282ca8706df295cbd89c5d55449b587b7ebe0a2e352e394a86975955c9ed7f98f209996bdca2749479619aceecc7b75c2374e146b5a722b2e1";
    let hardcoded_ttwid = "1%7CujFiEGend0Qdgp4z6JtMVxrMQOb8X-3eVIqJb01WC7M%7C1747990241%7Cc80885daaa44b982ca725011bf5309c94db3aaf4431f89f1792c0455b8d8197c";
    
    let cookie_string = format!("odin_tt={}; ttwid={}", hardcoded_odin_tt, hardcoded_ttwid);
    
    let mut headers = HeaderMap::new();
    headers.insert(COOKIE, HeaderValue::from_str(&cookie_string).map_err(|e| format!("Failed to create cookie header value: {}", e))?);

    let url = format!(
        "https://live.douyin.com/webcast/web/partition/detail/room/?aid=6383&app_name=douyin_web&live_id=1&device_platform=web&language=zh-CN&enter_from=web_homepage_hot&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=zh-CN&browser_platform=MacIntel&browser_name=Chrome&browser_version=120.0.0.0&count={}&offset={}&partition={}&partition_type={}&req_from=2&msToken={}",
        count, offset, partition, partition_type, ms_token
    );

    println!("Fetching Douyin partition rooms (using local client & hardcoded cookie values for test) from URL: {} with Cookie: {}", url, cookie_string);

    let request_builder = local_client.request(reqwest::Method::GET, &url)
        .headers(headers);

    match request_builder.send().await {
        Ok(response) => {
            let initial_status = response.status();
            if initial_status.is_success() {
                let response_text = response.text().await.map_err(|e| format!("Failed to read response text: {}", e))?;
                return match serde_json::from_str::<DouyinPartitionApiResponse>(&response_text) {
                    Ok(api_response) => {
                        if api_response.status_code == 0 {
                            let mut frontend_rooms = Vec::new();
                            let received_rooms_count = api_response.data.data.len(); // Number of rooms actually received from this API call

                            for room_data in api_response.data.data {
                                let room_details = room_data.room; 
                                
                                let avatar_url = room_details.owner.avatar_thumb
                                    .as_ref()
                                    .and_then(|thumb| thumb.url_list.get(0))
                                    .cloned()
                                    .unwrap_or_default();

                                let user_count_display = room_details.stats.user_count_str
                                    .clone()
                                    .unwrap_or_else(|| room_details.stats.total_user_str.clone());

                                frontend_rooms.push(LiveRoomFrontend {
                                    web_rid: room_data.actual_web_rid_for_frontend.clone(),
                                    title: room_details.title,
                                    cover_url: room_details.cover.url_list.get(0).cloned().unwrap_or_default(),
                                    owner_nickname: room_details.owner.nickname,
                                    user_count_str: user_count_display, 
                                    avatar_url,
                                });
                            }
                            
                            // New has_more logic: true if we received exactly 'count' items
                            let has_more = received_rooms_count == (count as usize);

                            // New next_offset logic: current offset + number of items requested for a page
                            let next_offset_for_frontend = offset + count; 

                            Ok(DouyinLiveListResponse {
                                rooms: frontend_rooms,
                                has_more,
                                next_offset: next_offset_for_frontend,
                            })
                        } else {
                            Err(format!(
                                "Douyin API returned non-zero status code: {}. Response: {}",
                                api_response.status_code,
                                response_text
                            ))
                        }
                    }
                    Err(e) => Err(format!("Failed to parse Douyin room list JSON: {}. Response: {}", e, response_text)),
                };
            } else {
                let error_body = response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
                Err(format!(
                    "Failed to fetch Douyin room list: HTTP Status {}. Body: {}",
                    initial_status,
                    error_body
                ))
            }
        }
        Err(e) => Err(format!("Network error fetching Douyin room list: {}", e)),
    }
} 