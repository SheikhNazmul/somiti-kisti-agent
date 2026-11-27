import { h, bn, money, badge, errorBox, toast, STATUS } from '../ui.js';
import { api } from '../api.js';
import { isAdmin } from '../session.js';

export async function renderGata() {
  const page = h('div', { class: 'main', style: 'padding:0' });
  const detail = h('div', { class: 'card' });
  let groups = [], members = [], selected = null;

  async function show() {
    const g = groups.find((x) => x.id === selected);
    if (!g) { detail.replaceChildren(h('div', { class: 'empty' }, 'কোনো গ্রুপ নেই')); return; }
    detail.replaceChildren(h('div', { class: 'empty' }, 'লোড হচ্ছে…'));
    try {
      const s = await api.groupStatus(g.id);
      const byId = Object.fromEntries(members.map((m) => [m.id, m.full_name]));
      const unpaid = s.unpaid_member_ids.map((id, i) => ({ id, name: s.unpaid_member_names[i] || byId[id] }));
      detail.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: 'grow' }, h('h2', null, g.name),
          h('span', { class: 'muted' }, `${money(g.amount)} · ${g.frequency === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'} · ${bn(g.total_slots)} জন`)), badge(g.status)),
        g.status === 'running' ? h('div', null,
          h('b', null, `রাউন্ড ${bn(s.current_round)} / ${bn(s.total_rounds)}`),
          h('div', { class: 'progress' }, h('i', { style: `width:${(s.current_round / s.total_rounds) * 100}%` })),
          h('p', { class: 'muted' }, `জিতেছেন ${bn(s.winners_count)} জন · এখনও জেতেননি ${bn(s.not_won_member_ids.length)} জন`)) : h('p', { class: 'muted' }, `অবস্থা: ${STATUS[g.status]}`),
        g.status === 'running' && h('h2', null, `এই রাউন্ডে বাকি (${bn(unpaid.length)} জন)`),
        g.status === 'running' && (unpaid.length ? h('div', { class: 'list' }, unpaid.map((u) => h('div', { class: 'row' },
          h('span', { class: 'grow' }, h('b', null, u.name)),
          h('button', { class: 'btn btn-primary btn-small', onClick: async (e) => {
            e.target.disabled = true;
            try { await api.gataPay(g.id, u.id, s.current_round); toast('জমা নেওয়া হয়েছে'); show(); }
            catch (ex) { toast(ex.message, true); e.target.disabled = false; }
          } }, 'জমা নিলাম')))) : h('div', { class: 'ok-card card' }, 'সবাই জমা দিয়েছে। এবার বিজয়ী নির্বাচন করা যাবে।')),
        g.status === 'running' && isAdmin() && h('div', { class: 'actions' }, h('button', { class: 'btn btn-gold', disabled: unpaid.length > 0, onClick: async (e) => {
          if (!confirm('বিজয়ী নির্বাচন ও পেআউট করবে?')) return;
          e.target.disabled = true;
          try { const r = await api.payout(g.id); toast(`${r.winner_name} পেয়েছেন ${money(r.payout_amount)}`); await reload(); }
          catch (ex) { toast(ex.message, true); e.target.disabled = false; }
        } }, 'বিজয়ী নির্বাচন ও পেআউট')));
    } catch (e) { detail.replaceChildren(errorBox(e, show)); }
  }

  const chips = h('div', { class: 'chips' });
  const renderChips = () => chips.replaceChildren(...groups.map((g) =>
    h('button', { class: 'chip' + (g.id === selected ? ' on' : ''), onClick: () => { selected = g.id; renderChips(); show(); } }, g.name)));
  async function reload() { groups = await api.groups(); renderChips(); await show(); }

  try {
    [groups, members] = await Promise.all([api.groups(), api.members()]);
    selected = (groups.find((g) => g.status === 'running') || groups[0])?.id;
  } catch (e) { return h('div', null, errorBox(e, () => location.reload())); }
  page.append(h('div', { class: 'page-head' }, h('h1', null, 'Islamic Saving Circle')), chips, detail);
  renderChips(); show();
  return page;
}
