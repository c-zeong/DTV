pub mod douyin_streamer_list;
pub mod douyin_streamer_detail;
pub mod models;
pub mod utils;
pub mod douyin_danmu_listener;
pub mod danmu;
// pub mod parsers; // This line was causing an error, remove it if parsers.rs doesn't exist here

// Re-export the specific commands needed by main.rs
// This makes the path cleaner in main.rs (e.g., platforms::douyin::generate_douyin_ms_token)
pub use danmu::signature::generate_douyin_ms_token;
pub use douyin_streamer_list::fetch_douyin_partition_rooms;
pub use douyin_streamer_detail::get_douyin_live_stream_url;
pub use douyin_danmu_listener::start_douyin_danmu_listener;
pub use danmu::web_fetcher::fetch_douyin_room_info; 