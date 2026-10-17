import { FinanceModuleShell } from '@/components/finance-module-shell';
import { FinovaDemo } from '@/components/finova-demo';

export default function DemoPage() {
  return <FinanceModuleShell active="dashboard"><div className="module-page"><div className="page-header"><div><span className="eyebrow">TRADETIDE OPEN</span><h1>Grounding evaluation</h1><p>Compare deterministic answers with open-model explanations and inspect validation.</p></div></div><FinovaDemo/></div></FinanceModuleShell>;
}
