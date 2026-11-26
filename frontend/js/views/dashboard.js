import { h, bn, money, date, badge, errorBox } from '../ui.js';
import { api } from '../api.js';
import { currentUser } from '../session.js';

export async function renderDashboard() {
  const page = h('div', { class: 'main', style: 'padding:0' });
  try {
    const [due, members, loans, groups] = await Promise.all([api.due(), api.members(), api.loans({ status: 'active' }), api.groups()]);
    const names = Object.fromEntries(members.map((m) => [m.id, m.full_name]));
    const loanMember = Object.fromEntries(loans.map((l) => [l.id, l.member_id]));
    const remaining = due.reduce((s, i) => s + Math.max(Number(i.amount_due) - Number(i.amount_paid), 0), 0);
    const statuses = await Promise.all(groups.filter((g) => g.status === 'running').map((g) => api.groupStatus(g.id).then((s) => ({ g, s }))));
    page.append(
      h('div', { class: 'page-head' }, h('div', null,
        h('h1', null, `স্বাগতম, ${currentUser().full_name}`),
        h('p', { class: 'muted' }, date(new Date().toISOString().slice(0, 10))))),
      h('div', { class: 'grid' },
        h('div', { class: 'card hero wide' }, h('span', { class: 'muted' }, 'মোট বকেয়া কিস্তি'),
          h('div', { class: 'stat' }, money(remaining)), h('span', { class: 'muted' }, `${bn(due.length)}টি কিস্তি বাকি`)),
        h('div', { class: 'card' }, h('span', { class: 'muted' }, 'সক্রিয় সদস্য'),
          h('div', { class: 'stat' }, bn(members.filter((m) => m.is_active).length))),
        h('div', { class: 'card' }, h('span', { class: 'muted' }, 'চলমান ঋণ'),
          h('div', { class: 'stat' }, bn(loans.length)))),
      h('div', { class: 'grid' },
        h('div', { class: 'card wide' }, h('h2', null, 'আজকের বকেয়া কিস্তি'),
          due.length ? h('div', { class: 'list' }, due.slice(0, 8).map((i) => {
            const mid = loanMember[i.loan_id];
            return h('a', { class: 'row', href: mid ? `#/members/${mid}` : '#/loans' },
              h('span', { class: 'grow' }, h('b', null, names[mid] || `ঋণ #${bn(i.loan_id)}`),
                h('span', { class: 'muted' }, `কিস্তি ${bn(i.number)} · ${date(i.due_date)}`)),
              h('span', { class: 'amount' }, money(Number(i.amount_due) - Number(i.amount_paid))));
          })) : h('div', { class: 'empty' }, 'কোনো বকেয়া নেই 🎉'),
          due.length > 8 && h('a', { href: '#/loans', class: 'btn btn-ghost btn-small' }, 'সব দেখো')),
        h('div', { class: 'card gold-card narrow' }, h('h2', null, 'গাটার অবস্থা'),
          statuses.length ? statuses.map(({ g, s }) => h('div', null,
            h('b', null, g.name), ' ',
            h('span', { class: 'muted' }, `রাউন্ড ${bn(s.current_round)}/${bn(s.total_rounds)} · বাকি ${bn(s.unpaid_member_ids.length)} জন`),
            h('div', { class: 'progress' }, h('i', { style: `width:${(s.current_round / s.total_rounds) * 100}%` }))))
            : h('div', { class: 'muted' }, 'চলমান কোনো গ্রুপ নেই'),
          h('a', { href: '#/gata', class: 'btn btn-gold btn-small' }, 'গাটা দেখো'))),
    );
  } catch (e) { page.append(errorBox(e, () => location.reload())); }
  return page;
}
