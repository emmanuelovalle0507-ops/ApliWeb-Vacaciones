"use client";

import React, { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-red-50 text-red-500">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Algo salió mal</h2>
              <p className="text-sm text-gray-500">
                Ocurrió un error inesperado. Intenta recargar la página.
              </p>
            </div>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="text-left text-xs bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-40 text-red-700">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-seekop-500 text-white text-sm font-medium rounded-xl hover:bg-seekop-600 transition-colors shadow-sm"
            >
              <RefreshCw size={16} />
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
