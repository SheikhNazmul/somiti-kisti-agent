// Login screen with a "server waking up" state for the Render free plan.
import { api } from '../api.js';
import { session } from '../session.js';
import { esc, icon, errorText } from '../ui.js';

const WAKE_LIMIT_MS = 150000; // give the sleeping server up to 2.5 minutes

let serverReady = false;

export function renderLogin(root, { onLoggedIn }) {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <section class="login-art">
          <div class="brand">
            <div class="brand-mark" style="background:#fff"><span style="border-color:#12B76A"></span></div>
            <div><div class="brand-name">Islamic Saving Circle</div><div class="brand-sub">Somiti Kisti Agent</div></div>
          </div>
          <div>
            <h1>সমিতির হিসাব,<br>এক জায়গায় সহজে।</h1>
            <p class="lead">সাপ্তাহিক কিস্তি আদায়, গাতা গ্রুপের রাউন্ড আর সদস্যদের হিসাব — সাথে বাংলায় কথা বলা AI সহকারী।</p>
          </div>
          <div class="art-cards" aria-hidden="true">
            <div class="art-card c1"><div class="stat-ico ico-green">${icon('wallet')}</div><div><b>কিস্তি আদায়</b><span>এলাকা ধরে ভিজিট তালিকা</span></div></div>
            <div class="art-card c2"><div class="stat-ico ico-orange">${icon('circle')}</div><div><b>গাতা রাউন্ড</b><span>কে দিয়েছে, কে বাকি</span></div></div>
            <div class="art-card c3"><div class="stat-ico ico-black">${icon('chat')}</div><div><b>AI সহকারী</b><span>বাংলায় প্রশ্ন করুন</span></div></div>
          </div>
        </section>

        <section class="login-form-side">
          <div>
            <span class="server-pill" id="server-pill"><span class="dot"></span><span id="server-text">সার্ভারের সাথে সংযোগ দেখা হচ্ছে…</span></span>
          </div>
          <div>
            <h2 style="font-size:28px">স্বাগতম 👋</h2>
            <p class="muted" style="margin-top:6px">আপনার সমিতির অ্যাকাউন্ট দিয়ে লগইন করুন।</p>
          </div>

          <div class="waking hidden" id="waking" role="status">
            <span class="spin"></span>
            <div><b>সার্ভার জাগছে, একটু অপেক্ষা করুন…</b><span id="waking-sub">ফ্রি সার্ভার ঘুমিয়ে থাকলে প্রথমবার প্রায় ১ মিনিট লাগতে পারে।</span></div>
          </div>

          <form id="login-form" novalidate>
            <div class="form-error hidden" id="login-error" role="alert"></div>
            <label class="field"><span>ইমেইল</span>
              <input class="input" type="email" name="email" id="email" autocomplete="username" required placeholder="you@somiti.local"></label>
            <label class="field"><span>পাসওয়ার্ড</span>
              <div class="pw-wrap">
                <input class="input" type="password" name="password" id="password" autocomplete="current-password" required placeholder="••••••••">
                <button type="button" class="pw-toggle" id="pw-toggle">দেখুন</button>
              </div></label>
            <button class="btn btn-black btn-lg btn-block" type="submit" id="login-btn">লগইন করুন ${icon('arrow', 18)}</button>
          </form>
          <p class="tiny muted">সমস্যা হলে আপনার সমিতির অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
        </section>
      </div>
    </div>`;

  const pill = root.querySelector('#server-pill');
  const pillText = root.querySelector('#server-text');
  const waking = root.querySelector('#waking');
  const wakingSub = root.querySelector('#waking-sub');
  const form = root.querySelector('#login-form');
  const errBox = root.querySelector('#login-error');
  const btn = root.querySelector('#login-btn');
  const pw = root.querySelector('#password');

  root.querySelector('#pw-toggle').addEventListener('click', (e) => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'লুকান' : 'দেখুন';
  });

  let wakeStart = 0;
  let wakeTimer = null;
  let alive = true;

  const setPill = (state, text) => {
    pill.className = `server-pill ${state}`;
    pillText.textContent = text;
  };
  const showWaking = (on) => {
    if (on) {
      if (!wakeStart) wakeStart = Date.now();
      waking.classList.remove('hidden');
      setPill('wait', 'সার্ভার জাগছে…');
      if (!wakeTimer) {
        wakeTimer = setInterval(() => {
          const s = Math.round((Date.now() - wakeStart) / 1000);
          wakingSub.textContent = `ফ্রি সার্ভার ঘুমিয়ে ছিল, জাগতে প্রায় ১ মিনিট লাগে। অপেক্ষা: ${new Intl.NumberFormat('bn-BD').format(s)} সেকেন্ড`;
        }, 1000);
      }
    } else {
      waking.classList.add('hidden');
      clearInterval(wakeTimer);
      wakeTimer = null;
      wakeStart = 0;
    }
  };
  const setError = (msg) => {
    if (msg) { errBox.textContent = msg; errBox.classList.remove('hidden'); }
    else { errBox.classList.add('hidden'); errBox.textContent = ''; }
  };
  const setBusy = (busy, text) => {
    btn.disabled = busy;
    btn.innerHTML = busy ? `<span class="spin white"></span> ${esc(text || 'লগইন হচ্ছে…')}` : `লগইন করুন ${icon('arrow', 18)}`;
  };

  /** Ping /health until the server answers or the time limit passes. */
  async function waitForServer() {
    if (serverReady) return true;
    const started = Date.now();
    let slowTimer = setTimeout(() => alive && showWaking(true), 2500);
    while (alive && Date.now() - started < WAKE_LIMIT_MS) {
      try {
        await api.health(15000);
        clearTimeout(slowTimer);
        serverReady = true;
        if (alive) { showWaking(false); setPill('ok', 'সার্ভার প্রস্তুত'); }
        return true;
      } catch (err) {
        if (err.status && !err.isWaking) {
          // Server answered with some other status — it is awake.
          clearTimeout(slowTimer);
          serverReady = true;
          if (alive) { showWaking(false); setPill('ok', 'সার্ভার প্রস্তুত'); }
          return true;
        }
        if (alive) showWaking(true);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    clearTimeout(slowTimer);
    if (alive) { showWaking(false); setPill('bad', 'সার্ভারে পৌঁছানো যাচ্ছে না'); }
    return false;
  }

  // Start waking the server as soon as the login page opens.
  if (serverReady) setPill('ok', 'সার্ভার প্রস্তুত');
  else waitForServer();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    const email = root.querySelector('#email').value.trim();
    const password = pw.value;
    if (!email || !password) { setError('ইমেইল ও পাসওয়ার্ড দুটোই লিখুন।'); return; }
    if (!root.querySelector('#email').checkValidity()) { setError('সঠিক ইমেইল ঠিকানা লিখুন।'); return; }

    setBusy(true, serverReady ? 'লগইন হচ্ছে…' : 'সার্ভার জাগার অপেক্ষা…');
    const deadline = Date.now() + WAKE_LIMIT_MS;
    try {
      const ok = await waitForServer();
      if (!ok) { setError('সার্ভার এখনও সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।'); return; }
      setBusy(true, 'লগইন হচ্ছে…');
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          await session.login(email, password);
          showWaking(false);
          alive = false;
          onLoggedIn();
          return;
        } catch (err) {
          if (err.isWaking && Date.now() < deadline) {
            showWaking(true);
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      showWaking(false);
      if (err.status === 401 || err.status === 400) setError('ইমেইল বা পাসওয়ার্ড ভুল হয়েছে। আবার চেষ্টা করুন।');
      else if (err.status === 403) setError('এই অ্যাকাউন্টটি বন্ধ আছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
      else if (err.status === 422) setError('ইমেইল ও পাসওয়ার্ড ঠিকভাবে লিখুন।');
      else setError(errorText(err));
      session.logout();
    } finally {
      if (alive) setBusy(false);
    }
  });

  root.querySelector('#email').focus();
}
