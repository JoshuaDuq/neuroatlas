/**
 * Writes the scene's link once the scene settles: debounced, and held while a
 * link is being applied, so the address bar keeps that link rather than the
 * half-built scene its downloads leave on screen. `hold` takes the restore's
 * intent check; the hold ends with that restore or once a later command overtakes it.
 */
export function createLinkWriter(write, delay = 250) {
  let timer = null;
  let holding = () => false;
  return {
    schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!holding()) write();
      }, delay);
    },
    hold(current) { holding = current; },
    release(current) {
      if (holding === current) holding = () => false;
    },
    cancel() { clearTimeout(timer); },
  };
}

/** Whether a link names the brain on screen; an omitted one means the published default. */
export const sameSubject = (link, anatomy, defaultAnatomy) => (link.anatomy ?? defaultAnatomy) === anatomy;
