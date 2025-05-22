use reqwest::header::USER_AGENT;
use serde::{Deserialize, Serialize};
use tauri::command;

// Structs expected by the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FrontendCate3Item {
    id: String, // cate3Id
    name: String, // cate3Name
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FrontendCate2Item {
    id: String,        // cate2Id
    name: String,      // cate2Name
    short_name: String, // shortName
    icon: String,      // icon
    #[serde(rename = "cate3List")]
    cate3_list: Vec<FrontendCate3Item>, // Will be empty from this fetch
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FrontendCate1Item {
    id: String,   // cate1Id
    name: String, // cate1Name
    #[serde(rename = "cate2List")]
    cate2_list: Vec<FrontendCate2Item>,
}

// This is what the command will return
#[derive(Debug, Serialize, Deserialize)]
pub struct FrontendCategoryResponse {
    // No longer embedding error/msg here, Result handles it.
    // error: i32,
    // msg: Option<String>,
    // data: Option<Vec<FrontendCate1Item>>,
    #[serde(rename = "cate1List")]
    cate1_list: Vec<FrontendCate1Item>,
}

// Structs for deserializing Douyu's m.douyu.com/api/cate/list response
// Based on provided list.json

#[derive(Deserialize, Debug, Clone)]
struct JsonCate1Item {
    #[serde(rename = "cate1Id")]
    id: i32,
    #[serde(rename = "cate1Name")]
    name: String,
    // #[serde(rename = "shortName")] // Removed as unused
    // short_name: String,
}

#[derive(Deserialize, Debug, Clone)]
struct JsonCate2Item {
    #[serde(rename = "cate1Id")]
    parent_id: i32, // To link with JsonCate1Item.id
    #[serde(rename = "cate2Id")]
    id: i32,
    #[serde(rename = "cate2Name")]
    name: String,
    #[serde(rename = "shortName")]
    short_name: String,
    icon: String, // Assuming this is the desired icon URL
    // pic: Option<String>, // Available but not currently used
    // small_icon: Option<String>, // Available but not currently used
    // count: Option<i32>, // Available but not currently used
}

// Removed DouyuCate3ItemRaw as it's not in this API response

#[derive(Deserialize, Debug)]
struct DouyuCategoryDataRaw {
    #[serde(rename = "cate1Info")]
    cate1_info: Option<Vec<JsonCate1Item>>,
    #[serde(rename = "cate2Info")]
    cate2_info: Option<Vec<JsonCate2Item>>,
}

#[derive(Deserialize, Debug)]
struct DouyuCategoryApiResponse {
    #[serde(alias = "code")]
    error: i32, // Douyu uses 'code' for error status
    msg: Option<String>,
    data: Option<DouyuCategoryDataRaw>,
}

#[command]
pub async fn fetch_categories() -> Result<FrontendCategoryResponse, String> {
    let client = reqwest::Client::new();
    let url = "https://m.douyu.com/api/cate/list";

    let response = client
        .get(url)
        .header(USER_AGENT, "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1")
        .send()
        .await;

    match response {
        Ok(res) => {
            if res.status().is_success() {
                let body_text = res.text().await.unwrap_or_else(|_| "{}".to_string());
                match serde_json::from_str::<DouyuCategoryApiResponse>(&body_text) {
                    Ok(parsed_response) => {
                        if parsed_response.error == 0 {
                            if let Some(douyu_data) = parsed_response.data {
                                let mut frontend_cate1_list: Vec<FrontendCate1Item> = Vec::new();
                                
                                let all_raw_c2_items = douyu_data.cate2_info.unwrap_or_default();

                                if let Some(raw_cate1_list) = douyu_data.cate1_info {
                                    for raw_c1_item in raw_cate1_list {
                                        let mut c1_specific_frontend_cate2_list: Vec<FrontendCate2Item> = Vec::new();
                                        for raw_c2_item in &all_raw_c2_items {
                                            if raw_c2_item.parent_id == raw_c1_item.id {
                                                c1_specific_frontend_cate2_list.push(FrontendCate2Item {
                                                    id: raw_c2_item.id.to_string(),
                                                    name: raw_c2_item.name.clone(),
                                                    short_name: raw_c2_item.short_name.clone(),
                                                    icon: raw_c2_item.icon.clone(),
                                                    cate3_list: Vec::new(), // C3 list is empty from this API
                                                });
                                            }
                                        }

                                        frontend_cate1_list.push(FrontendCate1Item {
                                            id: raw_c1_item.id.to_string(),
                                            name: raw_c1_item.name.clone(),
                                            cate2_list: c1_specific_frontend_cate2_list,
                                        });
                                    }
                                }
                                
                                Ok(FrontendCategoryResponse {
                                    cate1_list: frontend_cate1_list,
                                })
                            } else {
                                Err(format!("Data field is missing in API response. Code: {}, Msg: {:?}. Full response: {}", parsed_response.error, parsed_response.msg, body_text))
                            }
                        } else {
                            Err(format!("Category API returned an error. Code: {}, Msg: {:?}. Full response: {}", parsed_response.error, parsed_response.msg, body_text))
                        }
                    }
                    Err(e) => {
                        Err(format!("Failed to parse category JSON: {}, Body: {}", e, body_text))
                    }
                }
            } else {
                Err(format!("Failed to fetch categories: HTTP {}", res.status()))
            }
        }
        Err(e) => {
            Err(format!("Error fetching categories: {}", e))
        }
    }
}

// Ensure this file is part of a module if you have a lib.rs or main.rs that expects it.
// For example, in main.rs or lib.rs:
// pub mod category;
// And ensure this file is named category.rs in the correct directory.