<!-- Fixture for the section tests: G2's dock on the stage host, with the Section popover and the section row as its snippets, and a tab stop each side. Not shipped. -->
<script lang="ts">
  import type { FakeEngine } from '../../lib/engine/fake.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language, Paint, SurfaceColor } from '../../lib/types/index.ts';
  import '../../styles/index.css';
  import Tooltip from '../../lib/ui/Tooltip.svelte';
  import Dock from '../stage/Dock.svelte';
  import type { DockCommands } from '../stage/dock-commands.ts';
  import '../stage/stage-vars.css';
  import SectionBar from './SectionBar.svelte';
  import SectionPopover from './SectionPopover.svelte';
  import type { SectionControls } from './section-controls.svelte.ts';

  interface Props {
    engine: FakeEngine;
    stage: StageLayout;
    controls: SectionControls;
    /** Reactive, so a test can change the language, the phone layout, the colouring or the tract reference. */
    live: {
      lang: Language;
      phone: boolean;
      tractReference: boolean;
      view: { surfaceColor: SurfaceColor; paint: Paint | null };
    };
    width: number;
    height: number;
  }

  let { engine, stage, controls, live, width, height }: Props = $props();

  const commands: DockCommands = {
    chooseView() {},
    reset() {},
    setHemisphere() {},
    setCortexVisible() {},
    setCortexOpacity() {},
    setInternalVisible() {},
    setSpinalCordVisible: async () => {},
  };

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

<Tooltip />
<button type="button">Before</button>
<main
  id="viewport"
  bind:this={host}
  tabindex="-1"
  style:width="{width}px"
  style:height="{height}px"
  style="--vis-top: 0px; --vis-left: 0px; --vis-right: 0px; --vis-bottom: 0px; --stage-edge: #3a3d42;"
>
  <Dock
    {engine}
    {stage}
    media={{
      get phone() {
        return live.phone;
      },
    }}
    lang={live.lang}
    status="ready"
    tractReference={live.tractReference}
    view={{
      view: 'oblique',
      hemisphere: 'both',
      cortexVisible: true,
      cortexOpacity: 1,
      internalVisible: true,
      spinalCordVisible: false,
    }}
    hasSpinalCord={false}
    {commands}
    onLesionPlacing={() => {}}
  >
    {#snippet sectionPopover({ close })}
      <SectionPopover {controls} lang={live.lang} phone={live.phone} {close} />
    {/snippet}
    {#snippet sectionBar()}
      <SectionBar
        {controls}
        {stage}
        lang={live.lang}
        view={live.view}
        tractReference={live.tractReference}
      />
    {/snippet}
    {#snippet lesionPopover()}{/snippet}
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
