// S5a parity: the keymap against the legacy `onKeyDown` in viewer/app.js. The legacy handler is a
// closure inside `boot`, so its source is cut out of app.js (as viewer/app.test.js does for the
// linked MRI key) and run over fakes that log every command it issues. The new keymap runs the same
// key x focus-target x state matrix over fakes that log the same lines; the logs and whether the key
// was cancelled must agree. The deviation (docs/decisions/deviations/s5a-arrows-in-tablist.md) is
// kept out of the matrix and tested in src/lib/controller/keymap.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import {
  DOLLY_KEYS as legacyDollyKeys,
  ORBIT_KEYS as legacyOrbitKeys,
} from '../../viewer/render/keyboard-orbit.js';
import { shortcutsAllowed as legacyShortcutsAllowed } from '../../viewer/state/session.js';
import {
  characterShortcutAllowed as legacyCharacterShortcutAllowed,
  isCharacterKey as legacyIsCharacterKey,
} from '../../viewer/ui/chrome/shortcuts.js';
import { characterShortcutAllowed, isCharacterKey } from '../src/lib/core/keyboard.ts';
import { dispatchKey } from '../src/lib/controller/keymap.ts';
import type { KeymapHost, KeymapState } from '../src/lib/controller/keymap.ts';
import { repoRoot } from '../test/repo.ts';

const source = readFileSync(`${repoRoot}viewer/app.js`, 'utf8');
const between = (from: string, to: string) =>
  source.slice(source.indexOf(from), source.indexOf(to));
const onKeyDownSource = between(
  '  const onKeyDown = event => {',
  "  globalThis.addEventListener('keydown', onKeyDown);",
);
const orbitSource = between('  function orbitFromKeyboard(event) {', '  // From the keys 0–6');
const chooseViewSource = between('  function chooseView(view) {', '  const onKeyDown = event => {');

const PARAMETERS = [
  'ctx',
  'document',
  'nativeTracts',
  'keyPreference',
  'shortcutsAllowed',
  'characterShortcutAllowed',
  'isCharacterKey',
  'shortcuts',
  'workspace',
  'session',
  'model',
  'select',
  'rescueFocus',
  'closeFunction',
  'closeDeficit',
  'showList',
  'functionExplorer',
  'clinicalExplorer',
  'circuitExplorer',
  'navigator',
  'chrome',
  'applyView',
  'display',
  'focusSelection',
  'isolateSelection',
  'setSpinalCordVisible',
  'VIEW_KEYS',
  'scene',
  'ORBIT_KEYS',
  'DOLLY_KEYS',
  'turnFromKeyboard',
  'rememberZoom',
] as const;
// `tractReferenceActive` is a `let` of the closure: read here through the context.
const makeLegacy = new Function(
  ...PARAMETERS,
  `${orbitSource}\n${chooseViewSource}\n${onKeyDownSource.replaceAll('tractReferenceActive', 'ctx.tractReferenceActive')}\nreturn onKeyDown;`,
) as (...args: unknown[]) => (event: unknown) => void;

interface Focus {
  name: string;
  /** The legacy target: `matches` is the control test, `closest` the PANELS test. */
  legacy: Record<string, unknown>;
  /** The new target: `matches` is the control test, `closest` finds a `data-own-keys` region. */
  next: Record<string, unknown>;
  canvas?: true;
  /** A tab keeps ArrowUp and ArrowDown: the deviation, tested in keymap.test.ts. */
  tab?: boolean;
}
/**
 * `kind` is the selector of the control the element is (button, summary or tab), or null for none;
 * `region` is whether it is inside a region that marks its keys as its own. `matches` answers from
 * the kind, so a changed control selector shows.
 */
const own = (tagName: string, kind: string | null, region: boolean, extra = {}): Focus => {
  const matches = (selector: string) => kind !== null && selector.split(', ').includes(kind);
  return {
    name: `${tagName}${kind ? ` ${kind}` : ''}${region ? ' in a marked region' : ''}`,
    legacy: { tagName, matches, closest: () => region, ...extra },
    next: {
      tagName,
      matches,
      closest: (selector: string) =>
        selector === '[role="tab"]' ? kind === selector : selector.includes('own-keys') && region,
      ...extra,
    },
    tab: kind === '[role="tab"]',
  };
};
const FOCI: Focus[] = [
  { name: 'nothing', legacy: null as never, next: null as never },
  own('BODY', null, false),
  own('BUTTON', 'button', false),
  own('BUTTON', 'button', true),
  own('SUMMARY', 'summary', true),
  own('SUMMARY', 'summary', false),
  own('BUTTON', '[role="tab"]', true),
  own('DIV', '[role="tab"]', true),
  own('DIV', '[role="tab"]', false),
  own('DIV', null, true),
  own('INPUT', null, true, { type: 'text' }),
  own('INPUT', null, false, { type: 'checkbox' }),
  own('INPUT', null, true, { type: 'checkbox' }),
  own('INPUT', null, true, { type: 'range' }),
  own('INPUT', null, false, { type: 'range' }),
  own('TEXTAREA', null, false),
  own('SELECT', null, false),
  own('DIV', null, false, { isContentEditable: true }),
  { ...own('CANVAS', null, false), canvas: true },
];

