export interface OAuthWindowOptions {
  provider: string;
  url: string;
  timeoutMs?: number;
}

export interface OAuthResult<T = unknown> {
  provider: string;
  ok: boolean;
  payload?: T;
  error?: string;
}

export function openOAuthWindow<T = unknown>(options: OAuthWindowOptions): Promise<OAuthResult<T>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window_unavailable"));
  }
  const timeout = options.timeoutMs ?? 60_000;
  const popup = window.open(options.url, `${options.provider}-oauth`, "width=600,height=800");
  return new Promise<OAuthResult<T>>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("oauth_timeout"));
    }, timeout);

    function cleanup() {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      if (popup && !popup.closed) {
        popup.close();
      }
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; provider?: string; payload?: T; error?: string };
      if (!data || data.type !== "oauth:callback" || data.provider !== options.provider) {
        return;
      }
      cleanup();
      if (data.error) {
        resolve({ provider: options.provider, ok: false, error: data.error });
        return;
      }
      resolve({ provider: options.provider, ok: true, payload: data.payload });
    }

    window.addEventListener("message", onMessage);
  });
}

export function simulateOAuthCallback<T = unknown>(provider: string, payload: T) {
  if (typeof window === "undefined") {
    return;
  }
  window.postMessage({ type: "oauth:callback", provider, payload }, window.origin);
}
