// Loans & Due: visit list (GET /installments/due) with collect, and loan list (GET /loans).
import { api } from '../api.js';
import { can } from '../session.js';
import { getAreas, getAllMembers, getDueEnriched, byId, invalidate } from '../data.js';
import { collectInstallmentDialog, loanFormDialog, loanStatusDialog } from '../actions.js';
import {
  esc, icon, money, num, fmtDate, fmtDateLong, todayISO, toNumber, loanStatusBadge, label, LABELS,
  options, skeletonRows, emptyState, errorState, isBefore, confirmDialog, toast, errorText, debounce,
} from '../ui.js';

export async function renderLoans(view, _params, isCurrent) {
  const state = { tab: 'due', date: todayISO(), area_id: '', status: '', q: '' };

  view.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${icon('wallet', 16)} কিস্তি আদায়</div>
        <h1>ঋণ ও বকেয়া</h1>
        <p class="sub">এলাকা ধরে আজকের ভিজিট তালিকা, কিস্তি আদায় আর সব ঋণের হিসাব।</p>
      </div>
      <div class="head-actions">
        ${can.manageLoans() ? `<button class="btn btn-green" id="new-loan">${icon('plus', 18)} নতুন ঋণ</button>` : ''}
      </div>
    </div>
    <div class="toolbar">
      <div class="seg" role="tablist">
        <button data-tab="due" class="on" role="tab">${icon('calendar', 16)} ভিজিট তালিকা</button>
        <button data-tab="loans" role="tab">${icon('list', 16)} ঋণ তালিকা</button>
      </div>
    </div>
    <div id="tab-body"></div>`;

  const body = view.querySelector('#tab-body');
  const areas = await getAreas().catch(() => []);
  if (!isCurrent()) return;

  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    view.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    renderTab();
  }));
  const nl = view.querySelector('#new-loan');
  if (nl) nl.addEventListener('click', async () => {
    const r = await loanFormDialog(null);
    if (r && isCurrent()) renderTab();
  });

  function renderTab() {
    if (state.tab === 'due') renderDue(); else renderLoanList();
  }

  /* ---------------- due / visit list ---------------- */
  function renderDue() {
    body.innerHTML = `
      <div class="stat-row" id="due-stats">
        <div class="mini-stat green"><div class="l">মোট বাকি</div><div class="v"><span class="skel skel-val light" style="display:block;height:26px;width:120px"></span></div></div>
        <div class="mini-stat"><div class="l">বাকি কিস্তি</div><div class="v">—</div></div>
        <div class="mini-stat orange"><div class="l">মেয়াদোত্তীর্ণ</div><div class="v">—</div></div>
      </div>
      <section class="card">
        <div class="toolbar">
          <label class="field" style="grid-auto-flow:column;align-items:center;gap:8px"><span>তারিখ পর্যন্ত</span>
            <input class="input" type="date" id="d-date" value="${state.date}" style="width:auto"></label>
          <select class="select" id="d-area" aria-label="এলাকা">
            <option value="">সব এলাকা</option>
            ${options(areas.map((a) => ({ value: a.id, text: `${a.name} · ${label('day', a.collection_day)}` })), state.area_id)}
          </select>
          <button class="btn btn-ghost btn-sm" id="d-refresh">${icon('refresh', 16)} হালনাগাদ</button>
        </div>
        <p class="small muted" id="d-caption" style="margin-bottom:12px"></p>
        <div id="d-list">${skeletonRows(5)}</div>
      </section>`;
    body.querySelector('#d-date').addEventListener('change', (e) => { state.date = e.target.value || todayISO(); loadDue(); });
    body.querySelector('#d-area').addEventListener('change', (e) => { state.area_id = e.target.value; loadDue(); });
    body.querySelector('#d-refresh').addEventListener('click', () => { invalidate('loans', 'members'); loadDue(); });
    loadDue();
  }

  async function loadDue() {
    const list = body.querySelector('#d-list');
    if (!list) return;
    list.innerHTML = skeletonRows(5);
    const snap = `${state.date}|${state.area_id}`;
    try {
      const rows = await getDueEnriched({ date: state.date, area_id: state.area_id || undefined });
      if (!isCurrent() || state.tab !== 'due' || snap !== `${state.date}|${state.area_id}`) return;
      const today = todayISO();
      const total = rows.reduce((s, r) => s + (toNumber(r.inst.amount_due) - toNumber(r.inst.amount_paid)), 0);
      const overdue = rows.filter((r) => isBefore(r.inst.due_date, today)).length;
      const stats = body.querySelector('#due-stats');
      stats.innerHTML = `
        <div class="mini-stat green"><div class="l">মোট বাকি</div><div class="v">${money(total)}</div></div>
        <div class="mini-stat"><div class="l">বাকি কিস্তি</div><div class="v">${num(rows.length)}টি</div></div>
        <div class="mini-stat orange"><div class="l">মেয়াদোত্তীর্ণ (আজকের আগের)</div><div class="v">${num(overdue)}টি</div></div>`;
      body.querySelector('#d-caption').textContent = `${fmtDateLong(state.date)} পর্যন্ত নির্ধারিত, এখনও বাকি কিস্তি`;

      if (!rows.length) { list.innerHTML = emptyState('এই তারিখ পর্যন্ত কোনো বকেয়া কিস্তি নেই। 🎉', 'check'); return; }

      // Group by area for the collector's visit route.
      const groups = new Map();
      rows.forEach((r, idx) => {
        const key = r.area ? r.area.id : 0;
        if (!groups.has(key)) groups.set(key, { area: r.area, items: [] });
        groups.get(key).items.push({ ...r, idx });
      });
      list.innerHTML = [...groups.values()].map((g) => {
        const sub = g.items.reduce((s, r) => s + (toNumber(r.inst.amount_due) - toNumber(r.inst.amount_paid)), 0);
        return `<div style="margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin:0 4px 10px">
            <h4>${icon('map', 16)} ${esc(g.area ? g.area.name : 'এলাকা জানা নেই')} ${g.area ? `<span class="muted small">· ${esc(label('day', g.area.collection_day))}</span>` : ''}</h4>
            <span class="small muted">${num(g.items.length)}টি · ${money(sub)}</span>
          </div>
          <div class="list">${g.items.map((r) => dueRow(r, today)).join('')}</div>
        </div>`;
      }).join('');

      list.querySelectorAll('[data-collect]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const r = rows[Number(b.dataset.collect)];
        const res = await collectInstallmentDialog(r);
        if (res && isCurrent()) loadDue();
      }));
      list.querySelectorAll('[data-member]').forEach((el) => el.addEventListener('click', () => {
        location.hash = `#/members/${el.dataset.member}`;
      }));
    } catch (err) {
      if (!isCurrent()) return;
      list.innerHTML = errorState(err, 'd-retry');
      const b = body.querySelector('#d-retry'); if (b) b.addEventListener('click', loadDue);
    }
  }

  function dueRow({ inst, member, loan, idx }, today) {
    const rem = toNumber(inst.amount_due) - toNumber(inst.amount_paid);
    const overdue = isBefore(inst.due_date, today);
    return `<div class="row ${overdue ? 'overdue' : ''}">
      <div class="grow" ${member ? `data-member="${member.id}" style="cursor:pointer"` : ''}>
        <div class="title">${esc(member ? member.full_name : `ঋণ #${inst.loan_id}`)}</div>
        <div class="meta">
          ${member ? `<span>${icon('phone', 13)} ${esc(member.phone)}</span>` : ''}
          <span>ঋণ #${esc(inst.loan_id)} · কিস্তি ${num(inst.number)}${loan ? `/${num(loan.num_installments)}` : ''}</span>
          <span>${esc(fmtDate(inst.due_date))}</span>
          ${toNumber(inst.amount_paid) > 0 ? `<span>আংশিক জমা ${money(inst.amount_paid)}</span>` : ''}
          ${overdue ? '<span class="badge b-red">মেয়াদোত্তীর্ণ</span>' : inst.due_date === today ? '<span class="badge b-orange">আজ</span>' : '<span class="badge b-blue">আসন্ন</span>'}
        </div>
      </div>
      <div class="amount">${money(rem)}</div>
      ${can.collect() ? `<div class="actions"><button class="btn btn-sm btn-green" data-collect="${idx}">${icon('cash', 16)} আদায়</button></div>` : ''}
    </div>`;
  }

  /* ---------------- loan list ---------------- */
  function renderLoanList() {
    body.innerHTML = `
      <section class="card">
        <div class="toolbar">
          <div class="search-wrap">${icon('search', 18)}<input class="input input-pill" id="l-q" type="search" placeholder="সদস্যের নাম বা ফোন…" value="${esc(state.q)}"></div>
          <select class="select" id="l-status" aria-label="অবস্থা">
            <option value="">সব অবস্থা</option>
            ${options(Object.entries(LABELS.loanStatus).map(([value, text]) => ({ value, text })), state.status)}
          </select>
        </div>
        <div id="l-list">${skeletonRows(6)}</div>
      </section>`;
    body.querySelector('#l-status').addEventListener('change', (e) => { state.status = e.target.value; loadLoans(); });
    body.querySelector('#l-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); loadLoans(); }, 250));
    loadLoans();
  }

  async function loadLoans() {
    const el = body.querySelector('#l-list');
    if (!el) return;
    try {
      const [loans, members] = await Promise.all([
        api.loans.listAll({ status: state.status || undefined }),
        getAllMembers(),
      ]);
      if (!isCurrent() || state.tab !== 'loans') return;
      const mm = byId(members);
      const q = state.q.toLowerCase();
      const shown = loans.filter((l) => {
        if (!q) return true;
        const m = mm.get(l.member_id);
        return m && (m.full_name.toLowerCase().includes(q) || m.phone.includes(q));
      });
      if (!shown.length) { el.innerHTML = emptyState('কোনো ঋণ পাওয়া যায়নি।', 'wallet'); return; }
      el.innerHTML = `
        <p class="small muted" style="margin-bottom:10px">${num(shown.length)}টি ঋণ</p>
        <div class="table-wrap"><table class="table">
        <thead><tr><th>ঋণ</th><th>সদস্য</th><th class="num">মূল</th><th class="num">চার্জ</th><th class="num">মোট পরিশোধ</th><th class="num">প্রতি কিস্তি</th><th>কিস্তি</th><th>শুরু</th><th>অবস্থা</th>${can.manageLoans() ? '<th></th>' : ''}</tr></thead>
        <tbody>${shown.map((l) => {
          const m = mm.get(l.member_id);
          return `<tr class="clickable" data-member="${l.member_id}">
            <td>#${esc(l.id)}</td>
            <td><b>${esc(m ? m.full_name : `সদস্য #${l.member_id}`)}</b>${m ? `<div class="tiny muted">${esc(m.phone)}</div>` : ''}</td>
            <td class="num">${money(l.principal)}</td>
            <td class="num">${num(l.service_charge_pct)}%</td>
            <td class="num"><b>${money(l.total_payable)}</b></td>
            <td class="num">${money(l.installment_amount)}</td>
            <td>${num(l.num_installments)}টি</td>
            <td class="nowrap">${esc(fmtDate(l.start_date))}</td>
            <td>${loanStatusBadge(l.status)}</td>
            ${can.manageLoans() ? `<td class="act"><button class="btn btn-sm btn-ghost" data-status="${l.id}">অবস্থা</button>
              ${can.deleteLoans() ? `<button class="icon-btn" data-del="${l.id}" style="color:var(--red)" aria-label="মুছুন">${icon('trash', 16)}</button>` : ''}</td>` : ''}
          </tr>`;
        }).join('')}</tbody></table></div>`;
      const lm = byId(loans);
      el.querySelectorAll('tr[data-member]').forEach((tr) => tr.addEventListener('click', () => {
        location.hash = `#/members/${tr.dataset.member}`;
      }));
      el.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const r = await loanStatusDialog(lm.get(Number(b.dataset.status)));
        if (r && isCurrent()) loadLoans();
      }));
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog({ title: 'ঋণ মুছবেন?', message: `ঋণ #${esc(b.dataset.del)} ও তার কিস্তিগুলো মুছে যাবে।`, confirmText: 'মুছে ফেলুন', danger: true });
        if (!ok) return;
        try { await api.loans.remove(Number(b.dataset.del)); invalidate('loans'); toast('ঋণ মুছে ফেলা হয়েছে'); loadLoans(); }
        catch (err) { toast(errorText(err), 'err', 5000); }
      }));
    } catch (err) {
      if (!isCurrent()) return;
      el.innerHTML = errorState(err, 'l-retry');
      const b = body.querySelector('#l-retry'); if (b) b.addEventListener('click', loadLoans);
    }
  }

  renderTab();
}
