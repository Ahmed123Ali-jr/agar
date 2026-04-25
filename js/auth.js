// ============================================
// المصادقة (تسجيل دخول/جديد)
// ============================================

const Auth = {
  mode: 'login',

  // اشتقاق إيميل/كلمة سر ثابتة من الاسم → نفس الاسم = نفس الحساب من أي جهاز
  async deriveCredentials(name) {
    const normalized = name.trim().toLowerCase();
    const data = new TextEncoder().encode('agradi-v1:' + normalized);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return {
      email: `q-${hex.slice(0, 20)}@agradi.app`,
      password: `Q!${hex.slice(20, 52)}`,
    };
  },

  init() {
    // Tabs
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => Auth.switchMode(tab.dataset.tab));
    });

    // Form
    $('#auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Auth.submit();
    });
  },

  switchMode(mode) {
    Auth.mode = mode;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === mode));

    const isQuick = mode === 'quick';
    const isSignup = mode === 'signup';

    // إظهار/إخفاء الحقول
    $('#signup-name').style.display = isSignup ? 'block' : 'none';
    $('#quick-name').style.display = isQuick ? 'block' : 'none';
    $('#quick-hint').style.display = isQuick ? 'block' : 'none';

    // حقول الإيميل/كلمة السر تختفي في وضع quick
    $('#auth-email').style.display = isQuick ? 'none' : 'block';
    $('#auth-password').style.display = isQuick ? 'none' : 'block';
    $('#auth-email').required = !isQuick;
    $('#auth-password').required = !isQuick;

    $('#auth-submit').textContent = isQuick ? 'دخول' : (isSignup ? 'إنشاء حساب' : 'دخول');
    $('#auth-error').textContent = '';
  },

  async submit() {
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    const name = $('#signup-name').value.trim();
    const quickName = $('#quick-name').value.trim();
    const errEl = $('#auth-error');
    const btn = $('#auth-submit');

    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '...';

    try {
      if (Auth.mode === 'quick') {
        if (!quickName) throw new Error('يرجى إدخال اسمك');
        if (quickName.length < 3) throw new Error('الاسم قصير جداً (3 أحرف على الأقل)');

        const creds = await Auth.deriveCredentials(quickName);

        // محاولة الدخول أولاً
        let { error: signInErr } = await supabaseClient.auth.signInWithPassword(creds);

        if (signInErr) {
          const msg = (signInErr.message || '').toLowerCase();
          // المستخدم غير موجود → أنشئه
          if (msg.includes('invalid') || msg.includes('not found') || msg.includes('credentials')) {
            const { data: signUpData, error: signUpErr } = await supabaseClient.auth.signUp({
              email: creds.email,
              password: creds.password,
              options: { data: { display_name: quickName, quick_login: true } }
            });
            if (signUpErr) throw signUpErr;
            if (!signUpData.session) {
              // تأكيد الإيميل مفعّل → جرب دخول مباشر
              const { error: e2 } = await supabaseClient.auth.signInWithPassword(creds);
              if (e2) throw new Error('فعّل خاصية تعطيل تأكيد الإيميل في Supabase');
            }
          } else {
            throw signInErr;
          }
        }

        try { localStorage.setItem('agradi_quick_name', quickName); } catch {}
      } else if (Auth.mode === 'signup') {
        if (!name) throw new Error('يرجى إدخال اسمك');
        const { data, error } = await supabaseClient.auth.signUp({
          email, password,
          options: { data: { display_name: name } }
        });
        if (error) throw error;
        if (!data.session) {
          const { error: e2 } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (e2) throw new Error('تم إنشاء الحساب. تأكد من إيميلك ثم سجل دخول.');
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await App.handleAuthSuccess();
    } catch (err) {
      console.error(err);
      errEl.textContent = Auth.translateError(err.message);
    } finally {
      btn.disabled = false;
      const labels = { quick: 'دخول', signup: 'إنشاء حساب', login: 'دخول' };
      btn.textContent = labels[Auth.mode] || 'دخول';
    }
  },

  translateError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials')) return 'الإيميل أو كلمة السر غير صحيحة';
    if (m.includes('already registered') || m.includes('already exists')) return 'هذا الإيميل مسجل مسبقاً';
    if (m.includes('password') && m.includes('6')) return 'كلمة السر يجب أن تكون 6 أحرف على الأقل';
    if (m.includes('email')) return 'الإيميل غير صحيح';
    return msg || 'حدث خطأ، حاول مرة أخرى';
  },

  async logout() {
    await supabaseClient.auth.signOut();
    State.user = null;
    State.family = null;
    State.member = null;
    location.reload();
  },
};
