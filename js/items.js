// ============================================
// إدارة الأغراض
// ============================================

const Items = {
  imageFile: null,
  existingImageUrl: null,
  currentItemId: null,

  init() {
    $('#item-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Items.save();
    });

    $('#item-image-btn').addEventListener('click', () => $('#item-image').click());
    $('#item-image').addEventListener('change', (e) => Items.handleImage(e.target.files[0]));
    $('#item-image-remove').addEventListener('click', () => {
      Items.imageFile = null;
      Items.existingImageUrl = null;
      hide('#item-image-preview');
      hide('#item-image-remove');
    });

    $('#add-item-here-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Items.openAdd(State.currentLocationId);
    });

    $('#edit-item-btn').addEventListener('click', () => {
      const it = State.items.find(i => i.id === Items.currentItemId);
      if (it) Items.openEdit(it);
    });
    $('#delete-item-btn').addEventListener('click', () => Items.deleteCurrent());
  },

  handleImage(file) {
    if (!file) return;
    Items.imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = $('#item-image-preview');
      img.src = e.target.result;
      show(img);
      show('#item-image-remove');
    };
    reader.readAsDataURL(file);
  },

  populateLocationSelect(selectedId) {
    const sel = $('#item-location-select');
    sel.innerHTML = State.locations.map(l =>
      `<option value="${l.id}" ${l.id === selectedId ? 'selected' : ''}>${escapeHtml(l.icon || '📦')} ${escapeHtml(l.name)}</option>`
    ).join('');
  },

  openAdd(presetLocationId = null) {
    if (State.locations.length === 0) {
      toast('أضف مكان أولاً', 'error');
      return;
    }
    $('#item-modal-title').textContent = 'إضافة غرض';
    $('#item-id').value = '';
    $('#item-name').value = '';
    $('#item-quantity').value = 1;
    $('#item-notes').value = '';
    Items.imageFile = null;
    Items.existingImageUrl = null;
    hide('#item-image-preview');
    hide('#item-image-remove');
    $('#item-image').value = '';
    Items.populateLocationSelect(presetLocationId);
    openModal('item-modal');
  },

  openEdit(item) {
    closeModal('item-detail-modal');
    $('#item-modal-title').textContent = 'تعديل الغرض';
    $('#item-id').value = item.id;
    $('#item-name').value = item.name;
    $('#item-quantity').value = item.quantity || 1;
    $('#item-notes').value = item.notes || '';
    Items.imageFile = null;
    Items.existingImageUrl = item.image_url || null;
    if (item.image_url) {
      const img = $('#item-image-preview');
      img.src = item.image_url;
      show(img);
      show('#item-image-remove');
    } else {
      hide('#item-image-preview');
      hide('#item-image-remove');
    }
    $('#item-image').value = '';
    Items.populateLocationSelect(item.location_id);
    openModal('item-modal');
  },

  async save() {
    const id = $('#item-id').value;
    const location_id = $('#item-location-select').value;
    const name = $('#item-name').value.trim();
    const quantity = parseInt($('#item-quantity').value) || 1;
    const notes = $('#item-notes').value.trim();
    if (!name || !location_id) return;

    const btn = $('#save-item-btn');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      let image_url = Items.existingImageUrl;
      if (Items.imageFile) {
        image_url = await uploadImage(Items.imageFile, 'items');
      }

      const payload = {
        location_id,
        family_id: State.family.id,
        name,
        quantity,
        notes: notes || null,
        image_url,
        updated_at: new Date().toISOString(),
      };

      if (id) {
        const { error } = await supabaseClient.from('items').update(payload).eq('id', id);
        if (error) throw error;
        toast('تم التعديل ✓', 'success');
      } else {
        payload.created_by = State.user.id;
        const { error } = await supabaseClient.from('items').insert(payload);
        if (error) throw error;
        toast('تمت الإضافة ✓', 'success');
      }

      Realtime.markLocalChange();
      closeModal('item-modal');
      await Items.load();
      Locations.render();
      if (State.currentLocationId) Locations.renderItems();
    } catch (err) {
      console.error(err);
      toast('فشل الحفظ', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'حفظ';
    }
  },

  async load() {
    const { data, error } = await supabaseClient
      .from('items')
      .select('*')
      .eq('family_id', State.family.id)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    State.items = data || [];
  },

  openDetail(id) {
    Items.currentItemId = id;
    const it = State.items.find(i => i.id === id);
    if (!it) return;
    const loc = State.locations.find(l => l.id === it.location_id);

    const imgWrap = $('#item-detail-image');
    if (it.image_url) {
      imgWrap.innerHTML = `<img src="${escapeHtml(it.image_url)}" />`;
    } else {
      imgWrap.innerHTML = '🎒';
    }
    $('#item-detail-name').textContent = it.name;
    $('#item-detail-location').textContent = '📍 ' + (loc ? loc.name : '');
    $('#item-detail-quantity').textContent = it.quantity || 1;
    if (it.notes) {
      $('#item-detail-notes').textContent = it.notes;
      show('#item-detail-notes-wrap');
    } else {
      hide('#item-detail-notes-wrap');
    }
    openModal('item-detail-modal');
  },

  async deleteCurrent() {
    const it = State.items.find(i => i.id === Items.currentItemId);
    if (!it) return;
    const ok = await confirmAction('حذف الغرض', `سيتم حذف "${it.name}".`);
    if (!ok) return;
    const { error } = await supabaseClient.from('items').delete().eq('id', it.id);
    if (error) { toast('فشل الحذف', 'error'); return; }
    Realtime.markLocalChange();
    toast('تم الحذف', 'success');
    closeModal('item-detail-modal');
    await Items.load();
    Locations.render();
    if (State.currentLocationId) Locations.renderItems();
  },
};
