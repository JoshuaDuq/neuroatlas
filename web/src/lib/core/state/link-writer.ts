/**
 * Writes the scene's link once the scene settles: debounced, and held while a
 * link is being applied, so the address bar keeps that link rather than the
 * half-built scene its downloads leave on screen. `hold` takes the restore's
 * intent check; the hold ends with that restore or once a later command overtakes it.
 */
export function createLinkWriter(write: () => void, delay = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let holding: () => boolean = () => false;
  return {
    /** Writes after `wait` ms of stillness; the default is the writer's own delay. */
    schedule(wait = delay) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!holding()) write();
      }, wait);
    },
    hold(current: () => boolean) {
      holding = current;
    },
    release(current: () => boolean) {
      if (holding === current) holding = () => false;
    },
    cancel() {
      clearTimeout(timer);
    },
  };
}

/** Whether a link names the brain on screen; an omitted one means the published default. */
export const sameSubject = (
  link: { anatomy?: string | null },
  anatomy: string,
  defaultAnatomy: string,
): boolean => (link.anatomy ?? defaultAnatomy) === anatomy;
