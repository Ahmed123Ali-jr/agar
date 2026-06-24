// ============================================
// قوائم السفر (شجرة قابلة للتداخل)
// ============================================

const Trips = {
  list: [],           // كل السفرات
  items: [],          // كل عناصر السفرة الحالية (مسطّحة)
  currentTripId: null,
  currentItemId: null, // للقائمة المنبثقة
  expanded: new Set(), // معرّفات العناصر المفتوحة

  init() {
    // إنشاء سفرة جديدة
    $('#new-trip-btn').addEventListener('click', () => Trips.openTripNameModal());

    // نموذج اسم السفرة
    $('#trip-name-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Trips.saveTripName();
    });

    // الرجوع من تفاصيل السفرة
    $('#back-from-trip').addEventListener('click', () => App.goTo('trips'));

    // إضافة عنصر جذري للسفرة
    $('#add-trip-root-item').addEventListener('click', () => {
      Trips.openItemModal({ parentId: null });
    });

    // نموذج العنصر
    $('#trip-item-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Trips.saveItem();
    });

    // قائمة السفرة
    $('#trip-menu-btn').addEventListener('click', () => Trips.openTripMenu());
    $('#trip-rename-btn').addEventListener('click', () => {
      closeModal('trip-menu-modal');
      const t = Trips.currentTrip();
      if (t) Trips.openTripNameModal(t);
    });
    $('#trip-duplicate-btn').addEventListener('click', () => Trips.duplicateTrip());
    $('#trip-archive-btn').addEventListener('click', () => Trips.archiveTrip());
    $('#trip-delete-btn').addEventListener('click', () => Trips.deleteTrip());

    // قائمة العنصر
    $('#trip-item-add-child-btn').addEventListener('click', () => {
      closeModal('trip-item-menu-modal');
      Trips.openItemModal({ parentId: Trips.currentItemId });
    });
    $('#trip-item-rename-btn').addEventListener('click', () => {
      closeModal('trip-item-menu-modal');
      const it = Trips.findItem(Trips.currentItemId);
      if (it) Trips.openItemModal({ existing: it });
    });
    $('#trip-item-delete-btn').addEventListener('click', () => Trips.deleteItem());
  },

  currentTrip() {
    return Trips.list.find(t => t.id === Trips.currentTripId);
  },

  findItem(id) {
    return Trips.items.find(i => i.id === id);
  },

  // ============ تحميل ============
  async loadTrips() {
    const { data, error } = await supabaseClient
      .from('trips')
      .select('*')
      .eq('family_id', State.family.id)
      .order('archived_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    Trips.list = data || [];
    Trips.renderList();
  },

  async loadItems(tripId) {
    const { data, error } = await supabaseClient
      .from('trip_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { console.error(error); Trips.items = []; return; }
    Trips.items = data || [];
  },

  // ============ عرض قائمة السفرات ============
  renderList() {
    const wrap = $('#trips-list');
    const empty = $('#empty-trips');
    if (!Trips.list.length) {
      wrap.innerHTML = '';
      show(empty);
      return;
    }
    hide(empty);
    wrap.innerHTML = Trips.list.map(t => Trips.tripCardHtml(t)).join('');
    wrap.querySelectorAll('[data-trip]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.trip-card-menu')) return;
        Trips.openTrip(el.dataset.trip);
      });
    });
    wrap.querySelectorAll('.trip-card-menu').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        Trips.currentTripId = el.dataset.id;
        Trips.openTripMenu();
      });
    });
  },

  tripCardHtml(t) {
    // الإحصائيات تحتاج تحميل items — نتجاهل ونعرض الاسم فقط حتى تُفتح
    return `
      <div class="trip-card ${t.archived_at ? 'archived' : ''}" data-trip="${t.id}">
        <div class="trip-card-icon">${t.archived_at ? '🗄️' : '🧳'}</div>
        <div class="trip-card-body">
          <div class="trip-card-name">${escapeHtml(t.name)}</div>
          <div class="trip-card-meta muted">${t.archived_at ? 'مؤرشفة' : 'نشطة'}</div>
        </div>
        <button class="btn-icon trip-card-menu" data-id="${t.id}">⋮</button>
      </div>
    `;
  },

  // ============ فتح سفرة ============
  async openTrip(tripId) {
    Trips.currentTripId = tripId;
    const t = Trips.currentTrip();
    if (!t) return;
    $('#trip-detail-name').textContent = t.name;
    await Trips.loadItems(tripId);
    Trips.renderTree();
    App.goTo('trip-detail');
  },

  // ============ بناء الشجرة وعرضها ============
  buildTree() {
    const byParent = new Map();
    Trips.items.forEach(it => {
      const key = it.parent_id || 'root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(it);
    });
    return byParent;
  },

  renderTree() {
    const wrap = $('#trip-tree');
    const empty = $('#empty-trip-items');
    if (!Trips.items.length) {
      wrap.innerHTML = '';
      show(empty);
      Trips.updateProgress();
      return;
    }
    hide(empty);
    const tree = Trips.buildTree();
    const roots = tree.get('root') || [];
    wrap.innerHTML = roots.map(it => Trips.nodeHtml(it, tree, 0)).join('');
    Trips.bindTreeEvents();
    Trips.updateProgress();
  },

  nodeHtml(item, tree, depth) {
    const children = tree.get(item.id) || [];
    const hasChildren = children.length > 0;
    const isOpen = Trips.expanded.has(item.id);
    const childrenHtml = (hasChildren && isOpen)
      ? `<div class="trip-children">${children.map(c => Trips.nodeHtml(c, tree, depth + 1)).join('')}</div>`
      : '';
    return `
      <div class="trip-node" data-id="${item.id}" style="--depth:${depth}">
        <div class="trip-node-row ${item.is_checked ? 'checked' : ''}">
          <button class="node-chevron ${hasChildren ? '' : 'invisible'}" data-toggle="${item.id}">
            ${isOpen ? '▼' : '▶'}
          </button>
          <button class="node-check" data-check="${item.id}">
            ${item.is_checked ? '✅' : '⬜'}
          </button>
          <span class="node-name" data-rename="${item.id}">${escapeHtml(item.name)}</span>
          <button class="node-add" data-add-child="${item.id}" title="إضافة داخله">+</button>
          <button class="node-menu" data-menu="${item.id}">⋮</button>
        </div>
        ${childrenHtml}
      </div>
    `;
  },

  bindTreeEvents() {
    const wrap = $('#trip-tree');
    wrap.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.toggle;
        if (Trips.expanded.has(id)) Trips.expanded.delete(id);
        else Trips.expanded.add(id);
        Trips.renderTree();
      });
    });
    wrap.querySelectorAll('[data-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        Trips.toggleCheck(el.dataset.check);
      });
    });
    wrap.querySelectorAll('[data-rename]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const it = Trips.findItem(el.dataset.rename);
        if (it) Trips.openItemModal({ existing: it });
      });
    });
    wrap.querySelectorAll('[data-add-child]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        Trips.expanded.add(el.dataset.addChild); // افتح الأب
        Trips.openItemModal({ parentId: el.dataset.addChild });
      });
    });
    wrap.querySelectorAll('[data-menu]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        Trips.currentItemId = el.dataset.menu;
        openModal('trip-item-menu-modal');
      });
    });
  },

  updateProgress() {
    const total = Trips.items.length;
    const checked = Trips.items.filter(i => i.is_checked).length;
    const pct = total ? Math.round((checked / total) * 100) : 0;
    $('#trip-progress-fill').style.width = pct + '%';
    $('#trip-progress-text').textContent = total ? `${checked}/${total} (${pct}%)` : '';
  },

  // ============ عمليات السفرة ============
  openTripNameModal(trip = null) {
    $('#trip-name-modal-title').textContent = trip ? 'تعديل اسم السفرة' : 'سفرة جديدة';
    $('#trip-name-id').value = trip?.id || '';
    $('#trip-name-input').value = trip?.name || '';
    openModal('trip-name-modal');
    setTimeout(() => $('#trip-name-input').focus(), 100);
  },

  async saveTripName() {
    const id = $('#trip-name-id').value;
    const name = $('#trip-name-input').value.trim();
    if (!name) return;
    Realtime.markLocalChange();
    if (id) {
      const { error } = await supabaseClient.from('trips').update({ name, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) { toast('فشل التعديل', 'error'); return; }
      const t = Trips.list.find(x => x.id === id);
      if (t) t.name = name;
      if (Trips.currentTripId === id) $('#trip-detail-name').textContent = name;
    } else {
      const { data, error } = await supabaseClient
        .from('trips')
        .insert({ name, family_id: State.family.id, created_by: State.user.id })
        .select()
        .single();
      if (error) {
        console.error('createTrip', error);
        const m = (error.message || '').toLowerCase();
        if (m.includes('does not exist') || m.includes('relation') || m.includes('schema')) {
          toast('جدول trips غير موجود — شغّل SQL في Supabase', 'error');
        } else {
          toast('فشل: ' + (error.message || 'خطأ غير معروف'), 'error');
        }
        return;
      }
      Trips.list.unshift(data);
    }
    closeModal('trip-name-modal');
    Trips.renderList();
    toast('تم ✓', 'success');
  },

  openTripMenu() {
    const t = Trips.currentTrip();
    if (!t) return;
    $('#trip-archive-label').textContent = t.archived_at ? 'إلغاء الأرشفة' : 'أرشفة';
    openModal('trip-menu-modal');
  },

  async duplicateTrip() {
    const t = Trips.currentTrip();
    if (!t) return;
    closeModal('trip-menu-modal');
    // حمّل العناصر إن لم تكن محمّلة
    if (Trips.currentTripId !== t.id || !Trips.items.length) await Trips.loadItems(t.id);
    Realtime.markLocalChange();
    // أنشئ السفرة الجديدة
    const { data: newTrip, error } = await supabaseClient
      .from('trips')
      .insert({ name: t.name + ' (نسخة)', family_id: State.family.id, created_by: State.user.id })
      .select()
      .single();
    if (error) { toast('فشل النسخ', 'error'); return; }

    // انسخ العناصر مع الحفاظ على شجرة parent_id
    const idMap = new Map();
    // ترتيب طوبولوجي: الجذر أولاً
    const inOrder = [];
    const remaining = [...Trips.items];
    while (remaining.length) {
      for (let i = 0; i < remaining.length; i++) {
        const it = remaining[i];
        if (!it.parent_id || idMap.has(it.parent_id) || !Trips.items.find(x => x.id === it.parent_id)) {
          inOrder.push(it);
          idMap.set(it.id, 'placeholder');
          remaining.splice(i, 1);
          i--;
        }
      }
    }
    // الآن أدرج بالترتيب
    idMap.clear();
    for (const it of inOrder) {
      const payload = {
        trip_id: newTrip.id,
        parent_id: it.parent_id ? idMap.get(it.parent_id) : null,
        family_id: State.family.id,
        name: it.name,
        is_checked: false,
        position: it.position,
      };
      const { data: newItem } = await supabaseClient.from('trip_items').insert(payload).select().single();
      if (newItem) idMap.set(it.id, newItem.id);
    }

    await Trips.loadTrips();
    toast('تم النسخ 📋', 'success');
  },

  async archiveTrip() {
    const t = Trips.currentTrip();
    if (!t) return;
    closeModal('trip-menu-modal');
    const newVal = t.archived_at ? null : new Date().toISOString();
    Realtime.markLocalChange();
    const { error } = await supabaseClient.from('trips').update({ archived_at: newVal }).eq('id', t.id);
    if (error) { toast('فشل', 'error'); return; }
    t.archived_at = newVal;
    Trips.renderList();
    toast(newVal ? 'أرشفت 🗄️' : 'أعيدت', 'success');
  },

  async deleteTrip() {
    const t = Trips.currentTrip();
    if (!t) return;
    closeModal('trip-menu-modal');
    const ok = await confirmAction('حذف السفرة', `سيتم حذف "${t.name}" وكل عناصرها.`);
    if (!ok) return;
    Realtime.markLocalChange();
    const { error } = await supabaseClient.from('trips').delete().eq('id', t.id);
    if (error) { toast('فشل الحذف', 'error'); return; }
    Trips.list = Trips.list.filter(x => x.id !== t.id);
    Trips.currentTripId = null;
    Trips.renderList();
    App.goTo('trips');
    toast('تم الحذف', 'success');
  },

  // ============ عمليات العناصر ============
  openItemModal({ parentId = null, existing = null } = {}) {
    const isEdit = !!existing;
    $('#trip-item-modal-title').textContent = isEdit ? 'تعديل العنصر' : 'عنصر جديد';
    $('#trip-item-id').value = existing?.id || '';
    $('#trip-item-parent-id').value = existing ? (existing.parent_id || '') : (parentId || '');
    $('#trip-item-name').value = existing?.name || '';
    const parentItem = (existing ? existing.parent_id : parentId)
      ? Trips.findItem(existing ? existing.parent_id : parentId)
      : null;
    $('#trip-item-parent-hint').textContent = parentItem ? `داخل: ${parentItem.name}` : 'عنصر رئيسي';
    openModal('trip-item-modal');
    setTimeout(() => $('#trip-item-name').focus(), 100);
  },

  async saveItem() {
    const id = $('#trip-item-id').value;
    const parentId = $('#trip-item-parent-id').value || null;
    const name = $('#trip-item-name').value.trim();
    if (!name || !Trips.currentTripId) return;
    Realtime.markLocalChange();
    if (id) {
      const { error } = await supabaseClient.from('trip_items').update({ name }).eq('id', id);
      if (error) { toast('فشل التعديل', 'error'); return; }
      const it = Trips.findItem(id);
      if (it) it.name = name;
    } else {
      const maxPos = Trips.items
        .filter(i => (i.parent_id || null) === parentId)
        .reduce((m, i) => Math.max(m, i.position || 0), 0);
      const { data, error } = await supabaseClient.from('trip_items').insert({
        trip_id: Trips.currentTripId,
        parent_id: parentId,
        family_id: State.family.id,
        name,
        position: maxPos + 1,
      }).select().single();
      if (error) { toast('فشل الإضافة', 'error'); return; }
      Trips.items.push(data);
    }
    closeModal('trip-item-modal');
    Trips.renderTree();
  },

  async toggleCheck(itemId) {
    const it = Trips.findItem(itemId);
    if (!it) return;
    const newVal = !it.is_checked;
    Realtime.markLocalChange();
    const { error } = await supabaseClient.from('trip_items').update({ is_checked: newVal }).eq('id', it.id);
    if (error) { toast('فشل', 'error'); return; }
    it.is_checked = newVal;
    Trips.renderTree();
  },

  async deleteItem() {
    closeModal('trip-item-menu-modal');
    const it = Trips.findItem(Trips.currentItemId);
    if (!it) return;
    const ok = await confirmAction('حذف العنصر', `سيتم حذف "${it.name}" وكل ما داخله.`);
    if (!ok) return;
    Realtime.markLocalChange();
    const { error } = await supabaseClient.from('trip_items').delete().eq('id', it.id);
    if (error) { toast('فشل الحذف', 'error'); return; }
    // cascade سيحذف الأبناء في DB، لكن نمسح من state يدوياً
    const toRemove = new Set([it.id]);
    let changed = true;
    while (changed) {
      changed = false;
      Trips.items.forEach(i => {
        if (i.parent_id && toRemove.has(i.parent_id) && !toRemove.has(i.id)) {
          toRemove.add(i.id);
          changed = true;
        }
      });
    }
    Trips.items = Trips.items.filter(i => !toRemove.has(i.id));
    Trips.renderTree();
    toast('تم الحذف', 'success');
  },
};
