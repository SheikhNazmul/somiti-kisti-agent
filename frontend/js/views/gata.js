// Gata (rotating savings circle): group list, group status, join, start, payment, payout.
import { api } from '../api.js';
import { can } from '../session.js';
import { getAllMembers, byId, invalidate } from '../data.js';
import {
  esc, icon, money, num, fmtDate, todayISO, gataStatusBadge, label, LABELS, options,
  skeletonRows, emptyState, errorState, openModal, confirmDialog, toast, initials,
  errorText as errorTextSafe,
} from '../ui.js';

/* =============== group list =============== */
export async function renderGata(view, _params, isCurrent) {
  const state = { status: '' };
  view.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${icon('circle', 16)} ঘূর্ণায়মান সঞ্চয়</div>
        <h1>গাতা গ্রুপ</h1>
        <p class="sub">প্রতি রাউন্ডে সবাই নির্দিষ্ট টাকা দেন, লটারিতে একজন পুরো টাকা পান।</p>
      </div>
      <div class="head-actions">
        ${can.manageGata() ? `<button class="btn btn-green" id="new-group">${icon('plus', 18)} নতুন গ্রুপ</button>` : ''}
      </div>
    </div>
    <div class="toolbar">
      <div class="seg" id="g-filter">
        <button data-s="" class="on">সব</button>
        ${Object.entries(LABELS.gataStatus).map(([v, t]) => `<button data-s="${v}">${esc(t)}</button>`).join('')}
      </div>
    </div>
    <div id="g-list" class="grid g-3">${skeletonRows(3)}</div>`;

  const listEl = view.querySelector('#g-list');

  async function load() {
    listEl.innerHTML = `<div style="grid-column:1/-1">${skeletonRows(3)}</div>`;
    try {
      const groups = await api.gata.listAll({ status: state.status || undefined });
      if (!isCurrent()) return;
      if (!groups.length) {
        listEl.innerHTML = `<div class="card" style="grid-column:1/-1">${emptyState('কোনো গাতা গ্রুপ নেই।', 'circle')}</div>`;
        return;
      }
      const statuses = await Promise.all(groups.map((g) => api.gata.status(g.id).catch(() => null)));
      if (!isCurrent()) return;
      listEl.innerHTML = groups.map((g, i) => {
        const s = statuses[i];
        const joined = s ? s.paid_member_ids.length + s.unpaid_member_ids.length : null;
        const pct = s && joined ? Math.round((s.paid_member_ids.length / joined) * 100) : 0;
        return `<article class="card group-card" data-open="${g.id}" tabindex="0">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
            <div><h3>${esc(g.name)}</h3><p class="small muted">${esc(label('frequency', g.frequency))} · শুরু ${esc(fmtDate(g.start_date))}</p></div>
            ${gataStatusBadge(g.status)}
          </div>
          <div><div class="small muted">প্রতি রাউন্ডে জমা</div><div class="g-amount">${money(g.amount)}</div></div>
          <div class="meta" style="display:flex;gap:6px 14px;flex-wrap:wrap;font-size:13px;color:var(--muted)">
            <span>${icon('users', 14)} সদস্য ${joined === null ? '—' : num(joined)}/${num(g.total_slots)}</span>
            ${s ? `<span>রাউন্ড ${num(s.current_round)}/${num(s.total_rounds)}</span><span>বিজয়ী ${num(s.winners_count)}</span>` : ''}
          </div>
          ${s && g.status === 'running' ? `<div><div class="small muted" style="margin-bottom:6px">এই রাউন্ডে দিয়েছেন ${num(s.paid_member_ids.length)}/${num(joined)}</div><div class="progress"><span style="width:${pct}%"></span></div></div>` : ''}
        </article>`;
      }).join('');
      listEl.querySelectorAll('[data-open]').forEach((c) => {
        const go = () => { location.hash = `#/gata/${c.dataset.open}`; };
        c.addEventListener('click', go);
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      });
    } catch (err) {
      if (!isCurrent()) return;
      listEl.innerHTML = `<div style="grid-column:1/-1">${errorState(err, 'g-retry')}</div>`;
      const b = view.querySelector('#g-retry'); if (b) b.addEventListener('click', load);
    }
  }

  view.querySelectorAll('#g-filter [data-s]').forEach((b) => b.addEventListener('click', () => {
    state.status = b.dataset.s;
    view.querySelectorAll('#g-filter [data-s]').forEach((x) => x.classList.toggle('on', x === b));
    load();
  }));
  const nb = view.querySelector('#new-group');
  if (nb) nb.addEventListener('click', async () => {
    const g = await groupFormDialog();
    if (g && isCurrent()) location.hash = `#/gata/${g.id}`;
  });

  await load();
}

