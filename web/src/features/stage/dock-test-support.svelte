<!-- Fixture for the dock tests: the stage host as the Stage region renders it, with the dock, stubs for the Section and Lesion bodies, and a tab stop each side. Not shipped. -->
<script lang="ts">
  import type { FakeEngine } from '../../lib/engine/fake.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Hemisphere, Language, SessionState } from '../../lib/types/index.ts';
  import '../../styles/index.css';
  import Dock from './Dock.svelte';
  import type { DockCommands } from './dock-commands.ts';
  import './stage-vars.css';

  interface Props {
    engine: FakeEngine;
    stage: StageLayout;
    /** Reactive, so a test can change the language, the status or the tract reference. */
    live: {
      lang: Language;
      status: SessionState['status'];
      tractReference: boolean;
      hasSpinalCord: boolean;
      phone: boolean;
      view: {
        view: string;
        hemisphere: Hemisphere;
        cortexVisible: boolean;
        cortexOpacity: number;
        internalVisible: boolean;
        spinalCordVisible: boolean;
      };
    };
    commands: DockCommands;
    width: number;
    height: number;
    /** Each placing state the dock asks for. */
    placing: boolean[];
  }

  let { engine, stage, live, commands, width, height, placing }: Props = $props();

  let host: HTMLElement;

  // What StageOverlay writes: the rectangle the reader can see.
  $effect(() => {
    const { visibleRect: rect, hostSize: size } = stage;
    if (!rect || !size) return;
    host.style.setProperty('--vis-top', `${rect.y}px`);
    host.style.setProperty('--vis-left', `${rect.x}px`);
    host.style.setProperty('--vis-right', `${size.width - rect.x - rect.width}px`);
    host.style.setProperty('--vis-bottom', `${size.height - rect.y - rect.height}px`);
  });
</script>

<button type="button">Before</button>
<main
  id="viewport"
  bind:this={host}
  tabindex="-1"
  style:width="{width}px"
  style:height="{height}px"
  style="--vis-top: 0px; --vis-left: 0px; --vis-right: 0px; --vis-bottom: 0px; --stage-edge: #3a3d42;"
>
  <canvas id="stage-canvas" tabindex="0" aria-label="Brain model"></canvas>
  <Dock
    {engine}
    {stage}
    media={{
      get phone() {
        return live.phone;
      },
    }}
    lang={live.lang}
    status={live.status}
    tractReference={live.tractReference}
    view={live.view}
    hasSpinalCord={live.hasSpinalCord}
    {commands}
    onLesionPlacing={(next) => placing.push(next)}
  >
    {#snippet sectionPopover()}
      <p class="stage-field-label">Cutting plane</p>
      <button type="button">Sagittal</button>
    {/snippet}
    {#snippet lesionPopover()}
      <p class="stage-field-label">Radius</p>
      <button type="button">Remove</button>
    {/snippet}
  </Dock>
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
