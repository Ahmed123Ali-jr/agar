// ============================================
// إدارة الأماكن
// ============================================

const Locations = {
  selectedEmoji: '📦',
  imageFile: null,
  existingImageUrl: null,

  init() {
    $('#location-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Locations.saveLocation();
    });

    $$('#emoji-picker .emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#emoji-picker .emoji-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        Locations.selectedEmoji = btn.dataset.emoji;
      });
    });

    $('#location-image-btn').addEventListener('click', () => $('#location-image').click());
    $('#location-image').addEventListener('change', (e) => Locations.handleImage(e.target.files[0]));
    $('#location-image-remove').addEventListener('click', () => {
      Locations.imageFile = null;
      Locations.existingImageUrl = null;
      hide('#location-image-preview');
      hide('#location-image-remove');
    });

    $('#edit-location-btn').addEventListener('click', () => {
      const loc = State.locations.find(l => l.id === State.currentLocationId);
      if (loc) Locations.openEdit(loc);
    });
    $('#delete-location-btn').addEventListener('click', () => Locations.deleteCurrentLocation());
  },

  handleImage(file) {
    if (!file) return;
    Locations.imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = $('#location-image-preview');
      img.src = e.target.result;
      show(img);
      show('#location-image-remove');
    };
    reader.readAsDataURL(file);
  },

  openAdd() {
    $('#location-modal-title').textContent = 'إضافة مكان';
    $('#location-id').value = '';
    $('#location-name').value = '';
    $('#location-description').value = '';
    Locations.selectedEmoji = '📦';
    Locations.imageFile = null;
    Locations.existingImageUrl = null;
    $$('#emoji-picker .emoji-btn').forEach(b => b.classList.toggle('selected', b.dataset.emoji === '📦'));
    hide('#location-image-preview');
    hide('#location-image-remove');
    $('#location-image').value = '';
    openModal('location-modal');
  },

  openEdit(loc) {
    closeModal('location-detail-modal');
    $('#location-modal-title').textContent = 'تعديل المكان';
    $('#location-id').value = loc.id;
    $('#location-name').value = loc.name;
    $('#location-description').value = loc.description || '';
    Locations.selectedEmoji = loc.icon || '📦';
    Locations.imageFile = null;
    Locations.existingImageUrl = loc.image_url || null;
    $$('#emoji-picker .emoji-btn').forEach(b => b.classList.toggle('selected', b.dataset.emoji === Locations.selectedEmoji));
    if (loc.image_url) {
      const img = $('#location-image-preview');
      img.src = loc.image_url;
      show(img);
      show('#location-image-remove');
    } else {
      hide('#location-image-preview');
      hide('#location-image-remove');
    }
    $('#location-image').value = '';
    openModal('location-modal');
  },

  async saveLocation() {
    const id = $('#location-id').value;
    const name = $('#location-name').value.trim();
    const description = $('#location-description').value.trim();
    if (!name) return;

    const btn = $('#save-location-btn');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      let image_url = Locations.existingImageUrl;
      if (Locations.imageFile) {
        image_url = await uploadImage(Locations.imageFile, 'locations');
      }

      const payload = {
        name,
        description: description || null,
        icon: Locations.selectedEmoji,
        image_url,
        family_id: State.family.id,
        updated_at: new Date().toISOString(),
      };

      if (id) {
        const { error } = await supabaseClient.from('locations').update(payload).eq('id', id);
        if (error) throw error;
        toast('تم التعديل ✓', 'success');
      } else {
        payload.created_by = State.user.id;
        const { error } = await supabaseClient.from('locations').insert(payload);
        if (error) throw error;
        toast('تمت الإضافة ✓', 'success');
      }

      closeModal('location-modal');
      await Locations.load();
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
      .from('locations')
      .select('*')
      .eq('family_id', State.family.id)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    State.locations = data || [];
    Locations.render();
  },

  render() {
    const grid = $('#locations-grid');
    const empty = $('#empty-locations');
    $('#locations-count').textContent = State.locations.length || '';

    if (State.locations.length === 0) {
      grid.innerHTML = '';
      show(empty);
      return;
    }
    hide(empty);

    grid.innerHTML = State.locations.map(loc => {
      const itemCount = State.items.filter(i => i.location_id === loc.id).length;
      const imageHtml = loc.image_url
        ? `<img class="loc-image" src="${escapeHtml(loc.image_url)}" loading="lazy" />`
        : `<div class="loc-icon">${loc.icon || '📦'}</div>`;
      return `
        <div class="location-card" data-id="${loc.id}">
          ${imageHtml}
          <div class="loc-name">${escapeHtml(loc.name)}</div>
          ${loc.description ? `<div class="loc-desc">${escapeHtml(loc.description)}</div>` : ''}
          <div class="loc-count">${itemCount} غرض</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.location-card').forEach(card => {
      card.addEventListener('click', () => Locations.openDetail(card.dataset.id));
    });
  },

  async openDetail(id) {
    State.currentLocationId = id;
    const loc = State.locations.find(l => l.id === id);
    if (!loc) return;

    const imgWrap = $('#location-detail-image');
    if (loc.image_url) {
      imgWrap.innerHTML = `<img src="${escapeHtml(loc.image_url)}" />`;
    } else {
      imgWrap.innerHTML = loc.icon || '📦';
    }
    $('#location-detail-name').textContent = loc.name;
    $('#location-detail-description').textContent = loc.description || '';

    Locations.renderItems();
    openModal('location-detail-modal');
  },

  renderItems() {
    const items = State.items.filter(i => i.location_id === State.currentLocationId);
    $('#items-count').textContent = items.length;

    const list = $('#location-items-list');
    const empty = $('#empty-items');

    if (items.length === 0) {
      list.innerHTML = '';
      show(empty);
      return;
    }
    hide(empty);

    list.innerHTML = items.map(it => `
      <div class="item-card" data-id="${it.id}">
        <div class="item-thumb">
          ${it.image_url ? `<img src="${escapeHtml(it.image_url)}" loading="lazy" />` : '🎒'}
        </div>
        <div class="item-info">
          <div class="item-name">${escapeHtml(it.name)}</div>
          <div class="item-meta">الكمية: ${it.quantity || 1}${it.notes ? ' · ' + escapeHtml(it.notes.slice(0,40)) : ''}</div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => Items.openDetail(card.dataset.id));
    });
  },

  async deleteCurrentLocation() {
    const loc = State.locations.find(l => l.id === State.currentLocationId);
    if (!loc) return;
    const ok = await confirmAction('حذف المكان', `سيتم حذف "${loc.name}" وكل الأغراض داخله.`);
    if (!ok) return;
    const { error } = await supabaseClient.from('locations').delete().eq('id', loc.id);
    if (error) { toast('فشل الحذف', 'error'); return; }
    toast('تم الحذف', 'success');
    closeModal('location-detail-modal');
    await Locations.load();
    await Items.load();
  },
};
