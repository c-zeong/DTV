// This file makes the 'danmu' directory a module.

pub mod signature;
pub mod message_handler;
pub mod message_parsers;
pub mod websocket_connection;
pub mod web_fetcher;
pub mod gen;

// The old include for OUT_DIR is removed as build.rs now outputs to src/platforms/douyin/danmu/gen/
// The actual include will be in src/platforms/douyin/danmu/gen/mod.rs

// pub mod douyin { // This block is no longer needed here
//     include!(concat!(env!("OUT_DIR"), "/douyin.rs")); 
// }

// Re-export key structs/functions if needed, or define the public API of the danmu module.
// For now, we'll keep it simple and main.rs will qualify paths like danmu::websocket_connection::... 

pub use self::message_handler::*;
pub use self::signature::generate_douyin_ms_token;
pub use self::web_fetcher::fetch_douyin_room_info; 