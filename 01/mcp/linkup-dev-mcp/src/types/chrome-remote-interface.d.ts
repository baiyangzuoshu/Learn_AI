/**
 * Type declarations for chrome-remote-interface.
 * Minimal types for our CDP usage.
 */

declare module 'chrome-remote-interface' {
  interface CDPClient {
    Runtime: {
      evaluate(params: {
        expression: string;
        returnByValue?: boolean;
        awaitPromise?: boolean;
        timeout?: number;
      }): Promise<{ result: { type: string; value?: any; description?: string }; exceptionDetails?: any }>;
      enable(): Promise<void>;
      disable(): Promise<void>;
      consoleAPICalled?: (params: {
        type: string;
        args: Array<{ type: string; value?: any; description?: string }>;
        timestamp: number;
        stackTrace?: { callFrames: Array<{ functionName: string; url: string; lineNumber: number }> };
      }) => void;
    };
    Page: {
      captureScreenshot(params?: {
        format?: string;
        quality?: number;
      }): Promise<{ data: string }>;
      enable(): Promise<void>;
      disable(): Promise<void>;
    };
    close(): Promise<void>;
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
  }

  interface CDPTarget {
    id: string;
    type: string;
    title: string;
    url: string;
    webSocketDebuggerUrl?: string;
  }

  interface CDPStatic {
    (options?: { host?: string; port?: number; target?: string | CDPTarget }): Promise<CDPClient>;
    List(options?: { host?: string; port?: number }): Promise<CDPTarget[]>;
  }

  const CDP: CDPStatic;
  export default CDP;
  export { CDPClient, CDPTarget, CDPStatic };
  export = CDP;
}
