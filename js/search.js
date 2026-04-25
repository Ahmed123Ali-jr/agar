// ============================================
// البحث: نصي + صوتي
// ============================================

const Search = {
  recognition: null,
  recordingFor: null, // 'header' | 'search-page'

  init() {
    // بحث نصي في الهيدر
    $('#quick-search').addEventListener('input', (e) => {
      Search.runQuick(e.target.value);
    });
    $('#quick-search').addEventListener('blur', () => {
      setTimeout(() => hide('#quick-search-results'), 200);
    });
    $('#quick-search').addEventListener('focus', (e) => {
      if (e.target.value.trim()) Search.runQuick(e.target.value);
    });

    // بحث في صفحة البحث
    $('#search-input').addEventListener('input', (e) => {
      Search.runFull(e.target.value);
    });

    // أزرار الميكروفون
    $('#header-mic').addEventListener('click', () => Search.startVoice('header'));
    $('#search-mic').addEventListener('click', () => Search.startVoice('search-page'));

    $('#voice-cancel').addEventListener('click', Search.stopVoice);

    Search.setupRecognition();
  },

  setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      // إخفاء أزرار الميكرفون إذا غير مدعوم
      $('#header-mic').style.display = 'none';
      $('#search-mic').style.display = 'none';
      return;
    }
    Search.recognition = new SR();
    Search.recognition.lang = 'ar-SA';
    Search.recognition.continuous = false;
    Search.recognition.interimResults = true;

    Search.recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript;
      $('#voice-transcript').textContent = text;
      if (last.isFinal) {
        Search.handleVoiceResult(text);
      }
    };
    Search.recognition.onerror = (e) => {
      console.error('voice error', e);
      Search.stopVoice();
      if (e.error === 'not-allowed') toast('يرجى السماح بالميكروفون', 'error');
      else toast('تعذر التعرف على الصوت', 'error');
    };
    Search.recognition.onend = () => {
      $('#voice-overlay').classList.remove('active');
      $('#header-mic').classList.remove('recording');
      $('#search-mic').classList.remove('recording');
    };
  },

  startVoice(target) {
    if (!Search.recognition) {
      toast('البحث الصوتي غير مدعوم في هذا المتصفح', 'error');
      return;
    }
    Search.recordingFor = target;
    $('#voice-transcript').textContent = '';
    $('#voice-overlay').classList.add('active');
    if (target === 'header') $('#header-mic').classList.add('recording');
    else $('#search-mic').classList.add('recording');
    try { Search.recognition.start(); } catch (e) { console.error(e); }
  },

  stopVoice() {
    try { Search.recognition?.stop(); } catch {}
    $('#voice-overlay').classList.remove('active');
    $('#header-mic').classList.remove('recording');
    $('#search-mic').classList.remove('recording');
  },

  handleVoiceResult(text) {
    const cleaned = Search.cleanQuery(text);
    Search.stopVoice();
    if (Search.recordingFor === 'header') {
      $('#quick-search').value = cleaned;
      Search.runQuick(cleaned);
    } else {
      // التبديل إلى صفحة البحث
      App.goTo('search');
      $('#search-input').value = cleaned;
      Search.runFull(cleaned);
    }
  },

  cleanQuery(text) {
    if (!text) return '';
    let q = text.trim();
    const stopWords = ['وين', 'أين', 'فين', 'حق', 'يا', 'أبي', 'ابغى', 'أبغى', 'ابي', 'بغيت', 'الـ', 'هل', 'من', 'الي', 'اللي', 'تكون'];
    // إزالة علامات الاستفهام
    q = q.replace(/[؟?]/g, '');
    const words = q.split(/\s+/).filter(w => !stopWords.includes(w.replace(/[؟?]/g, '')));
    return words.join(' ').trim() || q;
  },

  // البحث الفعلي
  match(item, query) {
    if (!query) return false;
    const q = query.toLowerCase();
    const name = (item.name || '').toLowerCase();
    const notes = (item.notes || '').toLowerCase();
    return name.includes(q) || notes.includes(q);
  },

  matchLocation(loc, query) {
    if (!query) return false;
    const q = query.toLowerCase();
    return (loc.name || '').toLowerCase().includes(q)
        || (loc.description || '').toLowerCase().includes(q);
  },

  runQuick(query) {
    const box = $('#quick-search-results');
    const q = query.trim();
    if (!q) { hide(box); box.innerHTML = ''; return; }

    const itemMatches = State.items.filter(i => Search.match(i, q)).slice(0, 8);
    const locMatches = State.locations.filter(l => Search.matchLocation(l, q)).slice(0, 4);

    if (itemMatches.length === 0 && locMatches.length === 0) {
      box.innerHTML = '<div class="no-results">لا توجد نتائج</div>';
      show(box);
      return;
    }

    let html = '';
    if (locMatches.length) {
      html += locMatches.map(l => `
        <div class="result-card" data-loc="${l.id}">
          <div class="result-name">${l.icon || '📦'} ${escapeHtml(l.name)}</div>
          <div class="result-location muted">مكان</div>
        </div>
      `).join('');
    }
    if (itemMatches.length) {
      html += itemMatches.map(it => {
        const loc = State.locations.find(l => l.id === it.location_id);
        return `
          <div class="result-card" data-item="${it.id}">
            <div class="result-name">${escapeHtml(it.name)}</div>
            <div class="result-location">📍 ${escapeHtml(loc?.name || '')}</div>
          </div>
        `;
      }).join('');
    }

    box.innerHTML = html;
    show(box);

    box.querySelectorAll('[data-loc]').forEach(el => {
      el.addEventListener('mousedown', () => {
        hide(box);
        $('#quick-search').value = '';
        Locations.openDetail(el.dataset.loc);
      });
    });
    box.querySelectorAll('[data-item]').forEach(el => {
      el.addEventListener('mousedown', () => {
        hide(box);
        $('#quick-search').value = '';
        const it = State.items.find(i => i.id === el.dataset.item);
        if (it) Locations.openDetail(it.location_id);
      });
    });
  },

  runFull(query) {
    const results = $('#search-results');
    const q = query.trim();
    if (!q) { results.innerHTML = ''; return; }

    const itemMatches = State.items.filter(i => Search.match(i, q));
    const locMatches = State.locations.filter(l => Search.matchLocation(l, q));

    if (itemMatches.length === 0 && locMatches.length === 0) {
      results.innerHTML = '<div class="no-results">لا توجد نتائج لـ "' + escapeHtml(q) + '"</div>';
      return;
    }

    let html = '';
    if (locMatches.length) {
      html += '<h3 class="section-title">أماكن (' + locMatches.length + ')</h3>';
      html += locMatches.map(l => `
        <div class="result-card" data-loc="${l.id}">
          <div class="result-name">${l.icon || '📦'} ${escapeHtml(l.name)}</div>
          ${l.description ? `<div class="result-notes">${escapeHtml(l.description)}</div>` : ''}
        </div>
      `).join('');
    }
    if (itemMatches.length) {
      html += '<h3 class="section-title">أغراض (' + itemMatches.length + ')</h3>';
      html += itemMatches.map(it => {
        const loc = State.locations.find(l => l.id === it.location_id);
        return `
          <div class="result-card" data-item="${it.id}">
            <div class="result-name">${escapeHtml(it.name)}</div>
            <div class="result-location">📍 ${escapeHtml(loc?.name || '')}${it.quantity > 1 ? ` · الكمية ${it.quantity}` : ''}</div>
            ${it.notes ? `<div class="result-notes">${escapeHtml(it.notes)}</div>` : ''}
          </div>
        `;
      }).join('');
    }

    results.innerHTML = html;

    results.querySelectorAll('[data-loc]').forEach(el => {
      el.addEventListener('click', () => Locations.openDetail(el.dataset.loc));
    });
    results.querySelectorAll('[data-item]').forEach(el => {
      el.addEventListener('click', () => {
        const it = State.items.find(i => i.id === el.dataset.item);
        if (it) Locations.openDetail(it.location_id);
      });
    });
  },
};
