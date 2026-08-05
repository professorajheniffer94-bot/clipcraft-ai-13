/** Small client-side retry helper with exponential backoff. */

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
  isRetryable?: (error: Error) => boolean;
}

const TRANSIENT_PATTERNS = [
  "failed to fetch",
  "network",
  "timeout",
  "timed out",
  "econnreset",
  "load failed",
  "502",
  "503",
  "504",
  "429",
];

/** Network / rate-limit style failures are worth retrying; validation errors are not. */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return TRANSIENT_PATTERNS.some((pattern) => message.includes(pattern));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 600;
  const isRetryable = options.isRetryable ?? isTransientError;

  let lastError: Error = new Error("Unknown error");
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === attempts || !isRetryable(lastError)) throw lastError;
      options.onRetry?.(attempt, lastError);
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
