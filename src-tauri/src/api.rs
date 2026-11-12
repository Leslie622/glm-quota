//! 智谱 open.bigmodel.cn 用量接口封装（控制台自用接口，Bearer API Key 认证）。
//!
//! 注意：接口无论成败 HTTP 均返回 200，错误码在 JSON body 的 code/success 字段里。

use chrono::{DateTime, Timelike};
use serde::{Deserialize, Serialize};

const BASE: &str = "https://open.bigmodel.cn/api/monitor/usage";
const TIMEOUT_SECS: u64 = 20;

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
        .build()
        .expect("failed to build http client")
}

/// 统一 GET 请求：成功返回 body 的 data 字段，业务失败返回 Err(中文提示)
async fn get_data(path: &str, query: Option<&[(&str, &str)]>, key: &str) -> Result<serde_json::Value, String> {
    let url = match query {
        Some(q) => format!("{BASE}{path}?{}", serde_urlencoded(q)),
        None => format!("{BASE}{path}"),
    };
    let resp = client()
        .get(&url)
        .header("Authorization", format!("Bearer {key}"))
        .header("Accept", "application/json")
        .header("Accept-Language", "en-US,en")
        .send()
        .await
        .map_err(|e| format!("网络错误: {e}"))?;

    let status = resp.status();
    let body: serde_json::Value = resp.json().await.map_err(|e| format!("响应解析失败: {e}"))?;

    if let Some(obj) = body.as_object() {
        let success = obj.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
        let code = obj.get("code").and_then(|v| v.as_i64()).unwrap_or(-1);
        let msg = obj
            .get("msg")
            .and_then(|v| v.as_str())
            .unwrap_or("未知错误")
            .to_string();
        if status.as_u16() == 200 && success && code == 200 {
            return Ok(obj.get("data").cloned().unwrap_or(serde_json::Value::Null));
        }
        // 常见错误翻译
        let hint = if code == 401 || msg.contains("令牌") || msg.contains("token") {
            "Key 无效或已过期，请检查后重试"
        } else {
            &msg
        };
        return Err(format!("{hint}（code={code}）"));
    }
    Err(format!("HTTP {status}: 响应格式异常"))
}

/// 极简 urlencode（参数只有日期时间，空格转 %20 即可）
fn serde_urlencoded(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", k, v.replace(' ', "%20").replace(':', "%3A")))
        .collect::<Vec<_>>()
        .join("&")
}

