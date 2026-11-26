import { h, bn, money, date, badge, initial, errorBox, payDialog, toast, DAYS } from '../ui.js';
import { api } from '../api.js';

export async function renderMemberDetail(id) {
  const page = h('div', { class: 'main', style: 'padding:0' });
  async function load() {
    page.replaceChildren(h('div', { class: 'empty' }, 'লোড হচ্ছে…'));
    try {
      const [m, bal, loans, due, areas] = await Promise.all([api.member(id), api.balance(id), api.loans({ member_id: id }), api.due(), api.areas()]);
      const loanIds = new Set(loans.map((l) => l.id));
      const myDue = due.filter((i) => loanIds.has(i.loan_id));
      const area = areas.find((a) => a.id === m.area_id);
      const pct = Number(bal.loan_total) ? (Number(bal.total_paid) / Number(bal.loan_total)) * 100 : 0;
      page.replaceChildren(
        h('a', { href: '#/members', class: 'muted' }, '← সদস্য তালিকা'),
        h('div', { class: 'card' }, h('div', { class: 'row' },
          h('span', { class: 'avatar' }, initial(m.full_name)),
          h('span', { class: 'grow' }, h('h1', null, m.full_name),
            h('span', { class: 'muted' }, `${bn(m.phone)} · ${area ? `${area.name} (${DAYS[area.collection_day]})` : ''} · যোগ দিয়েছেন ${date(m.joined_on)}`)),
          badge(m.account_type))),
        h('div', { class: 'grid' },
          h('div', { class: 'card hero wide' }, h('span', { class: 'muted' }, 'বাকি আছে'), h('div', { class: 'stat' }, money(bal.remaining)),
            h('div', { class: 'progress' }, h('i', { style: `width:${Math.min(pct, 100)}%` })),
            h('span', { class: 'muted' }, `মোট ${money(bal.loan_total)} · শোধ ${money(bal.total_paid)}`))),
        h('div', { class: 'card' }, h('h2', null, 'ঋণ'),
          loans.length ? h('div', { class: 'list' }, loans.map((l) => h('div', { class: 'row' },
            h('span', { class: 'grow' }, h('b', null, `ঋণ #${bn(l.id)} · আসল ${money(l.principal)}`),
              h('span', { class: 'muted' }, `${bn(l.num_installments)}টি কিস্তি × ${money(l.installment_amount)} · শুরু ${date(l.start_date)}`)),
            badge(l.status)))) : h('div', { class: 'empty' }, 'কোনো ঋণ নেই')),
        h('div', { class: 'card' }, h('h2', null, 'বকেয়া কিস্তি'),
          myDue.length ? h('div', { class: 'list' }, myDue.map((i) => h('div', { class: 'row' },
            h('span', { class: 'grow' }, h('b', null, `কিস্তি ${bn(i.number)}`), h('span', { class: 'muted' }, date(i.due_date))),
            h('span', { class: 'amount' }, money(Number(i.amount_due) - Number(i.amount_paid))),
            h('button', { class: 'btn btn-primary btn-small', onClick: () => payDialog({
              title: `কিস্তি ${bn(i.number)} আদায়`, defaultAmount: Number(i.amount_due) - Number(i.amount_paid),
              onSubmit: async (amt) => { await api.pay(i.id, amt); toast('কিস্তি আদায় হয়েছে'); load(); } }) }, 'আদায়'))))
            : h('div', { class: 'empty' }, 'কোনো বকেয়া নেই')));
    } catch (e) { page.replaceChildren(errorBox(e, load)); }
  }
  await load();
  return page;
}
