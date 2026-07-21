import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // reset if data shrinks
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paged = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, setPage, totalPages, paged, pageSize, total: items.length };
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function Pagination({
  page, totalPages, onChange, total, pageSize,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  total?: number;
  pageSize?: number;
}) {
  if (totalPages <= 1) {
    if (typeof total === "number" && typeof pageSize === "number" && total > 0) {
      return (
        <div className="flex items-center justify-end px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
          Showing {total} of {total}
        </div>
      );
    }
    return null;
  }
  const nums = pageNumbers(page, totalPages);
  const from = (page - 1) * (pageSize ?? 20) + 1;
  const to = Math.min(page * (pageSize ?? 20), total ?? page * (pageSize ?? 20));
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 gap-3 flex-wrap">
      <div className="text-xs text-slate-500">
        {typeof total === "number"
          ? <>Showing <span className="font-medium text-slate-700">{from}–{to}</span> of {total}</>
          : <>Page {page} of {totalPages}</>}
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" className="h-8 px-2"
          disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e-${i}`} className="px-2 text-slate-400 text-sm">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={cn(
                "min-w-8 h-8 px-2 rounded-md text-sm border",
                n === page
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              )}
            >
              {n}
            </button>
          )
        )}
        <Button size="sm" variant="outline" className="h-8 px-2"
          disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
