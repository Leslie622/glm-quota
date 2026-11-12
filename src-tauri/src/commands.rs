//! Tauri 命令层：前端 invoke 的入口

use crate::api::{self, QuotaData, UsageBundle};
use crate::keys::{self, StoredKey};

#[tauri::command]
pub async fn fetch_quota(key: String) -> Result<QuotaData, String> {
    // 前端传空 key 时回退到本地选中的 key
    let key = resolve_key(key)?;
    api::fetch_quota(&key).await
}

#[tauri::command]
pub async fn fetch_usage(key: String, days: u32) -> Result<UsageBundle, String> {
    let key = resolve_key(key)?;
    api::fetch_usage(&key, days).await
}


#[tauri::command]
pub async fn fetch_usage_custom(
    key: String,
    start: String,
    end: String,
) -> Result<UsageBundle, String> {
    let key = resolve_key(key)?;
    let fmt = "%Y-%m-%d %H:%M:%S";
    let start_local = chrono::NaiveDateTime::parse_from_str(&format!("{start} 00:00:00"), fmt)
        .map_err(|_| "开始日期格式不对，应为 YYYY-MM-DD")?;
    let end_local = chrono::NaiveDateTime::parse_from_str(&format!("{end} 23:59:59"), fmt)
        .map_err(|_| "结束日期格式不对，应为 YYYY-MM-DD")?;
    use chrono::TimeZone;
    let start_t = start_local
        .and_local_timezone(chrono::Local)
        .single()
        .unwrap_or_else(|| chrono::Local.from_utc_datetime(&start_local));
    let end_t = end_local
        .and_local_timezone(chrono::Local)
        .single()
        .unwrap_or_else(|| chrono::Local.from_utc_datetime(&end_local));
    api::fetch_usage_range(&key, start_t, end_t).await
}

#[tauri::command]
pub fn list_keys() -> Result<Vec<StoredKey>, String> {
    keys::list_keys()
}

#[tauri::command]
pub fn save_key(alias: String, key: String) -> Result<Vec<StoredKey>, String> {
    keys::save_key(alias, key)
}

#[tauri::command]
pub fn delete_key(alias: String) -> Result<Vec<StoredKey>, String> {
    keys::delete_key(alias)
}

#[tauri::command]
pub fn select_key(alias: String) -> Result<Vec<StoredKey>, String> {
    keys::select_key(alias)
}

/// key 为空时使用本地选中的 key；都没有则报错提示
fn resolve_key(key: String) -> Result<String, String> {
    if !key.trim().is_empty() {
        return Ok(key.trim().to_string());
    }
    keys::selected_key()?.map(|k| k.key).ok_or_else(|| "请先在「Keys」里添加并选中一个 API Key".to_string())
}
