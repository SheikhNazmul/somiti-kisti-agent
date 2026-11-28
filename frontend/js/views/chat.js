// AI Chat (POST /chat, full history each time) + Rule Book (POST /knowledge/search, admin: /knowledge/ingest).
import { api } from '../api.js';
import { session, can } from '../session.js';
import { esc, icon, num, initials, errorText, toast, confirmDialog } from '../ui.js';

// Conversation survives page switches until the user starts a new one or logs out.
let history = [];
let historyOwner = null;

const SUGGESTIONS = [
  'আজ কার কার কিস্তি বাকি?',
  'কারা কিস্তি খেলাপি?',
  'গাতা গ্রুপগুলোর বর্তমান অবস্থা কী?',
  'একজন সদস্য কয়টা ঋণ নিতে পারে?',
];

/** Very small, safe formatter: escape first, then **bold** and line breaks. */
function formatReply(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

export async function renderChat(view, _params, isCurrent) {
  const user = session.user;
  if (historyOwner !== user.email) { history = []; historyOwner = user.email; }

  view.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${icon('spark', 16)} বাংলায় প্রশ্ন করুন</div>
        <h1>AI সহকারী</h1>
        <p class="sub">কিস্তি, বকেয়া, গাতা আর সমিতির নিয়ম নিয়ে জিজ্ঞেস করুন। উত্তর আসে সরাসরি ডাটাবেস ও নিয়ম-বই থেকে।</p>
      </div>
    </div>
    <div class="chat-layout">
      <section class="card chat-card">
        <div class="chat-top">
          <div class="bot">
            <div class="avatar green">${icon('chat', 18)}</div>
            <div><b style="color:var(--ink)">সমিতি সহকারী</b><div class="tiny muted">AI · কয়েক সেকেন্ড লাগতে পারে</div></div>
          </div>
          <button class="btn btn-sm btn-ghost" id="new-chat">${icon('refresh', 16)} নতুন কথোপকথন</button>
        </div>
        <div class="chat-msgs" id="msgs" aria-live="polite"></div>
        <div class="chat-suggest" id="suggest">
          ${SUGGESTIONS.map((s) => `<button type="button" data-q="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>
        <form class="chat-input" id="chat-form">
          <textarea class="textarea" id="chat-text" rows="1" placeholder="এখানে লিখুন… (Enter = পাঠান, Shift+Enter = নতুন লাইন)" aria-label="বার্তা"></textarea>
          <button class="btn btn-green" type="submit" id="send">${icon('send', 18)} পাঠান</button>
        </form>
      </section>

      <aside class="card">
        <div class="card-head">
          <div><h3>${icon('book', 18)} নিয়ম-বই</h3><p>সমিতির নিয়মে সরাসরি খুঁজুন</p></div>
        </div>
        <form id="kb-form" style="display:grid;gap:10px">
          <input class="input" id="kb-q" maxlength="500" placeholder="যেমন: কিস্তি দেরিতে দিলে কী হবে?" required>
          <button class="btn btn-black" type="submit" id="kb-btn">${icon('search', 18)} খুঁজুন</button>
        </form>
        <div class="rule-results" id="kb-results"></div>
        ${can.ingest() ? `
          <div style="border-top:1px solid var(--line);margin-top:18px;padding-top:16px;display:grid;gap:10px">
            <div><b style="color:var(--ink)">নিয়ম-বই হালনাগাদ (অ্যাডমিন)</b>
              <p class="small muted">নিয়মের ফাইল থেকে জ্ঞানভান্ডার নতুন করে তৈরি হবে।</p></div>
            <button class="btn btn-orange" id="kb-ingest">${icon('bolt', 18)} Ingest চালান</button>
            <div id="kb-ingest-result" class="small"></div>
          </div>` : ''}
      </aside>
    </div>`;

  const $ = (s) => view.querySelector(`#${s}`);
  const msgs = $('msgs');
  const text = $('chat-text');
  const sendBtn = $('send');
  let busy = false;

  function bubble(role, content, extraClass = '') {
    const wrap = document.createElement('div');
    wrap.className = `msg ${role === 'user' ? 'user' : 'bot'} ${extraClass}`;
    const av = role === 'user'
      ? `<div class="avatar">${esc(initials(user.full_name))}</div>`
      : `<div class="avatar green">${icon('chat', 16)}</div>`;
    wrap.innerHTML = `${av}<div class="bubble">${role === 'user' ? esc(content) : formatReply(content)}</div>`;
    return wrap;
  }

  function renderAll() {
    msgs.innerHTML = '';
    if (!history.length) {
      msgs.innerHTML = `<div class="welcome">
        <div class="brand-mark big"><span></span></div>
        <h3>আসসালামু আলাইকুম, ${esc(user.full_name)}!</h3>
        <p>নিচের কোনো প্রশ্নে ক্লিক করুন অথবা নিজের প্রশ্ন লিখুন।</p>
      </div>`;
    } else {
      history.forEach((m) => msgs.appendChild(bubble(m.role, m.content)));
    }
    $('suggest').classList.toggle('hidden', history.length > 0);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function typingEl() {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.id = 'typing';
    el.innerHTML = `<div class="avatar green">${icon('chat', 16)}</div>
      <div class="bubble"><span class="typing"><i></i><i></i><i></i></span><div class="typing-note" id="typing-note">ভাবছে…</div></div>`;
    return el;
  }

  async function send(content) {
    const q = content.trim();
    if (!q || busy) return;
    busy = true;
    sendBtn.disabled = true;
    text.value = '';
    autoGrow();
    history.push({ role: 'user', content: q });
    renderAll();
    const t = typingEl();
    msgs.appendChild(t);
    msgs.scrollTop = msgs.scrollHeight;
    const started = Date.now();
    const notes = ['ভাবছে…', 'তথ্য খুঁজছে…', 'হিসাব মিলিয়ে দেখছে…', 'উত্তর লিখছে…'];
    const noteTimer = setInterval(() => {
      const n = t.querySelector('#typing-note');
      if (!n) return;
      const s = Math.floor((Date.now() - started) / 1000);
      n.textContent = `${notes[Math.min(notes.length - 1, Math.floor(s / 4))]} (${num(s)} সে.)`;
    }, 1000);

    try {
      // Send the whole conversation so the model keeps context.
      const res = await api.chat(history.map((m) => ({ role: m.role, content: m.content })));
      const reply = res && typeof res.reply === 'string' && res.reply.trim() ? res.reply : 'দুঃখিত, এই প্রশ্নের উত্তর পাওয়া যায়নি।';
      history.push({ role: 'assistant', content: reply });
      if (isCurrent()) renderAll();
    } catch (err) {
      if (err.status === 401) return;
      // Drop the unanswered question so the next request stays valid (user/assistant alternate).
      const failed = history.pop();
      if (!isCurrent()) return;
      renderAll();
      const eb = bubble('assistant', `${errorText(err)}`, 'err');
      const retry = document.createElement('button');
      retry.className = 'btn btn-sm btn-white';
      retry.style.marginTop = '8px';
      retry.textContent = 'আবার পাঠান';
      retry.addEventListener('click', () => { eb.remove(); send(failed.content); });
      eb.querySelector('.bubble').appendChild(document.createElement('br'));
      eb.querySelector('.bubble').appendChild(retry);
      msgs.appendChild(eb);
      msgs.scrollTop = msgs.scrollHeight;
    } finally {
      clearInterval(noteTimer);
      const ty = view.querySelector('#typing'); if (ty) ty.remove();
      busy = false;
      sendBtn.disabled = false;
      if (isCurrent()) text.focus();
    }
  }

  function autoGrow() {
    text.style.height = 'auto';
    text.style.height = `${Math.min(text.scrollHeight, 160)}px`;
  }

  $('chat-form').addEventListener('submit', (e) => { e.preventDefault(); send(text.value); });
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(text.value); }
  });
  text.addEventListener('input', autoGrow);
  $('suggest').querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => send(b.dataset.q)));
  $('new-chat').addEventListener('click', async () => {
    if (!history.length) return;
    const ok = await confirmDialog({ title: 'নতুন কথোপকথন?', message: 'আগের কথোপকথন মুছে যাবে।', confirmText: 'নতুন শুরু করুন' });
    if (ok) { history = []; renderAll(); }
  });

  /* ---- rule book search ---- */
  $('kb-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('kb-q').value.trim();
    if (!q) return;
    const btn = $('kb-btn');
    const out = $('kb-results');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin white"></span> খুঁজছে…';
    out.innerHTML = '';
    try {
      const res = await api.knowledge.search(q);
      const hits = (res && res.results) || [];
      out.innerHTML = hits.length
        ? hits.map((h) => `<div class="rule-hit">
            <div class="src"><span>${icon('book', 13)} ${esc(h.source)}</span><span title="দূরত্ব: কম হলে বেশি মিল">দূরত্ব ${num(Math.round(Number(h.distance) * 1000) / 1000)}</span></div>
            <p>${esc(h.content)}</p></div>`).join('')
        : '<p class="small muted">নিয়ম-বইয়ে এ বিষয়ে কিছু পাওয়া যায়নি।</p>';
    } catch (err) {
      out.innerHTML = `<div class="form-error">${esc(errorText(err))}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('search', 18)} খুঁজুন`;
    }
  });

  const ingestBtn = $('kb-ingest');
  if (ingestBtn) ingestBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'নিয়ম-বই Ingest করবেন?', message: 'জ্ঞানভান্ডার নতুন করে তৈরি হবে; এক-দুই মিনিট লাগতে পারে।', confirmText: 'চালান' });
    if (!ok) return;
    const out = $('kb-ingest-result');
    ingestBtn.disabled = true;
    ingestBtn.innerHTML = '<span class="spin white"></span> চলছে…';
    try {
      const r = await api.knowledge.ingest();
      out.innerHTML = `<span class="badge b-green">সম্পন্ন</span> উৎস: ${esc(r.source)} · ${num(r.chunks)}টি অংশ`;
      toast('নিয়ম-বই হালনাগাদ হয়েছে');
    } catch (err) {
      out.innerHTML = `<div class="form-error">${esc(errorText(err))}</div>`;
    } finally {
      ingestBtn.disabled = false;
      ingestBtn.innerHTML = `${icon('bolt', 18)} Ingest চালান`;
    }
  });

  renderAll();
  text.focus();
}
