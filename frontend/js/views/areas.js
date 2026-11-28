import { h, bn, errorBox, formDialog, toast, DAYS } from '../ui.js';
import { api } from '../api.js';
import { canManage, isAdmin } from '../session.js';

const dayOptions = Object.entries(DAYS).map(([value, label]) => ({ value, label }));

export async function renderAreas() {
  const page = h('div', { class: 'main', style: 'padding:0' });
  const list = h('div', { class: 'list' });
  const count = h('p', { class: 'muted' });

  function areaForm(area) {
    formDialog({
      title: area ? 'এলাকা বদলাও' : 'নতুন এলাকা',
      fields: [
        { name: 'name', label: 'এলাকার নাম', value: area?.name },
        { name: 'collection_day', label: 'কিস্তি তোলার বার', type: 'select', options: dayOptions, value: area?.collection_day || 'sat' },
      ],
      onSubmit: async (v) => {
        if (area) { await api.updateArea(area.id, v); toast('এলাকা আপডেট হয়েছে'); }
        else { await api.createArea(v); toast('এলাকা যোগ হয়েছে'); }
        load();
      },
    });
  }

  function deleteForm(area) {
    formDialog({
      title: `"${area.name}" মুছে ফেলবে?`,
      fields: [],
      submitLabel: 'মুছে ফেলো',
      onSubmit: async () => { await api.deleteArea(area.id); toast('এলাকা মুছে ফেলা হয়েছে'); load(); },
    });
  }

  async function load() {
    list.replaceChildren(h('div', { class: 'empty' }, 'লোড হচ্ছে…'));
    try {
      const [areas, members] = await Promise.all([api.areas(), api.members()]);
      const perArea = {};
      for (const m of members) perArea[m.area_id] = (perArea[m.area_id] || 0) + 1;
      count.textContent = `${bn(areas.length)}টি এলাকা`;
      list.replaceChildren(...(areas.length ? areas.map((a) => h('div', { class: 'row' },
        h('span', { class: 'grow' }, h('b', null, a.name),
          h('span', { class: 'muted' }, `${DAYS[a.collection_day]} কিস্তি তোলা হয় · ${bn(perArea[a.id] || 0)} জন সদস্য`)),
        canManage() && h('button', { class: 'btn btn-ghost btn-small', onClick: () => areaForm(a) }, 'বদলাও'),
        isAdmin() && h('button', { class: 'btn btn-ghost btn-small', onClick: () => deleteForm(a) }, 'মুছো'),
      )) : [h('div', { class: 'empty' }, 'এখনও কোনো এলাকা নেই')]));
    } catch (e) { list.replaceChildren(errorBox(e, load)); }
  }

  const addBtn = canManage() && h('button', { class: 'btn btn-primary', onClick: () => areaForm(null) }, '+ নতুন এলাকা');
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'এলাকা'), count), addBtn), h('div', { class: 'card' }, list));
  load();
  return page;
}
