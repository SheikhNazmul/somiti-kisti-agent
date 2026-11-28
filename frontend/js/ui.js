// Shared UI helpers: formatting, labels, icons, toast, modal, error text.

/* ---------------- escaping ---------------- */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------------- numbers, money, dates ---------------- */
const moneyFmt = new Intl.NumberFormat('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat('bn-BD');

export function toNumber(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** ৳ with thousands separators, Bangla digits. Values come straight from the API. */
export function money(v) {
  if (v === null || v === undefined || v === '') return '—';
  return `৳ ${moneyFmt.format(toNumber(v))}`;
}

export function num(v) {
  if (v === null || v === undefined || v === '') return '—';
  return numFmt.format(toNumber(v));
}

/** Parse an API date (YYYY-MM-DD) as a local calendar date. */
function parseDate(iso) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFmt = new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short' });
const weekdayFmt = new Intl.DateTimeFormat('bn-BD', { weekday: 'long' });

/** e.g. "২৮ নভেম্বর, ২০২৬" */
export function fmtDate(iso) {
  const d = parseDate(iso);
  return d ? dateFmt.format(d) : '—';
}
export function fmtDateShort(iso) {
  const d = parseDate(iso);
  return d ? dateShortFmt.format(d) : '—';
}
export function fmtDateLong(iso) {
  const d = parseDate(iso);
  return d ? `${weekdayFmt.format(d)}, ${dateFmt.format(d)}` : '—';
}

/** Today's date on this device as YYYY-MM-DD. */
export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isBefore(isoA, isoB) {
  return String(isoA) < String(isoB);
}

/* ---------------- labels (enum values from the API → Bangla) ---------------- */
export const LABELS = {
  accountType: { loan: 'ঋণ', gata: 'গাতা', both: 'ঋণ + গাতা' },
  day: { sat: 'শনিবার', sun: 'রবিবার', mon: 'সোমবার', tue: 'মঙ্গলবার', wed: 'বুধবার', thu: 'বৃহস্পতিবার', fri: 'শুক্রবার' },
  loanStatus: { active: 'চলমান', closed: 'পরিশোধিত', defaulted: 'খেলাপি' },
  gataStatus: { forming: 'গঠন চলছে', running: 'চলমান', completed: 'সম্পন্ন' },
  frequency: { weekly: 'সাপ্তাহিক', monthly: 'মাসিক' },
  role: { admin: 'অ্যাডমিন', manager: 'ম্যানেজার', collector: 'কালেক্টর' },
};
export const label = (group, value) => (LABELS[group] && LABELS[group][value]) || value || '—';

export function accountBadge(type) {
  const cls = type === 'loan' ? 'b-orange' : type === 'gata' ? 'b-blue' : 'b-green';
  return `<span class="badge ${cls}">${esc(label('accountType', type))}</span>`;
}
export function loanStatusBadge(s) {
  const cls = s === 'active' ? 'b-green' : s === 'closed' ? 'b-grey' : 'b-red';
  return `<span class="badge ${cls}">${esc(label('loanStatus', s))}</span>`;
}
export function gataStatusBadge(s) {
  const cls = s === 'running' ? 'b-green' : s === 'forming' ? 'b-orange' : 'b-grey';
  return `<span class="badge ${cls}">${esc(label('gataStatus', s))}</span>`;
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0])[0] || '';
  const second = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';
  return (first + second).toUpperCase();
}

