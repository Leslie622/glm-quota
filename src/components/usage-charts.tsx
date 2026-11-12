import { Skeleton } from "@/components/ui/skeleton";
import type { UsageBundle } from "@/lib/api";
import { cn, fmtTokens } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";

interface Point {
  date: string;
  label: string;
  [model: string]: number | string;
}

// 模型配色：GLM-5.3 蓝，*Flash 淡蓝，其余按序取色
const MODEL_COLORS = ["#93c5fd", "#2563eb", "#38bdf8", "#a5b4fc", "#64748b"];
function modelColor(name: string, index: number): string {
  if (/flash/i.test(name)) return "#93c5fd"; // 淡蓝
  if (/5\.3|^glm-5|glm-4/i.test(name)) return "#2563eb"; // 蓝
  return MODEL_COLORS[(index + 2) % MODEL_COLORS.length];
}

export default function UsageCharts({
  data,
  loading,
  error,
}: {
  data: UsageBundle | null;
  loading: boolean;
  error: string | null;
}) {
  const seriesNames = useMemo(
    () => (data?.model?.modelDataList ?? []).map((s) => s.modelName ?? "").filter(Boolean),
    [data],
  );

  const points = useMemo<Point[]>(() => {
    const m = data?.model;
    const times = m?.x_time ?? [];
    const series = m?.modelDataList ?? [];
    return times.map((t, i) => {
      const p: Point = {
        date: t,
        label: t.length >= 16 ? t.slice(5, 16) : t.slice(5), // MM-DD [HH:00]
      };
      for (const s of series) {
        const name = s.modelName ?? "";
        p[name] = s.tokensUsage?.[i] ?? 0;
      }
      return p;
    });
  }, [data]);

  const total = data?.model?.totalUsage;
  const tools = data?.tool?.toolSummaryList ?? [];
  const models = total?.modelSummaryList ?? [];
  const sumTokens = models.reduce((acc, m) => acc + (m.totalTokens ?? 0), 0);

  // 有旧数据时保留画面只加透明度（切换范围不闪骨架）；真没数据才出骨架
  const hasData = points.length > 0 || models.length > 0;
  if (loading && !hasData) {
    return (
      <div className="flex h-full flex-col gap-2.5">
        <Skeleton className="min-h-0 flex-1 bg-zinc-200/60" />
        <Skeleton className="h-24 shrink-0 bg-zinc-200/60" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-[13px] font-medium text-red-700">用量查询失败</p>
        <p className="mt-0.5 text-xs text-red-600/80">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2.5 transition-opacity", loading && hasData && "pointer-events-none opacity-50")}>
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-baseline justify-between px-1 pb-2">
          <h2 className="text-[13px] font-semibold">每日用量</h2>
          <span className="text-[11px] text-zinc-400">
            {points.length > 0
              ? `${points[0].date.slice(0, 10)} ~ ${points[points.length - 1].date.slice(0, 10)}`
              : "无数据"}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-1">
          {points.length === 0 ? (
            <div className="flex min-h-32 flex-1 items-center justify-center text-xs text-zinc-400">
              该时间段没有用量数据
            </div>
          ) : (
            <div className="min-h-32 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={points}
                  margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid vertical={false} stroke="#f0f0f2" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#a1a1aa" }}
                    interval="preserveStartEnd"
                    axisLine={{ stroke: "#e4e4e7" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#a1a1aa" }}
                    tickFormatter={(v: number) => fmtTokens(v)}
                    width={50}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: 8,
                      fontSize: 11,
                      padding: "6px 10px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                    formatter={(value, name) => [fmtTokens(Number(value)), String(name)]}
                  />
                  {seriesNames.map((name, i) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="tokens"
                      fill={modelColor(name, i)}
                      maxBarSize={22}
                      radius={
                        i === seriesNames.length - 1 ? ([2, 2, 0, 0] as [number, number, number, number]) : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* 模型占比 + 工具计数：裸横幅，上分隔线 */}
      <section className="grid shrink-0 grid-cols-5 gap-4 border-t border-zinc-200 px-1 pt-3">
          {/* 模型分段条 + 图例 */}
          <div className="col-span-3">
            <div className="mb-1.5 text-[13px] font-semibold">模型用量占比</div>
            {models.length === 0 ? (
              <p className="py-3 text-xs text-zinc-400">无数据</p>
            ) : (
              <>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  {models.map((m, i) => (
                    <div
                      key={m.modelName}
                      style={{
                        width: `${((m.totalTokens ?? 0) / (sumTokens || 1)) * 100}%`,
                        backgroundColor: modelColor(m.modelName ?? "", i),
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {models.map((m, i) => (
                    <div key={m.modelName} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: modelColor(m.modelName ?? "", i) }}
                      />
                      <span className="text-zinc-500">{m.modelName}</span>
                      <span className="font-semibold tabular-nums text-zinc-800">
                        {fmtTokens(m.totalTokens)}
                      </span>
                      <span className="text-zinc-400">
                        {(((m.totalTokens ?? 0) / (sumTokens || 1)) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 工具计数 */}
          <div className="col-span-2 border-l pl-4">
            <div className="mb-1.5 text-[13px] font-semibold">工具 / MCP</div>
            {tools.length === 0 ? (
              <p className="py-3 text-xs text-zinc-400">该时段没有工具调用</p>
            ) : (
              <div className="space-y-1">
                {tools.map((t) => (
                  <div key={t.toolCode} className="flex justify-between text-[11px]">
                    <span className="text-zinc-500">{t.toolName}</span>
                    <span className="font-semibold tabular-nums text-zinc-800">
                      {t.totalUsageCount} 次
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* 总计 */}
            <div className="mt-2 flex gap-4 border-t pt-1.5 text-[11px] text-zinc-400">
              <span>
                总调用{" "}
                <span className="font-semibold tabular-nums text-zinc-700">
                  {(total?.totalModelCallCount ?? 0).toLocaleString("zh-CN")}
                </span>
              </span>
              <span>
                总 Token{" "}
                <span className="font-semibold tabular-nums text-zinc-700">
                  {fmtTokens(total?.totalTokensUsage)}
                </span>
              </span>
            </div>
          </div>
      </section>
    </div>
  );
}
