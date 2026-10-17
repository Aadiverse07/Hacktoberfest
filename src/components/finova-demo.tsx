'use client';

import { apiUrl } from '@/lib/api-client';

import { useState } from 'react';

type Row = { prompt: string; source: string; provider: string; validation: string; latency: number };
const fixedPrompts = ['How much did I spend this month?', 'Show unpaid invoices', 'What financial patterns should guide my planning for next quarter?', 'What patterns should I review in my expense records?'];

export function FinovaDemo() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function call(message: string, demoMode?: 'invalid' | 'throw') {
    const response = await fetch(apiUrl('/api/assistant'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, locale: 'en', ...(demoMode ? { demoMode, provider: 'mock' } : {}) }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'The demo request failed.');
    return body as { source: string; provider: string; validation: { passed: boolean; issues: string[] }; latencyMs: number; answer: string };
  }
  async function runEvaluation() {
    setBusy(true); setNotice(''); setRows([]);
    try {
      const next: Row[] = [];
      for (const prompt of fixedPrompts) {
        const result = await call(prompt);
        next.push({ prompt, source: result.source, provider: result.provider, validation: result.validation.passed ? 'passed' : result.validation.issues.join(', '), latency: result.latencyMs });
        setRows([...next]);
      }
    } catch { setNotice('Tradetide could not complete the evaluation. Please try again.'); }
    finally { setBusy(false); }
  }
  async function simulate(mode: 'invalid' | 'throw') {
    setBusy(true); setNotice('');
    try {
      const result = await call('What should I review in my finances?', mode);
      setRows((previous) => [{ prompt: mode === 'invalid' ? 'Invalid output injection' : 'Provider failure simulation', source: result.source, provider: result.provider, validation: result.validation.passed ? 'passed' : result.validation.issues.join(', '), latency: result.latencyMs }, ...previous]);
      setNotice(result.answer.slice(0, 240));
    } catch { setNotice('The simulation did not complete.'); }
    finally { setBusy(false); }
  }
  return <div className="panel open-demo"><div className="open-demo-actions"><button className="primary-button" type="button" onClick={runEvaluation} disabled={busy}>{busy ? 'Running…' : 'Run fixed prompt set'}</button><button className="secondary-button" type="button" onClick={() => simulate('invalid')} disabled={busy}>Test invalid output</button><button className="secondary-button" type="button" onClick={() => simulate('throw')} disabled={busy}>Simulate provider failure</button></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {rows.length === 0 ? <p className="muted">Run the evaluation to compare verified facts and model explanations.</p> : <div className="table-scroll"><table><thead><tr><th>Prompt</th><th>Source</th><th>Provider</th><th>Validation</th><th>Latency</th></tr></thead><tbody>{rows.map((row, i) => <tr key={`${row.prompt}-${i}`}><td>{row.prompt}</td><td>{row.source}</td><td>{row.provider}</td><td>{row.validation}</td><td>{row.latency} ms</td></tr>)}</tbody></table></div>}
  </div>;
}
