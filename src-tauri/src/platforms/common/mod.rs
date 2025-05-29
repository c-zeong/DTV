pub mod http_client;
pub mod types;
pub mod types_rust;

// Re-export necessary types to make them available directly under platforms::common::TypeName
pub use types::GetStreamUrlPayload;
pub use types::LiveStreamInfo;
pub use types::PayloadWrapperForRoomId; 
pub use types::RoomIdDetail;          
pub use types::StreamUrlStore;         
pub use types::DouyinDanmakuState;   
pub use types::DouyuDanmakuState;    
// Add any other structs from types.rs that need to be accessible via common::StructName

// All struct definitions below this line were moved to types.rs and should be removed. 