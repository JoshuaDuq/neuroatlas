import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet } from './sheet.js';
import { PHONE_QUERY } from '../../render/device.js';

function sheetFixture(t, callbacks = {}, { width = 390, height = 800 } = {}) {
  const names = ['document', 'matchMedia', 'getComputedStyle', 'addEventListener', 'removeEventListener', 'ResizeObserver', 'innerWidth'];
  const previous = new Map(names.map(name => [name, globalThis[name]]));
  const windowEvents = new EventTarget();
  const queries = new Map();
  const nodes = new Map();
  const doc = { activeElement: null };
  function element(id) {
    const node = new EventTarget();
    const attributes = new Map();
    node.dataset = {};
    node.style = { removeProperty(name) { delete this[name]; } };
    node.children = [];
    node.setAttribute = (name, value) => attributes.set(name, String(value));
    node.hasAttribute = name => attributes.has(name);
    node.toggleAttribute = (name, force = !attributes.has(name)) => {
      if (force) attributes.set(name, ''); else attributes.delete(name);
    };
    node.remove = () => {};
    node.focus = () => { if (node.checkVisibility?.() !== false) doc.activeElement = node; };
    node.getBoundingClientRect = () => ({
      top: id === 'sheet' ? 668 : 0,
      left: 0,
      bottom: id === 'sheet-grip' ? 800 : 0,
      height: id === 'sheet' ? parseFloat(node.style.height ?? '132') : 800,
      width: id === 'sheet' ? parseFloat(node.style.width ?? '252') : 844,
    });
    node.querySelector = () => element('grip-row');
    return node;
  }
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  };
  Object.assign(doc, { getElementById: byId, createElement: element, body: { append() {} } });
  globalThis.document = doc;
  const matches = query => {
    const landscape = width > height;
    const maxWidth = Number(query.match(/max-width:\s*(\d+)px/)?.[1] ?? 0);
    return query === '(orientation: landscape)' ? landscape
      : width <= maxWidth || (height <= 480 && landscape);
  };
  globalThis.matchMedia = query => {
    if (!queries.has(query)) {
      const media = new EventTarget();
      media.matches = matches(query);
      queries.set(query, media);
    }
    return queries.get(query);
  };
  globalThis.getComputedStyle = () => ({ paddingRight: '0', paddingBottom: '0', paddingLeft: '0', borderRightWidth: '1' });
  globalThis.addEventListener = windowEvents.addEventListener.bind(windowEvents);
  globalThis.removeEventListener = windowEvents.removeEventListener.bind(windowEvents);
  globalThis.ResizeObserver = undefined;
  globalThis.innerWidth = width;
  const controller = createSheet(callbacks);
  t.after(() => {
    controller.dispose();
    for (const [name, value] of previous) globalThis[name] = value;
  });
  function pointer(type, y, id = 1) {
    const event = new Event(type);
    Object.assign(event, { pointerId: id, isPrimary: true, button: 0, clientY: y, clientX: y });
    (type === 'pointerdown' ? byId('sheet-grip') : windowEvents).dispatchEvent(event);
  }
  function changeMedia(landscape, matches) {
    const query = [...queries.entries()].find(([name]) => (name !== PHONE_QUERY) === landscape)[1];
    query.matches = matches;
    query.dispatchEvent(new Event('change'));
  }
  function click(id, detail, target = byId(id)) {
    const event = new Event('click');
    Object.defineProperties(event, { detail: { value: detail }, target: { value: target } });
    byId(id).dispatchEvent(event);
  }
  function resize(nextWidth = width, nextHeight = height) {
    width = nextWidth;
    height = nextHeight;
    globalThis.innerWidth = width;
    for (const [query, media] of queries) {
      const next = matches(query);
      if (next === media.matches) continue;
      media.matches = next;
      media.dispatchEvent(new Event('change'));
    }
    windowEvents.dispatchEvent(new Event('resize'));
  }
  return {
    doc, byId, pointer, click, controller,
    blur: () => windowEvents.dispatchEvent(new Event('blur')),
    resize,
    landscape: matches => changeMedia(true, matches),
    phone: matches => changeMedia(false, matches),
  };
}

