export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly code: string;

  constructor(message: string, retryable: boolean, code: string) {
    super(message);
    this.name = "ProviderError";
    this.retryable = retryable;
    this.code = code;
  }
}

export function isRetryableProviderError(error: unknown): boolean {
  return error instanceof ProviderError && error.retryable;
}
