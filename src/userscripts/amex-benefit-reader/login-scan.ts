import { isSupportedAmexOrigin, SELECTED_CARD_DISPLAY } from "./visible-context";

/** Observe the account UI, never credentials, cookies, or intercepted traffic. */
export function watchAmexLogin(options: {
  scan(): Promise<void>;
  cancel(): void;
  isBusy(): boolean;
  root?: Document;
  location?: Pick<Location, "origin" | "pathname">;
}): () => void {
  const root = options.root ?? document;
  const location = options.location ?? window.location;
  let scanned = false;
  let stopped = false;
  let pending: ReturnType<typeof setTimeout> | undefined;

  const check = () => {
    if (stopped || !isSupportedAmexOrigin(location)) return;
    // Explicit login transitions re-arm a same-document login. A temporarily
    // missing selector during SPA rendering must not trigger another scan.
    if (/(?:^|\/)(?:log-?in|logon|log-?out|sign-?in|sign-?out)(?:\/|$)/i.test(location.pathname)) {
      if (scanned) options.cancel();
      scanned = false;
      return;
    }
    if (scanned || !root.querySelector(SELECTED_CARD_DISPLAY)) return;
    scanned = true;
    // A manual scan already in progress satisfies this login too.
    if (options.isBusy()) return;
    // Do not retry on DOM mutations, cancellation, or failed authentication.
    void options.scan().catch(() => undefined);
  };
  const schedule = () => {
    if (!stopped && pending === undefined) pending = setTimeout(() => {
      pending = undefined;
      check();
    }, 100);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-testid", "role"] });
  // History API transitions do not necessarily mutate the DOM or emit popstate.
  const timer = setInterval(check, 1000);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("focus", schedule);
  check();
  return () => {
    stopped = true;
    observer.disconnect();
    clearInterval(timer);
    clearTimeout(pending);
    window.removeEventListener("pageshow", schedule);
    window.removeEventListener("focus", schedule);
  };
}
