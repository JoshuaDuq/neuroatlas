import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotice } from './notice.js';

/** Notice placement and controls, without a renderer or downloaded anatomy. */
function noticeDocument(t) {
  const previous = globalThis.document;
  const nodes = new Map();
  const doc = { activeElement: null };
  const byId = id => {
    if (nodes.has(id)) return nodes.get(id);
    const listeners = new Map();
    const node = {
      id, children: [], parentElement: null, dataset: {}, textContent: '', hidden: false,
      setAttribute() {},
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
      click() { listeners.get('click')?.(); },
      contains(target) { return target === node || node.children.some(child => child.contains(target)); },
      append(...children) {
        for (const child of children) {
          if (child.parentElement) {
            child.parentElement.children = child.parentElement.children.filter(item => item !== child);
            if (child.contains(doc.activeElement)) doc.activeElement = null;
          }
          child.parentElement = node;
          node.children.push(child);
        }
      },
      prepend(child) { node.append(child); node.children.unshift(node.children.pop()); },
      after(child) {
        const parent = node.parentElement;
        parent.append(child);
        parent.children.pop();
        parent.children.splice(parent.children.indexOf(node) + 1, 0, child);
      },
      focus() { doc.activeElement = node; },
    };
    nodes.set(id, node);
    return node;
  };
  doc.getElementById = byId;
  globalThis.document = doc;
  t.after(() => { globalThis.document = previous; });
  byId('masthead').append(byId('masthead-data-wrap'));
  byId('sheet-grip').append(byId('sheet-tabs'));
  byId('workspace-panel').append(byId('workspace-tabs'), byId('notice'), byId('navigator'), byId('inspector'));
  byId('notice').append(byId('notice-text'), byId('notice-action'), byId('notice-dismiss'));
  return { byId, doc };
}

test('notices follow the task tabs in both shells without moving navigation', t => {
  const { byId, doc } = noticeDocument(t);
  let dismissed = 0;
  const actions = [];
  const notice = createNotice({ onDismiss: () => dismissed++, onAction: name => actions.push(name) });
  t.after(() => notice.dispose());
  const node = byId('notice');
  const dismiss = byId('notice-dismiss');

  for (const shell of ['rails', 'sheet', 'rails']) {
    dismiss.focus();
    notice.setShell(shell);
    const parent = byId(shell === 'sheet' ? 'sheet-grip' : 'workspace-panel');
    assert.equal(node.parentElement, parent);
    assert.equal(parent.children.indexOf(node), 1);
    assert.equal(doc.activeElement, dismiss, 'moving the notice preserves focus on its dismiss command');
  }

  assert.deepEqual(byId('masthead').children.map(child => child.id), ['masthead-data-wrap']);
  notice.update({ lang: 'en', notice: { text: 'Planum was updated.', action: 'reload' } });
  assert.equal(byId('notice-action').textContent, 'Reload');
  byId('notice-action').click();
  notice.update({ lang: 'fr', notice: { text: 'Amygdala.', action: 'see-through' } });
  assert.equal(byId('notice-action').textContent, 'Voir à travers le cortex');
  byId('notice-action').click();
  notice.update({ lang: 'en', notice: { text: 'Nothing to do.' } });
  assert.equal(byId('notice-action').hidden, true);
  assert.throws(() => notice.update({ lang: 'en', notice: { text: 'x', action: 'fly' } }), /Unknown notice action: fly/);
  dismiss.click();
  assert.deepEqual(actions, ['reload', 'see-through']);
  assert.equal(dismissed, 1);
});
