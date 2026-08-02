export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export class HttpStatusError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

export function isRetryableError(err: unknown): boolean {
  if (isHttpStatusError(err)) {
    return err.status === 429 || err.status === 503;
  }

  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    if (status === 429 || status === 503) {
      return true;
    }
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return true;
    }

    const message = err.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('ecconnreset') ||
      message.includes('econnreset') ||
      message.includes('econnaborted') ||
      message.includes('etimedout')
    );
  }

  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const isRetryable = options.isRetryable ?? isRetryableError;

  let attempt = 0;
  // total attempts = initial try + retries
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !isRetryable(err)) {
        throw err;
      }

      const jitterMs = Math.floor(random() * 501);
      const delayMs = baseDelayMs * 2 ** attempt + jitterMs;
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

function isHttpStatusError(err: unknown): err is HttpStatusError {
  return err instanceof HttpStatusError;
}
