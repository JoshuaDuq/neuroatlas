import { describe, expect, test, vi } from 'vitest';
import { createPorts } from './ports.ts';

describe('the ports', () => {
  test('a command with nothing mounted fails and names itself', () => {
    const { ports } = createPorts();
    expect(() => ports.showDetail()).toThrow('showDetail');
  });

  test('a controller built first reaches the region that mounts later, with its arguments and result', () => {
    const { ports, register } = createPorts();
    const { openFunction } = ports;
    const open = vi.fn(() => 'opened');
    register({ openFunction: open });
    expect(openFunction('executive')).toBe('opened');
    expect(open).toHaveBeenCalledWith('executive');
  });

  test('a question answers no until a region answers it', () => {
    const { ports, register } = createPorts();
    expect(ports.mprOpen()).toBe(false);
    register({ mprOpen: () => true });
    expect(ports.mprOpen()).toBe(true);
  });

  test('a region that unmounts takes only its own ports away', () => {
    const { ports, register } = createPorts();
    const first = vi.fn();
    const second = vi.fn();
    const withdrawFirst = register({ showList: first });
    register({ showList: second });
    withdrawFirst();
    ports.showList();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  test('withdrawn, a command fails again', () => {
    const { ports, register } = createPorts();
    const withdraw = register({ back: vi.fn() });
    withdraw();
    expect(() => ports.back()).toThrow('back');
  });
});
