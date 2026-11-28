// Entry point: session bootstrap, app shell and hash router.
import { onUnauthorized, tokenStore } from './api.js';
import { session } from './session.js';
import { invalidate } from './data.js';
import { esc, icon, initials, label, errorText } from './ui.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMembers } from './views/members.js';
import { renderMemberDetail } from './views/member-detail.js';
import { renderLoans } from './views/loans.js';
import { renderGata, renderGataDetail } from './views/gata.js';
import { renderChat } from './views/chat.js';

const app = document.getElementById('app');

const NAV = [
  { hash: '#/dashboard', text: 'ড্যাশবোর্ড', short: 'হোম', ic: 'home' },
  { hash: '#/members', text: 'সদস্য', short: 'সদস্য', ic: 'users' },
  { hash: '#/loans', text: 'ঋণ ও বকেয়া', short: 'কিস্তি', ic: 'wallet' },
  { hash: '#/gata', text: 'গাতা গ্রুপ', short: 'গাতা', ic: 'circle' },
  { hash: '#/chat', text: 'AI সহকারী', short: 'AI', ic: 'chat' },
];

const ROUTES = [
  { re: /^#\/dashboard$/, view: renderDashboard },
  { re: /^#\/members$/, view: renderMembers },
  { re: /^#\/members\/(\d+)$/, view: renderMemberDetail },
  { re: /^#\/loans$/, view: renderLoans },
  { re: /^#\/gata$/, view: renderGata },
  { re: /^#\/gata\/(\d+)$/, view: renderGataDetail },
  { re: /^#\/chat$/, view: renderChat },
];

let renderSeq = 0;
let shellMounted = false;

function brandHTML() {
  return `<div class="brand">
    <div class="brand-mark" aria-hidden="true"><span></span></div>
    <div><div class="brand-name">Islamic Saving Circle</div><div class="brand-sub">Somiti Kisti Agent</div></div>
  </div>`;
}

function mountShell() {
  const u = session.user;
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        ${brandHTML()}
        <nav class="nav" aria-label="প্রধান মেনু">
          ${NAV.map((n) => `<a href="${n.hash}" data-nav="${n.hash}">${icon(n.ic)}<span>${n.text}</span></a>`).join('')}
        </nav>
        <div class="side-foot">
          <div class="user-card">
            <div class="avatar green">${esc(initials(u.full_name))}</div>
            <div class="who">
              <div class="name">${esc(u.full_name)}</div>
              <span class="badge b-green">${esc(label('role', u.role))}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-block" data-logout>${icon('logout', 18)} লগআউট</button>
        </div>
      </aside>
      <div class="main-col">
        <header class="topbar">
          ${brandHTML()}
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge b-green">${esc(label('role', u.role))}</span>
            <button class="icon-btn" data-logout aria-label="লগআউট">${icon('logout', 18)}</button>
          </div>
        </header>
        <main class="main" id="view" tabindex="-1"></main>
      </div>
      <nav class="bottom-nav" aria-label="মোবাইল মেনু">
        ${NAV.map((n) => `<a href="${n.hash}" data-nav="${n.hash}">${icon(n.ic, 20)}<span>${n.short}</span></a>`).join('')}
        <a href="#/logout" data-logout>${icon('logout', 20)}<span>বের হন</span></a>
      </nav>
    </div>`;
  app.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  }));
  shellMounted = true;
}

function setActiveNav(hash) {
  const base = '#/' + (hash.split('/')[1] || '');
  app.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === base));
}

function logout() {
  session.logout();
  invalidate();
  shellMounted = false;
  if (location.hash !== '#/login') location.hash = '#/login';
  else route();
}

async function route() {
  const seq = ++renderSeq;
  let hash = location.hash || '';

  if (!tokenStore.get()) {
    shellMounted = false;
    if (hash !== '#/login') { history.replaceState(null, '', '#/login'); }
    renderLogin(app, {
      onLoggedIn: () => {
        const next = sessionStorage.getItem('isc_next');
        sessionStorage.removeItem('isc_next');
        location.hash = next && next !== '#/login' ? next : '#/dashboard';
      },
    });
    return;
  }

  if (!session.user) {
    app.innerHTML = `<div class="boot"><div class="brand-mark big"><span></span></div><p class="boot-text">আপনার তথ্য লোড হচ্ছে…</p></div>`;
    try {
      await session.loadMe();
    } catch (err) {
      if (err.status === 401) return; // handled by onUnauthorized
      app.innerHTML = `<div class="boot"><div class="brand-mark big"><span></span></div>
        <p class="boot-text">${esc(errorText(err))}</p>
        <button class="btn btn-black" id="boot-retry">${icon('refresh', 18)} আবার চেষ্টা</button></div>`;
      document.getElementById('boot-retry').addEventListener('click', route);
      return;
    }
    if (seq !== renderSeq) return;
  }

  if (hash === '' || hash === '#' || hash === '#/' || hash === '#/login') {
    history.replaceState(null, '', '#/dashboard');
    hash = '#/dashboard';
  }

  if (!shellMounted || !document.getElementById('view')) mountShell();
  setActiveNav(hash);

  const view = document.getElementById('view');
  const match = ROUTES.map((r) => ({ r, m: hash.match(r.re) })).find((x) => x.m);
  if (!match) {
    history.replaceState(null, '', '#/dashboard');
    setActiveNav('#/dashboard');
    renderDashboard(view, [], () => seq === renderSeq);
    return;
  }
  window.scrollTo(0, 0);
  const isCurrent = () => seq === renderSeq;
  try {
    await match.r.view(view, match.m.slice(1), isCurrent);
  } catch (err) {
    if (!isCurrent() || err.status === 401) return;
    view.innerHTML = `<div class="error-box">${esc(errorText(err))}</div>`;
  }
}

onUnauthorized(() => {
  const h = location.hash;
  if (h && h !== '#/login') sessionStorage.setItem('isc_next', h);
  session.logout();
  invalidate();
  shellMounted = false;
  if (location.hash !== '#/login') location.hash = '#/login';
  else route();
});

window.addEventListener('hashchange', route);
route();
