import { h, initial } from './ui.js';
import { clearToken, getToken } from './api.js';
import { loadUser, currentUser, resetUser } from './session.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMembers } from './views/members.js';
import { renderMemberDetail } from './views/memberDetail.js';
import { renderLoans } from './views/loans.js';
import { renderGata } from './views/gata.js';
import { renderChat } from './views/chat.js';

const root = document.getElementById('app');

const NAV = [
  ['#/', 'ড্যাশবোর্ড'],
  ['#/members', 'সদস্য'],
  ['#/loans', 'ঋণ ও কিস্তি'],
  ['#/gata', 'গাটা গ্রুপ'],
  ['#/chat', 'এআই সহকারী'],
];

function shell(activeHash, content) {
  const u = currentUser();
  const nav = NAV.map(([href, label]) =>
    h('a', { href, class: activeHash === href ? 'active' : '' }, label));
  return h('div', { class: 'shell' },
    h('aside', { class: 'side' },
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, '৳'), 'সমিতি কিস্তি'),
      h('nav', { class: 'nav' }, nav),
      h('div', { class: 'spacer' }),
      h('div', { class: 'me' }, h('span', { class: 'avatar' }, initial(u?.full_name)),
        h('div', null, u?.full_name, h('small', null, u?.role === 'admin' ? 'অ্যাডমিন' : 'কালেক্টর'))),
      h('button', { class: 'logout', onClick: logout }, 'লগআউট')),
    h('main', { class: 'main' }, content));
}

function logout() {
  clearToken();
  resetUser();
  window.location.hash = '#/login';
}

function parse() {
  const hash = window.location.hash || '#/';
  const m = hash.match(/^#\/members\/(\d+)$/);
  if (m) return { key: '#/members', view: renderMemberDetail, arg: Number(m[1]) };
  const table = {
    '#/': renderDashboard, '#/members': renderMembers, '#/loans': renderLoans,
    '#/gata': renderGata, '#/chat': renderChat,
  };
  return table[hash] ? { key: hash, view: table[hash] } : { key: '#/', view: renderDashboard };
}

async function route() {
  const hash = window.location.hash || '#/';
  if (hash === '#/login') {
    if (getToken()) { window.location.hash = '#/'; return; }
    root.replaceChildren(renderLogin(async () => { await loadUser(); window.location.hash = '#/'; }));
    return;
  }
  if (!getToken()) { window.location.hash = '#/login'; return; }
  if (!currentUser()) {
    try { await loadUser(); } catch { clearToken(); window.location.hash = '#/login'; return; }
  }
  const { key, view, arg } = parse();
  const content = h('div', null);
  root.replaceChildren(shell(key, content));
  content.replaceWith(await view(arg));
}

window.addEventListener('hashchange', route);
route();
