import { invoke } from "@tauri-apps/api/core";

// ---------- 类型定义（与 src-tauri/src/api.rs 的结构体对应） ----------

export interface UsageDetail {
  modelCode?: string | null;
  usage?: number | null;
}

export interface QuotaWindow {
  type?: string | null; // TOKENS_LIMIT | TIME_LIMIT
  unit?: number | null; // 3=小时 5=月 6=周（实测）
  number?: number | null;
  usage?: number | null;
  currentValue?: number | null;
  remaining?: number | null;
  percentage?: number | null;
  nextResetTime?: number | null; // ms 时间戳
  usageDetails?: UsageDetail[] | null;
}

export interface QuotaData {
  level?: string | null;
  limits?: QuotaWindow[] | null;
}

export interface ModelSummary {
  modelName?: string | null;
  totalTokens?: number | null;
}

export interface ModelUsageTotal {
  totalModelCallCount?: number | null;
  totalTokensUsage?: number | null;
  modelSummaryList?: ModelSummary[] | null;
}

export interface ModelDataSeries {
  modelName?: string | null;
  tokensUsage?: number[] | null;
  totalTokens?: number | null;
}

export interface ModelUsageData {
  x_time?: string[] | null;
  modelCallCount?: number[] | null;
  tokensUsage?: number[] | null;
  totalUsage?: ModelUsageTotal | null;
  modelDataList?: ModelDataSeries[] | null;
}

export interface ToolSummary {
  toolCode?: string | null;
  toolName?: string | null;
  totalUsageCount?: number | null;
}

export interface ToolUsageData {
  totalUsage?: {
    totalNetworkSearchCount?: number | null;
    totalWebReadMcpCount?: number | null;
    totalZreadMcpCount?: number | null;
    totalSearchMcpCount?: number | null;
  } | null;
  toolSummaryList?: ToolSummary[] | null;
}

export interface UsageBundle {
  model?: ModelUsageData | null;
  tool?: ToolUsageData | null;
}

export interface StoredKey {
  alias: string;
  key: string;
  selected: boolean;
}

// ---------- invoke 封装 ----------

export const api = {
  fetchQuota: (key: string) => invoke<QuotaData>("fetch_quota", { key }),
  fetchUsage: (key: string, days: number) => invoke<UsageBundle>("fetch_usage", { key, days }),
  fetchUsageCustom: (key: string, start: string, end: string) =>
    invoke<UsageBundle>("fetch_usage_custom", { key, start, end }),
  listKeys: () => invoke<StoredKey[]>("list_keys"),
  saveKey: (alias: string, key: string) => invoke<StoredKey[]>("save_key", { alias, key }),
  deleteKey: (alias: string) => invoke<StoredKey[]>("delete_key", { alias }),
  selectKey: (alias: string) => invoke<StoredKey[]>("select_key", { alias }),
};

// ---------- 窗口标签工具 ----------

export function windowLabel(w: QuotaWindow): string {
  const unitName = { 3: "小时", 5: "月", 6: "周" }[w.unit ?? -1] ?? `unit${w.unit}`;
  const n = w.number ?? 1;
  if (w.type === "TOKENS_LIMIT") return `${n > 1 ? n : ""}${unitName}Token窗口`;
  if (w.type === "TIME_LIMIT") return `${n > 1 ? n : ""}${unitName}工具次数窗口`;
  return `${n}${unitName}窗口`;
}

export function fmtReset(ms?: number | null): string {
  if (!ms) return "-";
  const d = new Date(ms);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function countdown(ms?: number | null): string {
  if (!ms) return "-";
  let diff = Math.max(0, Math.floor((ms - Date.now()) / 1000));
  const d = Math.floor(diff / 86400);
  diff -= d * 86400;
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const m = Math.floor(diff / 60);
  const s = diff - m * 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return d > 0 ? `${d}天 ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}
