import * as lp from './lp.js';
import * as transport from './transport.js';
import * as markov from './markov.js';
import * as queues from './queues.js';

const modules = { lp, transport, markov, queues };
Object.entries(modules).forEach(([id, m]) => m.mount(document.getElementById(id)));

const tabs = [...document.querySelectorAll('[role=tab]')];

function select(id, focus = false) {
  if (!modules[id]) id = 'lp';
  tabs.forEach((t) => {
    const on = t.getAttribute('aria-controls') === id;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (on && focus) t.focus();
  });
  history.replaceState(null, '', '#' + id);
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t.getAttribute('aria-controls')));
  t.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (d) select(tabs[(i + d + tabs.length) % tabs.length].getAttribute('aria-controls'), true);
  });
});

select(location.hash.slice(1));
addEventListener('hashchange', () => select(location.hash.slice(1)));
