<!-- Fixture for the orientation gizmo tests: the stage host with its variables, a canvas, the gizmo and a tab stop each side. Not shipped. -->
<script lang="ts">
  import type { FakeEngine } from '../../lib/engine/fake.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import '../../styles/index.css';
  import type { DockCommands } from './dock-commands.ts';
  import OrientationGizmo from './OrientationGizmo.svelte';
  import './stage-vars.css';

  interface Props {
    engine: FakeEngine;
    stage: StageLayout;
    /** Reactive, so a test can change the language, whether the anatomy is ready and the session's view. */
    live: { lang: Language; ready: boolean; view: string };
    commands: Pick<DockCommands, 'chooseView' | 'reset'>;
    /** The host's --vis-* and --key-* variables, in pixels. */
    insets: { top: number; right: number; keyTop: number; keyRight: number };
  }

  let { engine, stage, live, commands, insets }: Props = $props();
</script>

<button type="button">Before</button>
<main
  id="viewport"
  tabindex="-1"
  style:--vis-top="{insets.top}px"
  style:--vis-right="{insets.right}px"
  style:--key-top="{insets.keyTop}px"
  style:--key-right="{insets.keyRight}px"
  style="width: 900px; height: 600px; --vis-left: 0px; --vis-bottom: 0px; --stage-edge: #3a3d42;"
>
  <canvas id="stage-canvas" tabindex="0" aria-label="Brain model"></canvas>
  <OrientationGizmo
    {engine}
    {stage}
    lang={live.lang}
    ready={live.ready}
    viewName={live.view}
    {commands}
  />
</main>
<button type="button">After</button>

<style>
  @layer features {
    button {
      color: var(--text-primary);
      background: var(--surface-base);
    }
    main {
      position: relative;
      overflow: hidden;
      background: var(--scene-background);
    }
  }
</style>
