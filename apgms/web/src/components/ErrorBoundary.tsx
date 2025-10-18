import React from 'react';
import { StatusMessage } from './StatusMessage.js';

type ErrorBoundaryState = { hasError: boolean; error?: Error };

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: React.DependencyList;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    if (!resetKeys) return;

    const hasChanged = resetKeys.some((key, index) => !Object.is(key, prevProps.resetKeys?.[index]));
    if (hasChanged && this.state.hasError) {
      this.reset();
    }
  }

  reset() {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <StatusMessage
            variant="error"
            title="Something went wrong"
            description={this.state.error?.message ?? 'An unexpected error occurred.'}
            action={
              <button type="button" onClick={() => this.reset()}>
                Try again
              </button>
            }
          />
        )
      );
    }

    return this.props.children;
  }
}
