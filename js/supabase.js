// ============================================
// إعداد Supabase
// ============================================
// ⚠️ ضع هنا مفاتيح مشروعك من Supabase Dashboard:
//   Project Settings → API
//   - Project URL
//   - anon public key
// ============================================

const SUPABASE_URL = 'https://vzkrxpeiudmlorbezays.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0L2hZ8vjkzqhnAAuejN32w_mhgyD5I0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// State عام للتطبيق
const State = {
  user: null,
  family: null,
  member: null,
  locations: [],
  items: [],
  members: [],
  currentLocationId: null,
};

// ===== Helpers =====
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function show(el) { if (typeof el === 'string') el = $(el); el?.classList.remove('hidden'); }
function hide(el) { if (typeof el === 'string') el = $(el); el?.classList.add('hidden'); }

function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 2400);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function openModal(id) { $('#' + id).classList.add('active'); }
function closeModal(id) {
  if (id) $('#' + id).classList.remove('active');
  else $$('.modal.active').forEach(m => m.classList.remove('active'));
}

function confirmAction(title, message) {
  return new Promise(resolve => {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    openModal('confirm-modal');
    const yes = $('#confirm-yes');
    const no = $('#confirm-no');
    const cleanup = (val) => {
      yes.onclick = null; no.onclick = null;
      closeModal('confirm-modal');
      resolve(val);
    };
    yes.onclick = () => cleanup(true);
    no.onclick = () => cleanup(false);
  });
}

// رفع صورة إلى Supabase Storage
async function uploadImage(file, folder = 'misc') {
  if (!file) return null;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${State.family.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabaseClient.storage
    .from('agradi-images')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error('upload error', error);
    toast('فشل رفع الصورة', 'error');
    return null;
  }
  const { data } = supabaseClient.storage.from('agradi-images').getPublicUrl(path);
  return data.publicUrl;
}