test('a 681px viewport uses sheet detents through 800px and restores desktop rails above them', t => {
  const shells = [];
  const insets = [];
  const { byId, click, controller, resize } = sheetFixture(t, {
    onShell: shell => shells.push(shell),
    onInsets: next => insets.push(next),
  }, { width: 681, height: 800 });
  const sheet = byId('sheet');
  assert.equal(controller.isPhone, true);
  assert.equal(shells.at(-1), 'sheet');
  assert.equal(sheet.style.height, '132px');
  click('sheet-handle', 0);
  assert.equal(sheet.style.height, '400px');
  click('sheet-handle', 0);
  assert.equal(sheet.style.height, '672px');

  resize(821);
  assert.equal(controller.isPhone, false);
  assert.equal(shells.at(-1), 'rails');
  assert.equal(sheet.style.height, undefined);
  assert.equal(byId('sheet-grip').hidden, true);
  assert.deepEqual(insets.at(-1), { top: 0, right: 0, bottom: 0, left: 0 });

  resize(800);
  assert.equal(controller.isPhone, true);
  assert.equal(sheet.style.height, '672px', 'returning to the sheet preserves its previous detent');
  assert.equal(byId('sheet-grip').hidden, false);
  resize(1000);
  assert.equal(controller.isPhone, false);
  assert.equal(sheet.style.height, undefined);
  assert.equal(shells.at(-1), 'rails');
});

test('a narrow landscape viewport taller than 480px keeps the bottom-sheet axis', t => {
  const insets = [];
  const { byId, pointer } = sheetFixture(t, { onInsets: next => insets.push(next) }, { width: 600, height: 500 });
  const sheet = byId('sheet');

  assert.equal(sheet.style.height, '132px');
  assert.equal(sheet.style.width, undefined);
  assert.deepEqual(insets.at(-1), { top: 0, right: 0, bottom: 132, left: 0 });
  pointer('pointerdown', 700);
  pointer('pointermove', 600);
  assert.equal(sheet.style.height, '232px', 'the bottom sheet continues to grow vertically');
});

test('losing window focus settles an active sheet drag and permits another drag', t => {
  const { byId, pointer, controller, blur } = sheetFixture(t);
  pointer('pointerdown', 700);
  pointer('pointermove', 500);
  assert.equal(byId('sheet').dataset.dragging, 'true');
  blur();
  assert.equal(byId('sheet').dataset.dragging, 'false');
  assert.equal(controller.detent, 'peek');
  assert.equal(byId('sheet').style.height, '132px');
  pointer('pointerdown', 700, 2);
  pointer('pointermove', 600, 2);
  assert.equal(byId('sheet').dataset.dragging, 'true');
});

test('a cancelled sheet drag returns to its prior detent and permits a fresh drag', t => {
  const { byId, pointer, controller } = sheetFixture(t);
  pointer('pointerdown', 700);
  pointer('pointermove', 300);
  pointer('pointercancel', 300);
  assert.equal(controller.detent, 'peek');
  assert.equal(byId('sheet').style.height, '132px');
  assert.equal(byId('sheet').dataset.dragging, 'false');
  pointer('pointerdown', 700, 2);
  pointer('pointermove', 600, 2);
  assert.equal(byId('sheet').dataset.dragging, 'true');
});

test('cancellation from another pointer leaves the active sheet drag alone', t => {
  const { byId, pointer } = sheetFixture(t);
  pointer('pointerdown', 700);
  pointer('pointermove', 600);
  pointer('pointercancel', 600, 2);
  assert.equal(byId('sheet').dataset.dragging, 'true');
  pointer('pointermove', 500);
  assert.equal(byId('sheet').style.height, '332px');
});

