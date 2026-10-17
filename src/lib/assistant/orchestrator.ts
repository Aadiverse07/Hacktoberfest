import { answerQuestion, type Workspace } from './engine';
import { getAssistantRepository, type AssistantRepository } from '@/lib/data/assistant-repository';
import { createModelProvider } from './model-provider-factory';
import type { ModelProvider, ModelProviderId } from './model-provider';
import { resolveModelConfig } from './model-config';
import { systemPrompt } from './prompts';
import { buildAssistantContext } from './context-builder';
import { validateAnswer, type ValidationResult } from './validator';
import { BORDERLINE_ANSWER, classifyFinovaScope, OUT_OF_SCOPE_ANSWER, shouldUseModelForQuestion, SCOPE_SUGGESTIONS, type ScopeResult } from './scope';

export type AssistantSource = 'verified-data' | 'open-weight-model' | 'fallback';
export type OrchestratorResult = {
  answer: string; source: AssistantSource; provider: string; model: string | null; contextRefs: string[];
  validation: ValidationResult; latencyMs: number; limitations: string[]; scopeResult: ScopeResult;
};
export type OrchestratorOptions = {
  repository?: AssistantRepository; workspace?: Workspace; locale?: string; providerId?: ModelProviderId;
  provider?: ModelProvider; now?: string;
};

const LIMITATION = 'Generated explanations are not authoritative financial calculations; figures come from verified workspace data.';

export async function orchestrateAssistant(message: string, options: OrchestratorOptions = {}): Promise<OrchestratorResult> {
  const scope = classifyFinovaScope(message);
  if (scope.result === 'out_of_scope') {
    return { answer: OUT_OF_SCOPE_ANSWER, source: 'verified-data', provider: 'deterministic', model: null, contextRefs: [], validation: { passed: true, issues: [] }, latencyMs: 0, limitations: [], scopeResult: scope.result };
  }
  if (scope.result === 'borderline') {
    return { answer: `${BORDERLINE_ANSWER}\n\n${SCOPE_SUGGESTIONS.slice(0, 3).map((q) => `• ${q}`).join('\n')}`, source: 'verified-data', provider: 'deterministic', model: null, contextRefs: [], validation: { passed: true, issues: [] }, latencyMs: 0, limitations: [], scopeResult: scope.result };
  }

  const repository = options.repository ?? await getAssistantRepository({ workspace: options.workspace });
  const workspace = options.workspace ?? await repository.getWorkspace();
  const deterministic = answerQuestion(message, workspace);
  const solved = deterministic.inScope && deterministic.intent !== 'clarify' && deterministic.intent !== 'empty';
  const needsModel = shouldUseModelForQuestion(message);
  if (solved && !needsModel) {
    return { answer: deterministic.answer, source: 'verified-data', provider: 'deterministic', model: null, contextRefs: [], validation: { passed: true, issues: [] }, latencyMs: 0, limitations: [], scopeResult: scope.result };
  }

  const configSource = options.providerId ? { ...process.env, MODEL_PROVIDER: options.providerId } : process.env;
  const config = resolveModelConfig(configSource);
  const provider = options.provider ?? createModelProvider(config);
  const built = await buildAssistantContext(repository, workspace, message, options.now);
  const base = {
    system: systemPrompt(options.locale ?? 'en'), userMessage: message,
    context: { contextText: built.contextText }, locale: options.locale ?? 'en', maxTokens: 240, timeoutMs: config.modelTimeoutMs,
  };
  let elapsed = 0;
  try {
    let result = await provider.generate(base);
    elapsed += result.latencyMs;
    let validation = validateAnswer(result.text, built.allowedFigures);
    if (validation.passed) return { answer: result.text.trim(), source: 'open-weight-model', provider: result.provider, model: result.model, contextRefs: built.contextRefs, validation, latencyMs: elapsed, limitations: [LIMITATION], scopeResult: scope.result };
    result = await provider.generate({ ...base, system: systemPrompt(options.locale ?? 'en', true) });
    elapsed += result.latencyMs;
    validation = validateAnswer(result.text, built.allowedFigures);
    if (validation.passed) return { answer: result.text.trim(), source: 'open-weight-model', provider: result.provider, model: result.model, contextRefs: built.contextRefs, validation, latencyMs: elapsed, limitations: [LIMITATION], scopeResult: scope.result };
    return { answer: `I couldn't validate a generated answer. Here is the available verified context:\n${built.contextText}`, source: 'fallback', provider: provider.id, model: result.model || null, contextRefs: built.contextRefs, validation, latencyMs: elapsed, limitations: [LIMITATION, 'Generated answer failed validation; figures below are copied from verified context.'], scopeResult: scope.result };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'provider_error';
    return { answer: `I couldn't reach the assistant model. Here is the available verified context:\n${built.contextText}`, source: 'fallback', provider: provider.id, model: null, contextRefs: built.contextRefs, validation: { passed: false, issues: [`provider_${code}`] }, latencyMs: elapsed, limitations: [LIMITATION, 'Model output was unavailable; figures below are copied from verified context.'], scopeResult: scope.result };
  }
}
