/**
 * Tests for SWR utility functions
 * @module lib/__tests__/swr.test
 */

import { describe, it, expect } from 'vitest';
import { createStableCacheKey } from '../utils/swr';

describe('createStableCacheKey', () => {
  it('should return [resource, stringifiedParams] tuple', () => {
    const result = createStableCacheKey('bills', { limit: 20 });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('bills');
    expect(typeof result[1]).toBe('string');
  });

  it('should produce identical keys regardless of object key order', () => {
    const key1 = createStableCacheKey('bills', { b: 2, a: 1 });
    const key2 = createStableCacheKey('bills', { a: 1, b: 2 });
    expect(key1).toEqual(key2);
  });

  it('should filter out undefined values', () => {
    const key = createStableCacheKey('bills', { a: 1, b: undefined, c: 3 });
    const parsed = JSON.parse(key[1]);
    expect(parsed).toEqual({ a: 1, c: 3 });
    expect('b' in parsed).toBe(false);
  });

  it('should preserve null values (only undefined is filtered)', () => {
    const key = createStableCacheKey('bills', { a: null, b: 1 });
    const parsed = JSON.parse(key[1]);
    expect(parsed).toEqual({ a: null, b: 1 });
  });

  it('should produce deterministic output for same input', () => {
    const params = { offset: 0, limit: 20, search: 'tax' };
    const key1 = createStableCacheKey('bills', params);
    const key2 = createStableCacheKey('bills', params);
    expect(key1).toEqual(key2);
  });

  it('should handle empty params object', () => {
    const key = createStableCacheKey('bills', {});
    expect(key).toEqual(['bills', '{}']);
  });

  it('should handle params with nested objects', () => {
    const key = createStableCacheKey('bills', { filters: { chamber: 'house' } });
    const parsed = JSON.parse(key[1]);
    expect(parsed.filters).toEqual({ chamber: 'house' });
  });

  it('should differentiate between different resources', () => {
    const billsKey = createStableCacheKey('bills', { limit: 20 });
    const legislatorsKey = createStableCacheKey('legislators', { limit: 20 });
    expect(billsKey[0]).not.toBe(legislatorsKey[0]);
  });
});
