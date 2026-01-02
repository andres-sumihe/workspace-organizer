import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">Oops! Something went wrong</CardTitle>
              <CardDescription>
                We're sorry, but the application ran into an unexpected problem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Don't worry — your data is safe. Please try one of the options below to get back on track.
              </p>
              
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleReload} className="gap-2 w-full">
                  <RefreshCw className="h-4 w-4" />
                  Restart Application
                </Button>
                <Button variant="outline" onClick={this.handleReset} className="w-full">
                  Try Again
                </Button>
              </div>

              {/* Technical details - hidden by default, for support purposes */}
              {this.state.error && (
                <div className="pt-2">
                  <button
                    onClick={this.toggleDetails}
                    className="flex items-center justify-center gap-1 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {this.state.showDetails ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Hide technical details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show technical details
                      </>
                    )}
                  </button>
                  
                  {this.state.showDetails && (
                    <div className="mt-2 rounded-lg bg-muted p-3">
                      <p className="text-xs font-mono text-muted-foreground break-all">
                        {this.state.error.message}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
