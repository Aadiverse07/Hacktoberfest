import { invoiceStatus, invoiceTotal } from '@/lib/data/calc';
import type { AssistantRepository } from '@/lib/data/assistant-repository';
import { parsePeriod, type Workspace } from './engine';
import { evaluateAlerts } from '@/lib/alerts/engine';
import { extractFigures } from './validator';

export type BuiltAssistantContext = { contextText: string; contextRefs: string[]; allowedFigures: Set<string> };
const money = (n: number) => `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';

/** Builds a relevant, capped view from existing repository methods and domain records. */
export async function buildAssistantContext(repository: AssistantRepository, workspace: Workspace, question: string, now = new Date().toISOString().slice(0, 10)): Promise<BuiltAssistantContext> {
  const q = question.toLowerCase();
  const parsedPeriod = parsePeriod(question, now);
  const fallback = `${now.slice(0, 4)}-${now.slice(5, 7)}`;
  const patternQuestion = /\b(pattern|trend|over time|compare|save money|manage it|ways to)\b/i.test(question);
  let period = parsedPeriod ?? { kind: 'month' as const, from: `${fallback}-01`, to: `${fallback}-${String(new Date(Date.UTC(Number(fallback.slice(0, 4)), Number(fallback.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`, label: fallback, explicit: false };
  if (!parsedPeriod && patternQuestion) {
    for (let offset = 0; offset <= 24; offset += 1) {
      const date = new Date(Date.UTC(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1 - offset, 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const candidate = { kind: 'month' as const, from: `${key}-01`, to: `${key}-${String(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()).padStart(2, '0')}`, label: key, explicit: false };
      const summary = await repository.getPeriodSummary(candidate);
      period = candidate;
      if (summary.totalExpenses !== 0 || offset === 24) break;
    }
  }
  const periodKey = period.kind === 'all' ? 'all' : period.from?.slice(0, 7) ?? fallback;
  const from = period.from;
  const to = period.to;
  const lines: string[] = [];
  const refs: string[] = [];
  const wantsPeriod = /\b(total|summary|spend|spent|expense|income|revenue|profit|loss|financial|cash|balance|period|month|quarter|year)\b/.test(q);
  const wantsCategory = /categor|breakdown|expense|spend|spent|cost|where/.test(q);
  const wantsMerchant = /merchant|vendor|supplier|paid to|spent with/.test(q);
  const wantsInvoice = /invoice|overdue|unpaid|pending|receivable|due/.test(q);
  const wantsAlert = /alert|insight|risk|attention|act on|recommend/.test(q);
  const generic = !wantsPeriod && !wantsCategory && !wantsMerchant && !wantsInvoice && !wantsAlert;
  if (wantsPeriod || generic) {
    const summary = await repository.getPeriodSummary(period);
    lines.push(`Period ${period.label}: income ${money(summary.totalIncome)}; expenses ${money(summary.totalExpenses)}; net profit ${money(summary.netProfit)}; margin ${summary.margin.toFixed(1)}%.`);
    refs.push(`period:${periodKey}`);
  }
  if (wantsCategory || generic) {
    const categories = await repository.getCategorySummary(period);
    const top = categories.sort((a, b) => b.amount - a.amount).slice(0, 6);
    if (top.length) {
      lines.push(`Expense categories for ${periodKey}: ${top.map(({ account, amount }) => `${account.name} ${money(amount)}`).join('; ')}.`);
      refs.push(...top.map(({ account }) => `category:${slug(account.name)}`));
    }
  }
  if (patternQuestion) {
    const anchor = period.from ?? now;
    const anchorDate = new Date(`${anchor.slice(0, 7)}-01T00:00:00Z`);
    const monthly: string[] = [];
    for (let offset = 2; offset >= 0; offset -= 1) {
      const monthStart = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - offset, 1));
      const key = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
      const monthPeriod = { kind: 'month' as const, from: `${key}-01`, to: `${key}-${String(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate()).padStart(2, '0')}`, label: key, explicit: true };
      const summary = await repository.getPeriodSummary(monthPeriod);
      monthly.push(`${key}: ${money(summary.totalExpenses)}`);
      refs.push(`period:${key}`);
    }
    lines.push(`Recent monthly expense totals: ${monthly.join('; ')}.`);
  }
  if (wantsMerchant) {
    const totals = new Map<string, number>();
    for (const expense of workspace.expenses.filter((e) => (!from || e.date >= from) && (!to || e.date <= to))) totals.set(expense.vendor, (totals.get(expense.vendor) ?? 0) + expense.amount);
    const top = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 5);
    lines.push(top.length ? `Top vendors for ${periodKey}: ${top.map(([name, amount]) => `${name} ${money(amount)}`).join('; ')}.` : `No vendor expenses are present for ${periodKey}.`);
    refs.push(...top.map(([name]) => `merchant:${slug(name)}`));
  }
  if (wantsInvoice) {
    const counts = new Map<string, { count: number; total: number }>();
    for (const invoice of await repository.getInvoices()) {
      const status = invoiceStatus(invoice, now);
      const row = counts.get(status) ?? { count: 0, total: 0 }; row.count++; row.total += invoiceTotal(invoice); counts.set(status, row);
    }
    lines.push(`Invoice statuses: ${[...counts].map(([status, value]) => `${status} ${value.count} (${money(value.total)})`).join('; ') || 'none recorded'}.`);
    refs.push(...[...counts.keys()].map((status) => `invoice:status:${slug(status)}`));
  }
  if (wantsAlert) {
    const alerts = evaluateAlerts(workspace, { now }).slice(0, 5);
    lines.push(alerts.length ? `Alerts: ${alerts.map((alert) => `${alert.title} — ${alert.summary}${alert.impact ? ` ${money(alert.impact.amount)}` : ''}`).join('; ')}.` : 'No alerts are present in the current workspace.');
    refs.push(...alerts.map((alert) => `alert:${alert.id}`));
  }
  if (!lines.length) lines.push('The supplied workspace has no matching financial context for this question.');
  let contextText = '';
  for (const line of lines) { if (contextText.length + line.length + 1 > 8000) break; contextText += `${contextText ? '\n' : ''}${line}`; }
  return { contextText, contextRefs: [...new Set(refs)], allowedFigures: extractFigures(contextText) };
}
