import './styles/index.css'; // First: its @layer statement must lead the bundled CSS, ahead of every component's styles.
import { mount } from 'svelte';
import App from './app/App.svelte';

mount(App, { target: document.getElementById('app')! });
