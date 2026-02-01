/**
 * Type Guards
 *
 * Runtime type validation functions that provide TypeScript type narrowing.
 * Used to safely validate request data and runtime values.
 *
 * @module utils/type-guards
 */

import type { Request } from 'express';
import type { AuthenticatedUser, SessionData } from '../types/express.js';

/**
 * Type guard to check if request has a valid session with ID.
 *
 * @param req - Express request object
 * @returns True if request has session with valid ID
 *
 * @example
 * if (hasSession(req)) {
 *   // TypeScript knows req.session exists and has id property
 *   const sessionId = req.session.id;
 * }
 */
export function hasSession(req: Request): req is Request & { session: SessionData } {
  return (
    req.session !== undefined &&
    req.session !== null &&
    typeof req.session === 'object' &&
    'id' in req.session &&
    typeof req.session.id === 'string' &&
    req.session.id.length > 0
  );
}

/**
 * Type guard to check if request has authenticated user.
 *
 * @param req - Express request object
 * @returns True if request has authenticated user
 *
 * @example
 * if (hasAuthenticatedUser(req)) {
 *   // TypeScript knows req.user exists
 *   const userId = req.user.id;
 * }
 */
export function hasAuthenticatedUser(
  req: Request
): req is Request & { user: AuthenticatedUser } {
  return (
    req.user !== undefined &&
    req.user !== null &&
    typeof req.user === 'object' &&
    'id' in req.user &&
    typeof req.user.id === 'string' &&
    req.user.id.length > 0
  );
}

/**
 * Type guard to check if value is a non-empty string.
 *
 * @param value - Value to check
 * @returns True if value is non-empty string
 *
 * @example
 * if (isNonEmptyString(token)) {
 *   // TypeScript knows token is string
 *   console.log(token.toUpperCase());
 * }
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if value is a valid number (not NaN or Infinity).
 *
 * @param value - Value to check
 * @returns True if value is valid number
 *
 * @example
 * if (isValidNumber(value)) {
 *   // TypeScript knows value is number
 *   const doubled = value * 2;
 * }
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Type guard to check if value is a valid positive integer.
 *
 * @param value - Value to check
 * @returns True if value is positive integer
 *
 * @example
 * if (isPositiveInteger(id)) {
 *   // TypeScript knows id is number
 *   const recordId = id;
 * }
 */
export function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0
  );
}

/**
 * Type guard to check if value is a plain object (not null, array, or other special types).
 *
 * @param value - Value to check
 * @returns True if value is plain object
 *
 * @example
 * if (isPlainObject(data)) {
 *   // TypeScript knows data is Record<string, unknown>
 *   const keys = Object.keys(data);
 * }
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Type guard to check if value is an array of specific type.
 *
 * @param value - Value to check
 * @param itemGuard - Type guard function for array items
 * @returns True if value is array of specified type
 *
 * @example
 * if (isArrayOf(data, isNonEmptyString)) {
 *   // TypeScript knows data is string[]
 *   const firstItem = data[0].toUpperCase();
 * }
 */
export function isArrayOf<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(itemGuard);
}

/**
 * Type guard to check if error is an Error instance with a message.
 *
 * @param error - Error value to check
 * @returns True if error is Error instance
 *
 * @example
 * try {
 *   // risky operation
 * } catch (error) {
 *   if (isErrorWithMessage(error)) {
 *     console.log(error.message);
 *   }
 * }
 */
export function isErrorWithMessage(error: unknown): error is Error {
  return (
    error instanceof Error &&
    typeof error.message === 'string'
  );
}

/**
 * Type guard to check if value is defined (not null or undefined).
 *
 * @param value - Value to check
 * @returns True if value is defined
 *
 * @example
 * const values = [1, null, 2, undefined, 3];
 * const defined = values.filter(isDefined); // [1, 2, 3]
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Assert that a condition is true, throwing an error if not.
 * Useful for narrowing types when you know a condition must be true.
 *
 * @param condition - Condition to assert
 * @param message - Error message if assertion fails
 * @throws Error if condition is false
 *
 * @example
 * assertDefined(user, 'User must be authenticated');
 * // TypeScript knows user is defined after this line
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert that a value is defined (not null or undefined).
 *
 * @param value - Value to assert
 * @param message - Error message if assertion fails
 * @throws Error if value is null or undefined
 *
 * @example
 * assertDefined(config.apiKey, 'API key must be configured');
 * // TypeScript knows config.apiKey is defined after this line
 */
export function assertDefined<T>(
  value: T,
  message: string
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`Assertion failed: ${message}`);
  }
}
