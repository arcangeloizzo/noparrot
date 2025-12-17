import React from "react";
import { Button } from "@/components/ui/button";

type ErrorState = {
  hasError: boolean;
  errorMessage?: string;
  stack?: string;
  source?: "render" | "window.error" | "unhandledrejection";
};

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorState
> {
  state: ErrorState = { hasError: false };

  private handleWindowError = (event: ErrorEvent) => {
    const message = event.error?.message || event.message || "Errore JavaScript";
    const stack = event.error?.stack;
    this.setState({
      hasError: true,
      errorMessage: message,
      stack,
      source: "window.error",
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason: any = event.reason;
    const message =
      (reason && (reason.message || reason.toString?.())) ||
      "Promise rejection non gestita";
    const stack = reason?.stack;

    this.setState({
      hasError: true,
      errorMessage: message,
      stack,
      source: "unhandledrejection",
    });
  };

  static getDerivedStateFromError(): Partial<ErrorState> {
    return { hasError: true, source: "render" };
  }

  componentDidCatch(error: Error) {
    this.setState({
      errorMessage: error.message,
      stack: error.stack,
      source: "render",
    });
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection
    );
  }

  private buildDebugText() {
    const { errorMessage, stack, source } = this.state;
    return [
      `source: ${source ?? "unknown"}`,
      `message: ${errorMessage ?? "(no message)"}`,
      stack ? `\nstack:\n${stack}` : "",
      `\nurl: ${window.location.href}`,
      `ua: ${navigator.userAgent}`,
      `time: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private copyDebug = async () => {
    const text = this.buildDebugText();
    try {
      await navigator.clipboard.writeText(text);
      // No toast dependency here to avoid cascading failures
      alert("Dettagli copiati negli appunti");
    } catch {
      alert(text);
    }
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-sm">
          <h1 className="text-lg font-semibold">Errore nell’app</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Si è verificato un errore. Premi “Copia dettagli” e incollali qui in
            chat.
          </p>

          <div className="mt-3 rounded-md border border-border bg-background p-3">
            <p className="text-xs font-mono break-words">
              {this.state.errorMessage || "Errore sconosciuto"}
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <Button type="button" variant="default" onClick={this.copyDebug}>
              Copia dettagli
            </Button>
            <Button type="button" variant="outline" onClick={this.reload}>
              Ricarica
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