/* ---------------- icons (inline SVG, stroke = currentColor) ---------------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M16 15h2"/><path d="M6 6l9-3 2 3"/>',
  circle: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3.5 3.5 0 0 0 3.8 4M16 6h3.5a3.5 3.5 0 0 1-3.8 4"/><path d="M12 13v4M8.5 20h7M9.5 17h5"/>',
  send: '<path d="M4 12 20 4l-5 16-3-7z"/><path d="M12 13l8-9"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
  phone: '<path d="M5 3.5h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.6 6.6l1.4-2.3 4.5 1.8V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  userPlus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M19 8v6M16 11h6"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
};
export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* ---------------- error text (Bangla) ---------------- */
const KNOWN = [
  [/payment is more than the amount due/i, 'পরিশোধের পরিমাণ বাকি টাকার চেয়ে বেশি।'],
  [/already paid for round/i, 'এই সদস্য এই রাউন্ডের টাকা আগেই দিয়েছেন।'],
  [/only accepted for the current round/i, 'শুধু চলতি রাউন্ডের টাকা নেওয়া যায়।'],
  [/payments are only accepted in a running group/i, 'গ্রুপ চালু না হলে টাকা নেওয়া যায় না।'],
  [/cannot pay out round/i, 'সবাই টাকা না দেওয়া পর্যন্ত পে-আউট করা যাবে না।'],
  [/every member has already won/i, 'সব সদস্য ইতিমধ্যে পেয়ে গেছেন।'],
  [/payout is only possible in a running group/i, 'শুধু চলমান গ্রুপে পে-আউট করা যায়।'],
  [/members can only be added while the group is forming/i, 'গ্রুপ গঠনের সময়েই শুধু সদস্য যোগ করা যায়।'],
  [/loan-only member cannot join/i, 'শুধু-ঋণ সদস্য গাতা গ্রুপে যোগ দিতে পারেন না।'],
  [/already in this group/i, 'এই সদস্য আগেই এই গ্রুপে আছেন।'],
  [/group is full/i, 'গ্রুপ পূর্ণ হয়ে গেছে।'],
  [/group is not full/i, 'গ্রুপ এখনও পূর্ণ হয়নি।'],
  [/only a forming group can be started/i, 'শুধু গঠনাধীন গ্রুপ চালু করা যায়।'],
  [/gata group with this name already exists/i, 'এই নামে একটি গাতা গ্রুপ আগে থেকেই আছে।'],
  [/member is not in this group/i, 'এই সদস্য এই গ্রুপে নেই।'],
  [/conflicts with existing data/i, 'এই তথ্য আগে থেকেই আছে (যেমন একই ফোন নম্বর বা একই নাম)।'],
  [/not found/i, 'তথ্য খুঁজে পাওয়া যায়নি।'],
];

export function errorText(err) {
  if (!err) return 'কিছু একটা ভুল হয়েছে।';
  const status = err.status;
  const raw = (err.message || '').toString();
  if (status === 0) {
    return raw === 'timeout'
      ? 'সার্ভার সাড়া দিতে দেরি করছে। একটু পরে আবার চেষ্টা করুন।'
      : 'সার্ভারে পৌঁছানো যাচ্ছে না। ইন্টারনেট সংযোগ দেখুন।';
  }
  if (status === 502 || status === 503 || status === 504) return 'সার্ভার জাগছে, একটু অপেক্ষা করে আবার চেষ্টা করুন…';
  if (status === 401) return 'সেশন শেষ হয়েছে, আবার লগইন করুন।';
  if (status === 403) return 'এই কাজের অনুমতি আপনার নেই।';
  if (status === 422) {
    const details = err.data && Array.isArray(err.data.details) ? err.data.details : [];
    const fields = details.map((d) => String(d.field || '').split('.').pop()).filter(Boolean);
    return fields.length
      ? `তথ্য সঠিক নয়, এই ঘরগুলো দেখুন: ${[...new Set(fields)].join(', ')}`
      : 'তথ্য সঠিক নয়, ঘরগুলো আবার দেখুন।';
  }
  for (const [re, bn] of KNOWN) if (re.test(raw)) return bn;
  if (status >= 500) return 'সার্ভারে সমস্যা হয়েছে। একটু পরে চেষ্টা করুন।';
  if (status === 409) return `কাজটি করা যায়নি: ${raw}`;
  if (status === 404) return 'তথ্য খুঁজে পাওয়া যায়নি।';
  return raw ? `সমস্যা: ${raw}` : 'কিছু একটা ভুল হয়েছে।';
}

