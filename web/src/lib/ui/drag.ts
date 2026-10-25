/**
 * Whether any of these sliders is being dragged: from its first input until the
 * drag ends, however it ends. A drag released on its start value, or cancelled,
 * fires no `change`, so the pointer's release, its cancel and a lost focus end it too.
 */
export function trackDrag(sliders: Iterable<EventTarget>, onEnd: () => void) {
  const inputs = [...sliders];
  let dragging = false;
  const start = () => {
    dragging = true;
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    onEnd();
  };
  const ends = ['change', 'pointerup', 'pointercancel', 'blur'] as const;
  for (const slider of inputs) {
    slider.addEventListener('input', start);
    for (const type of ends) slider.addEventListener(type, end);
  }
  return {
    get dragging() {
      return dragging;
    },
    dispose() {
      for (const slider of inputs) {
        slider.removeEventListener('input', start);
        for (const type of ends) slider.removeEventListener(type, end);
      }
    },
  };
}
