// A fake roving group for the node unit and parity tests (viewer/ui/roving.test.js:5-38), shared by both.

export interface FakeItem {
  index: number;
  disabled: boolean;
  hidden: boolean;
  tabIndex: number;
  pressed: boolean;
  getAttribute(name: string): string | null;
  focus(): void;
}

export interface Spec {
  pressed?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export function fakeGroup(specs: Spec[]) {
  const doc: { activeElement: FakeItem | null } = { activeElement: null };
  const listeners: Record<string, ((event: unknown) => void) | undefined> = {};
  const items: FakeItem[] = specs.map(
    ({ pressed = false, disabled = false, hidden = false }, index) => ({
      index,
      disabled,
      hidden,
      tabIndex: 0,
      pressed,
      getAttribute(name) {
        return name === 'aria-pressed' ? String(this.pressed) : null;
      },
      focus() {
        const previous = doc.activeElement;
        doc.activeElement = this;
        if (previous) listeners.focusout?.({ target: previous, relatedTarget: this });
        listeners.focusin?.({ target: this });
      },
    }),
  );
  const group = {
    ownerDocument: doc,
    querySelectorAll: () => items,
    contains: (node: unknown) => items.includes(node as FakeItem),
    addEventListener(type: string, fn: (event: unknown) => void) {
      listeners[type] = fn;
    },
    removeEventListener(type: string) {
      delete listeners[type];
    },
  };
  /** Presses a key on the focused item (or `target`); returns whether the group handled it. */
  const press = (key: string, target: FakeItem | null = doc.activeElement, modifiers = {}) => {
    let prevented = false;
    listeners.keydown?.({
      key,
      target,
      ...modifiers,
      preventDefault() {
        prevented = true;
      },
    });
    return prevented;
  };
  const leave = () => {
    const previous = doc.activeElement;
    doc.activeElement = null;
    listeners.focusout?.({ target: previous, relatedTarget: null });
  };
  return {
    doc,
    items,
    group: group as unknown as HTMLElement,
    listeners,
    press,
    leave,
    stops: () => items.map((item) => item.tabIndex),
  };
}
