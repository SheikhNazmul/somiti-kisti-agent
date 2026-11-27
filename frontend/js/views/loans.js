import { h, bn, money, date, badge, errorBox, formDialog, payDialog, toast } from '../ui.js';
import { api } from '../api.js';
import { isAdmin } from '../session.js';

export async function renderLoans() {
  const page = h('div', { class: 'main', style: 'padding:0' });
  const body = h('div', null);
  const state = { tab: 'due', area: '' };
  let areas = [], members = [], loanMember = {};

  async function load() {
    body.replaceChildren(h('div', { class: 'empty' }, 'লোড হচ্ছে…'));
    try {
      const name = Object.fromEntries(members.map((m) => [m.id, m]));
      if (state.tab === 'due') {
        const due = await api.due({ area_id: state.area });
        body.replaceChildren(due.length ? h('div', { class: 'list' }, due.map((i) => {
          const m = name[loanMember[i.loan_id]];
          return h('div', { class: 'row' },
            h('span', { class: 'grow' }, h('b', null, m ? m.full_name : `ঋণ #${bn(i.loan_id)}`),
              h('span', { class: 'muted' }, `কিস্তি ${bn(i.number)} · ${date(i.due_date)}`)),
            h('span', { class: 'amount' }, money(Number(i.amount_due) - Number(i.amount_paid))),
            h('button', { class: 'btn btn-primary btn-small', onClick: () => payDialog({
              title: 'কিস্তি আদায়', defaultAmount: Number(i.amount_due) - Number(i.amount_paid),
              onSubmit: async (a) => { await api.pay(i.id, a); toast('কিস্তি আদায় হয়েছে'); load(); } }) }, 'আদায়'));
        })) : h('div', { class: 'empty' }, 'এই এলাকায় কোনো বকেয়া নেই'));
      } else {
        const loans = await api.loans();
        body.replaceChildren(loans.length ? h('div', { class: 'list' }, loans.map((l) => h('a', { class: 'row', href: `#/members/${l.member_id}` },
          h('span', { class: 'grow' }, h('b', null, name[l.member_id]?.full_name || `সদস্য #${bn(l.member_id)}`),
            h('span', { class: 'muted' }, `${bn(l.num_installments)}টি × ${money(l.installment_amount)} · শুরু ${date(l.start_date)}`)),
          h('span', { class: 'amount' }, money(l.total_payable)), badge(l.status)))) : h('div', { class: 'empty' }, 'কোনো ঋণ নেই'));
      }
    } catch (e) { body.replaceChildren(errorBox(e, load)); }
  }

  const tabs = h('div', { class: 'chips' });
  const renderTabs = () => tabs.replaceChildren(...[['due', 'বকেয়া কিস্তি'], ['all', 'সব ঋণ']].map(([v, l]) =>
    h('button', { class: 'chip' + (state.tab === v ? ' on' : ''), onClick: () => { state.tab = v; renderTabs(); renderAreas(); load(); } }, l)));
  const areaChips = h('div', { class: 'chips' });
  const renderAreas = () => areaChips.replaceChildren(...(state.tab === 'due' ? [{ id: '', name: 'সব এলাকা' }, ...areas] : []).map((a) =>
    h('button', { class: 'chip' + (String(state.area) === String(a.id) ? ' on' : ''), onClick: () => { state.area = a.id; renderAreas(); load(); } }, a.name)));

  try {
    [areas, members] = await Promise.all([api.areas(), api.members()]);
    const all = await api.loans();
    loanMember = Object.fromEntries(all.map((l) => [l.id, l.member_id]));
  } catch (e) { return h('div', null, errorBox(e, () => location.reload())); }
  renderTabs(); renderAreas();

  const addBtn = isAdmin() && h('button', { class: 'btn btn-primary', onClick: () => formDialog({
    title: 'নতুন ঋণ',
    fields: [
      { name: 'member_id', label: 'সদস্য', type: 'select', options: members.filter((m) => m.account_type !== 'gata').map((m) => ({ value: m.id, label: m.full_name })) },
      { name: 'principal', label: 'আসল টাকা (৳)', type: 'number', min: '1', inputmode: 'decimal' },
      { name: 'service_charge_pct', label: 'সার্ভিস চার্জ (%)', type: 'number', min: '0', step: '0.01', value: '10' },
      { name: 'num_installments', label: 'কিস্তির সংখ্যা', type: 'number', min: '1', inputmode: 'numeric' },
      { name: 'start_date', label: 'শুরুর তারিখ', type: 'date', value: new Date().toISOString().slice(0, 10) },
    ],
    onSubmit: async (v) => {
      await api.createLoan({ ...v, member_id: Number(v.member_id), principal: v.principal, service_charge_pct: v.service_charge_pct, num_installments: Number(v.num_installments) });
      toast('ঋণ তৈরি হয়েছে'); load();
    } }) }, '+ নতুন ঋণ');

  page.append(h('div', { class: 'page-head' }, h('h1', null, 'ঋণ ও কিস্তি'), addBtn),
    h('div', { class: 'card' }, tabs, areaChips, body));
  load();
  return page;
}
