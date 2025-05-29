use reqwest::header::{HeaderMap as ReqwestHeaderMap, HeaderName, HeaderValue, USER_AGENT, ACCEPT, ACCEPT_LANGUAGE};
use reqwest::{Client, Response, RequestBuilder, cookie::Jar};
use std::time::Duration;
use std::sync::Arc;

pub const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_SECONDS: u64 = 20;

#[derive(Debug)]
pub struct HttpClient {
    pub inner: Client,
    headers: ReqwestHeaderMap,
}

impl HttpClient {
    pub fn new() -> Result<Self, String> {
        let mut default_headers = ReqwestHeaderMap::new();
        default_headers.insert(
            USER_AGENT,
            HeaderValue::from_str(DEFAULT_USER_AGENT).map_err(|e| format!("Invalid default user agent: {}", e))?,
        );

        let cookie_jar = Arc::new(Jar::default());

        let client_builder = Client::builder()
            .timeout(Duration::from_secs(DEFAULT_TIMEOUT_SECONDS))
            .cookie_provider(cookie_jar);
        
        let inner_client = client_builder.build().map_err(|e| format!("Failed to build reqwest client: {}", e))?;

        Ok(HttpClient {
            inner: inner_client,
            headers: default_headers,
        })
    }

    // Method to add or update a header for subsequent requests made with this client instance
    pub fn insert_header(&mut self, name: HeaderName, value: &str) -> Result<(), String> {
        let header_value = HeaderValue::from_str(value).map_err(|e| {
            format!("Failed to create header value for {}: {}", name, e)
        })?;
        self.headers.insert(name.clone(), header_value);
        Ok(())
    }
    
    // Clears all headers except for the default ones (like User-Agent if set in new())
    pub fn clear_headers(&mut self) {
        let mut new_headers = ReqwestHeaderMap::new();
        if let Some(ua) = self.headers.get(USER_AGENT) {
            new_headers.insert(USER_AGENT, ua.clone());
        }
        self.headers = new_headers;
    }

    async fn send_request(&self, request_builder: RequestBuilder) -> Result<Response, String> {
        request_builder
            .headers(self.headers.clone())
            .send()
            .await
            .map_err(|e| {
                println!("[HTTP_CLIENT ERROR] HTTP request failed: {}", e);
                format!("HTTP request execution failed: {}", e)
            })
    }

    pub async fn get(&self, url: &str) -> Result<Response, String> {
        let response = self.send_request(self.inner.get(url)).await?;
        Ok(response)
    }

    pub async fn get_text(&self, url: &str) -> Result<String, String> {
        let response = self.get(url).await?;
        let status = response.status();
        let response_text = response.text().await.map_err(|e| {
            format!("Failed to read response body from {}: {}", url, e)
        })?;
        if !status.is_success() {
            return Err(format!("GET {} failed with status {}: {}", url, status, response_text));
        }
        Ok(response_text)
    }

    pub async fn get_json<T: serde::de::DeserializeOwned>(&self, url: &str) -> Result<T, String> {
        let response = self.get(url).await?;
        let status = response.status();
        if !status.is_success() {
            let err_text = response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
            return Err(format!("GET JSON {} failed with status {}: {}", url, status, err_text));
        }
        let json_response = response.json::<T>().await.map_err(|e| {
            format!("Failed to parse JSON response from {}: {}", url, e)
        })?;
        Ok(json_response)
    }

    // Add post, post_json etc. from the demo if needed in the future
}

// Optional: if you still want a quick way to get headers for simple HTML page fetches (outside the client instance)
// This is less used if the HttpClient instance manages its own headers for specific tasks.
pub fn default_html_page_headers() -> ReqwestHeaderMap {
    let mut headers = ReqwestHeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"));
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-US,en;q=0.5"));
    headers
}