import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getExpenseYearSummary, getMileageYearTotal, listExpenses, listMileageRecords } from "@/lib/repos/tax-expenses";
import { buildExpenseCsv, buildMileageCsv, buildTaxSummaryCsv } from "@/lib/tax-expenses/export";

/**
 * CSV export for Tax & Expenses — ?type=expenses|mileage|summary, optional
 * &taxYear=2026 (required for summary — it's always one year's totals,
 * never an all-years dump). Owner-scoped the same way as every list query
 * here (see src/lib/repos/tax-expenses.ts); a signed-out request never
 * gets a byte of data, and a signed-in user only ever sees their own
 * records — exports carry the exact same authorization as the rest of
 * this feature.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");
  const taxYearParam = request.nextUrl.searchParams.get("taxYear");
  const taxYear = taxYearParam && !Number.isNaN(Number(taxYearParam)) ? Number(taxYearParam) : undefined;
  const suffix = taxYear ? `-${taxYear}` : "";

  if (type === "mileage") {
    const records = await listMileageRecords(session.user.id, { taxYear });
    const csv = buildMileageCsv(records);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mileage${suffix}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (type === "summary") {
    if (!taxYear) {
      return new Response("Missing ?taxYear for a summary export.", { status: 400 });
    }
    const [summary, totalMiles] = await Promise.all([
      getExpenseYearSummary(session.user.id, taxYear),
      getMileageYearTotal(session.user.id, taxYear),
    ]);
    const csv = buildTaxSummaryCsv({ taxYear, totalMiles, ...summary });
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tax-summary-${taxYear}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (type === "expenses") {
    const expenses = await listExpenses(session.user.id, { taxYear });
    const csv = buildExpenseCsv(expenses);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="expenses${suffix}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new Response('Invalid export type. Use ?type=expenses, ?type=mileage, or ?type=summary.', { status: 400 });
}
