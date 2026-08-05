import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, Clock } from "lucide-react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import type { Language } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RECENT_KEY = "dubnex_recent_languages";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(code: string) {
  const next = [code, ...loadRecent().filter((c) => c !== code)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

type Props = {
  languages: Language[];
  value: string;
  onChange: (code: string) => void;
  label?: string;
};

export function LanguageSelect({
  languages,
  value,
  onChange,
  label = "Target language",
}: Props) {
  const listId = useId();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => languages.find((l) => l.code === value) || languages[0],
    [languages, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.localName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [languages, query]);

  const recentLangs = useMemo(
    () =>
      recent
        .map((code) => languages.find((l) => l.code === code))
        .filter(Boolean) as Language[],
    [recent, languages]
  );

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (code: string) => {
    onChange(code);
    setRecent(pushRecent(code));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative space-y-2">
      <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block">
        {label}
      </label>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-between rounded-xl px-3 font-normal"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 truncate text-sm">
          <span className="text-base leading-none" aria-hidden>
            {selected?.flag}
          </span>
          <span className="truncate text-zinc-900 dark:text-zinc-100">
            {selected?.name}
          </span>
          <span className="text-zinc-400 font-mono text-[10px]">
            {selected?.localName}
          </span>
        </span>
        <ChevronsUpDown className="size-4 opacity-50" />
      </Button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg"
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="p-2 border-b border-zinc-100 dark:border-zinc-900">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search languages…"
                  className="h-8 pl-8 text-xs"
                  aria-autocomplete="list"
                />
              </div>
            </div>

            {recentLangs.length > 0 && !query ? (
              <div className="px-2 pt-2">
                <p className="px-1.5 mb-1 text-[9px] font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                  <Clock className="size-3" /> Recent
                </p>
                <div className="flex flex-wrap gap-1 pb-2">
                  {recentLangs.map((l) => (
                    <button
                      key={`recent-${l.code}`}
                      type="button"
                      onClick={() => pick(l.code)}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <span aria-hidden>{l.flag}</span> {l.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <ul className="max-h-56 overflow-y-auto p-1">
              {filtered.map((l) => {
                const active = l.code === value;
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(l.code)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                        active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200"
                      )}
                    >
                      <span className="text-base" aria-hidden>
                        {l.flag}
                      </span>
                      <span className="flex-1 truncate font-medium">{l.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono truncate">
                        {l.localName}
                      </span>
                      {active ? <Check className="size-3.5 text-emerald-500" /> : null}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-zinc-400">
                  No languages match
                </li>
              ) : null}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