for (const control of ['sheet-handle', 'sheet-selection', 'sheet-tabs']) {
  test(`keyboard activation of ${control} raises the sheet immediately`, t => {
    const { byId, click, controller } = sheetFixture(t);
    const target = control === 'sheet-tabs' ? { closest: () => ({ role: 'tab' }) } : byId(control);
    click(control, 0, target);
    assert.equal(controller.detent, 'half');
    assert.equal(byId('sheet').hasAttribute('data-instant'), true);
  });
}

test('a pointer handle activation restores motion after a keyboard activation', t => {
  const { byId, click, controller } = sheetFixture(t);
  click('sheet-handle', 0);
  click('sheet-handle', 1);
  assert.equal(controller.detent, 'full');
  assert.equal(byId('sheet').hasAttribute('data-instant'), false);
});

test('losing focus before the drag threshold clears the pending press', t => {
  const { byId, pointer, blur } = sheetFixture(t);
  pointer('pointerdown', 700);
  blur();
  pointer('pointerdown', 700, 2);
  pointer('pointermove', 600, 2);
  assert.equal(byId('sheet').dataset.dragging, 'true');
});

test('resizing cancels an active sheet drag before remeasuring its rest', t => {
  const { byId, pointer, resize } = sheetFixture(t);
  pointer('pointerdown', 700);
  pointer('pointermove', 500);
  resize();
  assert.equal(byId('sheet').dataset.dragging, 'false');
  assert.equal(byId('sheet').style.height, '132px');
  pointer('pointermove', 400);
  assert.equal(byId('sheet').style.height, '132px', 'the old pointer cannot resume a drag with stale measurements');
  pointer('pointerdown', 700, 2);
  pointer('pointermove', 600, 2);
  assert.equal(byId('sheet').dataset.dragging, 'true');
});

test('rotation cancels a pending press before changing the sheet drag axis', t => {
  const { byId, pointer, landscape } = sheetFixture(t);
  pointer('pointerdown', 700);
  landscape(true);
  const width = byId('sheet').style.width;
  pointer('pointermove', 400);
  assert.equal(byId('sheet').dataset.dragging, 'false');
  assert.equal(byId('sheet').style.width, width, 'the upright press cannot change the side sheet');
});

test('leaving the phone shell cancels its drag before returning to the desktop grid', t => {
  const { byId, pointer, phone } = sheetFixture(t);
  pointer('pointerdown', 700);
  pointer('pointermove', 500);
  phone(false);
  pointer('pointermove', 400);
  assert.equal(byId('sheet').dataset.dragging, 'false');
  assert.equal(byId('sheet').style.height, undefined, 'the old pointer cannot size the desktop grid');
});

for (const initialView of ['list', 'detail']) {
  test(`opening ${initialView === 'detail' ? 'the same detail again' : 'detail'} from the focused grip moves focus into the raised panel`, t => {
    let detentAtOpen;
    const { doc, byId } = sheetFixture(t, {
      onSelection() {
        detentAtOpen = byId('sheet').dataset.detent;
        byId('sheet').dataset.view = 'detail';
      },
    });
    byId('sheet').dataset.view = initialView;
    const back = byId('detail-back');
    back.checkVisibility = () => byId('sheet').dataset.detent !== 'peek' && byId('sheet').dataset.view === 'detail';
    byId('sheet-selection').focus();
    byId('sheet-selection').dispatchEvent(new Event('click'));
    assert.equal(detentAtOpen, 'half', 'the detail is exposed before its activation callback runs');
    assert.equal(doc.activeElement, back, 'focus leaves the grip title that the detail hides');
  });
}

test('a grip selection activated without focus does not take focus from another control', t => {
  const { doc, byId } = sheetFixture(t, {
    onSelection() { byId('sheet').dataset.view = 'detail'; },
  });
  const other = byId('other-control');
  other.focus();
  byId('sheet-selection').dispatchEvent(new Event('click'));
  assert.equal(byId('sheet').dataset.detent, 'half');
  assert.equal(doc.activeElement, other);
});
