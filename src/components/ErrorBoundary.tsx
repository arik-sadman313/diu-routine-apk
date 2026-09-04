import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/50 m-4 shadow-sm">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
            <AlertOctagon className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
            Planner couldn't display this item.
          </h2>
          <p className="text-red-600/80 dark:text-red-400/80 max-w-sm mb-6 text-sm">
            A rendering error occurred. You can safely retry loading the planner.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-500/20 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          
          {import.meta.env.DEV && this.state.error && (
            <div className="mt-6 p-4 bg-black/5 dark:bg-black/20 rounded-lg text-left text-xs font-mono text-red-800 dark:text-red-300 overflow-auto max-w-full">
              {this.state.error.message}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
