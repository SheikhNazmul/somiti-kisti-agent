import { h } from '../ui.js';
import { api } from '../api.js';

const SUGGESTIONS = ['আজ কাদের কিস্তি বকেয়া?', 'এই সপ্তাহে মোট কত টাকা আদায় হয়েছে?', 'Islamic Saving Circle-এ কে কে এখনও জেতেননি?'];

export async function renderChat() {
  const history = [];
  const box = h('div', { class: 'chat-box', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', placeholder: 'বাংলায় প্রশ্ন লেখো…', 'aria-label': 'প্রশ্ন', required: true });
  const send = h('button', { class: 'btn btn-primary', type: 'submit' }, 'পাঠাও');
  const chips = h('div', { class: 'chips' }, SUGGESTIONS.map((s) => h('button', { class: 'chip', type: 'button', onClick: () => ask(s) }, s)));

  const add = (role, text) => { const b = h('div', { class: `bubble ${role === 'user' ? 'user' : 'bot'}` }, text); box.append(b); box.scrollTop = box.scrollHeight; return b; };
  add('assistant', 'আসসালামু আলাইকুম। সদস্য, কিস্তি বা Islamic Saving Circle নিয়ে যা জানতে চাও জিজ্ঞেস করো।');

  async function ask(text) {
    if (!text.trim() || send.disabled) return;
    chips.classList.add('hidden');
    history.push({ role: 'user', content: text });
    add('user', text); input.value = ''; send.disabled = true;
    const typing = add('assistant', 'উত্তর খুঁজছি…');
    typing.classList.add('typing');
    try {
      const { reply } = await api.chat(history);
      typing.textContent = reply;
      typing.classList.remove('typing');
      history.push({ role: 'assistant', content: reply });
    } catch (e) {
      typing.textContent = e.message;
      history.pop();
    } finally { send.disabled = false; input.focus(); box.scrollTop = box.scrollHeight; }
  }

  const form = h('form', { class: 'chat-form' }, input, send);
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  return h('div', { class: 'main', style: 'padding:0' },
    h('div', { class: 'page-head' }, h('h1', null, 'এআই সহকারী')),
    h('div', { class: 'card' }, box, chips, form));
}
