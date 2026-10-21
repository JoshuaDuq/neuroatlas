export function bindAppLifecycle(app, events = globalThis) {
  function onPageHide(event) {
    if (event.persisted) return;
    events.removeEventListener('pagehide', onPageHide);
    app.dispose();
  }
  events.addEventListener('pagehide', onPageHide);
}
