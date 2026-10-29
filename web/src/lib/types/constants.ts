/** Camera presets, in the order the legacy `VIEW_DIRECTIONS` declares them (render/camera-views.js:8). */
export const VIEW_NAMES = [
  'oblique',
  'left',
  'right',
  'anterior',
  'posterior',
  'superior',
  'inferior',
] as const;

/** Section modes (slices/sections.js:7, state/url-state.js:55). */
export const CUTS = ['off', 'sagittal', 'coronal', 'axial', 'oblique'] as const;

/**
 * What the cortical surface is coloured by (model/brain-atlas.js:68, state/url-state.js:36).
 * The legacy code declares this list twice; there is one here.
 */
export const SURFACE_COLORS = ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'territory'] as const;

export const FUNCTIONAL_LEVELS = ['named', 'sections'] as const;

export const HEMISPHERES = ['both', 'left', 'right'] as const;

/** The workspace's explorers (state/url-state.js:38). */
export const EXPLORERS = ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion'] as const;

/** The workspace's modes (ui/chrome/workspace.js:6): the same list as the explorers. */
export const MODES = EXPLORERS;

/** What colours the brain beside a placed lesion: nothing, its functions' territories, or its findings' regions. */
export const LESION_MODES = ['lesion', 'functions', 'deficits'] as const;

/** A placed lesion's radius slider, in millimetres. */
export const LESION_RADIUS = { min: 3, max: 30, initial: 10 } as const;

/**
 * The compact interface. CSS cannot share it (custom media is not native), so
 * the literal is repeated in phone.css, stage.css, dialogs.css and masthead.css;
 * a test keeps them in step (render/device.js:13).
 */
export const PHONE_QUERY = '(max-width: 800px), (max-height: 480px) and (orientation: landscape)';

/** The narrower phone device profile, kept apart from the layout query (render/device.js:15). */
export const PHONE_DEVICE_QUERY =
  '(max-width: 640px), (max-height: 480px) and (orientation: landscape)';

/** A finger rather than a mouse (render/device.js:21). */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';
