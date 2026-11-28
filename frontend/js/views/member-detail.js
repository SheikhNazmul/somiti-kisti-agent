// Member details: profile, balance (GET /members/{id}/balance), loans, due installments + collect.
import { api } from '../api.js';
import { can } from '../session.js';
import { getAreas, byId, invalidate } from '../data.js';
import { memberFormDialog, collectInstallmentDialog, loanFormDialog, loanStatusDialog } from '../actions.js';
import {
  esc, icon, money, num, fmtDate, todayISO, toNumber, accountBadge, loanStatusBadge, label,
  skeletonRows, emptyState, errorState, initials, isBefore, confirmDialog, toast, errorText,
} from '../ui.js';

export async function renderMemberDetail(view, params, isCurrent) {
  const id = Number(params[0]);
  view.innerHTML = `<a class="back-link" href="#/members">${icon('back', 16)} সদস্য তালিকা</a>${skeletonRows(5)}`;

  let member; let areas;
  try {
    [member, areas] = await Promise.all([api.members.get(id), getAreas().catch(() => [])]);
  } catch (err) {
    if (!isCurrent()) return;
    view.innerHTML = `<a class="back-link" href="#/members">${icon('back', 16)} সদস্য তালিকা</a>${errorState(err)}`;
    return;
  }
  if (!isCurrent()) return;
  const area = byId(areas).get(member.area_id);
  const state = { dueDate: todayISO(), loans: [] };

  view.innerHTML = `
    <a class="back-link" href="#/members">${icon('back', 16)} সদস্য তালিকা</a>
    <div class="grid g-main" style="margin-bottom:18px">
      <section class="card">
        <div class="profile-card">
          <div class="avatar green">${esc(initials(member.full_name))}</div>
          <div class="info">
            <h1 style="font-size:28px">${esc(member.full_name)}</h1>
            <div class="meta" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
              ${accountBadge(member.account_type)}
              ${member.is_active ? '<span class="badge b-green">সক্রিয়</span>' : '<span class="badge b-grey">নিষ্ক্রিয়</span>'}
            </div>
          </div>
          <div class="head-actions">
            ${can.editMembers() ? `<button class="btn btn-ghost btn-sm" id="edit-member">${icon('edit', 16)} সম্পাদনা</button>` : ''}
            ${can.manageLoans() ? `<button class="btn btn-black btn-sm" id="new-loan">${icon('plus', 16)} নতুন ঋণ</button>` : ''}
            ${can.deleteMembers() ? `<button class="btn btn-danger btn-sm" id="del-member">${icon('trash', 16)} মুছুন</button>` : ''}
          </div>
        </div>
        <dl class="kv" style="margin-top:20px">
          <dt>ফোন</dt><dd>${esc(member.phone)}</dd>
          <dt>NID (শেষ ৪)</dt><dd>${esc(member.nid_last4)}</dd>
          <dt>এলাকা</dt><dd>${esc(area ? area.name : `#${member.area_id}`)}</dd>
          <dt>আদায়ের দিন</dt><dd>${esc(area ? label('day', area.collection_day) : '—')}</dd>
          <dt>যোগদান</dt><dd>${esc(fmtDate(member.joined_on))}</dd>
          <dt>সদস্য নং</dt><dd>#${esc(member.id)}</dd>
        </dl>
      </section>
      <section class="balance-card" id="balance">
        <div class="hero-label">ঋণের বাকি (মোট)</div>
        <div class="big"><div class="skel skel-val light" style="height:36px;width:160px"></div></div>
      </section>
    </div>

    <section class="card" style="margin-bottom:18px">
      <div class="card-head">
        <div><h3>বকেয়া কিস্তি</h3><p>নির্বাচিত তারিখ পর্যন্ত নির্ধারিত, এখনও বাকি</p></div>
        <label class="field" style="grid-auto-flow:column;align-items:center;gap:8px">
          <span>তারিখ পর্যন্ত</span><input class="input" type="date" id="due-date" value="${state.dueDate}" style="width:auto">
        </label>
      </div>
      <div id="due-list">${skeletonRows(2)}</div>
    </section>

    <section class="card">
      <div class="card-head"><div><h3>ঋণসমূহ</h3><p>এই সদস্যের সব ঋণ</p></div></div>
      <div id="loan-list">${skeletonRows(2)}</div>
    </section>`;

  const $ = (sel) => view.querySelector(`#${sel}`);

  async function loadBalance() {
    try {
      const b = await api.members.balance(id);
      if (!isCurrent()) return;
      $('balance').innerHTML = `
        <div class="hero-label">ঋণের বাকি (মোট)</div>
        <div class="big">${money(b.remaining)}</div>
        <div class="balance-split">
          <div><span>মোট পরিশোধযোগ্য</span><b>${money(b.loan_total)}</b></div>
          <div><span>মোট জমা</span><b>${money(b.total_paid)}</b></div>
        </div>`;
    } catch (err) {
      if (isCurrent()) $('balance').innerHTML = `<div class="hero-label">ঋণের বাকি</div><p style="margin-top:10px">${esc(errorText(err))}</p>`;
    }
  }

  async function loadLoans() {
    try {
      state.loans = await api.loans.listAll({ member_id: id });
      if (!isCurrent()) return;
      const el = $('loan-list');
      if (!state.loans.length) { el.innerHTML = emptyState('এই সদস্যের কোনো ঋণ নেই।', 'wallet'); return; }
      el.innerHTML = `<div class="table-wrap"><table class="table">
        <thead><tr><th>ঋণ</th><th class="num">মূল</th><th class="num">চার্জ</th><th class="num">মোট পরিশোধ</th><th class="num">প্রতি কিস্তি</th><th>কিস্তি</th><th>শুরু</th><th>অবস্থা</th>${can.manageLoans() ? '<th></th>' : ''}</tr></thead>
        <tbody>${state.loans.map((l) => `<tr>
          <td>#${esc(l.id)}</td>
          <td class="num">${money(l.principal)}</td>
          <td class="num">${num(l.service_charge_pct)}%</td>
          <td class="num"><b>${money(l.total_payable)}</b></td>
          <td class="num">${money(l.installment_amount)}</td>
          <td>${num(l.num_installments)}টি</td>
          <td class="nowrap">${esc(fmtDate(l.start_date))}</td>
          <td>${loanStatusBadge(l.status)}</td>
          ${can.manageLoans() ? `<td class="act"><button class="btn btn-sm btn-ghost" data-status="${l.id}">অবস্থা</button>
            ${can.deleteLoans() ? `<button class="icon-btn" data-del-loan="${l.id}" style="color:var(--red)" aria-label="মুছুন">${icon('trash', 16)}</button>` : ''}</td>` : ''}
        </tr>`).join('')}</tbody></table></div>`;
      const map = byId(state.loans);
      el.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', async () => {
        const r = await loanStatusDialog(map.get(Number(b.dataset.status)));
        if (r && isCurrent()) refreshAll();
      }));
      el.querySelectorAll('[data-del-loan]').forEach((b) => b.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'ঋণ মুছবেন?', message: `ঋণ #${esc(b.dataset.delLoan)} ও তার কিস্তিগুলো মুছে যাবে।`, confirmText: 'মুছে ফেলুন', danger: true });
        if (!ok) return;
        try { await api.loans.remove(Number(b.dataset.delLoan)); invalidate('loans'); toast('ঋণ মুছে ফেলা হয়েছে'); refreshAll(); }
        catch (err) { toast(errorText(err), 'err', 5000); }
      }));
    } catch (err) {
      if (isCurrent()) $('loan-list').innerHTML = errorState(err);
    }
  }

  async function loadDue() {
    const el = $('due-list');
    el.innerHTML = skeletonRows(2);
    try {
      const due = await api.installments.due({ date: state.dueDate });
      if (!isCurrent()) return;
      const loanIds = new Set(state.loans.map((l) => l.id));
      const mine = (due || []).filter((i) => loanIds.has(i.loan_id));
      if (!mine.length) { el.innerHTML = emptyState('এই তারিখ পর্যন্ত কোনো বকেয়া কিস্তি নেই।', 'check'); return; }
      const today = todayISO();
      const total = mine.reduce((s, i) => s + (toNumber(i.amount_due) - toNumber(i.amount_paid)), 0);
      const loanMap = byId(state.loans);
      el.innerHTML = `
        <p class="small muted" style="margin-bottom:10px">${num(mine.length)}টি কিস্তি · মোট বাকি <b style="color:var(--ink)">${money(total)}</b></p>
        <div class="list">${mine.map((i, idx) => {
          const rem = toNumber(i.amount_due) - toNumber(i.amount_paid);
          const overdue = isBefore(i.due_date, today);
          return `<div class="row ${overdue ? 'overdue' : ''}">
            <div class="grow">
              <div class="title">ঋণ #${esc(i.loan_id)} · কিস্তি ${num(i.number)}</div>
              <div class="meta"><span>${esc(fmtDate(i.due_date))}</span><span>কিস্তি ${money(i.amount_due)}</span><span>জমা ${money(i.amount_paid)}</span>
                ${overdue ? '<span class="badge b-red">মেয়াদোত্তীর্ণ</span>' : ''}</div>
            </div>
            <div class="amount">${money(rem)}</div>
            ${can.collect() ? `<div class="actions"><button class="btn btn-sm btn-green" data-collect="${idx}">${icon('cash', 16)} আদায়</button></div>` : ''}
          </div>`;
        }).join('')}</div>`;
      el.querySelectorAll('[data-collect]').forEach((b) => b.addEventListener('click', async () => {
        const inst = mine[Number(b.dataset.collect)];
        const res = await collectInstallmentDialog({ inst, member, loan: loanMap.get(inst.loan_id) });
        if (res && isCurrent()) refreshAll();
      }));
    } catch (err) {
      if (isCurrent()) el.innerHTML = errorState(err);
    }
  }

  async function refreshAll() {
    loadBalance();
    await loadLoans();
    await loadDue();
  }

  $('due-date').addEventListener('change', (e) => {
    state.dueDate = e.target.value || todayISO();
    loadDue();
  });
  const editBtn = $('edit-member');
  if (editBtn) editBtn.addEventListener('click', async () => {
    const res = await memberFormDialog(member);
    if (res && isCurrent()) renderMemberDetail(view, params, isCurrent);
  });
  const loanBtn = $('new-loan');
  if (loanBtn) loanBtn.addEventListener('click', async () => {
    const res = await loanFormDialog(member.id);
    if (res && isCurrent()) refreshAll();
  });
  const delBtn = $('del-member');
  if (delBtn) delBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'সদস্য মুছবেন?', message: `"${esc(member.full_name)}"-এর তথ্য মুছে যাবে।`, confirmText: 'মুছে ফেলুন', danger: true });
    if (!ok) return;
    try {
      await api.members.remove(member.id);
      invalidate('members');
      toast('সদস্য মুছে ফেলা হয়েছে');
      location.hash = '#/members';
    } catch (err) { toast(errorText(err), 'err', 5000); }
  });

  await refreshAll();
}
