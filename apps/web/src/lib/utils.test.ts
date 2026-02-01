/**
 * Tests for utility functions
 * @module lib/utils.test
 */
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (className utility)', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles undefined values', () => {
    const result = cn('foo', undefined, 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles null values', () => {
    const result = cn('foo', null, 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles boolean conditions', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn('base', isActive && 'active', isDisabled && 'disabled');
    expect(result).toBe('base active');
  });

  it('handles array of class names', () => {
    const result = cn(['foo', 'bar']);
    expect(result).toBe('foo bar');
  });

  it('handles object with boolean values', () => {
    const result = cn({ foo: true, bar: false, baz: true });
    expect(result).toBe('foo baz');
  });

  it('merges Tailwind classes correctly (later class wins)', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });

  it('handles responsive Tailwind modifiers', () => {
    const result = cn('text-sm', 'md:text-base', 'lg:text-lg');
    expect(result).toBe('text-sm md:text-base lg:text-lg');
  });

  it('handles hover and focus states', () => {
    const result = cn('bg-white', 'hover:bg-gray-100', 'focus:ring-2');
    expect(result).toBe('bg-white hover:bg-gray-100 focus:ring-2');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('handles empty string', () => {
    const result = cn('', 'foo', '');
    expect(result).toBe('foo');
  });

  it('returns empty string for no arguments', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('handles mixed input types', () => {
    const result = cn(
      'base',
      undefined,
      ['array-class'],
      { 'object-class': true, 'excluded': false },
      true && 'conditional-class'
    );
    expect(result).toBe('base array-class object-class conditional-class');
  });

  it('handles Tailwind padding/margin conflicts', () => {
    const result = cn('px-2 py-4', 'px-4');
    expect(result).toBe('py-4 px-4');
  });

  it('handles flex and grid classes', () => {
    const result = cn('flex items-center', 'justify-between');
    expect(result).toBe('flex items-center justify-between');
  });
});
