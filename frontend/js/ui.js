// ছোট DOM হেল্পার ও বাংলা ফরম্যাটিং

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const DIGITS = '০১২৩৪৫৬৭৮৯';
export const bn = (v) => String(v).replace(/\d/g, (d) => DIGITS[d]);
export const money = (v) =>
  '৳ ' + bn(Math.round(Number(v) || 0).toLocaleString('en-IN'));
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
export function date(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${bn(d)} ${MONTHS[m - 1]} ${bn(y)}`;
}
export const DAYS = { sat: 'শনিবার', sun: 'রবিবার', mon: 'সোমবার', tue: 'মঙ্গলবার', wed: 'বুধবার', thu: 'বৃহস্পতিবার', fri: 'শুক্রবার' };
export const TYPES = { loan: 'ঋণ', gata: 'Islamic Saving Circle', both: 'ঋণ ও Islamic Saving Circle' };
export const STATUS = { active: 'চলমান', closed: 'শেষ', defaulted: 'খেলাপি', forming: 'গঠনাধীন', running: 'চলছে', completed: 'সম্পন্ন' };

export const badge = (type) => h('span', { class: `badge badge-${type}` }, TYPES[type] || STATUS[type] || type);
export const initial = (name) => (name || '?').trim().charAt(0);

export function toast(msg, bad = false) {
  const el = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg);
  document.getElementById('toast').append(el);
  setTimeout(() => el.remove(), 3500);
}

export function errorBox(err, retry) {
  return h('div', { class: 'error-box' }, h('span', null, err.message || 'কিছু একটা ভুল হয়েছে'),
    retry && h('button', { class: 'btn btn-ghost btn-small', onClick: retry }, 'আবার চেষ্টা করো'));
}

// ফর্ম ডায়ালগ। fields: [{name,label,type,options,required,value}]
export function formDialog({ title, fields, submitLabel = 'সংরক্ষণ', onSubmit }) {
  const dlg = document.getElementById('dialog');
  const err = h('div', { class: 'form-error', role: 'alert' });
  const inputs = fields.map((f) => {
    const input = f.type === 'select'
      ? h('select', { id: `f-${f.name}`, name: f.name }, f.options.map((o) => h('option', { value: o.value }, o.label)))
      : h('input', { id: `f-${f.name}`, name: f.name, type: f.type || 'text', value: f.value ?? '', required: f.required !== false, step: f.step, min: f.min, inputmode: f.inputmode });
    if (f.type === 'select' && f.value !== undefined) input.value = f.value;
    return h('div', { class: 'field' }, h('label', { for: `f-${f.name}` }, f.label), input);
  });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, submitLabel);
  const form = h('form', { class: 'form', method: 'dialog' },
    h('h2', null, title), inputs, err,
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close() }, 'বাতিল'), submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    try {
      await onSubmit(values);
      dlg.close();
    } catch (ex) {
      err.textContent = ex.details?.length
        ? ex.details.map((d) => `${d.field}: ${d.message}`).join(' · ')
        : ex.message;
    } finally {
      submit.disabled = false;
    }
  });
  dlg.replaceChildren(form);
  dlg.showModal();
}

// নিজস্ব নিশ্চিতকরণ ডায়ালগ, ব্রাউজারের confirm() এর বদলে
export function confirmDialog({ title, text, confirmLabel = 'হ্যাঁ, করো', onConfirm }) {
  const dlg = document.getElementById('dialog');
  const err = h('div', { class: 'form-error', role: 'alert' });
  const ok = h('button', { class: 'btn btn-primary', type: 'button', onClick: async () => {
    ok.disabled = true; err.textContent = '';
    try { await onConfirm(); dlg.close(); } catch (ex) { err.textContent = ex.message; } finally { ok.disabled = false; }
  } }, confirmLabel);
  dlg.replaceChildren(h('div', { class: 'form' }, h('h2', null, title), text && h('p', null, text), err,
    h('div', { class: 'actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close() }, 'বাতিল'), ok)));
  dlg.showModal();
}

export function payDialog({ title, defaultAmount, onSubmit }) {
  formDialog({
    title, submitLabel: 'টাকা নিলাম',
    fields: [{ name: 'amount', label: 'পরিমাণ (৳)', type: 'number', value: Math.round(defaultAmount), step: '0.01', min: '1', inputmode: 'decimal' }],
    onSubmit: (v) => onSubmit(v.amount),
  });
}

export function spinner(text = 'লোড হচ্ছে…') {
  return h('div', { class: 'empty' }, text);
}
