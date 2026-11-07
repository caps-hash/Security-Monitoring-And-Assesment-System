import { manilaDateKey } from "@/lib/attendance/policy";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { loadReportSnapshot } from "@/lib/reports/load";
import {
  EXPORT_LIMIT,
  buildReport,
  readReportFilters,
  toCsv,
  toExcelXml,
  toPdf,
} from "@/lib/reports/model";

export async function GET(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return new Response("HR access is required.", { status: 403 });
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const filters = readReportFilters(Object.fromEntries(url.searchParams.entries()), manilaDateKey(new Date()));
  let loaded;
  try {
    loaded = await loadReportSnapshot(filters);
  } catch {
    return new Response("The report could not be exported.", { status: 500 });
  }
  const table = buildReport(loaded.snapshot, filters);
  if (table.error) {
    return new Response(table.error, { status: 400 });
  }
  if (table.rows.length > EXPORT_LIMIT) {
    return new Response(`This export has more than ${EXPORT_LIMIT} rows. Narrow the filters and try again.`, {
      status: 413,
    });
  }
  const filename = `${filters.report}-report`;
  if (format === "csv") {
    return fileResponse(toCsv(table), `${filename}.csv`, "text/csv; charset=utf-8");
  }
  if (format === "xlsx") {
    return fileResponse(toExcelXml(table), `${filename}.xls`, "application/vnd.ms-excel; charset=utf-8");
  }
  if (format === "pdf") {
    return new Response(Buffer.from(toPdf(table)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response("Choose CSV, Excel, or PDF.", { status: 400 });
}

function fileResponse(body: string, filename: string, contentType: string) {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
