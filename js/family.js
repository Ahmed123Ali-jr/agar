// ============================================
// إدارة العائلة
// ============================================

const Family = {
  init() {
    $('#create-family-btn').addEventListener('click', () => {
      hide('#join-family-form');
      $('#create-family-form').classList.toggle('hidden');
    });
    $('#join-family-btn').addEventListener('click', () => {
      hide('#create-family-form');
      $('#join-family-form').classList.toggle('hidden');
    });

    $('#confirm-create-family').addEventListener('click', Family.createFamily);
    $('#confirm-join-family').addEventListener('click', Family.joinFamily);
    $('#logout-from-setup').addEventListener('click', Auth.logout);

    $('#copy-code-btn').addEventListener('click', Family.copyCode);
    $('#share-code-btn').addEventListener('click', Family.shareCode);
    $('#leave-family-btn').addEventListener('click', Family.leaveFamily);
  },

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  async createFamily() {
    const name = $('#new-family-name').value.trim();
    const displayName = $('#creator-display-name').value.trim();
    const errEl = $('#family-error');
    errEl.textContent = '';

    if (!name) { errEl.textContent = 'أدخل اسم العائلة'; return; }
    if (!displayName) { errEl.textContent = 'أدخل اسمك في العائلة'; return; }

    try {
      const code = Family.generateCode();
      const { data: family, error } = await supabaseClient
        .from('families')
        .insert({ name, invite_code: code, created_by: State.user.id })
        .select()
        .single();
      if (error) throw error;

      const { error: memErr } = await supabaseClient
        .from('family_members')
        .insert({
          family_id: family.id,
          user_id: State.user.id,
          display_name: displayName,
          role: 'admin'
        });
      if (memErr) throw memErr;

      toast('تم إنشاء العائلة 🎉', 'success');
      await App.loadFamilyAndStart();
    } catch (err) {
      console.error(err);
      errEl.textContent = 'فشل إنشاء العائلة: ' + (err.message || '');
    }
  },

  async joinFamily() {
    const code = $('#invite-code-input').value.trim().toUpperCase();
    const displayName = $('#joiner-display-name').value.trim();
    const errEl = $('#family-error');
    errEl.textContent = '';

    if (code.length !== 6) { errEl.textContent = 'الكود 6 أحرف'; return; }
    if (!displayName) { errEl.textContent = 'أدخل اسمك في العائلة'; return; }

    try {
      const { data, error } = await supabaseClient.rpc('join_family_by_code', {
        code,
        member_name: displayName,
      });
      if (error) {
        if ((error.message || '').includes('INVALID_CODE')) {
          errEl.textContent = 'الكود غير صحيح';
        } else {
          errEl.textContent = error.message;
        }
        return;
      }
      toast('تم الانضمام بنجاح 🎉', 'success');
      await App.loadFamilyAndStart();
    } catch (err) {
      console.error(err);
      errEl.textContent = err.message || 'فشل الانضمام';
    }
  },

  async loadMembers() {
    const { data, error } = await supabaseClient
      .from('family_members')
      .select('*')
      .eq('family_id', State.family.id)
      .order('joined_at', { ascending: true });
    if (error) { console.error(error); return; }
    State.members = data || [];
  },

  renderFamilyPage() {
    $('#family-name-display').textContent = State.family.name;
    $('#invite-code-display').textContent = State.family.invite_code;

    const list = $('#members-list');
    list.innerHTML = State.members.map(m => `
      <div class="member-card">
        <div class="member-avatar">${escapeHtml((m.display_name || '?')[0])}</div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(m.display_name)}${m.user_id === State.user.id ? ' <span class="muted">(أنت)</span>' : ''}</div>
          <div class="member-meta">انضم ${new Date(m.joined_at).toLocaleDateString('ar')}</div>
        </div>
        ${m.role === 'admin' ? '<span class="member-role">مدير</span>' : ''}
      </div>
    `).join('');
  },

  async copyCode() {
    try {
      await navigator.clipboard.writeText(State.family.invite_code);
      toast('تم نسخ الكود ✓', 'success');
    } catch {
      toast('تعذّر النسخ', 'error');
    }
  },

  async shareCode() {
    const text = `انضم لعائلة "${State.family.name}" في تطبيق أغراضي بكود: ${State.family.invite_code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'أغراضي', text }); } catch {}
    } else {
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  },

  async leaveFamily() {
    const ok = await confirmAction('مغادرة العائلة', 'هل أنت متأكد؟ ستفقد الوصول لكل البيانات.');
    if (!ok) return;
    const { error } = await supabaseClient
      .from('family_members')
      .delete()
      .eq('family_id', State.family.id)
      .eq('user_id', State.user.id);
    if (error) { toast('فشل المغادرة', 'error'); return; }
    toast('تمت المغادرة', 'success');
    State.family = null;
    State.member = null;
    location.reload();
  },
};
