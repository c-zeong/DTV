use md5::Digest;
use quick_js::{Context, JsValue};
use regex::Regex;
use std::time::{SystemTime, UNIX_EPOCH};
use isahc::{prelude::*, HttpClient, Request, http};
use isahc::config::{RedirectPolicy, Configurable};
use percent_encoding::{percent_encode, NON_ALPHANUMERIC};

struct DouYu {
    did: String,
    rid: String,
    client: HttpClient,
}

impl DouYu {
    async fn new(rid: &str) -> Result<Self, Box<dyn std::error::Error>> {
        println!("Creating new DouYu instance for room {}", rid);
        let client = HttpClient::builder()
            .redirect_policy(RedirectPolicy::Follow)
            .default_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()?;

        Ok(Self {
            did: "10000000000000000000000000001501".to_string(),
            rid: rid.to_string(),
            client,
        })
    }

    fn md5(data: &str) -> String {
        let mut hasher = md5::Md5::new();
        hasher.update(data.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    async fn get_pc_js(&self, cdn: &str, rate: i32) -> Result<String, Box<dyn std::error::Error>> {
        println!("Fetching webpage for room {}", self.rid);
        // 获取PC网页内容
        let request = Request::builder()
            .method(http::Method::GET)
            .uri(&format!("https://www.douyu.com/{}", self.rid))
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8")
            .header("Accept-Language", "zh-CN,zh;q=0.9")
            .header("Connection", "keep-alive")
            .body(())?;

        let text = self.client.send(request)?
            .text()?;

        println!("Extracting JS function from webpage");
        // 提取JS函数
        let re = Regex::new(r"(vdwdae325w_64we[\s\S]*function ub98484234[\s\S]*?)function")?;
        let result = re.captures(&text)
            .ok_or("Cannot find js function")?
            .get(1)
            .ok_or("No capture group")?
            .as_str();

        let re_eval = Regex::new(r"eval.*?;\}")?;
        let func_ub9 = re_eval.replace_all(result, "strc;}");

        println!("Executing JS to get parameters");
        // 执行JS获取参数
        let context = Context::new()?;
        context.eval(&func_ub9)?;
        let js_result = context.eval("ub98484234()")?;
        let res = match js_result {
            JsValue::String(s) => s,
            _ => return Err("JavaScript didn't return a string".into())
        };

        println!("Extracting v parameter");
        // 提取v参数
        let re = Regex::new(r"v=(\d+)")?;
        let v = re.captures(&res)
            .ok_or("v parameter not found")?
            .get(1)
            .ok_or("No capture group")?
            .as_str();

        let t10 = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs()
            .to_string();

        let rb = Self::md5(&format!("{}{}{}{}", self.rid, self.did, &t10, v));

        println!("Building sign function");
        // 构造签名函数
        let mut func_sign = res.replace("return rt;})", "return rt;}");
        func_sign = func_sign.replace("(function (", "function sign(");
        func_sign = func_sign.replace("CryptoJS.MD5(cb).toString()", &format!("\"{}\"", rb));

        context.eval(&func_sign)?;
        let sign_call = format!(
            "sign(\"{}\", \"{}\", \"{}\");",
            self.rid, self.did, t10
        );
        let js_params = context.eval(&sign_call)?;
        let mut params = match js_params {
            JsValue::String(s) => s,
            _ => return Err("JavaScript didn't return a string".into())
        };

        params.push_str(&format!("&cdn={}&rate={}", cdn, rate));

        println!("Fetching stream URL for room {}", self.rid);
        // 获取真实URL
        let url = format!("https://www.douyu.com/lapi/live/getH5Play/{}", self.rid);
        let request = Request::builder()
            .method(http::Method::POST)
            .uri(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Origin", "https://www.douyu.com")
            .header("Referer", format!("https://www.douyu.com/{}", self.rid))
            .body(params)?;

        let mut response = self.client.send(request)?;
        println!("API response status: {}", response.status());
        
        let json: serde_json::Value = response.json()?;

        let data = json["data"].as_object().ok_or("No data field in response")?;
        let rtmp_url = data["rtmp_url"].as_str().ok_or("No rtmp_url field")?;
        let rtmp_live = data["rtmp_live"].as_str().ok_or("No rtmp_live field")?;

        let final_url = format!("{}/{}", rtmp_url, rtmp_live);
        println!("Successfully got stream URL for room {}", self.rid);
        
        Ok(final_url)
    }

    pub async fn get_real_url(&self) -> Result<String, Box<dyn std::error::Error>> {
        self.get_pc_js("ws-h5", 0).await
    }
}

pub async fn get_stream_url(room_id: &str) -> Result<String, Box<dyn std::error::Error>> {
    println!("Starting to fetch stream URL for room {}", room_id);
    let douyu = DouYu::new(room_id).await?;
    let url = douyu.get_real_url().await?;
    Ok(url)  // 直接返回实际的流地址
}

// 添加搜索主播的函数
pub async fn search_anchor(keyword: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = HttpClient::builder()
        .redirect_policy(RedirectPolicy::Follow)
        .default_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36")
        .build()?;

    let mut hasher = md5::Md5::new();
    hasher.update(SystemTime::now()
        .duration_since(UNIX_EPOCH)?
        .as_nanos()
        .to_string());
    let did = format!("{:x}", hasher.finalize());

    let url = format!(
        "https://www.douyu.com/japi/search/api/searchUser?kw={}&page=1&pageSize=20&filterType=0",
        percent_encode(keyword.as_bytes(), NON_ALPHANUMERIC)
    );

    let request = Request::builder()
        .method(http::Method::GET)
        .uri(url)
        .header("Referer", "https://www.douyu.com/search/")
        .header("Cookie", format!("dy_did={}; acf_did={}", did, did))
        .body(())?;

    let mut response = client.send(request)?;
    let text = response.text()?;
    
    Ok(text)
} 