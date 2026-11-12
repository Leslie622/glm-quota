//! 多 Key 管理：存储于 %APPDATA%/glm-quota/keys.json

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredKey {
    pub alias: String,
    pub key: String,
    /// 是否当前选中的 key
    pub selected: bool,
}

fn config_path() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or("无法定位配置目录")?
        .join("glm-quota");
    fs::create_dir_all(&dir).map_err(|e| format!("创建配置目录失败: {e}"))?;
    Ok(dir.join("keys.json"))
}

fn read_keys() -> Result<Vec<StoredKey>, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("配置解析失败: {e}"))
}

fn write_keys(keys: &[StoredKey]) -> Result<(), String> {
    let path = config_path()?;
    let raw = serde_json::to_string_pretty(keys).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&path, raw).map_err(|e| format!("写入配置失败: {e}"))
}

pub fn list_keys() -> Result<Vec<StoredKey>, String> {
    read_keys()
}

pub fn save_key(alias: String, key: String) -> Result<Vec<StoredKey>, String> {
    if alias.trim().is_empty() || key.trim().is_empty() {
        return Err("别名和 Key 都不能为空".into());
    }
    let mut keys = read_keys()?;
    if let Some(existing) = keys.iter_mut().find(|k| k.alias == alias) {
        existing.key = key.trim().to_string();
    } else {
        keys.push(StoredKey {
            alias,
            key: key.trim().to_string(),
            selected: false,
        });
    }
    write_keys(&keys)?;
    Ok(keys)
}

pub fn delete_key(alias: String) -> Result<Vec<StoredKey>, String> {
    let mut keys: Vec<StoredKey> = read_keys()?
        .into_iter()
        .filter(|k| k.alias != alias)
        .collect();
    // 若删除的是选中项，选中第一个
    if !keys.iter().any(|k| k.selected) {
        if let Some(first) = keys.first_mut() {
            first.selected = true;
        }
    }
    write_keys(&keys)?;
    Ok(keys)
}

pub fn select_key(alias: String) -> Result<Vec<StoredKey>, String> {
    let mut keys = read_keys()?;
    let mut found = false;
    for k in keys.iter_mut() {
        k.selected = k.alias == alias;
        if k.selected {
            found = true;
        }
    }
    if !found {
        return Err(format!("未找到别名 {alias}"));
    }
    write_keys(&keys)?;
    Ok(keys)
}

pub fn selected_key() -> Result<Option<StoredKey>, String> {
    Ok(read_keys()?.into_iter().find(|k| k.selected))
}
