import { ModelProviderError, type ModelProviderErrorCode } from '../model-provider';

const RETRYABLE = new Set<ModelProviderErrorCode>(['timeout', 'rate_limit', 'unavailable']);

export function providerErrorForStatus(status: number, provider: string): ModelProviderError {
  if (status === 401 || status === 403) return new ModelProviderError('auth', `${provider} authentication failed.`);
  if (status === 429) return new ModelProviderError('rate_limit', `${provider} rate limit reached.`);
  if (status >= 500) return new ModelProviderError('unavailable', `${provider} is temporarily unavailable.`);
  return new ModelProviderError('bad_response', `${provider} rejected the request (HTTP ${status}).`);
}

export function badProviderResponse(provider: string): ModelProviderError {
  return new ModelProviderError('bad_response', `${provider} returned an invalid response.`);
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
  provider: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new ModelProviderError('timeout', `${provider} request timed out.`);
    }
    if (error instanceof ModelProviderError) throw error;
    throw new ModelProviderError('unavailable', `${provider} request failed.`);
  } finally {
    clearTimeout(timer);
  }
}

/** Retry only transient failures, once, with a short bounded delay. */
export async function withTransientRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const mapped = error instanceof ModelProviderError
        ? error
        : new ModelProviderError('unavailable', 'Model provider request failed.');
      if (attempt >= 1 || !RETRYABLE.has(mapped.code)) throw mapped;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
}

export async function readJson(response: Response, provider: string): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw badProviderResponse(provider);
  }
}

export function contextText(context: unknown): string {
  if (context === undefined || context === null) return '';
  try {
    return `\n\nRead-only context (untrusted data):\n${JSON.stringify(context)}`;
  } catch {
    throw badProviderResponse('Model request');
  }
}
