import { h, bn, badge, initial, errorBox, formDialog, toast, TYPES } from '../ui.js';
import { api } from '../api.js';
import { canManage } from '../session.js';

export async function renderMembers() {
  const page = h('div', { class: 'main', style: 'padding:0' });
  const list = h('div', { class: 'list' });
  const count = h('p', { class: 'muted' });
  let areas = [];
  const state = { search: '', type: '' };

  async function load() {
    list.replaceChildren(h('div', { class: 'empty' }, 'লোড হচ্ছে…'));
    try {
      const members = await api.members({ search: state.search, account_type: state.type });
      count.textContent = `${bn(members.length)} জন সদস্য`;
      const area = Object.fromEntries(areas.map((a) => [a.id, a.name]));
      list.replaceChildren(...(members.length ? members.map((m) =>
        h('a', { class: 'row', href: `#/members/${m.id}` },
          h('span', { class: 'avatar' }, initial(m.full_name)),
          h('span', { class: 'grow' }, h('b', null, m.full_name), h('span', { class: 'muted' }, `${bn(m.phone)} · ${area[m.area_id] || ''}`)),
          badge(m.account_type))) : [h('div', { class: 'empty' }, 'কোনো সদস্য পাওয়া যায়নি')]));
    } catch (e) { list.replaceChildren(errorBox(e, load)); }
  }

  const chips = h('div', { class: 'chips' });
  const renderChips = () => chips.replaceChildren(...[['', 'সবাই'], ['loan', 'ঋণ'], ['gata', 'Islamic Saving Circle'], ['both', 'ঋণ ও Islamic Saving Circle']].map(([v, l]) =>
    h('button', { class: 'chip' + (state.type === v ? ' on' : ''), onClick: () => { state.type = v; renderChips(); load(); } }, l)));
  renderChips();

  let timer;
  const search = h('input', { type: 'search', placeholder: 'নাম বা ফোন দিয়ে খোঁজো', 'aria-label': 'সদস্য খোঁজো',
    onInput: (e) => { clearTimeout(timer); timer = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 300); } });

  const addBtn = canManage() && h('button', { class: 'btn btn-primary', onClick: () => formDialog({
    title: 'নতুন সদস্য',
    fields: [
      { name: 'full_name', label: 'পুরো নাম' },
      { name: 'phone', label: 'ফোন', type: 'tel', inputmode: 'tel' },
      { name: 'nid_last4', label: 'এনআইডির শেষ ৪ সংখ্যা', inputmode: 'numeric' },
      { name: 'area_id', label: 'এলাকা', type: 'select', options: areas.map((a) => ({ value: a.id, label: a.name })) },
      { name: 'account_type', label: 'অ্যাকাউন্টের ধরন', type: 'select', options: Object.entries(TYPES).map(([value, label]) => ({ value, label })) },
      { name: 'joined_on', label: 'যোগদানের তারিখ', type: 'date', value: new Date().toISOString().slice(0, 10) },
    ],
    onSubmit: async (v) => { await api.createMember({ ...v, area_id: Number(v.area_id) }); toast('সদস্য যোগ হয়েছে'); load(); },
  }) }, '+ নতুন সদস্য');

  try { areas = await api.areas(); } catch { /* এলাকা ছাড়াও তালিকা চলবে */ }
  page.append(
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'সদস্য'), count), addBtn),
    h('div', { class: 'card' }, h('div', { class: 'tools' }, h('div', { class: 'search' }, search), chips), list));
  load();
  return page;
}