const KEYS = [
  'Escape',
  '?',
  '/',
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  '+',
  '=',
  '-',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  'f',
  'F',
  'i',
  'c',
  'u',
  's',
  'h',
  'H',
  'm',
  'M',
  'a',
  ' ',
  'Enter',
  'Tab',
];

const EXPLORERS = ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion'] as const;
const MODIFIERS = [{}, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }];

interface Scenario extends KeymapState {
  /** Both the legacy and the new reading of "the stage's canvas is focused" come from the focus. */
}
const BASE: Scenario = {
  explorer: 'anatomy',
  selectedRegion: null,
  selectedFunction: null,
  selectedDeficit: null,
  cortexVisible: true,
  internalVisible: false,
  spinalCordVisible: false,
  hemisphere: 'both',
  singleKeys: true,
  diffusionMriOpen: false,
  mprOpen: false,
  shortcutsOpen: false,
  focusInDetail: false,
  tractReferenceActive: false,
};
const REGION = { id: 'r' } as unknown as KeymapState['selectedRegion'];

const SCENARIOS: Scenario[] = [
  BASE,
  ...EXPLORERS.map((explorer) => ({ ...BASE, explorer })),
  { ...BASE, selectedRegion: REGION },
  { ...BASE, selectedRegion: REGION, focusInDetail: true },
  { ...BASE, selectedRegion: REGION, selectedFunction: 'f', explorer: 'functions' },
  { ...BASE, selectedFunction: 'f', explorer: 'functions' },
  { ...BASE, selectedFunction: 'f', explorer: 'anatomy' },
  { ...BASE, selectedDeficit: 'd', explorer: 'deficits' },
  { ...BASE, selectedFunction: 'f', selectedDeficit: 'd', explorer: 'functions' },
  { ...BASE, singleKeys: false },
  { ...BASE, singleKeys: false, selectedRegion: REGION },
  { ...BASE, shortcutsOpen: true },
  { ...BASE, shortcutsOpen: true, selectedRegion: REGION },
  { ...BASE, diffusionMriOpen: true },
  { ...BASE, mprOpen: true },
  { ...BASE, mprOpen: true, singleKeys: false },
  { ...BASE, tractReferenceActive: true, explorer: 'diffusion', selectedRegion: REGION },
  { ...BASE, tractReferenceActive: true, explorer: 'anatomy' },
  {
    ...BASE,
    hemisphere: 'left',
    cortexVisible: false,
    internalVisible: true,
    spinalCordVisible: true,
    selectedRegion: REGION,
  },
  { ...BASE, hemisphere: 'right', selectedRegion: REGION },
];

const FLAGS = [{}, { defaultPrevented: true }, { isComposing: true }];

