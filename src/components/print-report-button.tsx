"use client";

export function PrintReportButton() {
  return (
    <button
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
      onClick={() => window.print()}
      type="button"
    >
      Print
    </button>
  );
}
