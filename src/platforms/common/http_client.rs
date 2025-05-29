use reqwest::header::{HeaderMap as ReqwestHeaderMap, HeaderName, HeaderValue, USER_AGENT, ACCEPT, ACCEPT_LANGUAGE};
use reqwest::{Client, Response, RequestBuilder, cookie::Jar};
use std::time::Duration;
use std::sync::Arc;

pub const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_SECONDS: u64 = 20;

#[derive(Debug)] // Added Debug for better error messages potentially
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

    // ... (rest of the HttpClient impl)
} 