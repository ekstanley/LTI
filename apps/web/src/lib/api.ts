/**
 * API client for LTIP backend with CSRF protection
 */

import type {
  Bill,
  Legislator,
  Vote,
  BillAnalysis,
  ConflictOfInterest,
  PaginatedResponse,
} from '@ltip/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ============================================================================
// CSRF Token Management
// ============================================================================

/**
 * In-memory CSRF token storage
 * Token is automatically rotated on each protected request
 */
let csrfToken: string | null = null;

/**
 * HTTP methods that require CSRF protection
 */
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Fetch CSRF token from server
 * Should be called after authentication
 *
 * @param signal - Optional AbortSignal for request cancellation
 * @security M-2: Respects AbortSignal to prevent resource waste on cancellation
 */
export async function fetchCsrfToken(signal?: AbortSignal): Promise<string> {
  const url = `${API_BASE_URL}/api/v1/auth/csrf-token`;

  const response = await fetch(url, {
    credentials: 'include', // Include cookies for session
    headers: {
      'Content-Type': 'application/json',
    },
    ...(signal && { signal }), // Support request cancellation
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const data = await response.json();
  if (!data.csrfToken || typeof data.csrfToken !== 'string') {
    throw new Error('Invalid CSRF token response');
  }

  csrfToken = data.csrfToken;
  return data.csrfToken;
}

/**
 * Get current CSRF token
 * Returns null if not yet fetched
 */
export function getCsrfToken(): string | null {
  return csrfToken;
}

/**
 * Clear CSRF token (on logout)
 */
export function clearCsrfToken(): void {
  csrfToken = null;
}

// ============================================================================
// API Error Handling
// ============================================================================

/**
 * HTTP API error with status code and error code
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Network-level error (connection failed, DNS resolution, etc.)
 */
export class NetworkError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Request cancellation error (via AbortController)
 */
export class AbortError extends Error {
  constructor(message: string = 'Request was cancelled') {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * CSRF token expiration error (requires token refresh)
 */
export class CsrfTokenError extends Error {
  constructor(message: string = 'CSRF token expired or invalid') {
    super(message);
    this.name = 'CsrfTokenError';
  }
}

// ============================================================================
// Error Message Sanitization
// ============================================================================

/**
 * Safe error messages for known error codes
 *
 * Maps backend error codes to user-friendly messages that do not expose
 * internal implementation details (database connection strings, file paths,
 * SQL queries, etc.)
 *
 * @security M-1: Prevents error information disclosure
 */
const SAFE_ERROR_MESSAGES = {
  // Authentication & Authorization
  AUTH_INVALID_CREDENTIALS: 'Invalid username or password.',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_UNAUTHORIZED: 'You are not authorized to perform this action.',
  AUTH_FORBIDDEN: 'You do not have permission to access this resource.',
  AUTH_TOKEN_EXPIRED: 'Your authentication token has expired. Please log in again.',
  AUTH_TOKEN_INVALID: 'Invalid authentication token. Please log in again.',

  // Resource Management
  RESOURCE_NOT_FOUND: 'The requested resource could not be found.',
  RESOURCE_CONFLICT: 'This resource already exists.',
  RESOURCE_GONE: 'This resource is no longer available.',

  // Validation
  VALIDATION_ERROR: 'The provided data is invalid. Please check your input.',
  VALIDATION_FIELD_REQUIRED: 'Required field is missing.',
  VALIDATION_FIELD_INVALID: 'One or more fields contain invalid data.',
  VALIDATION_FORMAT_INVALID: 'The data format is invalid.',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',

  // Server Errors
  DATABASE_ERROR: 'A database error occurred. Please try again.',
  DATABASE_CONNECTION_FAILED: 'Unable to connect to the database. Please try again later.',
  INTERNAL_ERROR: 'An internal error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',

  // CSRF
  CSRF_TOKEN_INVALID: 'Security token invalid. Please refresh and try again.',
  CSRF_TOKEN_MISSING: 'Security token missing. Please refresh and try again.',

  // Network
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  TIMEOUT_ERROR: 'The request timed out. Please try again.',

  // Generic
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  BAD_REQUEST: 'Invalid request. Please check your input and try again.',
} as const;

type SafeErrorCode = keyof typeof SAFE_ERROR_MESSAGES;

/**
 * Fallback message for unknown error codes
 */
const FALLBACK_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

/**
 * Get safe, user-friendly error message for a given error code
 *
 * @param code - Backend error code
 * @returns Safe error message that does not expose internal details
 * @security M-1: Sanitizes error messages to prevent information disclosure
 */
function getSafeErrorMessage(code: string): string {
  // Check if we have a mapped safe message for this code
  if (code in SAFE_ERROR_MESSAGES) {
    return SAFE_ERROR_MESSAGES[code as SafeErrorCode];
  }

  // Log unknown error codes server-side for monitoring
  // (Only in server environment to avoid exposing to client DevTools)
  if (typeof window === 'undefined') {
    console.warn('Unknown error code encountered:', code);
  }

  // Return generic fallback message for unknown codes
  return FALLBACK_ERROR_MESSAGE;
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validation error for invalid inputs
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation schema type definitions
 */
export interface ValidationSchema {
  [key: string]: StringFieldSchema | NumberFieldSchema | EnumFieldSchema;
}

interface StringFieldSchema {
  type: 'string';
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
}

interface NumberFieldSchema {
  type: 'number';
  min?: number;
  max?: number;
  integer?: boolean;
}

interface EnumFieldSchema {
  type: 'enum';
  values: readonly string[];
}

/**
 * Validate ID parameter to prevent XSS and SQL injection
 *
 * Valid IDs must:
 * - Be non-empty strings
 * - Contain only alphanumeric characters, hyphens, and underscores
 * - Be between 1 and 100 characters
 *
 * @param id - ID parameter to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Validated and trimmed ID
 * @throws {ValidationError} If ID is invalid
 * @security M-3: Prevents XSS/SQLi through ID parameters (CVSS 5.3 MEDIUM)
 */
export function validateId(id: string, fieldName: string = 'id'): string {
  // Check if empty
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  // Trim whitespace
  const trimmedId = id.trim();

  // Check length constraints
  if (trimmedId.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
  }

  if (trimmedId.length > 100) {
    throw new ValidationError(`${fieldName} must be less than 100 characters`, fieldName);
  }

  // Check for valid characters (alphanumeric, hyphens, underscores only)
  // This prevents XSS through <script> tags and SQLi through quotes/semicolons
  const validIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validIdPattern.test(trimmedId)) {
    throw new ValidationError(
      `${fieldName} contains invalid characters. Only alphanumeric, hyphens, and underscores are allowed`,
      fieldName
    );
  }

  // Check for SQL comment marker (double hyphens)
  // Even though individual hyphens are allowed, -- is a SQL comment and must be blocked
  if (trimmedId.includes('--')) {
    throw new ValidationError(
      `${fieldName} contains invalid sequence '--' (SQL comment marker)`,
      fieldName
    );
  }

  return trimmedId;
}

/**
 * Validate string parameter
 * @internal
 */
function validateStringParam(
  value: unknown,
  fieldName: string,
  schema: StringFieldSchema
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  const trimmed = value.trim();

  // Check minimum length
  if (schema.minLength !== undefined && trimmed.length < schema.minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${schema.minLength} characters`,
      fieldName
    );
  }

  // Check maximum length (default 500 to prevent abuse)
  const maxLength = schema.maxLength ?? 500;
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be less than ${maxLength} characters`,
      fieldName
    );
  }

  // Check for control characters (potential injection)
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    throw new ValidationError(
      `${fieldName} contains invalid control characters`,
      fieldName
    );
  }

  // Check pattern if specified
  if (schema.pattern && !schema.pattern.test(trimmed)) {
    throw new ValidationError(
      `${fieldName} format is invalid`,
      fieldName
    );
  }

  return trimmed;
}

/**
 * Validate numeric parameter
 * @internal
 */
function validateNumberParam(
  value: unknown,
  fieldName: string,
  schema: NumberFieldSchema
): number {
  // Try to convert to number
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);

  if (isNaN(num) || !isFinite(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
  }

  // Check if integer is required
  if (schema.integer && !Number.isInteger(num)) {
    throw new ValidationError(`${fieldName} must be an integer`, fieldName);
  }

  // Check minimum value
  if (schema.min !== undefined && num < schema.min) {
    throw new ValidationError(
      `${fieldName} must be at least ${schema.min}`,
      fieldName
    );
  }

  // Check maximum value
  if (schema.max !== undefined && num > schema.max) {
    throw new ValidationError(
      `${fieldName} must be at most ${schema.max}`,
      fieldName
    );
  }

  return num;
}

/**
 * Validate enum parameter
 * @internal
 */
function validateEnumParam(
  value: unknown,
  fieldName: string,
  schema: EnumFieldSchema
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  const trimmed = value.trim();

  if (!schema.values.includes(trimmed)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${schema.values.join(', ')}`,
      fieldName
    );
  }

  return trimmed;
}

/**
 * Validate query parameters to prevent injection attacks
 *
 * Validates:
 * - String parameters: No control characters, max 500 chars
 * - Numeric parameters: Valid integers/floats, reasonable ranges
 * - Enum parameters: Must match allowed values
 *
 * @param params - Query parameters object
 * @param schema - Validation schema with expected types and constraints
 * @returns Validated and sanitized parameters
 * @throws {ValidationError} If parameters are invalid
 * @security M-3: Prevents injection through query parameters (CVSS 5.3 MEDIUM)
 */
export function validateQueryParams<T extends Record<string, unknown>>(
  params: T,
  schema: ValidationSchema
): T {
  const validated: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    // Skip undefined values
    if (value === undefined) {
      continue;
    }

    // Check if field is defined in schema
    const fieldSchema = schema[key];
    if (!fieldSchema) {
      // Unknown field - skip silently (defensive)
      continue;
    }

    // Validate based on type
    switch (fieldSchema.type) {
      case 'string':
        validated[key] = validateStringParam(value, key, fieldSchema);
        break;
      case 'number':
        validated[key] = validateNumberParam(value, key, fieldSchema);
        break;
      case 'enum':
        validated[key] = validateEnumParam(value, key, fieldSchema);
        break;
      default:
        throw new ValidationError(`Unknown validation type for ${key}`, key);
    }
  }

  return validated as T;
}

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Check if error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Check if error is an abort error
 */
export function isAbortError(error: unknown): error is AbortError {
  return error instanceof AbortError;
}

/**
 * Check if error is a CSRF token error
 */
export function isCsrfTokenError(error: unknown): error is CsrfTokenError {
  return error instanceof CsrfTokenError;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Get user-friendly error message based on error type
 */
export function getErrorMessage(error: unknown): string {
  if (isValidationError(error)) {
    return error.message;
  }

  if (isAbortError(error)) {
    return 'Request was cancelled';
  }

  if (isCsrfTokenError(error)) {
    return 'Your session has expired. Please refresh the page and try again.';
  }

  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }

  if (isApiError(error)) {
    // Provide specific messages for common HTTP status codes
    if (error.status === 401) {
      return 'You are not authorized. Please log in and try again.';
    }
    if (error.status === 403) {
      return 'You do not have permission to access this resource.';
    }
    if (error.status === 404) {
      return 'The requested resource was not found.';
    }
    if (error.status === 429) {
      return 'Too many requests. Please try again later.';
    }
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

/** Maximum number of retry attempts for transient failures */
const MAX_RETRIES = 3;

/** Initial backoff delay in milliseconds */
const INITIAL_BACKOFF_MS = 1000;

/** Maximum backoff delay in milliseconds (30 seconds) */
const MAX_BACKOFF_MS = 30000;

/** Maximum CSRF token refresh attempts to prevent infinite loops */
const MAX_CSRF_REFRESH_ATTEMPTS = 2;

/**
 * Check if error is retriable (transient failure)
 */
function isRetriableError(error: unknown): boolean {
  // Network errors are retriable
  if (isNetworkError(error)) {
    return true;
  }

  // Server errors (5xx) are retriable
  if (isApiError(error) && error.status >= 500) {
    return true;
  }

  // 429 (Too Many Requests) is retriable with backoff
  if (isApiError(error) && error.status === 429) {
    return true;
  }

  return false;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number): number {
  // Exponential backoff: 2^attempt * baseDelay
  const exponentialDelay = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(2, attempt),
    MAX_BACKOFF_MS
  );

  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for specified milliseconds with cancellation support
 *
 * @param ms - Milliseconds to sleep
 * @param signal - Optional AbortSignal for cancellation
 * @throws {AbortError} If signal is aborted during sleep
 * @security M-2: Respects AbortSignal to prevent resource waste on cancellation
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already aborted before starting
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }

    const timeoutId = setTimeout(() => {
      // Clean up abort listener when timeout completes
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
      resolve();
    }, ms);

    // Listen for abort signal during sleep
    let abortHandler: (() => void) | null = null;
    if (signal) {
      abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new AbortError());
      };

      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}

// ============================================================================
// HTTP Client with CSRF Protection
// ============================================================================

/**
 * Core fetcher implementation without retry logic
 * @internal
 */
async function fetcherCore<T>(
  endpoint: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = options?.method?.toUpperCase() ?? 'GET';

  // Build headers with CSRF token for protected methods
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add CSRF token header for state-changing requests
  if (CSRF_PROTECTED_METHODS.has(method) && csrfToken) {
    (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
  }

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies for session
      headers,
      ...(options?.signal && { signal: options.signal }), // Support request cancellation
    });

    // Extract and store new CSRF token from response header (automatic rotation)
    const newCsrfToken = response.headers.get('X-CSRF-Token');
    if (newCsrfToken) {
      csrfToken = newCsrfToken;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        error.code ?? 'UNKNOWN_ERROR',
        getSafeErrorMessage(error.code ?? 'UNKNOWN_ERROR')
      );
    }

    return response.json();
  } catch (error) {
    // Categorize error types for better handling
    if (error instanceof ApiError) {
      // Already an ApiError, rethrow as-is
      throw error;
    }

    // Check if request was aborted (handles both Error and DOMException with name='AbortError')
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      throw new AbortError();
    }

    // Network-level errors (connection failed, DNS, timeout, etc.)
    if (error instanceof TypeError) {
      throw new NetworkError(getSafeErrorMessage('NETWORK_ERROR'), error);
    }

    // Unknown error type - wrap in NetworkError
    throw new NetworkError(
      getSafeErrorMessage('NETWORK_ERROR'),
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * HTTP fetcher with automatic retry for transient failures and CSRF token refresh
 *
 * Implements exponential backoff with jitter for retriable errors (network failures, 5xx, 429).
 * Automatically refreshes CSRF token on expiration and retries the request.
 * Respects AbortSignal for request cancellation.
 */
async function fetcher<T>(
  endpoint: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  let lastError: unknown;
  let csrfRefreshCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Check if request was aborted before retry
      if (options?.signal?.aborted) {
        throw new AbortError();
      }

      return await fetcherCore<T>(endpoint, options);
    } catch (error) {
      lastError = error;

      // Don't retry if request was aborted
      if (isAbortError(error)) {
        throw error;
      }

      // Handle CSRF token expiration (403 with specific error code)
      if (
        isApiError(error) &&
        error.status === 403 &&
        error.code === 'CSRF_TOKEN_INVALID'
      ) {
        // Limit CSRF refresh attempts to prevent infinite loops (DoS protection)
        csrfRefreshCount++;
        if (csrfRefreshCount > MAX_CSRF_REFRESH_ATTEMPTS) {
          throw new CsrfTokenError(
            getSafeErrorMessage('CSRF_TOKEN_INVALID')
          );
        }

        try {
          // Refresh CSRF token and retry immediately (don't count as retry attempt)
          await fetchCsrfToken(options?.signal);
          continue;
        } catch (csrfError) {
          // Failed to refresh CSRF token - throw CSRF-specific error
          throw new CsrfTokenError(
            getSafeErrorMessage('CSRF_TOKEN_INVALID')
          );
        }
      }

      // Check if error is retriable
      if (!isRetriableError(error)) {
        // Non-retriable error - throw immediately
        throw error;
      }

      // Check if we have retries remaining
      if (attempt >= MAX_RETRIES) {
        // Exhausted all retries - throw last error
        throw error;
      }

      // Wait with exponential backoff before retry
      const backoffDelay = calculateBackoff(attempt);
      await sleep(backoffDelay, options?.signal);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}

// ============================================================================
// Bills API
// ============================================================================

export interface BillsQueryParams {
  congressNumber?: number;
  billType?: string;
  status?: string;
  chamber?: string;
  search?: string;
  limit?: number;
  offset?: number;
  [key: string]: unknown; // Index signature to satisfy Record<string, unknown>
}

/**
 * Validation schema for bills query parameters
 * @security M-3: Validates query parameters to prevent injection attacks
 */
const BILLS_QUERY_SCHEMA: ValidationSchema = {
  congressNumber: { type: 'number', integer: true, min: 1, max: 200 },
  billType: {
    type: 'enum',
    values: ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres'] as const,
  },
  status: {
    type: 'enum',
    values: ['introduced', 'passed_house', 'passed_senate', 'enacted', 'vetoed'] as const,
  },
  chamber: { type: 'enum', values: ['house', 'senate'] as const },
  search: { type: 'string', maxLength: 200 },
  limit: { type: 'number', integer: true, min: 1, max: 100 },
  offset: { type: 'number', integer: true, min: 0 },
};

export async function getBills(
  params: BillsQueryParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<Bill>> {
  // Validate query parameters
  const validatedParams = validateQueryParams(params, BILLS_QUERY_SCHEMA);

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(validatedParams)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Bill>>(
    `/api/v1/bills${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

export async function getBill(id: string, signal?: AbortSignal): Promise<Bill> {
  // Validate bill ID to prevent XSS/SQLi
  const validatedId = validateId(id, 'billId');
  return fetcher<Bill>(`/api/v1/bills/${validatedId}`, signal ? { signal } : undefined);
}

export async function getBillAnalysis(billId: string, signal?: AbortSignal): Promise<BillAnalysis> {
  // Validate bill ID to prevent XSS/SQLi
  const validatedId = validateId(billId, 'billId');
  return fetcher<BillAnalysis>(`/api/v1/analysis/${validatedId}`, signal ? { signal } : undefined);
}

// ============================================================================
// Legislators API
// ============================================================================

export interface LegislatorsQueryParams extends Record<string, unknown> {
  chamber?: string;
  party?: string;
  state?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Validation schema for legislators query parameters
 * @security M-3: Validates query parameters to prevent injection attacks
 */
const LEGISLATORS_QUERY_SCHEMA: ValidationSchema = {
  chamber: { type: 'enum', values: ['house', 'senate'] as const },
  party: { type: 'enum', values: ['D', 'R', 'I'] as const },
  state: { type: 'string', maxLength: 2, pattern: /^[A-Z]{2}$/ },
  search: { type: 'string', maxLength: 200 },
  limit: { type: 'number', integer: true, min: 1, max: 100 },
  offset: { type: 'number', integer: true, min: 0 },
};

export async function getLegislators(
  params: LegislatorsQueryParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<Legislator>> {
  // Validate query parameters
  const validatedParams = validateQueryParams(params, LEGISLATORS_QUERY_SCHEMA);

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(validatedParams)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Legislator>>(
    `/api/v1/legislators${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

export async function getLegislator(id: string, signal?: AbortSignal): Promise<Legislator> {
  // Validate legislator ID to prevent XSS/SQLi
  const validatedId = validateId(id, 'legislatorId');
  return fetcher<Legislator>(`/api/v1/legislators/${validatedId}`, signal ? { signal } : undefined);
}

// ============================================================================
// Votes API
// ============================================================================

export interface VotesQueryParams extends Record<string, unknown> {
  chamber?: string;
  billId?: string;
  result?: string;
  limit?: number;
  offset?: number;
}

/**
 * Validation schema for votes query parameters
 * @security M-3: Validates query parameters to prevent injection attacks
 */
const VOTES_QUERY_SCHEMA: ValidationSchema = {
  chamber: { type: 'enum', values: ['house', 'senate'] as const },
  billId: { type: 'string', maxLength: 100, pattern: /^[a-zA-Z0-9_-]+$/ },
  result: { type: 'enum', values: ['passed', 'failed', 'agreed_to', 'rejected'] as const },
  limit: { type: 'number', integer: true, min: 1, max: 100 },
  offset: { type: 'number', integer: true, min: 0 },
};

export async function getVotes(
  params: VotesQueryParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<Vote>> {
  // Validate query parameters
  const validatedParams = validateQueryParams(params, VOTES_QUERY_SCHEMA);

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(validatedParams)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return fetcher<PaginatedResponse<Vote>>(
    `/api/v1/votes${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

export async function getVote(id: string, signal?: AbortSignal): Promise<Vote> {
  // Validate vote ID to prevent XSS/SQLi
  const validatedId = validateId(id, 'voteId');
  return fetcher<Vote>(`/api/v1/votes/${validatedId}`, signal ? { signal } : undefined);
}

// ============================================================================
// Conflicts of Interest API
// ============================================================================

export async function getConflicts(
  legislatorId: string,
  signal?: AbortSignal
): Promise<ConflictOfInterest[]> {
  // Validate legislator ID to prevent XSS/SQLi
  const validatedId = validateId(legislatorId, 'legislatorId');
  const response = await fetcher<{ data: ConflictOfInterest[] }>(
    `/api/v1/conflicts?legislatorId=${validatedId}`,
    signal ? { signal } : undefined
  );
  return response.data;
}

export async function getBillConflicts(
  billId: string,
  signal?: AbortSignal
): Promise<ConflictOfInterest[]> {
  // Validate bill ID to prevent XSS/SQLi
  const validatedId = validateId(billId, 'billId');
  const response = await fetcher<{ data: ConflictOfInterest[] }>(
    `/api/v1/conflicts?billId=${validatedId}`,
    signal ? { signal } : undefined
  );
  return response.data;
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkHealth(): Promise<{ status: string }> {
  return fetcher<{ status: string }>('/api/health');
}
