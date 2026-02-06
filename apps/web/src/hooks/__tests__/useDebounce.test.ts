import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));

    expect(result.current).toBe('initial');
  });

  it('should not update before delay expires', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    // Update value
    rerender({ value: 'updated', delay: 300 });

    // Advance time by less than delay
    act(() => {
      vi.advanceTimersByTime(299);
    });

    // Value should still be initial
    expect(result.current).toBe('initial');
  });

  it('should update after delay expires', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    // Update value
    rerender({ value: 'updated', delay: 300 });

    // Advance time past delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Value should be updated
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid changes and only persist last value', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    // Rapid changes
    rerender({ value: 'change1', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'change2', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'change3', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Still initial because timer keeps resetting
    expect(result.current).toBe('initial');

    // Now wait full delay from last change
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should be the last value
    expect(result.current).toBe('change3');
  });

  it('should use 300ms as default delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: 'initial' },
      }
    );

    rerender({ value: 'updated' });

    // Advance by 299ms (just before default delay)
    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(result.current).toBe('initial');

    // Advance by 1ms more to reach 300ms
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe('updated');
  });

  it('should respect custom delay value', () => {
    const customDelay = 500;
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: customDelay },
      }
    );

    rerender({ value: 'updated', delay: customDelay });

    // Advance by less than custom delay
    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(result.current).toBe('initial');

    // Advance to custom delay
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe('updated');
  });

  it('should clean up timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    // Trigger a value change to create a timeout
    rerender({ value: 'updated', delay: 300 });

    // Unmount the hook
    unmount();

    // Verify clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
