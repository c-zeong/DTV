// src-tauri/src/api/three_cate.rs
#[tauri::command]
pub async fn fetch_three_cate(tag_id: u32) -> Result<String, String> {
    let url = format!("https://capi.douyucdn.cn/api/v1/getThreeCate?tag_id={}&client_sys=android", tag_id);
    // println!("Fetching URL (from api::three_cate): {}", url); // 用于调试

    match reqwest::get(&url).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.text().await {
                    Ok(text) => {
                        Ok(text)
                    }
                    Err(e) => {
                        eprintln!("Failed to read response text: {}", e);
                        Err(format!("Failed to read response text: {}", e))
                    }
                }
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_else(|_| "Unknown error from API".to_string());
                eprintln!("API request failed with status {}: {}", status, error_text);
                Err(format!("API request failed with status {}: {}", status, error_text))
            }
        }
        Err(e) => {
            eprintln!("Failed to send request: {}", e);
            Err(format!("Failed to send request: {}", e))
        }
    }
}