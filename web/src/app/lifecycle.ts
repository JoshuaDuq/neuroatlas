/**
 * Disposes the app when the page is finally left. A page that enters the browser's back-forward
 * cache (`persisted`) may return, so it keeps its app; it is disposed once when it truly goes.
 */
export function bindAppLifecycle(
  app: { dispose(): void },
  events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = globalThis,
): void {
  function onPageHide(event: Event): void {
    if ((event as PageTransitionEvent).persisted) return;
    events.removeEventListener('pagehide', onPageHide);
    app.dispose();
  }
  events.addEventListener('pagehide', onPageHide);
}
