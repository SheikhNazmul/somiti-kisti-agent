// Members: searchable list (GET /members), create/edit/delete, plus the areas panel.
import { api } from '../api.js';
import { can } from '../session.js';
import { getAreas, byId, invalidate } from '../data.js';
import { memberFormDialog, areaFormDialog } from '../actions.js';
import {
  esc, icon, num, fmtDate, accountBadge, label, LABELS, options, debounce,
  skeletonRows, emptyState, errorState, confirmDialog, toast, errorText, initials,
} from '../ui.js';

const PAGE = 50;

export async function renderMembers(view, _params, isCurrent) {
  const state = { search: '', area_id: '', account_type: '', offset: 0, items: [], done: false, areas: [] };

  view.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${icon('users', 16)} সদস্য ব্যবস্থাপনা</div>
        <h1>সদস্য</h1>
        <p class="sub">নাম বা ফোন নম্বর দিয়ে খুঁজুন, এলাকা ও হিসাবের ধরন দিয়ে ছাঁকুন।</p>
      </div>
      <div class="head-actions">
        ${can.editMembers() ? `<button class="btn btn-green" id="add-member">${icon('plus', 18)} নতুন সদস্য</button>` : ''}
      </div>
    </div>

    <div class="grid g-main">
      <section class="card">
        <div class="toolbar">
          <div class="search-wrap">${icon('search', 18)}
            <input class="input input-pill" id="m-search" type="search" placeholder="নাম বা ফোন নম্বর…" aria-label="সদস্য খুঁজুন">
          </div>
          <select class="select" id="m-area" aria-label="এলাকা"><option value="">সব এলাকা</option></select>
          <select class="select" id="m-type" aria-label="হিসাবের ধরন">
            <option value="">সব ধরন</option>
            ${options(Object.entries(LABELS.accountType).map(([value, text]) => ({ value, text })), '')}
          </select>
        </div>
        <div id="m-list">${skeletonRows(6)}</div>
        <div class="load-more hidden" id="m-more"><button class="btn btn-ghost">আরও দেখুন</button></div>
      </section>

      <section class="card">
        <div class="card-head">
          <div><h3>এলাকা</h3><p>প্রতিটি এলাকার সাপ্তাহিক আদায়ের দিন</p></div>
          ${can.manageAreas() ? `<button class="btn btn-sm btn-black" id="add-area">${icon('plus', 16)} এলাকা</button>` : ''}
        </div>
        <div id="area-list">${skeletonRows(3)}</div>
      </section>
    </div>`;

  const $ = (id) => view.querySelector(`#${id}`);
  const listEl = $('m-list');
  const moreWrap = $('m-more');

  async function loadAreas() {
    try {
      invalidate('areas');
      state.areas = await getAreas();
      if (!isCurrent()) return;
      const sel = $('m-area');
      const keep = sel.value;
      sel.innerHTML = `<option value="">সব এলাকা</option>${options(state.areas.map((a) => ({ value: a.id, text: a.name })), keep)}`;
      renderAreas();
    } catch (err) {
      if (isCurrent()) $('area-list').innerHTML = errorState(err);
    }
  }

  function renderAreas() {
    const el = $('area-list');
    if (!state.areas.length) { el.innerHTML = emptyState('কোনো এলাকা নেই।', 'map'); return; }
    el.innerHTML = `<div class="list">${state.areas.map((a) => `
      <div class="row">
        <div class="stat-ico ico-green" style="width:36px;height:36px;border-radius:12px;display:grid;place-items:center">${icon('map', 18)}</div>
        <div class="grow"><div class="title">${esc(a.name)}</div><div class="meta"><span>প্রতি ${esc(label('day', a.collection_day))}</span></div></div>
        <div class="actions">
          ${can.manageAreas() ? `<button class="icon-btn" data-edit-area="${a.id}" aria-label="সম্পাদনা">${icon('edit', 16)}</button>` : ''}
          ${can.deleteAreas() ? `<button class="icon-btn" data-del-area="${a.id}" aria-label="মুছুন" style="color:var(--red)">${icon('trash', 16)}</button>` : ''}
        </div>
      </div>`).join('')}</div>`;
    const map = byId(state.areas);
    el.querySelectorAll('[data-edit-area]').forEach((b) => b.addEventListener('click', async () => {
      const res = await areaFormDialog(map.get(Number(b.dataset.editArea)));
      if (res && isCurrent()) { await loadAreas(); reload(); }
    }));
    el.querySelectorAll('[data-del-area]').forEach((b) => b.addEventListener('click', async () => {
      const a = map.get(Number(b.dataset.delArea));
      const ok = await confirmDialog({ title: 'এলাকা মুছবেন?', message: `"${esc(a.name)}" এলাকাটি মুছে যাবে। এই এলাকায় সদস্য থাকলে সার্ভার মুছতে দেবে না।`, confirmText: 'মুছে ফেলুন', danger: true });
      if (!ok) return;
      try { await api.areas.remove(a.id); toast('এলাকা মুছে ফেলা হয়েছে'); loadAreas(); }
      catch (err) { toast(errorText(err), 'err', 5000); }
    }));
  }

  async function loadPage(reset) {
    if (reset) { state.offset = 0; state.items = []; state.done = false; listEl.innerHTML = skeletonRows(6); }
    const params = {
      search: state.search || undefined,
      area_id: state.area_id || undefined,
      account_type: state.account_type || undefined,
      limit: PAGE,
      offset: state.offset,
    };
    const snapshot = JSON.stringify([state.search, state.area_id, state.account_type]);
    try {
      const page = await api.members.list(params);
      if (!isCurrent() || snapshot !== JSON.stringify([state.search, state.area_id, state.account_type])) return;
      state.items.push(...page);
      state.offset += page.length;
      state.done = page.length < PAGE;
      renderList();
    } catch (err) {
      if (!isCurrent()) return;
      listEl.innerHTML = errorState(err, 'm-retry');
      const b = $('m-retry'); if (b) b.addEventListener('click', () => loadPage(true));
    }
  }
  const reload = () => loadPage(true);

  function renderList() {
    moreWrap.classList.toggle('hidden', state.done);
    if (!state.items.length) {
      listEl.innerHTML = emptyState(state.search ? 'এই নামে/নম্বরে কোনো সদস্য পাওয়া যায়নি।' : 'কোনো সদস্য নেই।', 'users');
      return;
    }
    const areaMap = byId(state.areas);
    listEl.innerHTML = `
      <p class="small muted" style="margin-bottom:10px">${num(state.items.length)} জন দেখানো হচ্ছে${state.done ? '' : ' (আরও আছে)'}</p>
      <div class="list">${state.items.map((m) => {
        const area = areaMap.get(m.area_id);
        return `<div class="row clickable" data-open="${m.id}">
          <div class="avatar ${m.is_active ? 'green' : ''}" style="${m.is_active ? '' : 'background:#C9C3BA'}">${esc(initials(m.full_name))}</div>
          <div class="grow">
            <div class="title">${esc(m.full_name)} ${m.is_active ? '' : '<span class="badge b-grey">নিষ্ক্রিয়</span>'}</div>
            <div class="meta">
              <span>${icon('phone', 13)} ${esc(m.phone)}</span>
              <span>${esc(area ? area.name : `এলাকা #${m.area_id}`)}</span>
              <span>যোগদান ${esc(fmtDate(m.joined_on))}</span>
            </div>
          </div>
          ${accountBadge(m.account_type)}
          <div class="actions">
            ${can.editMembers() ? `<button class="icon-btn" data-edit="${m.id}" aria-label="সম্পাদনা">${icon('edit', 16)}</button>` : ''}
            ${can.deleteMembers() ? `<button class="icon-btn" data-del="${m.id}" aria-label="মুছুন" style="color:var(--red)">${icon('trash', 16)}</button>` : ''}
          </div>
        </div>`;
      }).join('')}</div>`;

    const map = byId(state.items);
    listEl.querySelectorAll('[data-open]').forEach((row) => row.addEventListener('click', () => {
      location.hash = `#/members/${row.dataset.open}`;
    }));
    listEl.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await memberFormDialog(map.get(Number(b.dataset.edit)));
      if (res && isCurrent()) reload();
    }));
    listEl.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const m = map.get(Number(b.dataset.del));
      const ok = await confirmDialog({ title: 'সদস্য মুছবেন?', message: `"${esc(m.full_name)}"-এর তথ্য মুছে যাবে। ঋণ বা গাতা থাকলে সার্ভার মুছতে দেবে না।`, confirmText: 'মুছে ফেলুন', danger: true });
      if (!ok) return;
      try {
        await api.members.remove(m.id);
        invalidate('members');
        toast('সদস্য মুছে ফেলা হয়েছে');
        reload();
      } catch (err) { toast(errorText(err), 'err', 5000); }
    }));
  }

  $('m-search').addEventListener('input', debounce((e) => { state.search = e.target.value.trim(); reload(); }, 350));
  $('m-area').addEventListener('change', (e) => { state.area_id = e.target.value; reload(); });
  $('m-type').addEventListener('change', (e) => { state.account_type = e.target.value; reload(); });
  moreWrap.querySelector('button').addEventListener('click', () => loadPage(false));
  const addBtn = $('add-member');
  if (addBtn) addBtn.addEventListener('click', async () => {
    const res = await memberFormDialog(null);
    if (res && isCurrent()) reload();
  });
  const addArea = $('add-area');
  if (addArea) addArea.addEventListener('click', async () => {
    const res = await areaFormDialog(null);
    if (res && isCurrent()) loadAreas();
  });

  await loadAreas();
  await loadPage(true);
}