function groupFormDialog() {
  const freq = Object.entries(LABELS.frequency).map(([value, text]) => ({ value, text }));
  const m = openModal({
    title: 'নতুন গাতা গ্রুপ',
    sub: 'গ্রুপ তৈরি হলে সদস্য যোগ করুন; সব আসন পূর্ণ হলে গ্রুপ চালু করা যাবে।',
    wide: true,
    body: `<div class="form-grid">
      <label class="field full"><span>গ্রুপের নাম</span><input class="input" name="name" required minlength="3" maxlength="120"></label>
      <label class="field"><span>প্রতি রাউন্ডে জমা (৳)</span><input class="input" name="amount" type="number" min="1" step="0.01" required inputmode="decimal"></label>
      <label class="field"><span>মোট আসন (সদস্য সংখ্যা)</span><input class="input" name="total_slots" type="number" min="1" step="1" required inputmode="numeric"></label>
      <label class="field"><span>কত দিন পর পর</span><select class="select" name="frequency">${options(freq, 'weekly')}</select></label>
      <label class="field"><span>শুরুর তারিখ</span><input class="input" name="start_date" type="date" required value="${todayISO()}"></label>
    </div>`,
    submitText: 'গ্রুপ তৈরি করুন',
    onSubmit: async (fd) => {
      const g = await api.gata.create({
        name: String(fd.get('name')).trim(),
        amount: String(fd.get('amount')),
        total_slots: Number(fd.get('total_slots')),
        frequency: String(fd.get('frequency')),
        start_date: String(fd.get('start_date')),
      });
      toast(`গ্রুপ তৈরি হয়েছে: ${g.name}`);
      return g;
    },
  });
  return m.done;
}

