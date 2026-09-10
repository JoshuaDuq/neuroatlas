import { edgeLabels } from '../render/orientation.js';
import { scaleBar } from '../render/scale-bar.js';

const VIEW_LABELS = {
  left: 'Left', right: 'Right', anterior: 'Front', posterior: 'Back',
  superior: 'Top', inferior: 'Bottom',
};

const megabytes = bytes => (bytes / 1_048_576).toFixed(1);

/**
 * Everything drawn over the canvas: anatomical orientation, the scale bar,
 * the view presets, the hover label, and the loading and error stage.
 *
 * Overlays sit on near-opaque chips because the geometry beneath them runs
 * from near-black crevices to near-white speculars, so no fixed text colour
 * would be legible against all of it.
 */
export function createViewportChrome({ onView, onRetry }) {
  const orientation = document.getElementById('orientation');
  const edges = Object.fromEntries(
    [...orientation.children].map(node => [node.dataset.edge, node]));
  const views = document.getElementById('views');
  const bar = document.getElementById('scale-bar');
  const barRule = bar.querySelector('.scale-bar-rule');
  const barText = bar.querySelector('.measure');
  const hover = document.getElementById('hover-label');
  const stage = document.getElementById('stage');
  const stageMessage = document.getElementById('stage-message');
  const stageProgress = document.getElementById('stage-progress');
  const stageBar = document.getElementById('stage-bar');
  const retry = document.getElementById('stage-retry');

  const buttons = Object.entries(VIEW_LABELS).map(([view, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.view = view;
    button.addEventListener('click', () => onView(view));
    views.append(button);
    return button;
  });

  retry.addEventListener('click', onRetry);

  return {
    update(state) {
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
      }
      const ready = state.status === 'ready' || state.status === 'switching';
      orientation.hidden = !ready;
      bar.hidden = !ready;

      if (state.status === 'error') {
        stageMessage.textContent = state.error?.message ?? 'Something went wrong.';
        stageProgress.hidden = true;
        retry.hidden = false;
        return;
      }
      retry.hidden = true;
      if (state.status === 'loading') {
        const { loaded, total } = state.progress ?? {};
        stageProgress.hidden = !total;
        if (total) {
          stageBar.style.width = `${Math.round((loaded / total) * 100)}%`;
          stageMessage.textContent =
            `Loading anatomy · ${megabytes(loaded)} / ${megabytes(total)} MB`;
        } else {
          stageMessage.textContent = 'Loading anatomy…';
        }
      }
    },

    /** Called every frame the camera moves, outside the state loop. */
    updateCamera(camera, distance, viewportHeight) {
      const labels = edgeLabels(camera);
      for (const [edge, node] of Object.entries(edges)) node.textContent = labels[edge];
      const { millimetres, pixels } = scaleBar(camera.fov, distance, viewportHeight);
      barRule.style.width = `${Math.round(pixels)}px`;
      barText.textContent = `${millimetres} mm`;
    },

    showHover(label, position) {
      if (!label || !position) {
        hover.hidden = true;
        return;
      }
      hover.hidden = false;
      hover.textContent = label;
      const bounds = hover.parentElement.getBoundingClientRect();
      hover.style.left =
        `${Math.min(position.x + 14, bounds.width - hover.offsetWidth - 8)}px`;
      hover.style.top =
        `${Math.min(position.y + 14, bounds.height - hover.offsetHeight - 8)}px`;
    },

    dispose() {
      retry.removeEventListener('click', onRetry);
      views.replaceChildren();
    },
  };
}