interface Press {
  key: string;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

function run(scenario: Scenario, focus: Focus, press: Press, version: 'legacy' | 'next') {
  const log: string[] = [];
  const canvas = { name: 'canvas' };
  const target = focus.canvas
    ? Object.assign(canvas, version === 'legacy' ? focus.legacy : focus.next)
    : version === 'legacy'
      ? focus.legacy
      : focus.next;
  let prevented = false;
  const event = {
    ...press,
    key: press.key,
    target,
    defaultPrevented: press.defaultPrevented ?? false,
    isComposing: press.isComposing ?? false,
    ctrlKey: press.ctrlKey ?? false,
    metaKey: press.metaKey ?? false,
    altKey: press.altKey ?? false,
    preventDefault() {
      prevented = true;
    },
  };
  const explorerCalls: Record<string, string> = {
    anatomy: 'navigator.focusSearch',
    functions: 'functionExplorer.focusSearch',
    deficits: 'clinicalExplorer.focusSearch',
    circuits: 'circuitExplorer.focus',
    diffusion: 'nativeTracts.focus',
  };
  if (version === 'legacy') {
    const dialog = { open: scenario.mprOpen, close: () => log.push('mpr.close') };
    const tell =
      (line: string) =>
      (...args: unknown[]) =>
        log.push(args.length ? `${line}(${JSON.stringify(args)})` : line);
    const ctx = { tractReferenceActive: scenario.tractReferenceActive };
    const model = {
      state: scenario,
      setCortexVisible: (v: boolean) => log.push(`setCortexVisible(${v})`),
      setInternalVisible: (v: boolean) => log.push(`setInternalVisible(${v})`),
      setHemisphere: (v: string) => log.push(`setHemisphere(${v})`),
    };
    const handler = makeLegacy(
      ctx,
      {
        getElementById: (id: string) =>
          id === 'mpr-dialog' ? dialog : { click: tell('mpr.open') },
      },
      {
        mriOpen: scenario.diffusionMriOpen,
        focus: tell('nativeTracts.focus'),
        openMri: tell('openDiffusionMri'),
      },
      { enabled: scenario.singleKeys },
      legacyShortcutsAllowed,
      legacyCharacterShortcutAllowed,
      legacyIsCharacterKey,
      { isOpen: scenario.shortcutsOpen, toggle: tell('toggleShortcuts') },
      { focusInDetail: scenario.focusInDetail, back: tell('back') },
      { assemble: () => scenario },
      model,
      (id: unknown) => log.push(`select(${id})`),
      tell('rescueFocus'),
      tell('closeFunction'),
      tell('closeDeficit'),
      tell('showList'),
      { focusSearch: tell('functionExplorer.focusSearch') },
      { focusSearch: tell('clinicalExplorer.focusSearch') },
      { focus: tell('circuitExplorer.focus') },
      {
        focusSearch: tell('navigator.focusSearch'),
        moveFocus: (step: number) => log.push(`walkTree(${step})`),
      },
      { dismissHelp: tell('dismissHelp') },
      tell('applyView'),
      (change: () => void) => change(),
      tell('focusSelection'),
      tell('isolateSelection'),
      (v: boolean) => log.push(`setSpinalCordVisible(${v})`),
      ['left', 'right', 'anterior', 'posterior', 'superior', 'inferior'],
      { domElement: canvas, controls: { dollyIn: (f: number) => log.push(`dolly(${f})`) } },
      legacyOrbitKeys,
      legacyDollyKeys,
      (_controls: unknown, turn: unknown) => log.push(`orbitBy(${JSON.stringify(turn)})`),
      () => {},
    );
    handler(event);
  } else {
    const tell =
      (line: string) =>
      (...args: unknown[]) =>
        log.push(args.length ? `${line}(${JSON.stringify(args)})` : line);
    const host: KeymapHost = {
      canvas: canvas as unknown as EventTarget,
      state: () => scenario,
      commands: {
        back: tell('back'),
        clearSelection: tell('select(null)'),
        closeFunction: tell('closeFunction'),
        closeDeficit: tell('closeDeficit'),
        rescueFocus: tell('rescueFocus'),
        toggleShortcuts: tell('toggleShortcuts'),
        showList: tell('showList'),
        focusSearch: (explorer) => log.push(explorerCalls[explorer]),
        walkTree: (step) => log.push(`walkTree(${step})`),
        chooseView: (view, options) => {
          log.push('dismissHelp', `applyView(${JSON.stringify([view, options])})`);
        },
        openDiffusionMri: tell('openDiffusionMri'),
        openMpr: () => log.push('mpr.open'),
        closeMpr: tell('mpr.close'),
        focusSelection: tell('focusSelection'),
        isolateSelection: tell('isolateSelection'),
        setCortexVisible: (v) => log.push(`setCortexVisible(${v})`),
        setInternalVisible: (v) => log.push(`setInternalVisible(${v})`),
        setSpinalCordVisible: (v) => log.push(`setSpinalCordVisible(${v})`),
        setHemisphere: (v) => log.push(`setHemisphere(${v})`),
        orbitBy: (turn) => log.push(`orbitBy(${JSON.stringify(turn)})`),
        dolly: (factor) => log.push(`dolly(${factor})`),
      },
    };
    dispatchKey(event as unknown as KeyboardEvent, host);
  }
  return { log, prevented };
}

describe('keymap', () => {
  it('dispatches every key x focus x state x modifier as the legacy onKeyDown does', () => {
    let cases = 0;
    let acted = 0;
    for (const scenario of SCENARIOS) {
      for (const focus of FOCI) {
        for (const key of KEYS) {
          if (focus.tab && key.startsWith('Arrow') && ['ArrowUp', 'ArrowDown'].includes(key))
            continue;
          for (const modifiers of MODIFIERS) {
            for (const flags of FLAGS) {
              if (Object.keys(modifiers).length && Object.keys(flags).length) continue;
              const press = { key, ...modifiers, ...flags };
              const legacy = run(scenario, focus, press, 'legacy');
              const next = run(scenario, focus, press, 'next');
              assert.deepEqual(
                next,
                legacy,
                `${JSON.stringify(press)} on ${focus.name} in ${JSON.stringify({ ...scenario, selectedRegion: Boolean(scenario.selectedRegion) })}`,
              );
              cases += 1;
              if (legacy.log.length) acted += 1;
            }
          }
        }
      }
    }
    // The matrix exercises the table, not just the gates.
    assert.ok(cases > 20_000 && acted > 2_000, `${cases} cases, ${acted} acting`);
  });

  it('isCharacterKey and characterShortcutAllowed agree with the legacy over keys and preferences', () => {
    for (const key of [...KEYS, '', 'é', '😀', 'Dead', undefined, 5]) {
      assert.equal(isCharacterKey(key), legacyIsCharacterKey(key), String(key));
    }
    for (const enabled of [true, false]) {
      for (const kind of ['button', 'summary', '[role="tab"]', 'div', null]) {
        for (const region of [true, false]) {
          const target = {
            matches: (selector: string) => kind !== null && selector.split(', ').includes(kind),
            closest: () => region,
          };
          assert.equal(
            characterShortcutAllowed(target, enabled),
            legacyCharacterShortcutAllowed(target, enabled),
          );
        }
      }
      assert.equal(
        characterShortcutAllowed(null, enabled),
        legacyCharacterShortcutAllowed(null, enabled),
      );
    }
  });
});