// ---------- quota/limit ----------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageDetail {
    #[serde(rename = "modelCode")]
    pub model_code: Option<String>,
    pub usage: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuotaWindow {
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub unit: Option<i64>,
    pub number: Option<i64>,
    pub usage: Option<f64>,
    #[serde(rename = "currentValue")]
    pub current_value: Option<f64>,
    pub remaining: Option<f64>,
    pub percentage: Option<f64>,
    #[serde(rename = "nextResetTime")]
    pub next_reset_time: Option<i64>,
    #[serde(rename = "usageDetails")]
    pub usage_details: Option<Vec<UsageDetail>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuotaData {
    pub level: Option<String>,
    pub limits: Option<Vec<QuotaWindow>>,
}

pub async fn fetch_quota(key: &str) -> Result<QuotaData, String> {
    let v = get_data("/quota/limit", None, key).await?;
    serde_json::from_value(v).map_err(|e| format!("额度数据解析失败: {e}"))
}

// ---------- model-usage / tool-usage ----------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelSummary {
    #[serde(rename = "modelName")]
    pub model_name: Option<String>,
    #[serde(rename = "totalTokens")]
    pub total_tokens: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelUsageTotal {
    #[serde(rename = "totalModelCallCount")]
    pub total_model_call_count: Option<f64>,
    #[serde(rename = "totalTokensUsage")]
    pub total_tokens_usage: Option<f64>,
    #[serde(rename = "modelSummaryList")]
    pub model_summary_list: Option<Vec<ModelSummary>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelDataSeries {
    #[serde(rename = "modelName")]
    pub model_name: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<i64>,
    #[serde(rename = "tokensUsage")]
    pub tokens_usage: Option<Vec<f64>>,
    #[serde(rename = "totalTokens")]
    pub total_tokens: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelUsageData {
    #[serde(rename = "x_time")]
    pub x_time: Option<Vec<String>>,
    #[serde(rename = "modelCallCount")]
    pub model_call_count: Option<Vec<f64>>,
    #[serde(rename = "tokensUsage")]
    pub tokens_usage: Option<Vec<f64>>,
    #[serde(rename = "totalUsage")]
    pub total_usage: Option<ModelUsageTotal>,
    #[serde(rename = "modelDataList")]
    pub model_data_list: Option<Vec<ModelDataSeries>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolSummary {
    #[serde(rename = "toolCode")]
    pub tool_code: Option<String>,
    #[serde(rename = "toolName")]
    pub tool_name: Option<String>,
    #[serde(rename = "totalUsageCount")]
    pub total_usage_count: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolUsageData {
    #[serde(rename = "totalUsage")]
    pub total_usage: Option<ToolUsageTotal>,
    #[serde(rename = "toolSummaryList")]
    pub tool_summary_list: Option<Vec<ToolSummary>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolUsageTotal {
    #[serde(rename = "totalNetworkSearchCount")]
    pub total_network_search_count: Option<f64>,
    #[serde(rename = "totalWebReadMcpCount")]
    pub total_web_read_mcp_count: Option<f64>,
    #[serde(rename = "totalZreadMcpCount")]
    pub total_zread_mcp_count: Option<f64>,
    #[serde(rename = "totalSearchMcpCount")]
    pub total_search_mcp_count: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageBundle {
    pub model: Option<ModelUsageData>,
    pub tool: Option<ToolUsageData>,
}

/// 单次请求：拉取一段 ≤31 天的 model+tool 用量
async fn fetch_usage_once(
    key: &str,
    path: &str,
    start: chrono::DateTime<chrono::Local>,
    end: chrono::DateTime<chrono::Local>,
) -> Result<serde_json::Value, String> {
    let start_s = start.format("%Y-%m-%d %H:00:00").to_string();
    let end_s = end.format("%Y-%m-%d %H:59:59").to_string();
    let q = [("startTime", start_s.as_str()), ("endTime", end_s.as_str())];
    get_data(path, Some(&q), key).await
}

/// 把时间点归一成日期键 "YYYY-MM-DD"（兼容 "YYYY-MM-DD HH:00" 小时点和纯日期点）
fn day_key(t: &str) -> String {
    t.split(' ').next().unwrap_or(t).to_string()
}

/// 合并多段 model-usage 结果：统一聚合到“按天”粒度，累加计数，重算 totals。
/// 接口对短跨度返回 hourly、长跨度返回 daily，这里一律折叠成天，保证前端只看到天。
fn merge_model_chunks(chunks: &[serde_json::Value]) -> ModelUsageData {
    // 日期键 -> (天序号按插入序, 调用, token)
    let mut day_index: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut days: Vec<String> = Vec::new();
    let mut calls: Vec<f64> = Vec::new();
    let mut tokens: Vec<f64> = Vec::new();
    let mut total_calls = 0f64;
    let mut total_tokens = 0f64;
    // 按模型累加 token 汇总 + 分模型按天序列
    let mut per_model: std::collections::BTreeMap<String, f64> = std::collections::BTreeMap::new();
    let mut series_order: Vec<String> = Vec::new();
    let mut series_data: std::collections::BTreeMap<String, Vec<f64>> = std::collections::BTreeMap::new();

    // day -> model -> token（先聚合，再展开成序列）
    let mut per_day_model: std::collections::BTreeMap<String, std::collections::BTreeMap<String, f64>> =
        std::collections::BTreeMap::new();

    for c in chunks {
        let Ok(v) = serde_json::from_value::<ModelUsageData>(c.clone()) else {
            continue;
        };
        if let Some(times) = &v.x_time {
            let calls_list = v.model_call_count.clone().unwrap_or_default();
            let tokens_list = v.tokens_usage.clone().unwrap_or_default();
            for (i, t) in times.iter().enumerate() {
                let key = day_key(t);
                let idx = match day_index.get(&key) {
                    Some(&ix) => ix,
                    None => {
                        let ix = days.len();
                        day_index.insert(key.clone(), ix);
                        days.push(key.clone());
                        calls.push(0.0);
                        tokens.push(0.0);
                        ix
                    }
                };
                calls[idx] += calls_list.get(i).copied().unwrap_or(0.0);
                tokens[idx] += tokens_list.get(i).copied().unwrap_or(0.0);
            }
        }
        if let Some(tu) = v.total_usage {
            total_calls += tu.total_model_call_count.unwrap_or(0.0);
            total_tokens += tu.total_tokens_usage.unwrap_or(0.0);
            for m in tu.model_summary_list.unwrap_or_default() {
                let e = per_model
                    .entry(m.model_name.unwrap_or_default())
                    .or_insert(0.0);
                *e += m.total_tokens.unwrap_or(0.0);
            }
        }
        // 分模型序列（hourly 或 daily）按天折叠
        if let Some(list) = &v.model_data_list {
            for s in list {
                let name = s.model_name.clone().unwrap_or_default();
                if !series_data.contains_key(&name) {
                    series_order.push(name.clone());
                    series_data.insert(name.clone(), Vec::new());
                }
                let _ = &s;
                let _ = &series_data;
                let times = v.x_time.clone().unwrap_or_default();
                for (i, t) in times.iter().enumerate() {
                    let key = day_key(t);
                    let val = s.tokens_usage.clone().unwrap_or_default().get(i).copied().unwrap_or(0.0);
                    let e = per_day_model
                        .entry(key)
                        .or_default()
                        .entry(name.clone())
                        .or_insert(0.0);
                    *e += val;
                }
            }
        }
    }

    // 把 per_day_model 展开成与 days 对齐的序列
    let axis_len = days.len();
    let model_data_list = series_order
        .iter()
        .map(|name| {
            let seq = days
                .iter()
                .map(|d| {
                    per_day_model
                        .get(d)
                        .and_then(|m| m.get(name))
                        .copied()
                        .unwrap_or(0.0)
                })
                .collect::<Vec<_>>();
            ModelDataSeries {
                model_name: Some(name.clone()),
                sort_order: None,
                tokens_usage: Some(seq),
                total_tokens: per_model.get(name).copied(),
            }
        })
        .collect::<Vec<_>>();

    let _ = axis_len;

    let model_summary_list = per_model
        .into_iter()
        .map(|(name, tokens)| ModelSummary {
            model_name: Some(name),
            total_tokens: Some(tokens),
        })
        .collect::<Vec<_>>();

    ModelUsageData {
        x_time: Some(days),
        model_call_count: Some(calls),
        tokens_usage: Some(tokens),
        total_usage: Some(ModelUsageTotal {
            total_model_call_count: Some(total_calls),
            total_tokens_usage: Some(total_tokens),
            model_summary_list: Some(model_summary_list),
        }),
        model_data_list: Some(model_data_list),
    }
}

/// 合并多段 tool-usage 结果
fn merge_tool_chunks(chunks: &[serde_json::Value]) -> ToolUsageData {
    let mut total_search = 0f64;
    let mut total_web = 0f64;
    let mut total_zread = 0f64;
    let mut per_tool: std::collections::BTreeMap<String, (String, f64)> =
        std::collections::BTreeMap::new();

    for c in chunks {
        let Ok(v) = serde_json::from_value::<ToolUsageData>(c.clone()) else {
            continue;
        };
        if let Some(tu) = v.total_usage {
            total_search += tu.total_network_search_count.unwrap_or(0.0);
            total_web += tu.total_web_read_mcp_count.unwrap_or(0.0);
            total_zread += tu.total_zread_mcp_count.unwrap_or(0.0);
        }
        for t in v.tool_summary_list.unwrap_or_default() {
            let e = per_tool
                .entry(t.tool_code.unwrap_or_default())
                .or_insert_with(|| (t.tool_name.clone().unwrap_or_default(), 0.0));
            e.1 += t.total_usage_count.unwrap_or(0.0);
        }
    }

    let tool_summary_list = per_tool
        .into_iter()
        .map(|(code, (name, count))| ToolSummary {
            tool_code: Some(code),
            tool_name: Some(name),
            total_usage_count: Some(count),
        })
        .collect::<Vec<_>>();

    ToolUsageData {
        total_usage: Some(ToolUsageTotal {
            total_network_search_count: Some(total_search),
            total_web_read_mcp_count: Some(total_web),
            total_zread_mcp_count: Some(total_zread),
            total_search_mcp_count: Some(total_search + total_web + total_zread),
        }),
        tool_summary_list: Some(tool_summary_list),
    }
}

/// 任意起止日期；跨度 >31 天自动分片（接口硬限制），并发拉取后合并
pub async fn fetch_usage_range(
    key: &str,
    start: chrono::DateTime<chrono::Local>,
    end: chrono::DateTime<chrono::Local>,
) -> Result<UsageBundle, String> {
    use futures::future::join_all;

    if end < start {
        return Err("结束时间早于开始时间".into());
    }
    const MAX_CHUNK: chrono::Duration = chrono::Duration::days(31);

    // 生成分片区间
    let mut ranges = Vec::new();
    let mut cursor = start;
    loop {
        let chunk_end = (cursor + MAX_CHUNK).min(end);
        ranges.push((cursor, chunk_end));
        if chunk_end >= end {
            break;
        }
        cursor = chunk_end + chrono::Duration::days(1);
    }

    // 并发拉取（path 两个接口 × 各分片）
    let mut model_futs = Vec::new();
    let mut tool_futs = Vec::new();
    for (s, e) in &ranges {
        model_futs.push(fetch_usage_once(key, "/model-usage", *s, *e));
        tool_futs.push(fetch_usage_once(key, "/tool-usage", *s, *e));
    }
    let (model_res, tool_res) = (join_all(model_futs).await, join_all(tool_futs).await);

    let mut model_chunks = Vec::new();
    for r in model_res {
        model_chunks.push(r?);
    }
    let mut tool_chunks = Vec::new();
    for r in tool_res {
        tool_chunks.push(r?);
    }

    Ok(UsageBundle {
        model: Some(merge_model_chunks(&model_chunks)),
        tool: Some(merge_tool_chunks(&tool_chunks)),
    })
}

/// 兼容旧接口：按天数查到现在
pub async fn fetch_usage(key: &str, days: u32) -> Result<UsageBundle, String> {
    let end = chrono::Local::now();
    let start = end - chrono::Duration::days(days as i64);
    fetch_usage_range(key, start, end).await
}

/// 供前端展示用的辅助：把天数字段留在调用侧计算，这里仅做时间格式化兜底
#[allow(dead_code)]
pub fn hour_of(ts: i64) -> u32 {
    DateTime::from_timestamp_millis(ts).map(|d| d.hour()).unwrap_or(0)
}