/* =============== group detail =============== */
export async function renderGataDetail(view, params, isCurrent) {
  const id = Number(params[0]);
  view.innerHTML = `<a class="back-link" href="#/gata">${icon('back', 16)} সব গ্রুপ</a>${skeletonRows(5)}`;

  let group; let status; let members;
  try {
    [group, status, members] = await Promise.all([api.gata.get(id), api.gata.status(id), getAllMembers()]);
  } catch (err) {
    if (!isCurrent()) return;
    view.innerHTML = `<a class="back-link" href="#/gata">${icon('back', 16)} সব গ্রুপ</a>${errorState(err, 'gd-retry')}`;
    const b = view.querySelector('#gd-retry'); if (b) b.addEventListener('click', () => renderGataDetail(view, params, isCurrent));
    return;
  }
  if (!isCurrent()) return;

  const mm = byId(members);
  const nameOf = (mid) => (mm.get(mid) ? mm.get(mid).full_name : `সদস্য #${mid}`);
  const paid = status.paid_member_ids;
  const unpaid = status.unpaid_member_ids;
  const allIds = [...paid, ...unpaid];
  const notWon = new Set(status.not_won_member_ids);
  const winners = allIds.filter((mid) => !notWon.has(mid));
  const joined = allIds.length;
  const pct = joined ? Math.round((paid.length / joined) * 100) : 0;
  const unpaidNameById = new Map(unpaid.map((mid, i) => [mid, status.unpaid_member_names[i]]));

  const pill = (mid, cls) => {
    const nm = unpaidNameById.get(mid) && !mm.get(mid) ? unpaidNameById.get(mid) : nameOf(mid);
    return `<span class="person-pill ${cls}"><span class="dot">${esc(initials(nm).slice(0, 2))}</span><a href="#/members/${mid}">${esc(nm)}</a></span>`;
  };

  const isForming = status.status === 'forming';
  const isRunning = status.status === 'running';

  view.innerHTML = `
    <a class="back-link" href="#/gata">${icon('back', 16)} সব গ্রুপ</a>
    <div class="page-head">
      <div>
        <div class="eyebrow">${gataStatusBadge(status.status)} <span>${esc(label('frequency', group.frequency))} · শুরু ${esc(fmtDate(group.start_date))}</span></div>
        <h1>${esc(group.name)}</h1>
        <p class="sub">প্রতি রাউন্ডে প্রত্যেকে ${money(group.amount)} · মোট আসন ${num(group.total_slots)}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" id="refresh">${icon('refresh', 18)} হালনাগাদ</button>
        ${can.manageGata() && isForming ? `<button class="btn btn-ghost" id="join">${icon('userPlus', 18)} সদস্য যোগ</button>
          <button class="btn btn-black" id="start">${icon('play', 18)} গ্রুপ চালু করুন</button>` : ''}
        ${can.collect() && isRunning ? `<button class="btn btn-green" id="pay">${icon('cash', 18)} জমা নিন</button>` : ''}
        ${can.manageGata() && isRunning ? `<button class="btn btn-orange" id="payout">${icon('trophy', 18)} পে-আউট (লটারি)</button>` : ''}
      </div>
    </div>

    <div class="hero-wrap" style="margin-bottom:24px">
      <section class="hero" style="padding-bottom:30px">
        <div class="hero-top">
          <div>
            <div class="hero-label">বর্তমান রাউন্ড</div>
            <div class="round-big">${num(status.current_round)}<span style="font-size:22px;opacity:.8"> / ${num(status.total_rounds)}</span></div>
            <div class="hero-meta">
              <span class="chip-glass">বিজয়ী ${num(status.winners_count)} জন</span>
              <span class="chip-glass">সদস্য ${num(joined)}/${num(group.total_slots)}</span>
              <span class="chip-glass">এই রাউন্ডে দিয়েছেন ${num(paid.length)} · বাকি ${num(unpaid.length)}</span>
            </div>
          </div>
          <div style="min-width:220px;position:relative;z-index:1">
            <div class="hero-label">এই রাউন্ডের জমা</div>
            <div class="progress" style="background:rgba(255,255,255,.25);margin-top:10px;height:12px"><span style="width:${pct}%;background:#fff"></span></div>
            <div class="hero-label" style="margin-top:6px">${num(pct)}% সম্পন্ন</div>
          </div>
        </div>
      </section>
    </div>

    ${isForming ? `<div class="form-note" style="margin-bottom:18px">${icon('info', 16)} গ্রুপ এখন গঠন চলছে: ${num(joined)}/${num(group.total_slots)} জন যোগ দিয়েছেন। সব আসন পূর্ণ হলে চালু করুন।</div>` : ''}

    <div class="grid g-3">
      <section class="card">
        <div class="card-head"><div><h3>দিয়েছেন</h3><p>রাউন্ড ${num(status.current_round)}-এ জমা দিয়েছেন</p></div><span class="badge b-green">${num(paid.length)}</span></div>
        ${paid.length ? `<div class="pill-list">${paid.map((mid) => pill(mid, 'paid')).join('')}</div>` : emptyState('এখনও কেউ দেননি।', 'cash')}
      </section>
      <section class="card">
        <div class="card-head"><div><h3>বাকি</h3><p>এই রাউন্ডে এখনও দেননি</p></div><span class="badge b-orange">${num(unpaid.length)}</span></div>
        ${unpaid.length ? `<div class="pill-list">${unpaid.map((mid) => `<span class="pay-pair">${pill(mid, 'unpaid')}${can.collect() && isRunning ? `<button class="btn btn-sm btn-soft" data-pay="${mid}">জমা</button>` : ''}</span>`).join('')}</div>` : emptyState(joined ? 'সবাই দিয়েছেন। ✅' : 'এখনও কোনো সদস্য নেই।', 'check')}
      </section>
      <section class="card">
        <div class="card-head"><div><h3>বিজয়ী</h3><p>এখন পর্যন্ত যাঁরা পেয়েছেন</p></div><span class="badge b-black plain">${num(winners.length)}</span></div>
        ${winners.length ? `<div class="pill-list">${winners.map((mid) => pill(mid, 'winner')).join('')}</div>` : emptyState('এখনও কেউ পাননি।', 'trophy')}
      </section>
    </div>`;

  const reload = () => { if (isCurrent()) renderGataDetail(view, params, isCurrent); };
  const $ = (s) => view.querySelector(`#${s}`);

  $('refresh').addEventListener('click', () => { invalidate('members'); reload(); });

  const joinBtn = $('join');
  if (joinBtn) joinBtn.addEventListener('click', async () => {
    const inGroup = new Set(allIds);
    const candidates = members
      .filter((m) => m.is_active && !inGroup.has(m.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'bn'));
    if (!candidates.length) { toast('যোগ করার মতো কোনো সদস্য নেই।', 'warn'); return; }
    const mdl = openModal({
      title: 'গ্রুপে সদস্য যোগ',
      sub: `${esc(group.name)} · আসন ${num(joined)}/${num(group.total_slots)}`,
      body: `
        <label class="field"><span>খুঁজুন</span><input class="input" id="join-q" type="search" placeholder="নাম বা ফোন…"></label>
        <label class="field"><span>সদস্য</span>
          <select class="select" name="member_id" id="join-sel" required size="8" style="height:auto;background-image:none;padding-right:14px">
            ${options(candidates.map((m) => ({ value: m.id, text: `${m.full_name} · ${m.phone} · ${label('accountType', m.account_type)}` })), '')}
          </select>
          <small>শুধু "গাতা" বা "ঋণ + গাতা" ধরনের সদস্য যোগ দিতে পারেন — সার্ভার যাচাই করবে।</small></label>`,
      submitText: 'যোগ করুন',
      onSubmit: async (fd) => {
        const memberId = Number(fd.get('member_id'));
        await api.gata.addMember(id, memberId);
        toast(`${nameOf(memberId)} গ্রুপে যোগ হয়েছেন`);
        return true;
      },
    });
    const q = mdl.el.querySelector('#join-q');
    const sel = mdl.el.querySelector('#join-sel');
    q.addEventListener('input', () => {
      const t = q.value.trim().toLowerCase();
      [...sel.options].forEach((o) => { o.hidden = Boolean(t) && !o.textContent.toLowerCase().includes(t); });
    });
    if (await mdl.done) reload();
  });

  const startBtn = $('start');
  if (startBtn) startBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'গ্রুপ চালু করবেন?', message: `চালু করার পর আর নতুন সদস্য যোগ করা যাবে না। বর্তমান সদস্য: ${num(joined)}/${num(group.total_slots)}`, confirmText: 'চালু করুন' });
    if (!ok) return;
    try { await api.gata.start(id); toast('গ্রুপ চালু হয়েছে'); reload(); }
    catch (err) { toast(errorTextSafe(err), 'err', 6000); }
  });

  async function payDialog(presetMember) {
    // Only member + round are sent: the backend records the group's fixed amount itself.
    const opts = allIds.map((mid) => ({ value: mid, text: `${nameOf(mid)}${paid.includes(mid) ? ' (এই রাউন্ডে দিয়েছেন)' : ''}` }));
    const mdl = openModal({
      title: 'গাতার জমা নিন',
      sub: `${esc(group.name)} · প্রতি রাউন্ডের নির্ধারিত টাকা সার্ভার নিজে লিখবে।`,
      body: `
        <label class="field"><span>সদস্য</span>
          <select class="select" name="member_id" required>${options(opts, presetMember ?? unpaid[0])}</select></label>
        <label class="field"><span>রাউন্ড নম্বর</span>
          <input class="input" name="round_number" type="number" min="1" step="1" required value="${esc(status.current_round)}" inputmode="numeric">
          <small>বর্তমান রাউন্ড: ${num(status.current_round)}</small></label>`,
      submitText: 'জমা নিশ্চিত করুন',
      onSubmit: async (fd) => {
        const memberId = Number(fd.get('member_id'));
        const round = Number(fd.get('round_number'));
        const p = await api.gata.pay(id, memberId, round);
        toast(`${nameOf(memberId)}: রাউন্ড ${num(p.round_number)}-এর ${money(p.amount)} জমা হয়েছে`);
        return true;
      },
    });
    if (await mdl.done) reload();
  }
  const payBtn = $('pay');
  if (payBtn) payBtn.addEventListener('click', () => payDialog(null));
  view.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => payDialog(Number(b.dataset.pay))));

  const payoutBtn = $('payout');
  if (payoutBtn) payoutBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: `রাউন্ড ${num(status.current_round)}-এর পে-আউট`,
      message: unpaid.length
        ? `এখনও ${num(unpaid.length)} জন দেননি। সবাই না দিলে সার্ভার পে-আউট করতে দেবে না।`
        : 'যাঁরা এখনও পাননি তাঁদের মধ্য থেকে লটারিতে একজন বিজয়ী বাছাই হবে।',
      confirmText: 'লটারি চালান',
    });
    if (!ok) return;
    payoutBtn.disabled = true;
    try {
      const r = await api.gata.payout(id);
      openModal({
        title: 'পে-আউট সম্পন্ন',
        body: `<div class="payout-result">
          <div class="trophy">${icon('trophy', 38)}</div>
          <p class="muted">রাউন্ড ${num(r.round_number)}-এর বিজয়ী</p>
          <div class="winner">${esc(r.winner_name || nameOf(r.winner_member_id))}</div>
          <div class="amt">${money(r.payout_amount)}</div>
          <p class="small muted">গ্রুপের অবস্থা: ${esc(label('gataStatus', r.group_status))}</p>
        </div>`,
      }).done.then(reload);
    } catch (err) {
      toast(errorTextSafe(err), 'err', 7000);
      payoutBtn.disabled = false;
    }
  });
}

