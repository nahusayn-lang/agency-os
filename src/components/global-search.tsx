"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, FileText, Users2, User, X } from "lucide-react";
import { globalSearchAction, type SearchResultItem } from "@/lib/search/actions";

const TYPE_ICON: Record<SearchResultItem["type"], typeof FileText> = {
  task: FileText,
  lead: Users2,
  user: User,
};

const TYPE_LABEL: Record<SearchResultItem["type"], string> = {
  task: "Task",
  lead: "Lead",
  user: "User",
};

// Shared search state/logic used by both the desktop bar and the
// mobile overlay, so the debounce + race-condition + error handling
// only needs to live in one place.
function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const router = useRouter();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      requestIdRef.current++; // invalidate any in-flight request
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const currentRequestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await globalSearchAction(trimmed);
        if (requestIdRef.current === currentRequestId) {
          setResults(data);
        }
      } catch (err) {
        if (requestIdRef.current === currentRequestId) {
          setResults([]);
          console.error("Global search failed:", err);
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const reset = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  const openResult = useCallback(
    (item: SearchResultItem) => {
      reset();
      router.push(item.href);
    },
    [router, reset]
  );

  return { query, setQuery, results, loading, reset, openResult };
}

function SearchResultsList({
  query,
  loading,
  results,
  onSelect,
}: {
  query: string;
  loading: boolean;
  results: SearchResultItem[];
  onSelect: (item: SearchResultItem) => void;
}) {
  if (query.trim().length < 2) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Type at least 2 characters to search.
      </div>
    );
  }
  if (!loading && results.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        No results for &quot;{query}&quot;.
      </div>
    );
  }
  return (
    <>
      {results.map((item) => {
        const Icon = TYPE_ICON[item.type];
        return (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => onSelect(item)}
            className="w-full flex items-start gap-2 p-2 rounded text-xs bg-popover hover:bg-accent/40 text-left transition-colors"
          >
            <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="font-semibold block truncate">{item.title}</span>
              {item.subtitle && (
                <span className="text-muted-foreground block truncate capitalize">
                  {item.subtitle}
                </span>
              )}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0 mt-0.5">
              {TYPE_LABEL[item.type]}
            </span>
          </button>
        );
      })}
    </>
  );
}

// Desktop: always-visible search bar in the header, dropdown results below.
export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const { query, setQuery, results, loading, openResult } = useGlobalSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      setIsOpen(false);
      openResult(item);
    },
    [openResult]
  );

  return (
    <div className="relative w-full max-w-xs" ref={containerRef}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-popover/60 px-2.5 h-9">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search tasks, leads, people..."
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
      </div>

      {isOpen && query.trim().length > 0 && (
        <div className="glass-card absolute left-0 right-0 mt-2 z-50 rounded-md p-2 shadow-md text-popover-foreground">
          <div className="max-h-80 overflow-y-auto space-y-1">
            <SearchResultsList query={query} loading={loading} results={results} onSelect={handleSelect} />
          </div>
        </div>
      )}
    </div>
  );
}

// Mobile: a plain icon button that opens a full-width overlay panel.
export function MobileGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const { query, setQuery, results, loading, reset, openResult } = useGlobalSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    reset();
  }, [reset]);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      setIsOpen(false);
      openResult(item);
    },
    [openResult]
  );

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open search"
        className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent/40 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-3 h-14 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, leads, people..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
            <button
              type="button"
              onClick={close}
              aria-label="Close search"
              className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent/40 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <SearchResultsList query={query} loading={loading} results={results} onSelect={handleSelect} />
          </div>
        </div>
      )}
    </div>
  );
}