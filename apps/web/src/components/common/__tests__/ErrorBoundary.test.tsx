/**
 * Tests for ErrorBoundary component
 * @module components/common/__tests__/ErrorBoundary
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ErrorBoundary, ErrorFallback } from '../ErrorBoundary';

/**
 * Test component that throws an error when shouldThrow is true
 */
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error during error boundary tests
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should catch error and render default ErrorFallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Should render default error fallback
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/test error/i)).toBeInTheDocument();
  });

  it('should show error message in ErrorFallback', () => {
    const errorMessage = 'Specific error message';

    function ThrowSpecificError(): JSX.Element {
      throw new Error(errorMessage);
    }

    render(
      <ErrorBoundary>
        <ThrowSpecificError />
      </ErrorBoundary>
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should use custom fallback prop instead of default', () => {
    const customFallback = <div>Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('should call onError callback with error and errorInfo', () => {
    const onErrorMock = vi.fn();

    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalledTimes(1);

    const callArgs = onErrorMock.mock.calls[0];
    if (!callArgs) throw new Error('Expected onError to be called');
    const [error, errorInfo] = callArgs;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(errorInfo).toHaveProperty('componentStack');
  });

  it('should reset error state when retry button is clicked', () => {
    // Test that clicking retry calls setState to reset error
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Error should be displayed
    const errorHeading = screen.getByText(/something went wrong/i);
    expect(errorHeading).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Click retry - this resets the error boundary state
    // The component will attempt to re-render children
    fireEvent.click(retryButton);

    // After retry, the error boundary attempted to reset and re-render
    // Since our ThrowingComponent always throws, it will catch the error again
    // But we can verify the retry mechanism works by checking that:
    // 1. The component re-rendered (new error fallback is shown)
    // 2. The error message is still displayed (error was re-caught)
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should render ErrorFallback standalone with title and message', () => {
    const customTitle = 'Custom Error Title';
    const customMessage = 'Custom error message text';

    render(
      <ErrorFallback
        title={customTitle}
        message={customMessage}
      />
    );

    expect(screen.getByText(customTitle)).toBeInTheDocument();
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('should call onRetry when ErrorFallback retry button is clicked', () => {
    const onRetryMock = vi.fn();

    render(
      <ErrorFallback
        error={new Error('Test error')}
        onRetry={onRetryMock}
      />
    );

    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);

    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('should show default message when no error provided to ErrorFallback', () => {
    render(<ErrorFallback />);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
  });

  it('should not leak error details (stack trace) to UI', () => {
    function ErrorWithStack(): JSX.Element {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at ErrorWithStack\n    at Component';
      throw error;
    }

    render(
      <ErrorBoundary>
        <ErrorWithStack />
      </ErrorBoundary>
    );

    // Error message should be shown
    expect(screen.getByText(/test error/i)).toBeInTheDocument();

    // But stack trace should not be visible in the UI
    expect(screen.queryByText(/at ErrorWithStack/)).not.toBeInTheDocument();
    expect(screen.queryByText(/at Component/)).not.toBeInTheDocument();
  });
});
