use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use reqwest;
use futures_util::StreamExt;
use tauri::async_runtime::Mutex;

pub struct ProxyServer {
    client: reqwest::Client,
    port: u16,
    current_stream: Arc<Mutex<Option<String>>>,
}

impl ProxyServer {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap();
            
        ProxyServer {
            client,
            port: 7433,
            current_stream: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn set_stream(&self, url: String) {
        let mut stream = self.current_stream.lock().await;
        *stream = Some(url);
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let addr = format!("127.0.0.1:{}", self.port);
        let listener = TcpListener::bind(&addr).await?;
        println!("Proxy server listening on http://{}/live.flv", addr);

        loop {
            let (mut stream, addr) = listener.accept().await?;
            println!("New connection from: {}", addr);
            let client = self.client.clone();
            let current_stream = self.current_stream.clone();

            tokio::spawn(async move {
                let mut buffer = [0; 1024];
                match stream.read(&mut buffer).await {
                    Ok(n) => {
                        let request = String::from_utf8_lossy(&buffer[..n]);
                        if !request.contains("GET /live.flv") {
                            let not_found = "HTTP/1.1 404 Not Found\r\n\r\nNot Found";
                            let _ = stream.write_all(not_found.as_bytes()).await;
                            return;
                        }

                        let stream_url = {
                            let guard = current_stream.lock().await;
                            match &*guard {
                                Some(url) => url.clone(),
                                None => {
                                    let err = "HTTP/1.1 503 Service Unavailable\r\n\r\nNo stream URL set";
                                    let _ = stream.write_all(err.as_bytes()).await;
                                    return;
                                }
                            }
                        };

                        println!("Fetching stream from: {}", stream_url);
                        match client.get(&stream_url)
                            .header("Referer", "https://www.example.com")
                            .header("Origin", "https://www.example.com")
                            .header("Accept", "*/*")
                            .header("Accept-Encoding", "identity")
                            .send()
                            .await 
                        {
                            Ok(response) => {
                                println!("Source response status: {}", response.status());

                                let response_header = "\
                                    HTTP/1.1 200 OK\r\n\
                                    Content-Type: video/x-flv\r\n\
                                    Connection: keep-alive\r\n\
                                    Access-Control-Allow-Origin: *\r\n\
                                    Access-Control-Allow-Methods: GET, OPTIONS\r\n\
                                    Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept\r\n\
                                    Cache-Control: no-cache\r\n\
                                    \r\n";

                                if let Err(e) = stream.write_all(response_header.as_bytes()).await {
                                    eprintln!("Failed to write headers: {}", e);
                                    return;
                                }

                                let mut first_bytes = Vec::new();
                                let mut stream_bytes = response.bytes_stream();
                                if let Some(Ok(chunk)) = stream_bytes.next().await {
                                    first_bytes.extend_from_slice(&chunk);
                                }

                                if first_bytes.len() >= 3 && &first_bytes[0..3] != b"FLV" {
                                    println!("Adding FLV header");
                                    if let Err(e) = stream.write_all(b"FLV\x01\x05\x00\x00\x00\x09\x00\x00\x00\x00").await {
                                        eprintln!("Failed to write FLV header: {}", e);
                                        return;
                                    }
                                }

                                if let Err(e) = stream.write_all(&first_bytes).await {
                                    eprintln!("Failed to write first bytes: {}", e);
                                    return;
                                }

                                if let Err(e) = stream.flush().await {
                                    eprintln!("Failed to flush: {}", e);
                                    return;
                                }

                                let mut total_bytes = first_bytes.len();
                                let start_time = std::time::Instant::now();
                                
                                while let Some(chunk_result) = stream_bytes.next().await {
                                    match chunk_result {
                                        Ok(chunk) => {
                                            total_bytes += chunk.len();
                                            match stream.write_all(&chunk).await {
                                                Ok(_) => {
                                                    if let Err(e) = stream.flush().await {
                                                        eprintln!("Error flushing: {}", e);
                                                        break;
                                                    }
                                                    if total_bytes % (1024 * 1024) == 0 {
                                                        let elapsed = start_time.elapsed().as_secs_f64();
                                                        let rate = total_bytes as f64 / elapsed / 1024.0;
                                                        println!("Transfer rate: {:.2} KB/s", rate);
                                                    }
                                                }
                                                Err(e) => {
                                                    if e.kind() == std::io::ErrorKind::BrokenPipe {
                                                        println!("Client disconnected");
                                                    } else {
                                                        eprintln!("Error writing: {}", e);
                                                    }
                                                    break;
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("Error reading from source: {}", e);
                                            break;
                                        }
                                    }
                                }
                                println!("Stream ended. Total bytes: {}", total_bytes);
                            }
                            Err(e) => eprintln!("Error connecting to stream: {}", e),
                        }
                    }
                    Err(e) => eprintln!("Error reading request: {}", e),
                }
            });
        }
    }

    pub fn get_proxy_url(&self) -> String {
        format!("http://127.0.0.1:{}/live.flv", self.port)
    }
} 