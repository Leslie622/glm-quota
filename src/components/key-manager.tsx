import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type StoredKey } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Eye, EyeOff, KeyRound, Plus, Trash2 } from "lucide-react";

function maskKey(key: string): string {
  if (key.length <= 8) return key.slice(0, 2) + "****";
  return key.slice(0, 6) + "****" + key.slice(-4);
}

export default function KeyManager({
  keys,
  onChange,
  onUseKey,
}: {
  keys: StoredKey[];
  onChange: (keys: StoredKey[]) => void;
  onUseKey: (key: string) => void;
}) {
  const [alias, setAlias] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const handleSave = async () => {
    try {
      const updated = await api.saveKey(alias.trim(), key.trim());
      onChange(updated);
      setAlias("");
      setKey("");
      toast.success("Key 已保存");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSelect = async (a: string) => {
    try {
      const updated = await api.selectKey(a);
      onChange(updated);
      toast.success(`已切换到 ${a}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDelete = async (a: string) => {
    try {
      const updated = await api.deleteKey(a);
      onChange(updated);
      toast.success(`已删除 ${a}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* 添加 Key：裸行，无卡片包裹 */}
      <div className="flex shrink-0 items-center gap-2 px-1">
        <KeyRound className="size-4 shrink-0 text-zinc-400" />
        <Input
          placeholder="别名"
          className="h-8 w-36 border-zinc-200 text-xs shadow-none"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && alias.trim() && key.trim() && handleSave()}
        />
        <Input
          placeholder="API Key"
          className="h-8 min-w-0 flex-1 border-zinc-200 font-mono text-xs shadow-none"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && alias.trim() && key.trim() && handleSave()}
        />
        <Button
          size="sm"
          className="h-8 shrink-0 bg-zinc-900 px-3 text-xs hover:bg-zinc-700"
          onClick={handleSave}
          disabled={!alias.trim() || !key.trim()}
        >
          <Plus className="size-3.5" /> 添加
        </Button>
      </div>

      {/* Key 列表：裸列表，铺满剩余高度 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-1 pb-2">
          <span className="text-[13px] font-semibold">已保存的 Key</span>
          <span className="text-[11px] text-zinc-400">
            {keys.length > 0 ? `${keys.length} 个 · 存于本机配置目录` : "点击「使用」切换当前查询用的 Key"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {keys.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 py-10 text-center">
              <KeyRound className="size-6 text-zinc-300" />
              <p className="text-xs text-zinc-400">还没有保存的 Key</p>
              <p className="text-[11px] text-zinc-300">在上方输入别名和 Key 后点「添加」</p>
            </div>
          ) : (
            <div className="space-y-1">
              {keys.map((k) => (
                <div
                  key={k.alias}
                  className={
                    k.selected
                      ? "flex items-center gap-2.5 rounded-lg border-l-2 border-l-indigo-500 bg-indigo-50/40 px-3 py-2"
                      : "flex items-center gap-2.5 rounded-lg border-l-2 border-l-transparent px-3 py-2 hover:bg-zinc-50"
                  }
                >
                  {k.selected ? (
                    <Check className="size-4 shrink-0 text-indigo-500" />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                  <span className="w-32 shrink-0 truncate text-[13px] font-medium">{k.alias}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-500">
                    {showKey[k.alias] ? k.key : maskKey(k.key)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-zinc-400 hover:text-zinc-600"
                    onClick={() => setShowKey((s) => ({ ...s, [k.alias]: !s[k.alias] }))}
                    title={showKey[k.alias] ? "隐藏" : "显示"}
                  >
                    {showKey[k.alias] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                  <Button
                    variant={k.selected ? "secondary" : "outline"}
                    size="sm"
                    disabled={k.selected}
                    className={
                      k.selected
                        ? "h-7 border-transparent bg-white px-3 text-xs text-indigo-600 shadow-none"
                        : "h-7 border-zinc-200 bg-white px-3 text-xs shadow-none hover:bg-zinc-50"
                    }
                    onClick={() => {
                      handleSelect(k.alias);
                      onUseKey(k.key);
                    }}
                  >
                    {k.selected ? "使用中" : "使用"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                    onClick={() => handleDelete(k.alias)}
                    title="删除"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