/* ---------------- toast ---------------- */
export function toast(message, type = 'ok', ms = 3800) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ic = type === 'err' ? 'alert' : type === 'warn' ? 'info' : 'check';
  el.innerHTML = `<span class="t-ico">${icon(ic, 18)}</span><span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 260);
  }, ms);
}

/* ---------------- modal ---------------- */
let openModalCount = 0;

/**
 * openModal({ title, sub, body, submitText, submitClass, wide, onSubmit, hideFooter })
 * body is HTML. If onSubmit is given, the body is wrapped in a <form>;
 * onSubmit(formData, { form, close, setError, setBusy }) may return a promise.
 * Returns { el, close, done } — done resolves with the onSubmit result (or null on cancel).
 */
export function openModal(opts) {
  const {
    title, sub = '', body = '', submitText = 'সংরক্ষণ করুন', submitClass = 'btn-green',
    cancelText = 'বাতিল', wide = false, onSubmit = null, hideFooter = false,
  } = opts;
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const inner = onSubmit
    ? `<form novalidate>
         <div class="form-error hidden" role="alert"></div>
         ${body}
         <div class="modal-foot">
           <button type="button" class="btn btn-ghost" data-cancel>${esc(cancelText)}</button>
           <button type="submit" class="btn ${submitClass}" data-submit>${esc(submitText)}</button>
         </div>
       </form>`
    : `${body}${hideFooter ? '' : `<div class="modal-foot"><button type="button" class="btn btn-black" data-cancel>ঠিক আছে</button></div>`}`;
  backdrop.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}</div>
        <button type="button" class="icon-btn" data-cancel aria-label="বন্ধ করুন">${icon('close', 18)}</button>
      </div>
      ${inner}
    </div>`;
  root.appendChild(backdrop);
  openModalCount += 1;
  document.body.style.overflow = 'hidden';

  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  let closed = false;
  const close = (result = null) => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    openModalCount -= 1;
    if (openModalCount <= 0) { openModalCount = 0; document.body.style.overflow = ''; }
    document.removeEventListener('keydown', onKey);
    resolveDone(result);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(null); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(null); });
  backdrop.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => close(null)));

  const form = backdrop.querySelector('form');
  if (form && onSubmit) {
    const errBox = form.querySelector('.form-error');
    const submitBtn = form.querySelector('[data-submit]');
    const setError = (msg) => {
      if (msg) { errBox.textContent = msg; errBox.classList.remove('hidden'); errBox.scrollIntoView({ block: 'nearest' }); }
      else { errBox.textContent = ''; errBox.classList.add('hidden'); }
    };
    const setBusy = (busy) => {
      submitBtn.disabled = busy;
      submitBtn.innerHTML = busy ? `<span class="spin white"></span> অপেক্ষা করুন…` : esc(submitText);
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');
      if (!form.checkValidity()) {
        const bad = form.querySelector(':invalid');
        const lbl = bad && bad.closest('.field') ? bad.closest('.field').querySelector('span') : null;
        setError(`দয়া করে সঠিকভাবে পূরণ করুন${lbl ? `: ${lbl.textContent}` : ''}`);
        if (bad) bad.focus();
        return;
      }
      setBusy(true);
      try {
        const result = await onSubmit(new FormData(form), { form, close, setError, setBusy });
        if (result !== false) close(result === undefined ? true : result);
      } catch (err) {
        setError(errorText(err));
      } finally {
        if (!closed) setBusy(false);
      }
    });
    const first = form.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
  }
  return { el: backdrop, close, done };
}

/** Simple confirm dialog → Promise<boolean> */
export function confirmDialog({ title, message, confirmText = 'হ্যাঁ, নিশ্চিত', danger = false }) {
  const m = openModal({
    title,
    body: `<p class="muted">${message}</p>`,
    submitText: confirmText,
    submitClass: danger ? 'btn-danger' : 'btn-black',
    onSubmit: async () => true,
  });
  return m.done.then((r) => r === true);
}

/* ---------------- states ---------------- */
export function skeletonRows(n = 4) {
  return Array.from({ length: n }, () => '<div class="skel skel-row"></div>').join('');
}
export function emptyState(text, ic = 'list') {
  return `<div class="empty"><div class="em-ico">${icon(ic, 26)}</div><p>${esc(text)}</p></div>`;
}
export function errorState(err, retryId = '') {
  return `<div class="error-box"><span>${icon('alert', 18)} ${esc(errorText(err))}</span>${retryId ? `<button class="btn btn-sm btn-white" id="${retryId}">${icon('refresh', 16)} আবার চেষ্টা</button>` : ''}</div>`;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Build <option>s. items: [{value, text}] */
export function options(items, selected) {
  return items.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(selected) ? 'selected' : ''}>${esc(o.text)}</option>`).join('');
}
