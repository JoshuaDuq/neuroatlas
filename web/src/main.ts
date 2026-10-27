import './styles/index.css'; // First: its @layer statement must lead the bundled CSS, ahead of every component's styles.
import { mount } from 'svelte';
import App from './app/App.svelte';
import { createApp } from './app/application.svelte.ts';
import { shellOptions, startApp } from './app/boot.ts';
import { attachAnnouncer } from './lib/ui/announcer.svelte.ts';

// The live region is in index.html, so it exists before anything can be said.
attachAnnouncer(document.getElementById('announcer')!);

const app = createApp();
mount(App, { target: document.getElementById('app')!, ...shellOptions(app) });
await startApp(app);
