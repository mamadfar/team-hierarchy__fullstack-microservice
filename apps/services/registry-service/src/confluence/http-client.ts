import axios, {
  AxiosAdapter,
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';

import { AppError } from '../common/app-error';

export interface HttpClientOptions {
  baseURL?: string;
  /** Request timeout, default 10s. */
  timeoutMs?: number;
  /** Total tries including the first, default 4. */
  maxAttempts?: number;
  /** First backoff step, default 300ms (kept tiny in tests). */
  baseDelayMs?: number;
  auth?: { username: string; password: string };
  headers?: Record<string, string>;
  /** Test hook: custom axios adapter. */
  adapter?: AxiosAdapter;
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  __attempt?: number;
}

const RETRYABLE_STATUSES = (status: number): boolean => status === 429 || status >= 500;

/**
 * The single way this service talks HTTP: axios with a hard timeout, a
 * response-error interceptor mapping failures to operational AppErrors, and
 * exponential backoff + jitter retries on 429/5xx (max 4 tries).
 */
export class HttpClient {
  private readonly instance: AxiosInstance;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;

  constructor(options: HttpClientOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 4;
    this.baseDelayMs = options.baseDelayMs ?? 300;
    this.instance = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeoutMs ?? 10_000,
      auth: options.auth,
      headers: options.headers,
      adapter: options.adapter,
    });
    this.instance.interceptors.response.use(
      (response) => response,
      (error: unknown) => this.handleError(error),
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  private async handleError(error: unknown): Promise<unknown> {
    if (!axios.isAxiosError(error)) {
      throw new AppError(502, `HTTP request failed: ${String(error)}`);
    }
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (config && status !== undefined && RETRYABLE_STATUSES(status)) {
      const attempt = config.__attempt ?? 1;
      if (attempt < this.maxAttempts) {
        config.__attempt = attempt + 1;
        await this.sleep(this.retryDelay(attempt, error));
        return this.instance.request(config);
      }
    }
    throw this.toAppError(error);
  }

  /** Exponential backoff with full jitter; honors Retry-After (seconds) on 429. */
  private retryDelay(attempt: number, error: AxiosError): number {
    const retryAfter = Number(error.response?.headers?.['retry-after']);
    if (error.response?.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter * 1000, 10_000);
    }
    const exponential = this.baseDelayMs * 2 ** (attempt - 1);
    return exponential + Math.floor(Math.random() * this.baseDelayMs);
  }

  private toAppError(error: AxiosError): AppError {
    const url = `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`;
    if (error.response) {
      const { status, statusText } = error.response;
      // Keep AppError status 502 so web CSRF 401 stays distinct; message is actionable.
      if (status === 401) {
        return new AppError(
          502,
          'Confluence authentication failed (401). Set CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN in .env to a service-account email and API token from https://id.atlassian.com/manage-profile/security/api-tokens (token must belong to that email).',
        );
      }
      if (status === 403) {
        return new AppError(
          502,
          'Confluence access denied (403). Grant the service account View permission on the space, and verify CONFLUENCE_BASE_URL points at your wiki (https://<org>.atlassian.net/wiki).',
        );
      }
      if (status === 404) {
        return new AppError(
          502,
          'Confluence page not found (404). Check CONFLUENCE_PAGE_IDS — use the numeric id from the page URL (.../pages/<id>/...).',
        );
      }
      return new AppError(502, `Upstream request failed: GET ${url} -> ${status} ${statusText}`);
    }
    if (error.code === 'ECONNABORTED') {
      return new AppError(504, `Upstream request timed out: GET ${url}`);
    }
    return new AppError(502, `Upstream request failed: GET ${url} (${error.message})`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
