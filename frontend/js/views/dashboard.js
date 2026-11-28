// Dashboard: green balance hero + overlapping stat cards, gata rounds, today's visit preview.
import { api } from '../api.js';
import { session, can } from '../session.js';
import { getAllMembers, getDueEnriched } from '../data.js';
import { collectInstallmentDialog } from '../actions.js';
import {
  esc, icon, money, num, fmtDate, fmtDateLong, todayISO, toNumber, gataStatusBadge,
  label, errorState, emptyState, skeletonRows, isBefore,
} from '../ui.js';

export async function renderDashboard(view, _params, isCurrent) {
  const user = session.user;
  const today = todayISO();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'শুভ সকাল' : hour < 17 ? 'শুভ দুপুর' : 'শুভ সন্ধ্যা';

  view.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${icon('calendar', 16)} ${esc(fmtDateLong(today))}</div>
        <h1>${greet}, ${esc(user.full_name)}</h1>
        <p class="sub">আজকের আদায়, সদস্য আর গাতা গ্রুপের সারসংক্ষেপ।</p>
      </div>
      <div class="head-actions">
        <a class="btn btn-ghost" href="#/chat">${icon('chat', 18)} AI-কে জিজ্ঞেস করুন</a>
        <a class="btn btn-black" href="#/loans">${icon('wallet', 18)} আজকের ভিজিট তালিকা</a>
      </div>
    </div>

    <div class="hero-wrap">
      <section class="hero">
        <div class="hero-top">
          <div>
            <div class="hero-label">আজ পর্যন্ত বকেয়া কিস্তি (আদায় বাকি)</div>
            <div class="hero-amount" id="hero-amount"><div class="skel skel-val light"></div></div>
            <div class="hero-meta" id="hero-meta"></div>
          </div>
          <div class="hero-actions">
            <a class="btn btn-white" href="#/loans">${icon('cash', 18)} আদায় শুরু করুন</a>
          </div>
        </div>
      </section>
      <div class="overlap">
        <div class="stat">
          <div class="stat-ico ico-orange">${icon('users')}</div>
          <div class="stat-label">মোট সদস্য</div>
          <div class="stat-value" id="st-members"><div class="skel skel-val"></div></div>
          <div class="stat-foot" id="st-members-foot">&nbsp;</div>
        </div>
        <div class="stat">
          <div class="stat-ico ico-black">${icon('circle')}</div>
          <div class="stat-label">গাতা গ্রুপ</div>
          <div class="stat-value" id="st-gata"><div class="skel skel-val"></div></div>
          <div class="stat-foot" id="st-gata-foot">&nbsp;</div>
        </div>
        <div class="stat">
          <div class="stat-ico ico-green">${icon('wallet')}</div>
          <div class="stat-label">মোট বকেয়া ঋণ (সব সদস্য)</div>
          <div class="stat-value" id="st-out"><div class="skel skel-val"></div></div>
          <div class="stat-foot" id="st-out-foot">&nbsp;</div>
        </div>
      </div>
    </div>

    <div class="grid g-main">
      <section class="card">
        <div class="card-head">
          <div><h3>আজকের ভিজিট</h3><p>আজ বা আগে নির্ধারিত, এখনও বাকি কিস্তি</p></div>
          <a class="btn btn-sm btn-soft" href="#/loans">সব দেখুন ${icon('arrow', 16)}</a>
        </div>
        <div id="due-list">${skeletonRows(4)}</div>
      </section>
      <section class="card">
        <div class="card-head">
          <div><h3>গাতা রাউন্ড</h3><p>চলমান গ্রুপের বর্তমান অবস্থা</p></div>
          <a class="btn btn-sm btn-soft" href="#/gata">গ্রুপ ${icon('arrow', 16)}</a>
        </div>
        <div id="gata-list">${skeletonRows(3)}</div>
      </section>
    </div>`;

  const $ = (id) => view.querySelector(`#${id}`);

  /* ---- due today (GET /installments/due) ---- */
  async function loadDue() {
    try {
      const rows = await getDueEnriched({ date: today });
      if (!isCurrent()) return;
      const total = rows.reduce((s, r) => s + (toNumber(r.inst.amount_due) - toNumber(r.inst.amount_paid)), 0);
      const overdue = rows.filter((r) => isBefore(r.inst.due_date, today)).length;
      const dueToday = rows.length - overdue;
      $('hero-amount').textContent = money(total);
      $('hero-meta').innerHTML = `
        <span class="chip-glass">${num(rows.length)}টি কিস্তি বাকি</span>
        <span class="chip-glass">আজ নির্ধারিত ${num(dueToday)}টি</span>
        <span class="chip-glass">আগের বকেয়া ${num(overdue)}টি</span>`;
      const list = $('due-list');
      if (!rows.length) { list.innerHTML = emptyState('আজ কোনো বকেয়া কিস্তি নেই। 🎉', 'check'); return; }
      list.innerHTML = `<div class="list">${rows.slice(0, 6).map((r, i) => dueRow(r, i, today)).join('')}</div>
        ${rows.length > 6 ? `<p class="small muted" style="margin-top:10px">আরও ${num(rows.length - 6)}টি — ঋণ ও বকেয়া পাতায় দেখুন।</p>` : ''}`;
      list.querySelectorAll('[data-collect]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const r = rows[Number(b.dataset.collect)];
        const res = await collectInstallmentDialog(r);
        if (res && isCurrent()) { loadDue(); loadOutstanding(); }
      }));
      list.querySelectorAll('[data-member]').forEach((el) => el.addEventListener('click', () => {
        location.hash = `#/members/${el.dataset.member}`;
      }));
    } catch (err) {
      if (!isCurrent()) return;
      $('hero-amount').textContent = '—';
      $('due-list').innerHTML = errorState(err, 'due-retry');
      const b = $('due-retry'); if (b) b.addEventListener('click', loadDue);
    }
  }

  /* ---- members (GET /members) + total outstanding (GET /members/{id}/balance) ---- */
  async function loadMembers() {
    try {
      const members = await getAllMembers();
      if (!isCurrent()) return [];
      const active = members.filter((m) => m.is_active).length;
      $('st-members').textContent = num(members.length);
      $('st-members-foot').textContent = `সক্রিয় ${num(active)} জন`;
      return members;
    } catch (err) {
      if (isCurrent()) { $('st-members').textContent = '—'; $('st-members-foot').textContent = 'লোড করা যায়নি'; }
      return null;
    }
  }

  async function loadOutstanding(membersArg) {
    const members = membersArg || (await getAllMembers().catch(() => null));
    if (!isCurrent()) return;
    if (!members) { $('st-out').textContent = '—'; $('st-out-foot').textContent = 'লোড করা যায়নি'; return; }
    $('st-out-foot').textContent = 'হিসাব হচ্ছে…';
    let total = 0; let withBalance = 0; let failed = 0;
    // Sum of each member's "remaining" from GET /members/{id}/balance.
    const queue = members.slice();
    const worker = async () => {
      while (queue.length) {
        const m = queue.shift();
        try {
          const b = await api.members.balance(m.id);
          const rem = toNumber(b.remaining);
          total += rem;
          if (rem > 0) withBalance += 1;
        } catch { failed += 1; }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (!isCurrent()) return;
    $('st-out').textContent = money(total);
    $('st-out-foot').textContent = failed
      ? `${num(withBalance)} জনের কাছে বাকি · ${num(failed)} জনের হিসাব আসেনি`
      : `${num(withBalance)} জন সদস্যের কাছে বাকি`;
  }

  /* ---- gata (GET /gata/groups + /status) ---- */
  async function loadGata() {
    try {
      const groups = await api.gata.listAll();
      if (!isCurrent()) return;
      const running = groups.filter((g) => g.status === 'running');
      const forming = groups.filter((g) => g.status === 'forming').length;
      $('st-gata').textContent = num(groups.length);
      $('st-gata-foot').textContent = `চলমান ${num(running.length)} · গঠন চলছে ${num(forming)}`;
      const list = $('gata-list');
      const show = (running.length ? running : groups).slice(0, 5);
      if (!show.length) { list.innerHTML = emptyState('এখনও কোনো গাতা গ্রুপ নেই।', 'circle'); return; }
      const statuses = await Promise.all(show.map((g) => api.gata.status(g.id).catch(() => null)));
      if (!isCurrent()) return;
      list.innerHTML = `<div class="list">${show.map((g, i) => {
        const s = statuses[i];
        const members = s ? s.paid_member_ids.length + s.unpaid_member_ids.length : 0;
        const pct = s && members ? Math.round((s.paid_member_ids.length / members) * 100) : 0;
        return `<a class="row clickable" href="#/gata/${g.id}" style="text-decoration:none;display:grid;gap:10px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <div class="grow"><div class="title">${esc(g.name)}</div>
              <div class="meta"><span>${money(g.amount)} · ${esc(label('frequency', g.frequency))}</span></div></div>
            ${gataStatusBadge(g.status)}
          </div>
          ${s ? `<div class="meta"><span>রাউন্ড ${num(s.current_round)}/${num(s.total_rounds)}</span><span>বিজয়ী ${num(s.winners_count)} জন</span><span>এই রাউন্ডে দিয়েছেন ${num(s.paid_member_ids.length)}/${num(members)}</span></div>
          <div class="progress"><span style="width:${pct}%"></span></div>` : '<div class="meta">অবস্থা লোড করা যায়নি</div>'}
        </a>`;
      }).join('')}</div>`;
    } catch (err) {
      if (!isCurrent()) return;
      $('st-gata').textContent = '—';
      $('gata-list').innerHTML = errorState(err, 'gata-retry');
      const b = $('gata-retry'); if (b) b.addEventListener('click', loadGata);
    }
  }

  loadDue();
  loadGata();
  const members = await loadMembers();
  if (members) loadOutstanding(members);
  else if (isCurrent()) { $('st-out').textContent = '—'; }
}

function dueRow(r, i, today) {
  const { inst, member, area } = r;
  const remaining = toNumber(inst.amount_due) - toNumber(inst.amount_paid);
  const overdue = isBefore(inst.due_date, today);
  return `<div class="row ${overdue ? 'overdue' : ''}">
    <div class="avatar" style="width:38px;height:38px;font-size:13px">${esc(member ? member.full_name.slice(0, 1) : '?')}</div>
    <div class="grow" ${member ? `data-member="${member.id}" style="cursor:pointer"` : ''}>
      <div class="title">${esc(member ? member.full_name : `ঋণ #${inst.loan_id}`)}</div>
      <div class="meta">
        <span>কিস্তি ${num(inst.number)}</span>
        <span>${esc(fmtDate(inst.due_date))}</span>
        ${area ? `<span>${esc(area.name)}</span>` : ''}
        ${overdue ? '<span class="badge b-red">মেয়াদোত্তীর্ণ</span>' : ''}
      </div>
    </div>
    <div class="amount">${money(remaining)}</div>
    ${can.collect() ? `<div class="actions"><button class="btn btn-sm btn-green" data-collect="${i}">আদায়</button></div>` : ''}
  </div>`;
}
