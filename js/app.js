// ============================================
// التطبيق الرئيسي - Routing والتهيئة
// ============================================

const App = {
  async init() {
    // هل المفاتيح معبّأة؟
    if (SUPABASE_URL.includes('YOUR_') || SUPABASE_ANON_KEY.includes('YOUR_')) {
      document.body.innerHTML = `
        <div style="padding:2rem;text-align:center;font-family:Tajawal,sans-serif">
          <h2 style="color:#c8553d">⚙️ يلزم إعداد Supabase</h2>
          <p>افتح <code>js/supabase.js</code> وضع <code>SUPABASE_URL</code> و <code>SUPABASE_ANON_KEY</code></p>
          <p>اطلع على <code>README.md</code> للخطوات الكاملة.</p>
        </div>`;
      return;
    }

    // ربط الأحداث
    Auth.init();
    Family.init();
    Locations.init();
    Items.init();
    Search.init();
    App.bindNav();
    App.bindFab();
    App.bindModals();
    App.bindSettings();

    // التحقق من الجلسة
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      State.user = session.user;
      await App.loadFamilyAndStart();
    } else {
      App.showScreen('auth-screen');
    }

    // الاستماع لتغيرات auth
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        Realtime.stop();
        State.user = null;
        State.family = null;
        App.showScreen('auth-screen');
      }
    });
  },

  async handleAuthSuccess() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    State.user = user;
    await App.loadFamilyAndStart();
  },

  async loadFamilyAndStart() {
    // البحث عن عضوية للمستخدم
    const { data: memberships, error } = await supabaseClient
      .from('family_members')
      .select('*, families(*)')
      .eq('user_id', State.user.id)
      .limit(1);

    if (error) {
      console.error(error);
      toast('خطأ في تحميل العائلة', 'error');
      return;
    }

    if (!memberships || memberships.length === 0) {
      // تعبئة الاسم تلقائياً من الدخول السريع أو metadata
      const savedName = (() => {
        try { return localStorage.getItem('agradi_quick_name'); } catch { return null; }
      })() || State.user?.user_metadata?.display_name || '';
      if (savedName) {
        $('#creator-display-name').value = savedName;
        $('#joiner-display-name').value = savedName;
      }
      App.showScreen('family-setup-screen');
      return;
    }

    State.member = memberships[0];
    State.family = memberships[0].families;

    // تحميل البيانات
    await Promise.all([
      Locations.load(),
      Items.load(),
      Family.loadMembers(),
    ]);

    Locations.render();
    Family.renderFamilyPage();
    App.fillSettings();

    // المزامنة
    Realtime.start();

    App.showScreen('app');
  },

  showScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#' + id).classList.add('active');
  },

  // ===== Navigation =====
  bindNav() {
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => App.goTo(btn.dataset.page));
    });
  },

  goTo(page) {
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    $$('.page').forEach(p => p.classList.remove('active'));
    $('#page-' + page).classList.add('active');

    // إخفاء/إظهار الهيدر للبحث السريع
    if (page === 'search') {
      $('#search-input').focus();
    }
  },

  // ===== FAB =====
  bindFab() {
    $('#fab').addEventListener('click', () => openModal('add-options-modal'));
    $('#add-location-option').addEventListener('click', () => {
      closeModal('add-options-modal');
      Locations.openAdd();
    });
    $('#add-item-option').addEventListener('click', () => {
      closeModal('add-options-modal');
      Items.openAdd();
    });
  },

  // ===== Modals close =====
  bindModals() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-close-modal]') || e.target.closest('[data-close-modal]')) {
        const modal = e.target.closest('.modal');
        if (modal) modal.classList.remove('active');
      }
      // النقر على الخلفية
      if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
      }
    });
  },

  // ===== Settings =====
  bindSettings() {
    $('#logout-btn').addEventListener('click', async () => {
      const ok = await confirmAction('تسجيل خروج', 'هل تريد تسجيل الخروج؟');
      if (!ok) return;
      await Auth.logout();
    });

    $('#save-display-name').addEventListener('click', async () => {
      const newName = $('#settings-display-name').value.trim();
      if (!newName) return;
      const { error } = await supabaseClient
        .from('family_members')
        .update({ display_name: newName })
        .eq('id', State.member.id);
      if (error) { toast('فشل الحفظ', 'error'); return; }
      State.member.display_name = newName;
      toast('تم الحفظ ✓', 'success');
      await Family.loadMembers();
      Family.renderFamilyPage();
    });
  },

  fillSettings() {
    $('#settings-email').textContent = State.user.email || '';
    $('#settings-display-name').value = State.member.display_name || '';
  },
};

document.addEventListener('DOMContentLoaded', () => {
  // إخفاء splash بعد فترة قصيرة
  setTimeout(() => {
    $('#splash').classList.remove('active');
    App.init();
  }, 400);
});
