import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepAnatomyCached } from './keep-cached.ts';

describe('keepAnatomyCached', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('registers sw.js at the app base in a built site', () => {
    const register = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    vi.stubEnv('PROD', true);
    keepAnatomyCached();
    expect(register).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  });

  it('does nothing in development, or without service workers', () => {
    const register = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    vi.stubEnv('PROD', false);
    keepAnatomyCached();
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', {});
    keepAnatomyCached();
    expect(register).not.toHaveBeenCalled();
  });

  it('warns when registration fails rather than passing unseen', async () => {
    const failure = new Error('no sw.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: async () => {
          throw failure;
        },
      },
    });
    vi.stubEnv('PROD', true);
    keepAnatomyCached();
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Service worker registration failed:', failure),
    );
  });
});
