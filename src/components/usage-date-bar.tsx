import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";

function parseDate(s: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function DatePicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 justify-start gap-1.5 border-zinc-200 bg-white px-2.5 text-xs font-normal shadow-none hover:bg-zinc-50",
            !selected && "text-zinc-400",
          )}
        >
          <CalendarIcon className="size-3.5 text-zinc-400" />
          {selected ? format(selected, "yyyy-MM-dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          captionLayout="dropdown"
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function UsageDateBar({
  days,
  customRange,
  onChangeDays,
  onChangeCustom,
}: {
  days: number;
  customRange: { start: string; end: string } | null;
  onChangeDays: (d: number) => void;
  onChangeCustom: (start: string, end: string) => void;
}) {
  const [start, setStart] = useState(customRange?.start ?? "");
  const [end, setEnd] = useState(customRange?.end ?? "");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end;

  return (
    <div className="flex items-center gap-1.5">
      {[7, 30, 90].map((d) => (
        <Button
          key={d}
          variant={days === d && !customRange ? "default" : "outline"}
          size="sm"
          className={
            days === d && !customRange
              ? "h-7 bg-zinc-900 px-3 text-xs"
              : "h-7 border-zinc-200 bg-white px-3 text-xs shadow-none hover:bg-zinc-50"
          }
          onClick={() => onChangeDays(d)}
        >
          近 {d} 天
        </Button>
      ))}
      <div className="mx-1 h-4 w-px bg-zinc-200" />
      <DatePicker value={start} onChange={setStart} placeholder="开始日期" />
      <span className="text-xs text-zinc-400">至</span>
      <DatePicker value={end} onChange={setEnd} placeholder="结束日期" />
      <Button
        size="sm"
        disabled={!valid}
        className={
          customRange
            ? "h-7 bg-indigo-600 px-3 text-xs hover:bg-indigo-700"
            : "h-7 bg-zinc-900 px-3 text-xs hover:bg-zinc-700"
        }
        onClick={() => onChangeCustom(start, end)}
      >
        查询
      </Button>
      {customRange && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-zinc-400 hover:bg-transparent hover:text-zinc-600"
          onClick={() => onChangeDays(days)}
          title="清除自定义范围"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
