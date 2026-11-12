import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type QuotaData,
  type QuotaWindow,
  countdown,
  fmtReset,
  windowLabel,
} from "@/lib/api";
import { fmtTokens } from "@/lib/utils";
import { useEffect, useState } from "react";

function pctColor(pct?: number | null): string {
  if (pct == null) return "";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function WindowCard({ w, now }: { w: QuotaWindow; now: number }) {
  const label = windowLabel(w);
  const isToken = w.type === "TOKENS_LIMIT";
  const pct = w.percentage ?? 0;

  return (
    <Card className="bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="px-4 pb-1 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
          <Badge variant={pct >= 90 ? "danger" : pct >= 70 ? "warning" : "success"}>
            {pct}%
          </Badge>
        </div>
        {isToken ? (
          <div className="text-xl font-bold tabular-nums">{pct}%<span className="ml-1 text-sm font-normal text-muted-foreground">已用</span></div>
        ) : (
          <div className="text-xl font-bold tabular-nums">
            {fmtTokens(w.currentValue)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ {fmtTokens(w.usage)} 次</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-3">
        <Progress value={pct} indicatorClassName={pctColor(pct)} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>重置 {fmtReset(w.nextResetTime)}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
            {w.nextResetTime && w.nextResetTime > now ? countdown(w.nextResetTime) : "已重置"}
          </span>
        </div>
        {!isToken && w.usageDetails && w.usageDetails.some((d) => (d.usage ?? 0) > 0) && (
          <div className="space-y-1 border-t pt-2">
            {w.usageDetails
              .filter((d) => (d.usage ?? 0) > 0)
              .map((d) => (
                <div key={d.modelCode} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{d.modelCode}</span>
                  <span className="font-mono">{d.usage} 次</span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function QuotaCards({
  data,
  loading,
  error,
}: {
  data: QuotaData | null;
  loading: boolean;
  error: string | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">查询失败</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) return null;

  const level = (data.level ?? "-").toUpperCase();
  const limits = data.limits ?? [];
  // 排序：5小时窗 → 周窗 → 月窗
  const order = { 3: 0, 6: 1, 5: 2 } as Record<number, number>;
  const sorted = [...limits].sort((a, b) => (order[a.unit ?? -1] ?? 9) - (order[b.unit ?? -1] ?? 9));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">套餐档位</span>
        <Badge className="bg-gradient-to-r from-indigo-500 to-sky-400 text-white shadow-sm">
          {level}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {sorted.map((w, i) => (
          <WindowCard key={i} w={w} now={now} />
        ))}
      </div>
    </div>
  );
}
