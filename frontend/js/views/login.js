import { h } from '../ui.js';
import { api, setToken } from '../api.js';

export function renderLogin(onDone) {
  const err = h('div', { class: 'form-error', role: 'alert' });
  const notice = h('div', { class: 'notice hidden' }, 'সার্ভার ঘুম থেকে উঠছে, ৩০–৬০ সেকেন্ড লাগতে পারে। একটু অপেক্ষা করো।');
  const email = h('input', { id: 'email', type: 'email', required: true, autocomplete: 'username' });
  const pass = h('input', { id: 'password', type: 'password', required: true, autocomplete: 'current-password' });
  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'প্রবেশ করো');
  const form = h('form', null,
    h('h2', null, 'আবার স্বাগতম'),
    h('p', { class: 'muted' }, 'ইমেইল ও পাসওয়ার্ড দিয়ে ঢোকো।'),
    h('div', { class: 'field' }, h('label', { for: 'email' }, 'ইমেইল'), email),
    h('div', { class: 'field' }, h('label', { for: 'password' }, 'পাসওয়ার্ড'), pass),
    err, notice, btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    const timer = setTimeout(() => notice.classList.remove('hidden'), 4000);
    try {
      const { access_token } = await api.login(email.value.trim(), pass.value);
      setToken(access_token);
      await onDone();
    } catch (ex) {
      err.textContent = ex.status === 401 ? 'ইমেইল বা পাসওয়ার্ড ভুল।' : ex.message;
    } finally {
      clearTimeout(timer);
      notice.classList.add('hidden');
      btn.disabled = false;
    }
  });
  return h('div', { class: 'login' },
    h('section', { class: 'login-brand' },
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, '৳'), 'সমিতি কিস্তি'),
      h('div', null, h('h1', null, 'কিস্তির হিসাব, এখন হাতের মুঠোয়'),
        h('p', null, 'সদস্য, ঋণ, কিস্তি আর গাটা — সব এক জায়গায়। কিছু জানতে চাইলে এআই সহকারীকে জিজ্ঞেস করো।')),
      h('p', { class: 'muted' }, 'Somiti Kisti Agent')),
    h('section', { class: 'login-form' }, form));
}
