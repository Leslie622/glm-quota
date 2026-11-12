import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  type QuotaData,
  type QuotaWindow,
  type UsageBundle,
  countdown,
  fmtReset,
  windowLabel,
} from "@/lib/api";
import { fmtTokens } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ---------- 额度窗口行 ---------- */

function pctColor(pct?: number | null): string {
  if (pct == null) return "bg-zinc-300";
  if (pct >= 80) return "bg-red-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-emerald-500";
}

function WindowRow({ w, now }: { w: QuotaWindow; now: number }) {
  const isToken = w.type === "TOKENS_LIMIT";
  const pct = w.percentage ?? 0;
  const urgent = w.nextResetTime != null && w.nextResetTime - now < 3600_000;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {/* 窗口名 */}
      <div className="w-32 shrink-0">
        <div className="text-[13px] font-medium">{windowLabel(w)}</div>
        <div className="text-[11px] text-zinc-400">
          {urgent ? "即将重置" : `重置 ${fmtReset(w.nextResetTime)}`}
        </div>
      </div>
      {/* 进度条 */}
      <Progress value={pct} className="h-1.5 flex-1 bg-zinc-100" indicatorClassName={pctColor(pct)} />
      {/* 百分比 */}
      <div className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums">
        {pct}%
      </div>
      {/* 明细 */}
      <div className="w-44 shrink-0 text-right text-[11px] leading-4 text-zinc-500">
        {isToken ? (
          <>
            剩余 <span className="font-medium text-zinc-700">{100 - pct}%</span>
            <br />
            {countdown(w.nextResetTime)} 后重置
          </>
        ) : (
          <>
            已用 {fmtTokens(w.currentValue)} / {fmtTokens(w.usage)} 次
            <br />
            {(w.usageDetails ?? [])
              .filter((d) => (d.usage ?? 0) > 0)
              .map((d) => d.modelCode)
              .join("、") || "—"}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 主仪表盘 ---------- */

export default function Dashboard({
  quota,
  quotaLoading,
  quotaError,
  usage,
  usageLoading,
  usageError,
  days = 30,
  onChangeDays,
}: {
  quota: QuotaData | null;
  quotaLoading: boolean;
  quotaError: string | null;
  usage: UsageBundle | null;
  usageLoading: boolean;
  usageError: string | null;
  days?: number;
  onChangeDays?: (d: number) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (quotaLoading) {
    return (
      <div className="flex h-full flex-col gap-3">
        <Skeleton className="h-44 shrink-0 bg-zinc-100" />
        <Skeleton className="min-h-0 flex-1 bg-zinc-100" />
      </div>
    );
  }

  if (quotaError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-[13px] font-medium text-red-700">查询失败</p>
        <p className="mt-1 text-xs text-red-600/80">{quotaError}</p>
      </div>
    );
  }
  if (!quota) return null;

  const order = { 3: 0, 6: 1, 5: 2 } as Record<number, number>;
  const limits = [...(quota.limits ?? [])].sort(
    (a, b) => (order[a.unit ?? -1] ?? 9) - (order[b.unit ?? -1] ?? 9),
  );

  const model = usage?.model;
  const tools = usage?.tool?.toolSummaryList ?? [];
  const total = model?.totalUsage;
  const seriesNames = (model?.modelDataList ?? []).map((s) => s.modelName ?? "").filter(Boolean);
  const chartData = (model?.x_time ?? []).map((t, i) => {
    const p: Record<string, number | string> = { label: t.slice(5) };
    for (const s of model?.modelDataList ?? []) {
      p[s.modelName ?? ""] = s.tokensUsage?.[i] ?? 0;
    }
    return p;
  });

  // 与用量明细页同一套模型配色：5.3 蓝 / Flash 淡蓝
  function modelColor(name: string): string {
    if (/flash/i.test(name)) return "#93c5fd";
    return "#2563eb";
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* 额度窗口：一张白面板，行式列表 */}
      <section className="shrink-0 divide-y divide-zinc-100">
        {limits.map((w, i) => (
          <WindowRow key={i} w={w} now={now} />
        ))}
        {limits.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-zinc-400">这个 Key 没有额度窗口</div>
        )}
      </section>

      {/* 近 N 天用量 + 工具：裸分栏，中间竖分隔线 */}
      <section className="grid min-h-0 flex-1 grid-cols-3">
        <div className="col-span-2 flex min-h-0 flex-col pr-4">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[13px] font-semibold">近 {days} 天用量</h2>
              {onChangeDays && (
                <div className="flex gap-1">
                  {[7, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => onChangeDays(d)}
                      className={
                        days === d
                          ? "rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-white"
                          : "rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      }
                    >
                      {d}天
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <span>
                共 <span className="font-medium text-zinc-700">{(total?.totalModelCallCount ?? 0).toLocaleString("zh-CN")}</span> 次
              </span>
              <span>
                <span className="font-medium text-zinc-700">{fmtTokens(total?.totalTokensUsage)}</span> tokens
              </span>
            </div>
          </div>
          {usageLoading && !model ? (
            <div className="min-h-24 flex-1 rounded-lg bg-zinc-100" />
          ) : usageError && !model ? (
            <p className="py-8 text-center text-xs text-zinc-400">{usageError}</p>
          ) : (
            <div className="min-h-24 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "#a1a1aa" }}
                    interval="preserveStartEnd"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: 8,
                      fontSize: 11,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                    formatter={(v, name) => [fmtTokens(Number(v)), String(name)]}
                  />
                  {seriesNames.map((name, i) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="tokens"
                      fill={modelColor(name)}
                      maxBarSize={18}
                      radius={i === seriesNames.length - 1 ? ([2, 2, 0, 0] as [number, number, number, number]) : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* 模型分行 */}
          <div className="mt-2 flex gap-5 border-t pt-2">
            {(total?.modelSummaryList ?? []).map((m) => (
              <div key={m.modelName} className="text-[11px]">
                <span className="text-zinc-400">{m.modelName}</span>{" "}
                <span className="font-semibold tabular-nums text-zinc-800">
                  {fmtTokens(m.totalTokens)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 工具/MCP */}
        <div className="min-h-0 border-l border-zinc-200 pl-4">
          <h2 className="mb-2 text-[13px] font-semibold">工具调用</h2>
          {tools.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-400">近 {days} 天没有工具调用</p>
          ) : (
            <div className="space-y-2">
              {tools.map((t) => {
                const max = Math.max(...tools.map((x) => x.totalUsageCount ?? 0), 1);
                return (
                  <div key={t.toolCode}>
                    <div className="mb-0.5 flex justify-between text-[11px]">
                      <span className="text-zinc-500">{t.toolName}</span>
                      <span className="font-semibold tabular-nums">{t.totalUsageCount}</span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-100">
                      <div
                        className="h-1 rounded-full bg-zinc-700"
                        style={{ width: `${((t.totalUsageCount ?? 0) / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-[10px] text-zinc-400">按月窗口额度计费（见上方“月工具次数窗口”）</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
