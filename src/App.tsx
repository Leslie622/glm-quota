import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Dashboard from "@/components/dashboard";
import UsageCharts from "@/components/usage-charts";
import KeyManager from "@/components/key-manager";
import { api, type QuotaData, type StoredKey, type UsageBundle } from "@/lib/api";
import { RefreshCw, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import UsageDateBar from "@/components/usage-date-bar";
import { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";

function App() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  // 总览页的迷你用量（独立天数，与用量明细页筛选完全独立）
  const [overviewDays, setOverviewDays] = useState(30);
  const [overviewUsage, setOverviewUsage] = useState<UsageBundle | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  // 用量明细页的数据与筛选状态
  const [usage, setUsage] = useState<UsageBundle | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageDays, setUsageDays] = useState(30);
  const [usageCustom, setUsageCustom] = useState<{ start: string; end: string } | null>(null);

  const selectedKey = keys.find((k) => k.selected);

  useEffect(() => {
    api.listKeys().then(setKeys).catch((e) => toast.error(String(e)));
  }, []);

  // quota 单独加载（key 切换/手动刷新时）
  const loadQuota = useCallback(async () => {
    if (!selectedKey) {
      setQuotaError("先到「Keys」添加一个 API Key，再回来查询");
      return;
    }
    setQuotaLoading(true);
    setQuotaError(null);
    try {
      setQuota(await api.fetchQuota(""));
    } catch (e) {
      setQuotaError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setQuotaLoading(false);
    }
  }, [selectedKey]);

  // usage 单独加载；keepData=true 时保留旧数据做局部刷新（不闪骨架）
  const loadUsage = useCallback(
    async (d: number, range?: { start: string; end: string } | null, keepData = false) => {
      if (!selectedKey) {
        setUsageError("先到「Keys」添加一个 API Key，再回来查询");
        return;
      }
      setUsageLoading(true);
      setUsageError(null);
      if (!keepData) setUsage(null); // 只有首次/换 key 才清空出骨架
      const req = range ? api.fetchUsageCustom("", range.start, range.end) : api.fetchUsage("", d);
      try {
        setUsage(await req);
      } catch (e) {
        setUsageError(String(e).replace(/^Error:\s*/, ""));
      } finally {
        setUsageLoading(false);
      }
    },
    [selectedKey],
  );

  // 总览页迷你用量加载（固定 30 天，静默，不出骨架——quota 卡片区不动）
  const loadOverviewUsage = useCallback(async (d = overviewDays, keepData = false) => {
    if (!selectedKey) return;
    setOverviewLoading(true);
    setOverviewError(null);
    if (!keepData) setOverviewUsage(null);
    try {
      setOverviewUsage(await api.fetchUsage("", d));
    } catch (e) {
      setOverviewError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedKey, overviewDays]);

  // 首次加载 & 选中 key 变化：全部拉取，筛选重置，usage 清空出骨架
  useEffect(() => {
    if (selectedKey) {
      loadQuota();
      setUsageDays(30);
      setUsageCustom(null);
      loadUsage(30, null);
      setOverviewDays(30);
      loadOverviewUsage(30, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey?.alias]);

  const changeDays = (d: number) => {
    setUsageDays(d);
    setUsageCustom(null);
    loadUsage(d, null, true); // 局部刷新，不闪骨架
  };

  const changeCustom = (start: string, end: string) => {
    setUsageCustom({ start, end });
    loadUsage(usageDays, { start, end }, true);
  };

  const refreshing = quotaLoading || usageLoading;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f7f8fa] text-zinc-900">
      <Toaster position="top-center" richColors />

      {/* 自定义标题栏：可拖拽移动窗口 */}
      <header
        data-tauri-drag-region
        className="flex h-9 shrink-0 select-none items-center justify-between border-b border-zinc-200/70 bg-white pl-4"
      >
        <div data-tauri-drag-region className="flex items-baseline gap-2.5">
          <h1 data-tauri-drag-region className="text-[13px] font-bold tracking-tight">
            GLM 套餐
          </h1>
          {selectedKey && (
            <span data-tauri-drag-region className="text-[11px] text-zinc-400">
              {selectedKey.alias} · {(quota?.level ?? "…").toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex h-full items-stretch">
          <button
            onClick={() => {
              loadQuota();
              loadUsage(usageDays, usageCustom ?? undefined, true);
              loadOverviewUsage(undefined, true);
            }}
            disabled={refreshing}
            title="刷新"
            className="flex w-11 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
          >
            <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
          </button>
          <button
            onClick={() => getCurrentWindow().minimize()}
            title="最小化"
            className="flex w-11 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={() => getCurrentWindow().toggleMaximize()}
            title="最大化/还原"
            className="flex w-11 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <Square className="size-3" />
          </button>
          <button
            onClick={() => getCurrentWindow().hide()}
            title="隐藏到托盘"
            className="flex w-11 items-center justify-center text-zinc-500 transition-colors hover:bg-red-500 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* 内容区：撑满剩余高度，自身滚动 */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex h-full flex-col gap-3 p-4">
          <Tabs defaultValue="dashboard" className="flex h-full min-h-0 flex-col">
            <TabsList className="h-8 bg-zinc-200/60 p-0.5">
              <TabsTrigger className="h-7 px-3 text-xs" value="dashboard">总览</TabsTrigger>
              <TabsTrigger className="h-7 px-3 text-xs" value="usage">用量明细</TabsTrigger>
              <TabsTrigger className="h-7 px-3 text-xs" value="keys">Keys</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="flex min-h-0 flex-1 flex-col pt-3">
              <Dashboard
                quota={quota}
                quotaLoading={quotaLoading}
                quotaError={quotaError}
                usage={overviewUsage}
                usageLoading={overviewLoading}
                usageError={overviewError}
                days={overviewDays}
                onChangeDays={(d) => {
                  setOverviewDays(d);
                  loadOverviewUsage(d, true); // 局部刷新不闪骨架
                }}
              />
            </TabsContent>

            <TabsContent value="usage" className="flex min-h-0 flex-1 flex-col gap-2 pt-3">
              <UsageDateBar
                days={usageDays}
                customRange={usageCustom}
                onChangeDays={changeDays}
                onChangeCustom={changeCustom}
              />
              <UsageCharts data={usage} loading={usageLoading} error={usageError} />
            </TabsContent>

            <TabsContent value="keys" className="flex min-h-0 flex-1 flex-col pt-3">
              <KeyManager
                keys={keys}
                onChange={(ks) => {
                  setKeys(ks);
                  // 选中项变化由 useEffect 自动处理
                }}
                onUseKey={() => {
                  loadQuota();
                  loadUsage(usageDays, usageCustom ?? undefined);
                  loadOverviewUsage(undefined, true);
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

export default App;
