import assert from 'node:assert/strict';
import { expect, test, vi } from 'vitest';
import { createBusyRunner, createLatestRunner } from './latest.ts';

/** A promise the test settles by hand, so completion order is the test's to choose. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test('a later run overtakes an earlier one: only the latest reports, though both resolve', async () => {
  const runner = createLatestRunner();
  const first = deferred<string>();
  const second = deferred<string>();
  const reported: string[] = [];
  const handlers = {
    onResult: (value: string) => reported.push(`result ${value}`),
    onSettled: () => reported.push('settled'),
  };
  const earlier = runner.run(() => first.promise, handlers);
  const later = runner.run(() => second.promise, handlers);
  second.resolve('b');
  first.resolve('a');
  assert.deepEqual(await earlier, { ok: true, value: 'a' });
  assert.deepEqual(await later, { ok: true, value: 'b' });
  assert.deepEqual(reported, ['result b', 'settled']);
});

test('an earlier run that lands first is still silent once a later one has started', async () => {
  const runner = createLatestRunner();
  const first = deferred<string>();
  const second = deferred<string>();
  const reported: string[] = [];
  const handlers = {
    onResult: (value: string) => reported.push(value),
    onSettled: () => reported.push('settled'),
  };
  const earlier = runner.run(() => first.promise, handlers);
  const later = runner.run(() => second.promise, handlers);
  first.resolve('a');
  await earlier;
  assert.deepEqual(reported, []);
  second.resolve('b');
  await later;
  assert.deepEqual(reported, ['b', 'settled']);
});

test('a failure is always logged, and only the latest run tells the reader', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const runner = createLatestRunner();
  const first = deferred<void>();
  const second = deferred<void>();
  const errors: unknown[] = [];
  const handlers = { onError: (error: unknown) => errors.push(error) };
  const earlier = runner.run(() => first.promise, handlers);
  const later = runner.run(() => second.promise, handlers);
  const stale = new Error('stale');
  const current = new Error('current');
  first.reject(stale);
  second.reject(current);
  assert.deepEqual(await earlier, { ok: false, error: stale });
  assert.deepEqual(await later, { ok: false, error: current });
  assert.deepEqual(errors, [current]);
  assert.deepEqual(log.mock.calls, [[stale], [current]]);
  log.mockRestore();
});

test('a synchronous throw is a failure of the run, not of the caller', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const runner = createLatestRunner();
  const error = new Error('sync');
  const onError = vi.fn();
  assert.deepEqual(
    await runner.run(
      () => {
        throw error;
      },
      { onError },
    ),
    { ok: false, error },
  );
  expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  log.mockRestore();
});

test('cancelling drops the run in flight without starting another', async () => {
  const runner = createLatestRunner();
  const pending = deferred<string>();
  const onResult = vi.fn();
  const onSettled = vi.fn();
  const run = runner.run(() => pending.promise, { onResult, onSettled });
  runner.cancel();
  pending.resolve('late');
  assert.deepEqual(await run, { ok: true, value: 'late' });
  expect(onResult).not.toHaveBeenCalled();
  expect(onSettled).not.toHaveBeenCalled();
  const next = vi.fn();
  await runner.run(() => 'now', { onResult: next });
  expect(next).toHaveBeenCalledExactlyOnceWith('now');
});

test('the action starts at once, before the first await', () => {
  const runner = createLatestRunner();
  const action = vi.fn(() => deferred<void>().promise);
  void runner.run(action);
  expect(action).toHaveBeenCalledOnce();
});

test('a run asked for while another is in flight is refused, not queued', async () => {
  const runner = createBusyRunner();
  const pending = deferred<void>();
  const second = vi.fn();
  const first = runner.run(() => pending.promise);
  assert.equal(runner.busy, true);
  assert.equal(await runner.run(second), false);
  expect(second).not.toHaveBeenCalled();
  pending.resolve();
  assert.equal(await first, true);
  assert.equal(runner.busy, false);
  assert.equal(await runner.run(second), true);
  expect(second).toHaveBeenCalledOnce();
});

test('a refused run starts and settles nothing', async () => {
  const runner = createBusyRunner();
  const pending = deferred<void>();
  const handlers = { onStart: vi.fn(), onError: vi.fn(), onSettled: vi.fn() };
  const first = runner.run(() => pending.promise);
  await runner.run(() => {}, handlers);
  expect(handlers.onStart).not.toHaveBeenCalled();
  expect(handlers.onSettled).not.toHaveBeenCalled();
  pending.resolve();
  await first;
});

test('a busy run starts busy and settles idle, in that order', async () => {
  const runner = createBusyRunner();
  const seen: string[] = [];
  await runner.run(() => seen.push(`action busy=${runner.busy}`), {
    onStart: () => seen.push(`start busy=${runner.busy}`),
    onSettled: () => seen.push(`settled busy=${runner.busy}`),
  });
  assert.deepEqual(seen, ['start busy=true', 'action busy=true', 'settled busy=false']);
});

test('a failed busy run is logged, reported, settled, and leaves the runner free', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const runner = createBusyRunner();
  const error = new Error('landmark');
  const seen: string[] = [];
  const ok = await runner.run(
    async () => {
      throw error;
    },
    {
      onError: (reported) => seen.push(reported === error ? 'error' : 'wrong error'),
      onSettled: () => seen.push(`settled busy=${runner.busy}`),
    },
  );
  assert.equal(ok, false);
  assert.deepEqual(seen, ['error', 'settled busy=false']);
  expect(log).toHaveBeenCalledExactlyOnceWith(error);
  assert.equal(await runner.run(() => {}), true);
  log.mockRestore();
});

test('the latest run settles even when its handler throws', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const runner = createLatestRunner();
  const onSettled = vi.fn();
  const failure = new Error('handler');
  await expect(
    runner.run(() => Promise.reject(new Error('action')), {
      onError: () => {
        throw failure;
      },
      onSettled,
    }),
  ).rejects.toBe(failure);
  expect(onSettled).toHaveBeenCalledOnce();
  log.mockRestore();
});

test('PANEL-31 a run whose value is false resolves as ok and hands false to the latest run only', async () => {
  const runner = createLatestRunner();
  const earlier = deferred<boolean>();
  const later = deferred<boolean>();
  const reported: boolean[] = [];
  const first = runner.run(() => earlier.promise, { onResult: (value) => reported.push(value) });
  const second = runner.run(() => later.promise, { onResult: (value) => reported.push(value) });
  later.resolve(false);
  earlier.resolve(true);
  assert.deepEqual(await second, { ok: true, value: false });
  assert.deepEqual(await first, { ok: true, value: true });
  assert.deepEqual(reported, [false], 'the panel reads false as not applied');
});
