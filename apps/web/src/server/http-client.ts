import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

/** Operational HTTP error with the upstream status attached (sanitized message). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface HttpClientOptions {
  baseURL: string;
  timeoutMs?: number;
  /** Retries on 429 with exponential backoff. */
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Server-side HTTP client (axios only — never fetch on the backend):
 * timeouts, an error interceptor that normalizes failures to HttpError, and
 * retry with exponential backoff on 429 responses.
 */
export class HttpClient {
  private readonly client: AxiosInstance;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(options: HttpClientOptions) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 400;
    this.client = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeoutMs ?? 30_000,
      headers: { Accept: 'application/json' },
    });
    this.client.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (error instanceof AxiosError) {
          const status = error.response?.status ?? 502;
          return Promise.reject(new HttpError(status, `Upstream request failed (${status})`));
        }
        return Promise.reject(new HttpError(502, 'Upstream request failed'));
      },
    );
  }

  async post<T>(url: string, body: unknown, config?: AxiosRequestConfig): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        const response = await this.client.post<T>(url, body, config);
        return response.data;
      } catch (error) {
        const retriable = error instanceof HttpError && error.status === 429;
        if (!retriable || attempt >= this.maxRetries) throw error;
        await sleep(this.retryBaseDelayMs * 2 ** attempt);
        attempt += 1;
      }
    }
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }
}
