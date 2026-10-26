import type { AnatomyCommands } from '../../lib/controller/anatomy.ts';
import type { ViewName } from '../../lib/types/index.ts';

/** What the dock's controls do; the stage's owner (I2) wires them to the controller and the session. */
export type DockCommands = Pick<
  AnatomyCommands,
  | 'reset'
  | 'setHemisphere'
  | 'setCortexVisible'
  | 'setCortexOpacity'
  | 'setInternalVisible'
  | 'setSpinalCordVisible'
> & {
  /** The session names the view and the camera frames it (app.js:443). */
  chooseView(view: ViewName): void;
};
