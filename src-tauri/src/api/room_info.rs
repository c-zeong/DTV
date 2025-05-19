use reqwest::header::{HeaderMap, HeaderValue};

#[tauri::command]
pub async fn fetch_room_info(room_id: String) -> Result<serde_json::Value, String> {
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