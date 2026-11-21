/**
 * VANTHESIS Constellation LCMS — Sector 1 (Overview) & Sector 2 (Constellation & Resources Hub)
 * File: resources.js (sibling of index.html & classroom.js)
 * Namespace: window.VANTHESIS_RESOURCES
 * Features: IndexedDB Cache, 8s Live Sync, 4-Level Topic Tree, SVG Constellation Map,
 *           Asymmetric Bento Observatory, Liquid Glass Preview Drawer, Google Drive Upload & /preview Embed,
 *           High-Density Teacher Management Table & Super Admin Publish Moderation Queue.
 */
(function () {
  'use strict';

  const STYLE_ID = 'vanthesis-resources-styles';
  const DB_NAME = 'vt_constellation_hub_v6';
  const DB_STORE = 'hub_cache';
  const HEARTBEAT_MS = 8000;

  const COGNITIVE_LABELS = {
    NHAN_BIET: 'Nhận biết',
    THONG_HIEU: 'Thông hiểu',
    VAN_DUNG: 'Vận dụng',
    VAN_DUNG_CAO: 'Vận dụng cao'
  };

  const TYPE_META = {
    LESSON: { label: 'Bài giảng tương tác', color: '#1D4ED8', icon: '📘' },
    PDF: { label: 'Tài liệu PDF / Chuyên đề', color: '#059669', icon: '📄' },
    SLIDE: { label: 'Bài trình chiếu', color: '#D97706', icon: '📽️' },
    VIDEO: { label: 'Video bài giảng', color: '#7C3AED', icon: '🎬' },
    LAB: { label: 'Mô phỏng 2D/3D', color: '#0EA5E9', icon: '∫' },
    EXERCISE: { label: 'Phiếu bài tập', color: '#E11D48', icon: '✍️' }
  };

  const SCOPE_META = {
    SCHOOL: { label: 'Toàn trường', cls: 'school' },
    PENDING_SCHOOL: { label: 'Chờ duyệt Toàn trường', cls: 'pending' },
    CLASS_ONLY: { label: 'Theo lớp được giao', cls: 'class' },
    PRIVATE: { label: 'Riêng tư', cls: 'private' }
  };

  const state = {
    loaded: false,
    loading: false,
    localSyncRev: 0,
    viewMode: 'explore', // 'explore' | 'manage' | 'moderate'
    resources: [],
    assignments: [],
    classes: [],
    myProgress: {},
    totalStarDust: 0,
    completionStats: {},
    commentsByResource: {},
    pendingModeration: [],

    // 4-Level Topic Tree Filters
    filterGrade: 'ALL',
    filterChapter: 'ALL',
    filterPattern: 'ALL',
    filterCognitive: 'ALL',
    searchQuery: '',

    // Active Drawer & Editor
    activeResourceId: '',
    editingResource: null,
    editorBlocks: [],
    selectedBulkIds: {},
    uploadingDrive: false,

    // CHẶNG IV: Exam Arena & Mastery State
    exams: [],
    myExamSubmissions: [],
    errorHeatmapByExam: {},
    classCoopStarDust: 0,
    activeExamSession: null, // { exam, mode, sessionSalt, serverGradedOnly, questions, answers, timingSecByQ, currentIdx, combo, maxCombo, twinActive, startedAt, endTimeMs }
    activeExamResult: null,
    activeLabSkin: (function () { try { return localStorage.getItem('vt_lab_skin_v6') || 'default'; } catch (e) { return 'default'; } })()
  };

  /* ==========================================================================
   * 1. UTILITIES, XSS SANITIZATION & FRIENDLY VIETNAMESE ERRORS
   * ========================================================================== */

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, '&#96;');
  }

  function formatFriendlyError(rawErr) {
    const c = String(rawErr || '').trim();
    const map = {
      UNAUTHORIZED_TOKEN: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      FORBIDDEN_ADMIN_ONLY: 'Thao tác này chỉ dành cho Quản trị viên hệ thống.',
      FORBIDDEN_STUDENT_READ_ONLY: 'Tài khoản Học sinh không có quyền chỉnh sửa học liệu.',
      FORBIDDEN_NOT_RESOURCE_OWNER: 'Bạn chỉ có thể sửa hoặc xóa học liệu do chính mình tạo.',
      FORBIDDEN_CLASS_OUT_OF_SCOPE: 'Bạn chỉ có thể giao học liệu cho các lớp mình phụ trách.',
      FORBIDDEN_RESOURCE_ACCESS: 'Bạn không có quyền truy cập học liệu này.',
      MISSING_RESOURCE_TITLE: 'Vui lòng nhập tiêu đề học liệu.',
      RESOURCE_NOT_FOUND: 'Không tìm thấy học liệu được yêu cầu.',
      SERVER_BUSY: 'Hệ thống đang bận, bạn vui lòng thử lại sau giây lát.',
      CONNECTION_ERROR: 'Không thể kết nối máy chủ dữ liệu. Vui lòng kiểm tra mạng.'
    };
    return map[c] || c || 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
  }

  function showNotice(msg, isErr) {
    const toast = document.getElementById('vtResToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.borderColor = isErr ? 'rgba(248, 113, 113, 0.7)' : 'rgba(56, 189, 248, 0.45)';
    toast.classList.add('visible');
    clearTimeout(showNotice._t);
    showNotice._t = setTimeout(function () { toast.classList.remove('visible'); }, 3400);
  }

  function decodeHtmlEntities(str) {
    return String(str || '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  }

  function renderMathInText(rawText) {
    let safe = escapeHtml(rawText || '');
    if (!window.katex) return safe.replace(/\n/g, '<br>');
    // 1. Display math $...$
    safe = safe.replace(/\$\$([\s\S]+?)\$\$/g, function (_m, expr) {
      try {
        return '<div class="vt-math-display">' + window.katex.renderToString(decodeHtmlEntities(expr), { throwOnError: false, displayMode: true }) + '</div>';
      } catch (e) {
        return expr;
      }
    });
    // 2. Inline math $...$
    safe = safe.replace(/\$([^$]+)\$/g, function (_m, expr) {
      try {
        return window.katex.renderToString(decodeHtmlEntities(expr), { throwOnError: false, displayMode: false });
      } catch (e) {
        return expr;
      }
    });
    return safe.replace(/\n/g, '<br>');
  }

  function getSession() {
    const ctx = window.VANTHESIS_SESSION_CONTEXT;
    if (!ctx || !ctx.bridgeUrl || !ctx.accessToken) return null;
    return ctx;
  }

  function isAdmin() { return Boolean(window.VANTHESIS_POLICY && window.VANTHESIS_POLICY.isAdmin()); }
  function isTeacher() { return Boolean(window.VANTHESIS_POLICY && window.VANTHESIS_POLICY.isTeacher()); }
  function isStudent() { return Boolean(window.VANTHESIS_POLICY && window.VANTHESIS_POLICY.isStudent()); }

  /* ==========================================================================
   * 2. INDEXEDDB LOCAL CACHE + LIVE SYNC ENGINE (sync_heartbeat + BroadcastChannel)
   * ========================================================================== */

  function openHubDb() {
    return new Promise(function (resolve) {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      try {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = function (ev) {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('exam_drafts')) {
            db.createObjectStore('exam_drafts', { keyPath: 'key' });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function readCache(email) {
    const db = await openHubDb();
    if (!db) return null;
    return new Promise(function (resolve) {
      try {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get('hub_' + email);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  async function writeCache(email, syncRev, data) {
    const db = await openHubDb();
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put({ key: 'hub_' + email, syncRev: syncRev, data: data, savedAt: Date.now() });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) { resolve(); }
    });
  }

  let syncChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      syncChannel = new BroadcastChannel('vanthesis_sync_v5');
      syncChannel.onmessage = function (ev) {
        if (ev && ev.data && ev.data.type === 'sync_bump' && Number(ev.data.rev) > state.localSyncRev) {
          fetchHubFromServer(true);
        }
      };
    }
  } catch (e) {}

  function broadcastSync(rev) {
    try { if (syncChannel) syncChannel.postMessage({ type: 'sync_bump', rev: rev }); } catch (e) {}
  }

  async function callApi(action, body, _retry) {
    let ctx = getSession();
    if (!ctx && !_retry && typeof window.VANTHESIS_REFRESH_TOKEN === 'function') {
      try { await window.VANTHESIS_REFRESH_TOKEN(); } catch (e) {}
      ctx = getSession();
    }
    if (!ctx) return { ok: false, error: 'UNAUTHORIZED_TOKEN' };
    try {
      const res = await fetch(ctx.bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action, accessToken: ctx.accessToken }, body || {}))
      });
      const txt = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(txt); } catch (e) { return { ok: false, error: 'CONNECTION_ERROR' }; }

      if (parsed && !parsed.ok && parsed.error === 'UNAUTHORIZED_TOKEN' && !_retry && typeof window.VANTHESIS_REFRESH_TOKEN === 'function') {
        try {
          await window.VANTHESIS_REFRESH_TOKEN();
          return await callApi(action, body, true);
        } catch (e) { return parsed; }
      }
      if (parsed && typeof parsed.syncRev === 'number' && parsed.syncRev > state.localSyncRev) {
        state.localSyncRev = parsed.syncRev;
      }
      if (parsed && parsed.ok && action !== 'resources_get_hub' && action !== 'sync_heartbeat') {
        broadcastSync(state.localSyncRev);
      }
      return parsed;
    } catch (e) {
      return { ok: false, error: 'CONNECTION_ERROR' };
    }
  }

  /* ==========================================================================
   * 3. GOOGLE DRIVE MULTIPART UPLOADER (PDF, WORD, PPTX, EXCEL, IMAGE, VIDEO)
   * ========================================================================== */

  async function uploadFileToDrive(file) {
    const ctx = getSession();
    if (!ctx) throw new Error('UNAUTHORIZED_TOKEN');
    const metadata = { name: file.name, mimeType: file.type || 'application/octet-stream' };
    const boundary = 'vt_drive_bound_' + Date.now();
    const metaPart = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n';
    const fileHeader = '--' + boundary + '\r\nContent-Type: ' + metadata.mimeType + '\r\n\r\n';
    const footer = '\r\n--' + boundary + '--';
    const bodyBlob = new Blob([metaPart, fileHeader, file, footer], { type: 'multipart/related; boundary=' + boundary });

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + ctx.accessToken },
      body: bodyBlob
    });
    if (!res.ok) throw new Error('Không thể tải tệp lên Google Drive (' + res.status + ').');
    const data = await res.json();
    return {
      fileId: data.id,
      name: data.name || file.name,
      mimeType: data.mimeType || file.type,
      previewUrl: 'https://drive.google.com/file/d/' + data.id + '/preview'
    };
  }

  /* ==========================================================================
   * 4. COSMIC LIQUID GLASS STYLESHEET INJECTION
   * ========================================================================== */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .vt-res-header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .vt-res-seg-tabs {
        display: inline-flex;
        gap: 4px;
        padding: 4px;
        border-radius: 9999px;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        overflow-x: auto;
        max-width: 100%;
      }
      .vt-res-seg-btn {
        border: none;
        background: transparent;
        color: var(--text-muted);
        padding: 8px 15px;
        border-radius: 9999px;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .vt-res-seg-btn.active {
        background: var(--surface);
        color: var(--primary);
        box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.42), 0 6px 16px -6px rgba(29, 78, 216, 0.22);
      }

      /* 4-Level Topic Tree Filter Bar */
      .vt-tree-filter-bar {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
        padding: 14px 16px;
        border-radius: 18px;
        background: var(--surface);
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
        margin-bottom: 16px;
      }
      .vt-tree-filter-bar select,
      .vt-tree-filter-bar input {
        width: 100%;
        height: 40px;
        padding: 0 12px;
        border-radius: 13px;
        border: 1px solid var(--border-strong);
        background: var(--bg);
        color: var(--text);
        font-family: var(--font-sans);
        font-size: 12.8px;
        font-weight: 600;
      }

      /* Interactive Constellation Map Card */
      .vt-constellation-stage {
        border-radius: 22px;
        background: linear-gradient(135deg, #060B19 0%, #0F1D44 55%, #1A1B4B 100%);
        border: 1px solid rgba(253, 230, 138, 0.24);
        padding: 16px 18px;
        margin-bottom: 18px;
        box-shadow: 0 18px 44px -16px rgba(6, 11, 25, 0.55);
        color: #F8FAFC;
      }
      .vt-constellation-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .vt-constellation-svg {
        width: 100%;
        height: 230px;
        display: block;
      }
      .vt-star-node {
        cursor: pointer;
        transition: transform 0.2s ease;
      }
      .vt-star-node:hover circle.vt-star-core {
        r: 10;
      }

      /* Asymmetric Bento Observatory Grid */
      .vt-bento-obs-grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 14px;
      }
      .vt-res-card {
        grid-column: span 4;
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        background: var(--surface);
        border: 1px solid var(--border);
        padding: 16px 18px;
        box-shadow: var(--shadow);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease, box-shadow 0.22s ease;
      }
      .vt-res-card.featured {
        grid-column: span 6;
      }
      .vt-res-card:hover {
        transform: translateY(-3px);
        border-color: rgba(217, 119, 6, 0.45);
        box-shadow: 0 14px 30px -12px rgba(29, 78, 216, 0.22);
      }
      .vt-res-spectrum {
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 4px;
      }
      .vt-res-card-title {
        font-family: 'Newsreader', var(--font-math), serif;
        font-size: 18.5px;
        font-weight: 700;
        color: var(--text);
        line-height: 1.3;
        margin: 0;
      }
      .vt-res-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
        background: var(--surface-alt);
        color: var(--text-muted);
        border: 1px solid var(--border);
      }
      .vt-res-pill.school { background: rgba(16, 185, 129, 0.12); color: #047857; border-color: rgba(16, 185, 129, 0.28); }
      .vt-res-pill.pending { background: rgba(245, 158, 11, 0.15); color: #B45309; border-color: rgba(245, 158, 11, 0.36); }
      .vt-res-pill.class { background: rgba(29, 78, 216, 0.12); color: #1D4ED8; border-color: rgba(29, 78, 216, 0.26); }
      html[data-theme="dark"] .vt-res-pill.school { color: #34D399; }
      html[data-theme="dark"] .vt-res-pill.pending { color: #FCD34D; }
      html[data-theme="dark"] .vt-res-pill.class { color: #93C5FD; }

      /* High-Density Management Table */
      .vt-res-table-wrap {
        width: 100%;
        overflow-x: auto;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: var(--surface);
      }
      .vt-res-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .vt-res-table th, .vt-res-table td {
        padding: 11px 13px;
        border-bottom: 1px solid var(--border);
        text-align: left;
      }
      .vt-res-table th {
        background: var(--surface-alt);
        font-size: 11.5px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-soft);
      }

      /* Liquid Glass Preview & Lesson Reader Drawer */
      .vt-res-drawer-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 160;
        background: rgba(6, 11, 25, 0.52);
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        justify-content: flex-end;
      }
      .vt-res-drawer-backdrop.open { display: flex; }
      .vt-res-drawer {
        width: min(640px, 95vw);
        height: 100dvh;
        background: var(--surface);
        border-left: 1px solid var(--border);
        box-shadow: -20px 0 60px rgba(6, 11, 25, 0.34);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .vt-res-drawer-head {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .vt-res-drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: 18px 20px 30px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .vt-drive-preview-frame {
        width: 100%;
        height: 360px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: #0F172A;
      }

      /* Editor & Bulk Assign Modals */
      .vt-res-modal-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 170;
        background: rgba(6, 11, 25, 0.56);
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .vt-res-modal-backdrop.open { display: flex; }
      .vt-res-modal {
        width: min(720px, 96vw);
        max-height: 90dvh;
        overflow-y: auto;
        border-radius: 24px;
        background: var(--surface);
        border: 1px solid var(--border-strong);
        padding: 20px 22px;
        box-shadow: 0 28px 70px rgba(6, 11, 25, 0.42);
      }
      .vt-res-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 12px;
      }
      .vt-res-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .vt-res-field label {
        font-size: 11.8px;
        font-weight: 700;
        color: var(--text-muted);
      }
      .vt-res-field input, .vt-res-field select, .vt-res-field textarea {
        padding: 9px 12px;
        border-radius: 12px;
        border: 1px solid var(--border-strong);
        background: var(--bg);
        color: var(--text);
        font-family: var(--font-sans);
        font-size: 13px;
      }

      /* ===== CHẶNG III: BLOCK-BASED LESSON STUDIO, EMBEDDED 2D/3D LAB & PRESENTATION MODE ===== */
      .vt-theorem-box {
        border-radius: 16px;
        padding: 15px 18px;
        background: linear-gradient(135deg, rgba(254, 243, 199, 0.58) 0%, rgba(255, 251, 235, 0.85) 100%);
        border: 1px solid rgba(217, 119, 6, 0.42);
        border-left: 4px solid #D97706;
        color: var(--text);
        line-height: 1.7;
      }
      html[data-theme="dark"] .vt-theorem-box {
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.30) 0%, rgba(30, 41, 59, 0.72) 100%);
        border-color: rgba(251, 191, 36, 0.42);
      }
      .vt-theorem-kicker {
        font-size: 11.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #B45309;
        margin-bottom: 6px;
      }
      html[data-theme="dark"] .vt-theorem-kicker { color: #FCD34D; }

      .vt-method-box {
        border-radius: 16px;
        padding: 15px 18px;
        background: linear-gradient(135deg, rgba(239, 246, 255, 0.85) 0%, rgba(255, 255, 255, 0.92) 100%);
        border: 1px solid rgba(29, 78, 216, 0.28);
        border-left: 4px solid #1D4ED8;
        color: var(--text);
        line-height: 1.7;
      }
      html[data-theme="dark"] .vt-method-box {
        background: linear-gradient(135deg, rgba(30, 58, 138, 0.28) 0%, rgba(15, 23, 42, 0.84) 100%);
        border-color: rgba(56, 189, 248, 0.34);
      }
      .vt-method-kicker {
        font-size: 11.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #1D4ED8;
        margin-bottom: 6px;
      }
      html[data-theme="dark"] .vt-method-kicker { color: #93C5FD; }

      .vt-math-display {
        margin: 10px 0;
        overflow-x: auto;
        text-align: center;
      }

      /* Embedded Live 2D/3D Graph Block */
      .vt-embed-lab-card {
        border-radius: 18px;
        border: 1px solid rgba(29, 78, 216, 0.30);
        background: var(--surface);
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: var(--shadow);
      }
      .vt-embed-lab-canvas {
        width: 100%;
        height: 240px;
        border-radius: 14px;
        background: #060B19;
        border: 1px solid rgba(56, 189, 248, 0.24);
        display: block;
        touch-action: none;
        cursor: grab;
      }
      .vt-embed-lab-canvas:active { cursor: grabbing; }
      .vt-embed-slider-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        padding: 8px 12px;
        border-radius: 12px;
        background: var(--surface-alt);
        font-size: 12.5px;
        font-weight: 700;
      }
      .vt-embed-slider-row input[type="range"] {
        flex: 1;
        min-width: 140px;
        accent-color: var(--primary);
      }

      /* Classroom Presentation Mode (Full Viewport Projector Scale) */
      .vt-res-drawer-backdrop.is-presenting {
        background: var(--bg) !important;
        justify-content: center !important;
      }
      .vt-res-drawer-backdrop.is-presenting .vt-res-drawer {
        width: 100vw !important;
        max-width: 100vw !important;
        height: 100dvh !important;
        border: none !important;
        border-radius: 0 !important;
      }
      .vt-res-drawer-backdrop.is-presenting .vt-res-drawer-head {
        padding: 18px 32px;
      }
      .vt-res-drawer-backdrop.is-presenting #vtResDrawerTitle {
        font-size: 28px !important;
      }
      .vt-res-drawer-backdrop.is-presenting .vt-res-drawer-body {
        max-width: 1040px;
        width: 100%;
        margin: 0 auto;
        padding: 24px 32px 48px;
        font-size: 18.5px !important;
        line-height: 1.8 !important;
      }
      .vt-res-drawer-backdrop.is-presenting .vt-embed-lab-canvas {
        height: 360px !important;
      }
      .vt-res-drawer-backdrop.is-presenting .vt-drive-preview-frame {
        height: 520px !important;
      }

      /* Multi-Block Composer Builder */
      .vt-block-builder-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 10px 0 14px;
      }
      .vt-block-item {
        border-radius: 14px;
        border: 1px solid var(--border-strong);
        background: var(--surface-alt);
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .vt-block-item-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 12px;
        font-weight: 700;
      }
      .vt-block-add-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      /* Quick Math Symbol Bar for LaTeX Q&A */
      .vt-math-quickbar {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .vt-math-sym-btn {
        padding: 4px 9px;
        border-radius: 8px;
        border: 1px solid var(--border-strong);
        background: var(--surface-alt);
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .vt-math-sym-btn:hover {
        border-color: var(--primary);
        color: var(--primary);
      }

      /* ===== CHẶNG IV: EXAM ARENA, 4 CONQUEST MODES, TWIN PROBLEMS, HEATMAP & STARDUST SKINS ===== */
      .vt-exam-modes-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .vt-mode-pill-card {
        border-radius: 18px;
        padding: 14px 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .vt-combo-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 13px;
        border-radius: 9999px;
        font-family: var(--font-mono);
        font-size: 13px;
        font-weight: 800;
        background: linear-gradient(135deg, #F59E0B, #EF4444);
        color: #FFFFFF;
        box-shadow: 0 0 18px rgba(245, 158, 11, 0.55);
      }
      .vt-trap-box {
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(239, 68, 68, 0.10);
        border: 1px solid rgba(239, 68, 68, 0.34);
        color: var(--text);
        font-size: 13px;
        line-height: 1.55;
      }
      .vt-twin-box {
        border-radius: 16px;
        padding: 14px 16px;
        background: rgba(245, 158, 11, 0.12);
        border: 1.5px solid rgba(217, 119, 6, 0.45);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .vt-coop-bar-wrap {
        border-radius: 18px;
        padding: 14px 18px;
        background: linear-gradient(135deg, rgba(29, 78, 216, 0.10), rgba(217, 119, 6, 0.10));
        border: 1px solid rgba(217, 119, 6, 0.28);
        margin-bottom: 16px;
      }
      .vt-coop-track {
        height: 10px;
        border-radius: 9999px;
        background: rgba(148, 163, 184, 0.24);
        overflow: hidden;
        margin-top: 8px;
      }
      .vt-coop-fill {
        height: 100%;
        border-radius: 9999px;
        background: linear-gradient(90deg, #1D4ED8, #38BDF8, #FBBF24);
        transition: width 0.4s ease;
      }
      .vt-heat-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12.5px;
      }
      .vt-heat-track {
        flex: 1;
        height: 8px;
        border-radius: 999px;
        background: var(--surface-alt);
        overflow: hidden;
      }
      .vt-skin-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .vt-skin-card {
        border-radius: 14px;
        padding: 12px;
        border: 1px solid var(--border);
        background: var(--surface);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .vt-skin-card.active {
        border-color: rgba(217, 119, 6, 0.6);
        box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.35);
      }
      /* Exclusive Lab Board Skins unlocked via StarDust */
      html[data-lab-skin="chalkboard"] #mathCanvas { filter: sepia(0.18) hue-rotate(85deg) contrast(1.06); }
      html[data-lab-skin="blueprint"] #mathCanvas { filter: hue-rotate(195deg) saturate(1.25); }
      html[data-lab-skin="observatory_gold"] #mathCanvas { filter: sepia(0.26) saturate(1.15); }

      @media (max-width: 1024px) {
        .vt-exam-modes-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 767px) {
        .vt-exam-modes-grid, .vt-skin-grid { grid-template-columns: 1fr; }
      }

      /* Floating Toast */
      #vtResToast {
        position: fixed;
        top: 18px;
        left: 50%;
        transform: translate(-50%, -20px) scale(0.96);
        z-index: 250;
        padding: 10px 18px;
        border-radius: 9999px;
        background: #0B1120;
        color: #F8FAFC;
        border: 1px solid rgba(56, 189, 248, 0.45);
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
        opacity: 0;
        pointer-events: none;
        transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      #vtResToast.visible {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }

      @media (max-width: 1024px) {
        .vt-tree-filter-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .vt-res-card, .vt-res-card.featured { grid-column: span 6; }
      }
      @media (max-width: 767px) {
        .vt-tree-filter-bar, .vt-res-form-grid { grid-template-columns: 1fr; }
        .vt-res-card, .vt-res-card.featured { grid-column: span 12; }
        .vt-res-drawer-backdrop, .vt-res-modal-backdrop { align-items: flex-end; padding: 0; }
        .vt-res-drawer, .vt-res-modal {
          width: 100% !important;
          max-width: 100% !important;
          height: auto;
          max-height: 92dvh !important;
          border-radius: 24px 24px 0 0 !important;
          padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
        }
        .vt-res-field input, .vt-res-field select, .vt-res-field textarea,
        .vt-tree-filter-bar select, .vt-tree-filter-bar input {
          font-size: 16px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlaysDOM() {
    if (document.getElementById('vtResDrawerBackdrop')) return;
    const host = document.createElement('div');
    host.innerHTML = `
      <!-- Liquid Glass Preview & Lesson Reader Drawer -->
      <div class="vt-res-drawer-backdrop" id="vtResDrawerBackdrop" role="dialog" aria-modal="true" aria-label="Xem trước và học bài giảng">
        <div class="vt-res-drawer">
          <div class="vt-res-drawer-head">
            <div style="font-family:'Newsreader',serif;font-size:19px;font-weight:700;" id="vtResDrawerTitle">Học liệu</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button id="vtResPresentToggle" class="btn btn-sm" type="button" title="Phóng lớn bài giảng để trình chiếu trên bảng tương tác / máy chiếu">📽️ Trình chiếu Lớp học</button>
              <button id="vtResDrawerClose" class="btn btn-sm" type="button">✕ Đóng</button>
            </div>
          </div>
          <div class="vt-res-drawer-body" id="vtResDrawerBody"></div>
        </div>
      </div>

      <!-- Resource Composer / Editor Modal (with Google Drive Upload) -->
      <div class="vt-res-modal-backdrop" id="vtResEditorBackdrop" role="dialog" aria-modal="true" aria-label="Biên soạn Học liệu">
        <div class="vt-res-modal">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <h3 style="font-family:'Newsreader',serif;font-size:21px;margin:0;" id="vtResEditorHeading">Biên soạn Học liệu mới</h3>
            <button id="vtResEditorClose" class="btn btn-sm" type="button">✕</button>
          </div>
          <form id="vtResEditorForm" novalidate>
            <div class="vt-res-form-grid">
              <div class="vt-res-field" style="grid-column:1 / -1;">
                <label for="vtEdTitle">Tiêu đề học liệu *</label>
                <input id="vtEdTitle" type="text" required placeholder="VD: Khảo sát cực trị hàm bậc ba chứa tham số m">
              </div>
              <div class="vt-res-field">
                <label for="vtEdGrade">Khối lớp</label>
                <select id="vtEdGrade">
                  <option value="Khối 10">Khối 10</option>
                  <option value="Khối 11">Khối 11</option>
                  <option value="Khối 12" selected>Khối 12</option>
                  <option value="Đại học">Đại học</option>
                </select>
              </div>
              <div class="vt-res-field">
                <label for="vtEdSubject">Môn học</label>
                <input id="vtEdSubject" type="text" value="Toán học">
              </div>
              <div class="vt-res-field">
                <label for="vtEdChapter">Chương / Chòm sao</label>
                <input id="vtEdChapter" type="text" placeholder="VD: Chòm sao Ứng dụng Đạo hàm">
              </div>
              <div class="vt-res-field">
                <label for="vtEdPattern">Dạng toán &amp; Phương pháp giải</label>
                <input id="vtEdPattern" type="text" placeholder="VD: Tìm m để hàm số có cực trị">
              </div>
              <div class="vt-res-field">
                <label for="vtEdCognitive">Mức độ nhận thức</label>
                <select id="vtEdCognitive">
                  <option value="NHAN_BIET">Nhận biết</option>
                  <option value="THONG_HIEU" selected>Thông hiểu</option>
                  <option value="VAN_DUNG">Vận dụng</option>
                  <option value="VAN_DUNG_CAO">Vận dụng cao</option>
                </select>
              </div>
              <div class="vt-res-field">
                <label for="vtEdType">Loại học liệu</label>
                <select id="vtEdType">
                  <option value="LESSON">📘 Bài giảng tương tác</option>
                  <option value="LAB">∫ Mô phỏng 2D/3D</option>
                  <option value="PDF">📄 Tài liệu PDF / Chuyên đề</option>
                  <option value="SLIDE">📽️ Bài trình chiếu</option>
                  <option value="VIDEO">🎬 Video bài giảng</option>
                  <option value="EXERCISE">✍️ Phiếu bài tập</option>
                </select>
              </div>
              <div class="vt-res-field">
                <label for="vtEdScope">Phạm vi xuất bản</label>
                <select id="vtEdScope">
                  <option value="CLASS_ONLY">Theo lớp được giao</option>
                  <option value="SCHOOL">Đề xuất / Xuất bản Toàn trường</option>
                  <option value="PRIVATE">Riêng tư</option>
                </select>
              </div>
              <div class="vt-res-field">
                <label for="vtEdOrder">Thứ tự ngôi sao trong chòm</label>
                <input id="vtEdOrder" type="number" min="1" value="1">
              </div>
              <div class="vt-res-field" style="grid-column:1 / -1;">
                <label for="vtEdSummary">Tóm tắt ngắn gọn</label>
                <textarea id="vtEdSummary" rows="2" placeholder="Tóm tắt mục tiêu kiến thức và phương pháp trọng tâm..."></textarea>
              </div>
            </div>

            <!-- Block-Based Lesson Builder (Add / Reorder / Edit Theory, Theorem, Method, 2D/3D Lab, Google Drive) -->
            <div style="padding:12px 14px;border-radius:16px;background:var(--bg);border:1px solid var(--border-strong);margin-bottom:12px;">
              <div style="font-size:12.5px;font-weight:800;margin-bottom:8px;">🧩 Cấu trúc Bài giảng Đa khối (Sắp xếp tự do)</div>
              <div class="vt-block-add-bar">
                <button class="btn btn-sm" type="button" id="vtAddBlkTheory">+ Lý thuyết</button>
                <button class="btn btn-sm" type="button" id="vtAddBlkTheorem">+ Khung Định lý</button>
                <button class="btn btn-sm" type="button" id="vtAddBlkMethod">+ Phương pháp giải</button>
                <button class="btn btn-sm" type="button" id="vtAddBlkLab">+ Đồ thị 2D/3D</button>
                <label class="btn btn-sm" style="cursor:pointer;">
                  <span>+ Tệp Google Drive</span>
                  <input id="vtEdDriveFileInput" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,video/*" style="display:none;">
                </label>
              </div>
              <div id="vtEdBlockBuilderList" class="vt-block-builder-list"></div>
            </div>

            <!-- Class Assignment Checkboxes -->
            <div style="margin-bottom:14px;">
              <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">Giao tới các lớp phụ trách:</div>
              <div id="vtEdClassChecks" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button id="vtResEditorCancel" class="btn" type="button">Hủy</button>
              <button id="vtResEditorSubmit" class="btn btn-primary" type="submit">💾 Lưu Học liệu</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Bulk Assign Classes Modal -->
      <div class="vt-res-modal-backdrop" id="vtResBulkBackdrop" role="dialog" aria-modal="true" aria-label="Giao học liệu hàng loạt">
        <div class="vt-res-modal" style="max-width:460px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-family:'Newsreader',serif;font-size:19px;margin:0;">Giao học liệu tới nhiều lớp</h3>
            <button id="vtResBulkClose" class="btn btn-sm" type="button">✕</button>
          </div>
          <div id="vtResBulkClassChecks" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button id="vtResBulkCancel" class="btn" type="button">Hủy</button>
            <button id="vtResBulkConfirm" class="btn btn-primary" type="button">✓ Xác nhận giao lớp</button>
          </div>
        </div>
      </div>

      <div id="vtResToast" role="status" aria-live="polite"></div>
    `;
    document.body.appendChild(host);

    // Wire static overlay events
    document.getElementById('vtResDrawerClose').addEventListener('click', closeDrawer);
    document.getElementById('vtResPresentToggle').addEventListener('click', togglePresentationMode);
    document.getElementById('vtAddBlkTheory').addEventListener('click', function () {
      state.editorBlocks.push({ type: 'markdown', style: 'plain', title: 'Lý thuyết trọng tâm', text: '' });
      renderEditorBlockBuilder();
    });
    document.getElementById('vtAddBlkTheorem').addEventListener('click', function () {
      state.editorBlocks.push({ type: 'markdown', style: 'theorem', title: 'Định lý / Tính chất cần nhớ', text: '' });
      renderEditorBlockBuilder();
    });
    document.getElementById('vtAddBlkMethod').addEventListener('click', function () {
      state.editorBlocks.push({ type: 'markdown', style: 'method', title: 'Phương pháp giải từng bước', text: 'Bước 1: ...\nBước 2: ...' });
      renderEditorBlockBuilder();
    });
    document.getElementById('vtAddBlkLab').addEventListener('click', function () {
      state.editorBlocks.push({
        type: 'lab_snapshot',
        title: 'Mô phỏng Đồ thị tương tác',
        snapshot: {
          exprs: [{ expr: 'x^3 - 3*m*x', color: '#38BDF8', visible: true }],
          params: { m: 1 },
          mode: 'standard',
          solid3D: false,
          view: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
        }
      });
      renderEditorBlockBuilder();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const bd = document.getElementById('vtResDrawerBackdrop');
        if (bd && bd.classList.contains('is-presenting')) togglePresentationMode(false);
      }
    });
    document.getElementById('vtResDrawerBackdrop').addEventListener('click', function (e) {
      if (e.target.id === 'vtResDrawerBackdrop') closeDrawer();
    });
    document.getElementById('vtResEditorClose').addEventListener('click', closeEditor);
    document.getElementById('vtResEditorCancel').addEventListener('click', closeEditor);
    document.getElementById('vtResBulkClose').addEventListener('click', function () {
      document.getElementById('vtResBulkBackdrop').classList.remove('open');
    });
    document.getElementById('vtResBulkCancel').addEventListener('click', function () {
      document.getElementById('vtResBulkBackdrop').classList.remove('open');
    });
    document.getElementById('vtEdDriveFileInput').addEventListener('change', handleDriveFileSelect);
    document.getElementById('vtResEditorForm').addEventListener('submit', handleEditorSubmit);
    document.getElementById('vtResBulkConfirm').addEventListener('click', handleBulkAssignConfirm);
  }

  /* ==========================================================================
   * 5. DATA HYDRATION & LIVE SYNC
   * ========================================================================== */

  function applyHubData(data) {
    state.resources = Array.isArray(data.resources) ? data.resources : [];
    state.assignments = Array.isArray(data.assignments) ? data.assignments : [];
    state.classes = Array.isArray(data.classes) ? data.classes : [];
    state.myProgress = data.myProgress || {};
    state.totalStarDust = Number(data.totalStarDust) || 0;
    state.completionStats = data.completionStats || {};
    state.commentsByResource = data.commentsByResource || {};
    state.pendingModeration = Array.isArray(data.pendingModeration) ? data.pendingModeration : [];
    state.loaded = true;
    renderDashboard();
    renderResourcesHub();
    if (state.activeResourceId) renderDrawerContent();
  }

  async function fetchHubFromServer(silent) {
    const ctx = getSession();
    if (!ctx) return;
    if (!silent) state.loading = true;
    const res = await callApi('resources_get_hub');
    state.loading = false;
    if (!res || !res.ok) {
      if (!silent) showNotice('⚠ ' + formatFriendlyError(res && res.error), true);
      return;
    }
    applyHubData(res);
    await writeCache(ctx.email, state.localSyncRev, res);
  }

  async function initHub() {
    const ctx = getSession();
    if (!ctx) return;
    injectStyles();
    ensureOverlaysDOM();

    // 1. Instant local cache hydration (< 30ms)
    const cached = await readCache(ctx.email);
    if (cached && cached.data) {
      state.localSyncRev = Number(cached.syncRev) || 0;
      applyHubData(cached.data);
    }

    // 2. Live sync verification with server
    await fetchHubFromServer(Boolean(cached));
  }

  let hbTimer = null;
  function startHeartbeat() {
    if (hbTimer) clearInterval(hbTimer);
    hbTimer = setInterval(async function () {
      if (document.visibilityState !== 'visible' || navigator.onLine === false || !getSession()) return;
      const hb = await callApi('sync_heartbeat');
      if (hb && hb.ok && typeof hb.syncRev === 'number' && hb.syncRev > state.localSyncRev) {
        state.localSyncRev = hb.syncRev;
        await fetchHubFromServer(true);
      }
    }, HEARTBEAT_MS);
  }

  /* ==========================================================================
   * 6. FILTERING (< 30ms IN-MEMORY) & CONSTELLATION SVG RENDERER
   * ========================================================================== */

  function getFilteredResources() {
    const q = state.searchQuery.trim().toLowerCase();
    return state.resources.filter(function (r) {
      if (state.filterGrade !== 'ALL' && r.gradeBlock !== state.filterGrade) return false;
      if (state.filterChapter !== 'ALL' && r.chapterConstellation !== state.filterChapter) return false;
      if (state.filterPattern !== 'ALL' && r.topicPattern !== state.filterPattern) return false;
      if (state.filterCognitive !== 'ALL' && r.cognitiveLevel !== state.filterCognitive) return false;
      if (!q) return true;
      return String(r.title || '').toLowerCase().indexOf(q) !== -1 ||
        String(r.summary || '').toLowerCase().indexOf(q) !== -1 ||
        String(r.chapterConstellation || '').toLowerCase().indexOf(q) !== -1 ||
        String(r.topicPattern || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderConstellationSvg(filtered) {
    if (!filtered.length) {
      return '<div style="text-align:center;padding:34px 12px;color:#94A3B8;font-size:13px;">Chưa có ngôi sao học liệu nào trong bộ lọc hiện tại.</div>';
    }
    const showList = filtered.slice(0, 14);
    const W = 940, H = 220;
    const pts = showList.map(function (r, idx) {
      const x = showList.length === 1 ? W / 2 : 68 + (idx / (showList.length - 1)) * (W - 136);
      const y = 110 + Math.sin(idx * 1.18 + 0.5) * 58 + (idx % 2 === 0 ? -12 : 14);
      let isLit = false;
      let ratio = 0;
      if (isStudent()) {
        const pr = state.myProgress[r.resourceId];
        isLit = Boolean(pr && (pr.status === 'COMPLETED' || pr.status === 'MASTERED'));
        ratio = isLit ? 1 : (pr ? 0.45 : 0.15);
      } else {
        const st = state.completionStats[r.resourceId];
        ratio = st && st.started > 0 ? Math.min(1, st.completed / st.started) : 0.35;
        isLit = ratio >= 0.6;
      }
      return { x: x, y: y, r: r, isLit: isLit, ratio: ratio };
    });

    let pathD = '';
    pts.forEach(function (p, i) {
      pathD += (i === 0 ? 'M ' : ' L ') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    });

    const nodesSvg = pts.map(function (p) {
      const fill = p.isLit ? '#FBBF24' : '#38BDF8';
      const haloOpacity = (0.18 + p.ratio * 0.45).toFixed(2);
      const shortTitle = p.r.title.length > 18 ? p.r.title.slice(0, 17) + '…' : p.r.title;
      return '<g class="vt-star-node" data-open-res="' + escapeAttr(p.r.resourceId) + '">' +
        '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="22" fill="' + fill + '" opacity="' + haloOpacity + '"/>' +
        '<circle class="vt-star-core" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="7.5" fill="' + fill + '" stroke="#FFFFFF" stroke-width="1.8"/>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 24).toFixed(1) + '" text-anchor="middle" fill="#E2E8F0" font-size="11" font-weight="600">' + escapeHtml(shortTitle) + '</text>' +
      '</g>';
    }).join('');

    return '<svg class="vt-constellation-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      '<path d="' + pathD + '" fill="none" stroke="rgba(147, 197, 253, 0.38)" stroke-width="1.6" stroke-dasharray="5 7"/>' +
      nodesSvg +
    '</svg>';
  }

  /* ==========================================================================
   * 7. RENDER SECTOR 1 (DASHBOARD) & SECTOR 2 (RESOURCES HUB)
   * ========================================================================== */

  function renderDashboard() {
    const mount = document.getElementById('vtDashboardMount');
    if (!mount) return;
    const totalRes = state.resources.length;
    const completedCount = Object.keys(state.myProgress).filter(function (k) {
      const st = state.myProgress[k] && state.myProgress[k].status;
      return st === 'COMPLETED' || st === 'MASTERED';
    }).length;
    const pendingModCount = state.pendingModeration.length;

    mount.innerHTML = `
      <div class="lcms-welcome-banner">
        <div>
          <h2>Trạm Quan trắc Tiến độ &amp; Lộ trình</h2>
          <p>${isAdmin()
            ? 'Quản trị toàn bộ Kho Chòm sao Tri thức, phê duyệt học liệu Toàn trường và điều phối lớp học.'
            : (isTeacher()
              ? 'Biên soạn bài giảng tương tác, giao học liệu cho các lớp phụ trách và theo dõi tiến độ học sinh.'
              : 'Khám phá bản đồ Chòm sao Tri thức, hoàn thành bài giảng để thắp sáng các ngôi sao và tích lũy Bụi Sao.')}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" type="button" id="vtDashGoResources">✦ Mở Kho Chòm sao</button>
          <button class="btn" type="button" id="vtDashGoLab">∫ Phòng Thí nghiệm 2D/3D</button>
        </div>
      </div>

      <div class="lcms-placeholder-grid">
        <div class="lcms-glass-tile">
          <span style="font-size:12px;color:var(--text-soft);font-weight:700;">✦ TỔNG HỌC LIỆU HIỆN CÓ</span>
          <b style="font-size:26px;font-family:var(--font-mono);color:var(--primary);">${totalRes}</b>
          <span style="font-size:12.5px;color:var(--text-muted);">Thuộc ${state.classes.length} lớp trong phạm vi của bạn</span>
        </div>
        <div class="lcms-glass-tile">
          <span style="font-size:12px;color:var(--text-soft);font-weight:700;">${isStudent() ? '★ BỤI SAO TÍCH LŨY' : '📋 LƯỢT GIAO HỌC LIỆU'}</span>
          <b style="font-size:26px;font-family:var(--font-mono);color:#D97706;">${isStudent() ? state.totalStarDust + '★' : state.assignments.length}</b>
          <span style="font-size:12.5px;color:var(--text-muted);">${isStudent() ? ('Đã hoàn thành ' + completedCount + ' / ' + totalRes + ' bài học') : 'Đang đồng bộ trực tiếp tới học sinh'}</span>
        </div>
        <div class="lcms-glass-tile">
          <span style="font-size:12px;color:var(--text-soft);font-weight:700;">${isAdmin() ? '🛡️ CHỜ DUYỆT TOÀN TRƯỜNG' : '🏫 KHÔNG GIAN LỚP HỌC'}</span>
          <b style="font-size:26px;font-family:var(--font-mono);color:#059669;">${isAdmin() ? pendingModCount : state.classes.length + ' lớp'}</b>
          <span style="font-size:12.5px;color:var(--text-muted);">${isAdmin() ? 'Học liệu giáo viên gửi đề xuất công khai' : 'Mở Sổ điểm Kép & Hồ sơ 360°'}</span>
        </div>
      </div>
    `;

    const bRes = document.getElementById('vtDashGoResources');
    if (bRes) bRes.addEventListener('click', function () { window.VANTHESIS_SWITCH_SECTOR('resources'); });
    const bLab = document.getElementById('vtDashGoLab');
    if (bLab) bLab.addEventListener('click', function () { window.VANTHESIS_SWITCH_SECTOR('lab'); });
  }

  function renderResourcesHub() {
    const mount = document.getElementById('vtResourcesMount');
    if (!mount) return;

    const canManage = isAdmin() || isTeacher();
    const filtered = getFilteredResources();

    // Cascading unique values for 4-level topic tree
    const chapters = [];
    const patterns = [];
    state.resources.forEach(function (r) {
      if (state.filterGrade === 'ALL' || r.gradeBlock === state.filterGrade) {
        if (r.chapterConstellation && chapters.indexOf(r.chapterConstellation) === -1) chapters.push(r.chapterConstellation);
      }
      if ((state.filterGrade === 'ALL' || r.gradeBlock === state.filterGrade) && (state.filterChapter === 'ALL' || r.chapterConstellation === state.filterChapter)) {
        if (r.topicPattern && patterns.indexOf(r.topicPattern) === -1) patterns.push(r.topicPattern);
      }
    });

    const segTabsHtml = `
      <div class="vt-res-seg-tabs" role="tablist">
        <button class="vt-res-seg-btn ${state.viewMode === 'explore' ? 'active' : ''}" data-resview="explore" type="button">✦ Khám phá &amp; Chòm sao</button>
        ${canManage ? '<button class="vt-res-seg-btn ' + (state.viewMode === 'manage' ? 'active' : '') + '" data-resview="manage" type="button">📋 Quản lý Học liệu</button>' : ''}
        ${isAdmin() ? '<button class="vt-res-seg-btn ' + (state.viewMode === 'moderate' ? 'active' : '') + '" data-resview="moderate" type="button">🛡️ Duyệt Xuất bản (' + state.pendingModeration.length + ')</button>' : ''}
      </div>`;

    const actionRightHtml = canManage
      ? '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button id="vtBtnNewResource" class="btn btn-primary" type="button">+ Biên soạn Học liệu</button></div>'
      : '';

    let bodyHtml = '';
    if (state.viewMode === 'explore') {
      const filterBarHtml = `
        <div class="vt-tree-filter-bar">
          <select id="vtFltGrade" aria-label="Lọc theo Khối">
            <option value="ALL">Tất cả Khối</option>
            <option value="Khối 10" ${state.filterGrade === 'Khối 10' ? 'selected' : ''}>Khối 10</option>
            <option value="Khối 11" ${state.filterGrade === 'Khối 11' ? 'selected' : ''}>Khối 11</option>
            <option value="Khối 12" ${state.filterGrade === 'Khối 12' ? 'selected' : ''}>Khối 12</option>
            <option value="Đại học" ${state.filterGrade === 'Đại học' ? 'selected' : ''}>Đại học</option>
          </select>
          <select id="vtFltChapter" aria-label="Lọc theo Chương hoặc Chòm sao">
            <option value="ALL">Mọi Chương / Chòm sao</option>
            ${chapters.map(function (c) { return '<option value="' + escapeAttr(c) + '" ' + (state.filterChapter === c ? 'selected' : '') + '>' + escapeHtml(c) + '</option>'; }).join('')}
          </select>
          <select id="vtFltPattern" aria-label="Lọc theo Dạng toán">
            <option value="ALL">Mọi Dạng toán</option>
            ${patterns.map(function (p) { return '<option value="' + escapeAttr(p) + '" ' + (state.filterPattern === p ? 'selected' : '') + '>' + escapeHtml(p) + '</option>'; }).join('')}
          </select>
          <select id="vtFltCog" aria-label="Lọc theo Mức độ nhận thức">
            <option value="ALL">Mọi mức độ nhận thức</option>
            <option value="NHAN_BIET" ${state.filterCognitive === 'NHAN_BIET' ? 'selected' : ''}>Nhận biết</option>
            <option value="THONG_HIEU" ${state.filterCognitive === 'THONG_HIEU' ? 'selected' : ''}>Thông hiểu</option>
            <option value="VAN_DUNG" ${state.filterCognitive === 'VAN_DUNG' ? 'selected' : ''}>Vận dụng</option>
            <option value="VAN_DUNG_CAO" ${state.filterCognitive === 'VAN_DUNG_CAO' ? 'selected' : ''}>Vận dụng cao</option>
          </select>
          <input id="vtFltSearch" type="text" value="${escapeAttr(state.searchQuery)}" placeholder="🔍 Tìm bài giảng, chuyên đề...">
        </div>`;

      const constellationHtml = `
        <section class="vt-constellation-stage">
          <div class="vt-constellation-head">
            <div style="font-weight:700;font-size:14.5px;">✦ Bản đồ Chòm sao Tri thức (${filtered.length} học liệu)</div>
            <div style="font-size:11.8px;color:#CBD5E1;">${isStudent() ? 'Chạm vào ngôi sao để học và thắp sáng vàng kim' : 'Độ sáng ngôi sao phản ánh tỷ lệ hoàn thành của lớp'}</div>
          </div>
          ${renderConstellationSvg(filtered)}
        </section>`;

      const cardsHtml = filtered.length
        ? filtered.map(function (r) {
            const tm = TYPE_META[r.resourceType] || TYPE_META.LESSON;
            const sm = SCOPE_META[r.publishScope] || SCOPE_META.CLASS_ONLY;
            const pr = state.myProgress[r.resourceId];
            const stStat = state.completionStats[r.resourceId];
            const progressPill = isStudent()
              ? (pr && (pr.status === 'COMPLETED' || pr.status === 'MASTERED') ? '<span class="vt-res-pill school">★ Đã hoàn thành</span>' : '<span class="vt-res-pill">○ Chưa hoàn thành</span>')
              : (stStat ? '<span class="vt-res-pill">' + stStat.completed + '/' + stStat.started + ' HS hoàn thành</span>' : '');
            const featuredSvg = r.featuredBento
              ? '<svg viewBox="0 0 260 56" style="width:100%;height:50px;background:var(--surface-alt);border-radius:10px;padding:4px;"><path d="M 10 44 Q 70 6 130 28 T 250 12" fill="none" stroke="' + tm.color + '" stroke-width="2.4" stroke-linecap="round"/><circle cx="130" cy="28" r="4" fill="#F59E0B"/></svg>'
              : '';
            return `
              <article class="vt-res-card ${r.featuredBento ? 'featured' : ''}" data-open-res="${escapeAttr(r.resourceId)}">
                <div class="vt-res-spectrum" style="background:${tm.color};"></div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                  <span class="vt-res-pill">${tm.icon} ${escapeHtml(tm.label)}</span>
                  <span class="vt-res-pill ${sm.cls}">${escapeHtml(sm.label)}</span>
                </div>
                ${featuredSvg}
                <h3 class="vt-res-card-title">${escapeHtml(r.title)}</h3>
                <div style="font-size:12.5px;color:var(--text-muted);line-height:1.5;flex:1;">${escapeHtml(r.summary || (r.chapterConstellation + (r.topicPattern ? ' • ' + r.topicPattern : '')))}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;padding-top:6px;border-top:1px solid var(--border);">
                  <span style="font-size:11.5px;color:var(--text-soft);">${escapeHtml(r.gradeBlock)} • ${escapeHtml(COGNITIVE_LABELS[r.cognitiveLevel] || r.cognitiveLevel)}</span>
                  ${progressPill}
                </div>
              </article>`;
          }).join('')
        : '<div class="lcms-glass-tile" style="grid-column:1 / -1;text-align:center;padding:34px;color:var(--text-soft);">Chưa có học liệu nào phù hợp. Hãy thử đổi bộ lọc hoặc biên soạn học liệu mới.</div>';

      bodyHtml = filterBarHtml + constellationHtml + '<div class="vt-bento-obs-grid">' + cardsHtml + '</div>';
    } else if (state.viewMode === 'manage') {
      const selCount = Object.keys(state.selectedBulkIds).filter(function (k) { return state.selectedBulkIds[k]; }).length;
      const rowsHtml = state.resources.map(function (r) {
        const ctx = getSession();
        const canEdit = isAdmin() || (ctx && r.authorEmail === ctx.email);
        const sm = SCOPE_META[r.publishScope] || SCOPE_META.CLASS_ONLY;
        const assignedCnt = state.assignments.filter(function (a) { return a.resourceId === r.resourceId; }).length;
        return `
          <tr>
            <td><input type="checkbox" class="vt-bulk-cb" data-rid="${escapeAttr(r.resourceId)}" ${state.selectedBulkIds[r.resourceId] ? 'checked' : ''}></td>
            <td><b style="cursor:pointer;color:var(--primary);" data-open-res="${escapeAttr(r.resourceId)}">${escapeHtml(r.title)}</b><div style="font-size:11.5px;color:var(--text-soft);">${escapeHtml(r.gradeBlock)} • ${escapeHtml(r.chapterConstellation)}</div></td>
            <td><span class="vt-res-pill ${sm.cls}">${escapeHtml(sm.label)}</span></td>
            <td>${assignedCnt} lớp</td>
            <td style="text-align:right;white-space:nowrap;">
              ${canEdit ? '<button class="btn btn-sm" type="button" data-edit-res="' + escapeAttr(r.resourceId) + '">✎ Sửa</button> <button class="btn btn-sm" type="button" data-del-res="' + escapeAttr(r.resourceId) + '" style="color:var(--danger);">✕ Xóa</button>' : '<span style="font-size:11.5px;color:var(--text-soft);">Chỉ xem</span>'}
            </td>
          </tr>`;
      }).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-soft);">Chưa có học liệu nào.</td></tr>';

      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="font-size:13px;color:var(--text-muted);">Đã chọn <b>${selCount}</b> học liệu</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="vtBtnBulkAssignOpen" class="btn btn-sm btn-primary" type="button" ${selCount === 0 ? 'disabled' : ''}>📌 Giao tới nhiều lớp</button>
          </div>
        </div>
        <div class="vt-res-table-wrap">
          <table class="vt-res-table">
            <thead><tr><th style="width:36px;"></th><th>Tên học liệu</th><th>Phạm vi</th><th>Đã giao</th><th style="text-align:right;">Thao tác</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    } else if (state.viewMode === 'moderate' && isAdmin()) {
      const modRows = state.pendingModeration.map(function (r) {
        return `
          <tr>
            <td><b style="cursor:pointer;color:var(--primary);" data-open-res="${escapeAttr(r.resourceId)}">${escapeHtml(r.title)}</b><div style="font-size:11.5px;color:var(--text-soft);">${escapeHtml(r.gradeBlock)} • ${escapeHtml(r.chapterConstellation)}</div></td>
            <td>${escapeHtml(r.authorEmail)}</td>
            <td style="text-align:right;white-space:nowrap;">
              <button class="btn btn-sm btn-primary" type="button" data-mod-approve="${escapeAttr(r.resourceId)}">✓ Duyệt Toàn trường</button>
              <button class="btn btn-sm" type="button" data-mod-reject="${escapeAttr(r.resourceId)}">↩ Trả về Theo lớp</button>
            </td>
          </tr>`;
      }).join('') || '<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--text-soft);">Hiện không có học liệu nào đang chờ duyệt xuất bản Toàn trường.</td></tr>';

      bodyHtml = `
        <div class="vt-res-table-wrap">
          <table class="vt-res-table">
            <thead><tr><th>Học liệu đề xuất công khai</th><th>Giáo viên biên soạn</th><th style="text-align:right;">Phê duyệt</th></tr></thead>
            <tbody>${modRows}</tbody>
          </table>
        </div>`;
    }

    mount.innerHTML = `
      <div class="vt-res-header-bar">
        ${segTabsHtml}
        ${actionRightHtml}
      </div>
      ${bodyHtml}
    `;

    wireHubEvents(mount);
  }

  function wireHubEvents(mount) {
    mount.querySelectorAll('[data-resview]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.viewMode = btn.getAttribute('data-resview');
        renderResourcesHub();
      });
    });

    const btnNew = document.getElementById('vtBtnNewResource');
    if (btnNew) btnNew.addEventListener('click', function () { openEditor(null, null); });

    const fltG = document.getElementById('vtFltGrade');
    if (fltG) fltG.addEventListener('change', function (e) { state.filterGrade = e.target.value; state.filterChapter = 'ALL'; state.filterPattern = 'ALL'; renderResourcesHub(); });
    const fltC = document.getElementById('vtFltChapter');
    if (fltC) fltC.addEventListener('change', function (e) { state.filterChapter = e.target.value; state.filterPattern = 'ALL'; renderResourcesHub(); });
    const fltP = document.getElementById('vtFltPattern');
    if (fltP) fltP.addEventListener('change', function (e) { state.filterPattern = e.target.value; renderResourcesHub(); });
    const fltCog = document.getElementById('vtFltCog');
    if (fltCog) fltCog.addEventListener('change', function (e) { state.filterCognitive = e.target.value; renderResourcesHub(); });
    const fltS = document.getElementById('vtFltSearch');
    if (fltS) fltS.addEventListener('input', function (e) {
      state.searchQuery = e.target.value;
      renderResourcesHub();
      const nxt = document.getElementById('vtFltSearch');
      if (nxt) { nxt.focus(); nxt.setSelectionRange(nxt.value.length, nxt.value.length); }
    });

    mount.querySelectorAll('[data-open-res]').forEach(function (el) {
      el.addEventListener('click', function () { openDrawer(el.getAttribute('data-open-res')); });
    });

    mount.querySelectorAll('.vt-bulk-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.selectedBulkIds[cb.getAttribute('data-rid')] = cb.checked;
        renderResourcesHub();
      });
    });

    const bulkOpen = document.getElementById('vtBtnBulkAssignOpen');
    if (bulkOpen) bulkOpen.addEventListener('click', openBulkAssignModal);

    mount.querySelectorAll('[data-edit-res]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const found = state.resources.find(function (r) { return r.resourceId === btn.getAttribute('data-edit-res'); });
        if (found) openEditor(found, null);
      });
    });

    mount.querySelectorAll('[data-del-res]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const rid = btn.getAttribute('data-del-res');
        if (!window.confirm('Xác nhận xóa học liệu này?')) return;
        const res = await callApi('resources_delete', { resourceId: rid });
        if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
        showNotice('✓ Đã xóa học liệu.');
        await fetchHubFromServer(true);
      });
    });

    mount.querySelectorAll('[data-mod-approve]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const res = await callApi('resources_moderate_publish', { resourceId: btn.getAttribute('data-mod-approve'), decision: 'APPROVE' });
        if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
        showNotice('✓ Đã duyệt xuất bản học liệu lên kho Toàn trường.');
        await fetchHubFromServer(true);
      });
    });

    mount.querySelectorAll('[data-mod-reject]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const res = await callApi('resources_moderate_publish', { resourceId: btn.getAttribute('data-mod-reject'), decision: 'REJECT', fallbackScope: 'CLASS_ONLY' });
        if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
        showNotice('↩ Đã trả học liệu về phạm vi Theo lớp.');
        await fetchHubFromServer(true);
      });
    });
  }

  /* ==========================================================================
   * 8. LIQUID GLASS PREVIEW & LESSON READER DRAWER (WITH DRIVE /preview & Q&A)
   * ========================================================================== */

  function openDrawer(resourceId) {
    state.activeResourceId = resourceId;
    document.getElementById('vtResDrawerBackdrop').classList.add('open');
    renderDrawerContent();
  }

  function togglePresentationMode(forceState) {
    const bd = document.getElementById('vtResDrawerBackdrop');
    const btn = document.getElementById('vtResPresentToggle');
    if (!bd) return;
    const next = typeof forceState === 'boolean' ? forceState : !bd.classList.contains('is-presenting');
    bd.classList.toggle('is-presenting', next);
    if (btn) btn.textContent = next ? '✕ Thoát Trình chiếu' : '📽️ Trình chiếu Lớp học';
    setTimeout(initAllEmbeddedLabCanvases, 60);
  }

  function closeDrawer() {
    state.activeResourceId = '';
    const bd = document.getElementById('vtResDrawerBackdrop');
    if (bd) {
      bd.classList.remove('open');
      bd.classList.remove('is-presenting');
    }
    const btn = document.getElementById('vtResPresentToggle');
    if (btn) btn.textContent = '📽️ Trình chiếu Lớp học';
  }

  // Safe lightweight expression evaluator for embedded 2D/3D lesson preview canvas
  function evalEmbedExpr(exprStr, xVal, paramsObj) {
    try {
      let s = String(exprStr || '').trim()
        .replace(/\^/g, '**')
        .replace(/\b(sin|cos|tan|abs|sqrt|exp|log|ln)\b/gi, function (m) {
          const low = m.toLowerCase();
          return low === 'ln' ? 'Math.log' : ('Math.' + low);
        })
        .replace(/\bpi\b/gi, 'Math.PI');
      // Implicit multiplication like 3x or 2m
      s = s.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
      const keys = Object.keys(paramsObj || {});
      const vals = keys.map(function (k) { return Number(paramsObj[k]) || 0; });
      const fn = new Function('x', ...keys, 'return (' + s + ');');
      const y = fn(xVal, ...vals);
      return isFinite(y) ? y : NaN;
    } catch (e) {
      return NaN;
    }
  }

  function drawEmbeddedLabCanvas(canvas, snap, yawRef) {
    if (!canvas || !snap) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#060B19';
    ctx.fillRect(0, 0, w, h);

    const exprs = Array.isArray(snap.exprs) && snap.exprs.length ? snap.exprs : [{ expr: 'x^3 - 3*x', color: '#38BDF8' }];
    const params = snap.params || {};
    const is3D = Boolean(snap.solid3D || snap.mode === 'solid3d');

    if (is3D) {
      // Interactive 3D Surface of Revolution wireframe preview
      const yaw = yawRef.yaw || 0.55;
      const pitch = yawRef.pitch || 0.32;
      const cx = w * 0.5, cy = h * 0.52, scale = Math.min(w, h) * 0.14;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw), cosP = Math.cos(pitch), sinP = Math.sin(pitch);
      function proj(x, y, z) {
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y2 = y * cosP - z1 * sinP;
        const z2 = y * sinP + z1 * cosP;
        const p = 6 / (6 + z2 * 0.28);
        return [cx + x1 * scale * p, cy - y2 * scale * p];
      }
      const ex = exprs[0].expr;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1.1;
      for (let xi = -2.2; xi <= 2.2; xi += 0.28) {
        const r = Math.min(2.6, Math.abs(evalEmbedExpr(ex, xi, params)) || 0.1);
        if (!isFinite(r)) continue;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.25; a += 0.35) {
          const p = proj(xi, Math.cos(a) * r, Math.sin(a) * r);
          if (a === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#FDE68A';
      ctx.font = '600 11.5px "JetBrains Mono", monospace';
      ctx.fillText('Kéo chuột / chạm để xoay khối tròn xoay 3D', 12, h - 12);
      return;
    }

    // 2D Coordinate Grid & Function Curves
    const v = snap.view || { xMin: -5, xMax: 5, yMin: -4, yMax: 4 };
    const xMin = Number(v.xMin) || -5, xMax = Number(v.xMax) || 5;
    const yMin = Number(v.yMin) || -4, yMax = Number(v.yMax) || 4;
    const toPx = function (x) { return ((x - xMin) / (xMax - xMin)) * w; };
    const toPy = function (y) { return h - ((y - yMin) / (yMax - yMin)) * h; };

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(xMin); gx <= Math.floor(xMax); gx++) {
      const px = toPx(gx);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
    }
    for (let gy = Math.ceil(yMin); gy <= Math.floor(yMax); gy++) {
      const py = toPy(gy);
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 1.4;
    const ox = toPx(0), oy = toPy(0);
    if (oy >= 0 && oy <= h) { ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke(); }
    if (ox >= 0 && ox <= w) { ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke(); }

    // Curves
    exprs.forEach(function (item, idx) {
      if (item.visible === false || !item.expr) return;
      ctx.strokeStyle = item.color || ['#38BDF8', '#FBBF24', '#34D399', '#A78BFA'][idx % 4];
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      let started = false;
      for (let px = 0; px <= w; px += 2) {
        const xv = xMin + (px / w) * (xMax - xMin);
        const yv = evalEmbedExpr(item.expr, xv, params);
        const py = toPy(yv);
        if (!isFinite(yv) || py < -h || py > h * 2) { started = false; continue; }
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
  }

  function initAllEmbeddedLabCanvases() {
    const r = state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
    if (!r) return;
    document.querySelectorAll('#vtResDrawerBody [data-embed-lab-idx]').forEach(function (wrap) {
      const idx = Number(wrap.getAttribute('data-embed-lab-idx'));
      const blk = r.blocks && r.blocks[idx];
      if (!blk || !blk.snapshot) return;
      const liveSnap = JSON.parse(JSON.stringify(blk.snapshot));
      const canvas = wrap.querySelector('.vt-embed-lab-canvas');
      const yawRef = { yaw: 0.55, pitch: 0.32, dragging: false, sx: 0, sy: 0 };

      drawEmbeddedLabCanvas(canvas, liveSnap, yawRef);

      if (canvas && !canvas._vtBound) {
        canvas._vtBound = true;
        canvas.addEventListener('pointerdown', function (e) {
          yawRef.dragging = true; yawRef.sx = e.clientX; yawRef.sy = e.clientY;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        });
        canvas.addEventListener('pointermove', function (e) {
          if (!yawRef.dragging) return;
          yawRef.yaw += (e.clientX - yawRef.sx) * 0.012;
          yawRef.pitch = Math.max(-1.2, Math.min(1.2, yawRef.pitch + (e.clientY - yawRef.sy) * 0.012));
          yawRef.sx = e.clientX; yawRef.sy = e.clientY;
          drawEmbeddedLabCanvas(canvas, liveSnap, yawRef);
        });
        const stopDrag = function (e) { yawRef.dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (err) {} };
        canvas.addEventListener('pointerup', stopDrag);
        canvas.addEventListener('pointercancel', stopDrag);
      }

      wrap.querySelectorAll('[data-embed-param]').forEach(function (slider) {
        const pKey = slider.getAttribute('data-embed-param');
        const valEl = wrap.querySelector('[data-embed-param-val="' + pKey + '"]');
        slider.addEventListener('input', function () {
          liveSnap.params = liveSnap.params || {};
          liveSnap.params[pKey] = Number(slider.value);
          if (valEl) valEl.textContent = Number(slider.value).toFixed(1);
          drawEmbeddedLabCanvas(canvas, liveSnap, yawRef);
        });
      });

      const openLabBtn = wrap.querySelector('[data-load-snap]');
      if (openLabBtn) {
        openLabBtn.addEventListener('click', function () {
          if (typeof window.VANTHESIS_LOAD_LAB_SNAPSHOT === 'function') {
            closeDrawer();
            window.VANTHESIS_LOAD_LAB_SNAPSHOT(liveSnap);
          }
        });
      }
    });
  }

  function renderDrawerContent() {
    const r = state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
    if (!r) return;
    document.getElementById('vtResDrawerTitle').textContent = r.title;
    const bodyEl = document.getElementById('vtResDrawerBody');

    const assignedClasses = state.assignments
      .filter(function (a) { return a.resourceId === r.resourceId; })
      .map(function (a) {
        const c = state.classes.find(function (cl) { return cl.classId === a.classId; });
        return c ? ('Lớp ' + c.className) : a.classId;
      });

    const blocksHtml = (r.blocks || []).map(function (blk, idx) {
      if (blk.type === 'drive_embed' && blk.previewUrl) {
        return '<div class="lcms-glass-tile"><div style="font-weight:700;font-size:13.5px;">📎 ' + escapeHtml(blk.name || 'Tài liệu gốc Google Drive') + '</div><iframe class="vt-drive-preview-frame" src="' + escapeAttr(blk.previewUrl) + '" allow="autoplay"></iframe></div>';
      }
      if (blk.type === 'lab_snapshot' && blk.snapshot) {
        const snap = blk.snapshot;
        const paramKeys = Object.keys(snap.params || {});
        const slidersHtml = paramKeys.map(function (pk) {
          const val = Number(snap.params[pk]);
          const curVal = isFinite(val) ? val : 1;
          return '<div class="vt-embed-slider-row"><span>Tham số ' + escapeHtml(pk) + ' = <b data-embed-param-val="' + escapeAttr(pk) + '">' + curVal.toFixed(1) + '</b></span><input type="range" min="-5" max="5" step="0.1" value="' + curVal + '" data-embed-param="' + escapeAttr(pk) + '"></div>';
        }).join('');
        const exprLabels = (snap.exprs || []).map(function (e) { return 'y = ' + e.expr; }).join('  |  ');
        return '<div class="vt-embed-lab-card" data-embed-lab-idx="' + idx + '">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
            '<div style="font-weight:700;font-size:13.5px;">∫ ' + escapeHtml(blk.title || 'Mô phỏng Đồ thị 2D/3D Trực tiếp') + '</div>' +
            '<span style="font-family:var(--font-mono);font-size:11.5px;color:var(--primary);">' + escapeHtml(exprLabels) + '</span>' +
          '</div>' +
          '<canvas class="vt-embed-lab-canvas" aria-label="Đồ thị tương tác nhúng trong bài giảng"></canvas>' +
          slidersHtml +
          '<button class="btn btn-primary btn-sm" type="button" data-load-snap="' + idx + '" style="align-self:flex-start;">∫ Mở rộng trong Phòng Thí nghiệm →</button>' +
        '</div>';
      }
      if (blk.style === 'theorem') {
        return '<div class="vt-theorem-box"><div class="vt-theorem-kicker">✦ ' + escapeHtml(blk.title || 'Định lý & Tính chất') + '</div><div>' + renderMathInText(blk.text || '') + '</div></div>';
      }
      if (blk.style === 'method') {
        return '<div class="vt-method-box"><div class="vt-method-kicker">🧭 ' + escapeHtml(blk.title || 'Phương pháp giải từng bước') + '</div><div>' + renderMathInText(blk.text || '') + '</div></div>';
      }
      return '<div class="lcms-glass-tile" style="line-height:1.72;font-size:14.5px;">' +
        (blk.title ? '<div style="font-weight:700;font-size:15px;margin-bottom:4px;">' + escapeHtml(blk.title) + '</div>' : '') +
        '<div>' + renderMathInText(blk.text || '') + '</div></div>';
    }).join('') || '<div class="lcms-glass-tile" style="color:var(--text-muted);">' + renderMathInText(r.summary || 'Chưa có nội dung chi tiết.') + '</div>';

    const comments = state.commentsByResource[r.resourceId] || [];
    const commentsHtml = comments.map(function (cm) {
      return '<div style="padding:10px 12px;border-radius:12px;background:var(--surface-alt);border:1px solid var(--border);"><div style="font-size:11.5px;color:var(--text-soft);margin-bottom:4px;"><b>' + escapeHtml(cm.authorName) + '</b> • ' + escapeHtml(String(cm.createdAt || '').replace('T', ' ').slice(0, 16)) + '</div><div style="font-size:13.5px;line-height:1.6;">' + renderMathInText(cm.contentLatex) + '</div></div>';
    }).join('') || '<div style="font-size:12.5px;color:var(--text-soft);">Chưa có câu hỏi thảo luận nào cho bài giảng này.</div>';

    const quickSyms = [
      { lbl: 'x²', ins: '$x^2$' },
      { lbl: '√x', ins: '$\sqrt{x}$' },
      { lbl: 'a/b', ins: '$\frac{a}{b}$' },
      { lbl: "f'(x)", ins: "$f\x27(x) = 0$" },
      { lbl: '∫', ins: '$\int_a^b f(x)\,dx$' },
      { lbl: 'Δ', ins: '$\Delta$' },
      { lbl: '∞', ins: '$\\infty$' },
      { lbl: 'π', ins: '$\pi$' },
      { lbl: '≤', ins: '$\le$' },
      { lbl: '≥', ins: '$\ge$' }
    ];
    const quickBarHtml = '<div class="vt-math-quickbar">' + quickSyms.map(function (s) {
      return '<button type="button" class="vt-math-sym-btn" data-ins-sym="' + escapeAttr(s.ins) + '">' + escapeHtml(s.lbl) + '</button>';
    }).join('') + '</div>';

    const progBtns = isStudent()
      ? '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button id="vtBtnMarkDone" class="btn btn-primary btn-sm" type="button">✓ Đánh dấu Hoàn thành (+10★)</button><button id="vtBtnMarkMaster" class="btn btn-sm" type="button">★ Đạt mức Tinh thông (+25★)</button></div>'
      : '';

    bodyEl.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<span class="vt-res-pill">' + escapeHtml(r.gradeBlock) + '</span>' +
        '<span class="vt-res-pill">' + escapeHtml(r.chapterConstellation) + '</span>' +
        '<span class="vt-res-pill">' + escapeHtml(COGNITIVE_LABELS[r.cognitiveLevel] || r.cognitiveLevel) + '</span>' +
        (assignedClasses.length ? '<span class="vt-res-pill class">Đã giao: ' + escapeHtml(assignedClasses.join(', ')) + '</span>' : '') +
      '</div>' +
      progBtns +
      blocksHtml +
      '<div style="margin-top:8px;padding-top:14px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px;">' +
        '<div style="font-weight:700;font-size:14.5px;">💬 Hỏi – Đáp Công thức Toán học</div>' +
        commentsHtml +
        quickBarHtml +
        '<form id="vtResCommentForm" style="display:flex;gap:8px;">' +
          '<input id="vtResCommentInput" type="text" placeholder="Nhập câu hỏi hoặc lời giải (hỗ trợ $...)..." style="flex:1;padding:9px 12px;border-radius:12px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);">' +
          '<button class="btn btn-primary btn-sm" type="submit">Gửi</button>' +
        '</form>' +
      '</div>';

    initAllEmbeddedLabCanvases();

    bodyEl.querySelectorAll('[data-ins-sym]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const inp = document.getElementById('vtResCommentInput');
        if (!inp) return;
        const sym = btn.getAttribute('data-ins-sym') || '';
        const start = inp.selectionStart || inp.value.length;
        inp.value = inp.value.slice(0, start) + sym + inp.value.slice(start);
        inp.focus();
      });
    });

    const btnDone = document.getElementById('vtBtnMarkDone');
    if (btnDone) btnDone.addEventListener('click', function () { markProgress(r.resourceId, 'COMPLETED'); });
    const btnMaster = document.getElementById('vtBtnMarkMaster');
    if (btnMaster) btnMaster.addEventListener('click', function () { markProgress(r.resourceId, 'MASTERED'); });

    const cForm = document.getElementById('vtResCommentForm');
    if (cForm) {
      cForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const inp = document.getElementById('vtResCommentInput');
        const val = inp.value.trim();
        if (!val) return;
        const res = await callApi('resources_comment_upsert', { resourceId: r.resourceId, contentLatex: val });
        if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
        inp.value = '';
        showNotice('✓ Đã gửi câu hỏi thảo luận.');
        await fetchHubFromServer(true);
      });
    }
  }

  async function markProgress(resourceId, status) {
    const res = await callApi('resources_mark_progress', { resourceId: resourceId, status: status });
    if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
    showNotice(status === 'MASTERED' ? '★ Xuất sắc! Đã cộng +25 Bụi Sao.' : '✓ Đã hoàn thành bài học (+10 Bụi Sao).');
    await fetchHubFromServer(true);
  }

  /* ==========================================================================
   * 9. RESOURCE EDITOR, DRIVE UPLOAD & BULK ASSIGN
   * ========================================================================== */

  function openEditor(existingRes, initialLabSnapshot) {
    state.editingResource = existingRes || null;
    state.editorBlocks = existingRes && Array.isArray(existingRes.blocks)
      ? JSON.parse(JSON.stringify(existingRes.blocks))
      : [];
    if (initialLabSnapshot) {
      state.editorBlocks.push({
        type: 'lab_snapshot',
        title: 'Mô phỏng Đồ thị 2D/3D từ Phòng Thí nghiệm',
        snapshot: JSON.parse(JSON.stringify(initialLabSnapshot))
      });
    }
    if (state.editorBlocks.length === 0) {
      state.editorBlocks.push({ type: 'markdown', style: 'plain', title: 'Lý thuyết trọng tâm', text: '' });
    }

    document.getElementById('vtResEditorHeading').textContent = existingRes
      ? 'Chỉnh sửa Bài giảng Đa khối'
      : (initialLabSnapshot ? 'Đóng gói Mô phỏng 2D/3D thành Bài giảng' : 'Biên soạn Bài giảng Đa khối');
    document.getElementById('vtEdTitle').value = existingRes ? existingRes.title : '';
    document.getElementById('vtEdGrade').value = existingRes ? existingRes.gradeBlock : 'Khối 12';
    document.getElementById('vtEdSubject').value = existingRes ? existingRes.subject : 'Toán học';
    document.getElementById('vtEdChapter').value = existingRes ? existingRes.chapterConstellation : '';
    document.getElementById('vtEdPattern').value = existingRes ? existingRes.topicPattern : '';
    document.getElementById('vtEdCognitive').value = existingRes ? existingRes.cognitiveLevel : 'THONG_HIEU';
    document.getElementById('vtEdType').value = existingRes ? existingRes.resourceType : (initialLabSnapshot ? 'LAB' : 'LESSON');
    document.getElementById('vtEdScope').value = existingRes ? (existingRes.publishScope === 'PENDING_SCHOOL' ? 'SCHOOL' : existingRes.publishScope) : 'CLASS_ONLY';
    document.getElementById('vtEdOrder').value = existingRes ? String(existingRes.starOrder || 1) : '1';
    document.getElementById('vtEdSummary').value = existingRes ? existingRes.summary : '';

    const assignedSet = {};
    if (existingRes) {
      state.assignments.forEach(function (a) {
        if (a.resourceId === existingRes.resourceId) assignedSet[a.classId] = true;
      });
    }
    const checksEl = document.getElementById('vtEdClassChecks');
    checksEl.innerHTML = state.classes.length
      ? state.classes.map(function (c) {
          return '<label class="vt-res-pill" style="cursor:pointer;"><input type="checkbox" class="vt-ed-cls-cb" value="' + escapeAttr(c.classId) + '" ' + (assignedSet[c.classId] ? 'checked' : '') + '> Lớp ' + escapeHtml(c.className) + '</label>';
        }).join('')
      : '<span style="font-size:12px;color:var(--text-soft);">Chưa có lớp nào trong phạm vi phân công.</span>';

    renderEditorBlockBuilder();
    document.getElementById('vtResEditorBackdrop').classList.add('open');
  }

  function closeEditor() {
    document.getElementById('vtResEditorBackdrop').classList.remove('open');
  }

  function renderEditorBlockBuilder() {
    const listEl = document.getElementById('vtEdBlockBuilderList');
    if (!listEl) return;
    if (!state.editorBlocks.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:16px;font-size:12.5px;color:var(--text-soft);">Chưa có khối nội dung nào. Hãy bấm các nút phía trên để thêm khối.</div>';
      return;
    }

    listEl.innerHTML = state.editorBlocks.map(function (blk, idx) {
      const badgeLabel = blk.type === 'drive_embed'
        ? '📎 Tệp Google Drive'
        : (blk.type === 'lab_snapshot'
          ? '∫ Khối Đồ thị 2D/3D Nhúng'
          : (blk.style === 'theorem' ? '✦ Khung Định lý vàng kim' : (blk.style === 'method' ? '🧭 Hộp Phương pháp giải' : '📘 Khối Lý thuyết')));

      let innerFields = '';
      if (blk.type === 'drive_embed') {
        innerFields = '<div style="font-size:12.5px;color:var(--text-muted);">Tệp đính kèm: <b>' + escapeHtml(blk.name || 'Tài liệu') + '</b></div>';
      } else if (blk.type === 'lab_snapshot') {
        const snap = blk.snapshot || { exprs: [{ expr: 'x^3 - 3*m*x' }], params: { m: 1 }, mode: 'standard' };
        const exprVal = (snap.exprs && snap.exprs[0] && snap.exprs[0].expr) || '';
        const mVal = snap.params && snap.params.m !== undefined ? snap.params.m : 1;
        innerFields = '<div class="vt-res-form-grid" style="margin:0;">' +
          '<div class="vt-res-field"><label>Hàm số f(x)</label><input type="text" data-blk-lab-expr="' + idx + '" value="' + escapeAttr(exprVal) + '"></div>' +
          '<div class="vt-res-field"><label>Chế độ &amp; Tham số m</label><div style="display:flex;gap:6px;"><select data-blk-lab-mode="' + idx + '" style="flex:1;"><option value="standard" ' + (snap.mode !== 'solid3d' ? 'selected' : '') + '>Đồ thị 2D</option><option value="solid3d" ' + (snap.mode === 'solid3d' || snap.solid3D ? 'selected' : '') + '>Khối tròn xoay 3D</option></select><input type="number" step="0.5" data-blk-lab-m="' + idx + '" value="' + escapeAttr(mVal) + '" style="width:74px;"></div></div>' +
        '</div>';
      } else {
        innerFields = '<input type="text" data-blk-title="' + idx + '" value="' + escapeAttr(blk.title || '') + '" placeholder="Tiêu đề khối..." style="padding:7px 10px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12.5px;font-weight:700;">' +
          '<textarea rows="3" data-blk-text="' + idx + '" placeholder="Nhập nội dung (hỗ trợ $f\x27(x)=0$ hoặc $$...$$)..." style="padding:8px 10px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12.8px;">' + escapeHtml(blk.text || '') + '</textarea>';
      }

      return '<div class="vt-block-item">' +
        '<div class="vt-block-item-head">' +
          '<span>' + (idx + 1) + '. ' + badgeLabel + '</span>' +
          '<div style="display:flex;gap:4px;">' +
            '<button type="button" class="btn btn-sm" data-blk-up="' + idx + '" ' + (idx === 0 ? 'disabled' : '') + '>↑</button>' +
            '<button type="button" class="btn btn-sm" data-blk-down="' + idx + '" ' + (idx === state.editorBlocks.length - 1 ? 'disabled' : '') + '>↓</button>' +
            '<button type="button" class="btn btn-sm" data-blk-del="' + idx + '" style="color:var(--danger);">✕</button>' +
          '</div>' +
        '</div>' +
        innerFields +
      '</div>';
    }).join('');

    listEl.querySelectorAll('[data-blk-title]').forEach(function (inp) {
      inp.addEventListener('input', function () { state.editorBlocks[Number(inp.getAttribute('data-blk-title'))].title = inp.value; });
    });
    listEl.querySelectorAll('[data-blk-text]').forEach(function (ta) {
      ta.addEventListener('input', function () { state.editorBlocks[Number(ta.getAttribute('data-blk-text'))].text = ta.value; });
    });
    listEl.querySelectorAll('[data-blk-lab-expr]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const b = state.editorBlocks[Number(inp.getAttribute('data-blk-lab-expr'))];
        if (!b.snapshot) b.snapshot = { exprs: [{ expr: '', color: '#38BDF8', visible: true }], params: { m: 1 }, mode: 'standard' };
        if (!b.snapshot.exprs || !b.snapshot.exprs.length) b.snapshot.exprs = [{ expr: '', color: '#38BDF8', visible: true }];
        b.snapshot.exprs[0].expr = inp.value;
      });
    });
    listEl.querySelectorAll('[data-blk-lab-mode]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        const b = state.editorBlocks[Number(sel.getAttribute('data-blk-lab-mode'))];
        if (b && b.snapshot) { b.snapshot.mode = sel.value; b.snapshot.solid3D = sel.value === 'solid3d'; }
      });
    });
    listEl.querySelectorAll('[data-blk-lab-m]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const b = state.editorBlocks[Number(inp.getAttribute('data-blk-lab-m'))];
        if (b && b.snapshot) { b.snapshot.params = b.snapshot.params || {}; b.snapshot.params.m = Number(inp.value) || 0; }
      });
    });
    listEl.querySelectorAll('[data-blk-up]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.getAttribute('data-blk-up'));
        if (i > 0) { const tmp = state.editorBlocks[i - 1]; state.editorBlocks[i - 1] = state.editorBlocks[i]; state.editorBlocks[i] = tmp; renderEditorBlockBuilder(); }
      });
    });
    listEl.querySelectorAll('[data-blk-down]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.getAttribute('data-blk-down'));
        if (i < state.editorBlocks.length - 1) { const tmp = state.editorBlocks[i + 1]; state.editorBlocks[i + 1] = state.editorBlocks[i]; state.editorBlocks[i] = tmp; renderEditorBlockBuilder(); }
      });
    });
    listEl.querySelectorAll('[data-blk-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.editorBlocks.splice(Number(btn.getAttribute('data-blk-del')), 1);
        renderEditorBlockBuilder();
      });
    });
  }

  async function handleDriveFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    showNotice('⬆ Đang tải tệp lên Google Drive...');
    try {
      const uploaded = await uploadFileToDrive(file);
      state.editorBlocks.push({
        type: 'drive_embed',
        fileId: uploaded.fileId,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        previewUrl: uploaded.previewUrl
      });
      renderEditorBlockBuilder();
      showNotice('✓ Đã thêm khối tệp ' + uploaded.name + '.');
    } catch (err) {
      showNotice('⚠ ' + formatFriendlyError(err.message), true);
    }
    e.target.value = '';
  }

  async function handleEditorSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('vtEdTitle').value.trim();
    if (!title) { showNotice('⚠ Vui lòng nhập tiêu đề học liệu.', true); return; }

    const assignedClassIds = [];
    document.querySelectorAll('.vt-ed-cls-cb:checked').forEach(function (cb) { assignedClassIds.push(cb.value); });

    const payload = {
      resourceId: state.editingResource ? state.editingResource.resourceId : '',
      title: title,
      gradeBlock: document.getElementById('vtEdGrade').value,
      subject: document.getElementById('vtEdSubject').value.trim() || 'Toán học',
      chapterConstellation: document.getElementById('vtEdChapter').value.trim() || 'Chòm sao Chung',
      topicPattern: document.getElementById('vtEdPattern').value.trim(),
      cognitiveLevel: document.getElementById('vtEdCognitive').value,
      resourceType: document.getElementById('vtEdType').value,
      publishScope: document.getElementById('vtEdScope').value,
      starOrder: Number(document.getElementById('vtEdOrder').value) || 1,
      summary: document.getElementById('vtEdSummary').value.trim(),
      blocks: state.editorBlocks.slice(),
      assignedClassIds: assignedClassIds
    };

    const btn = document.getElementById('vtResEditorSubmit');
    btn.disabled = true;
    const res = await callApi('resources_upsert', { payload: payload });
    btn.disabled = false;
    if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }

    closeEditor();
    showNotice(res.downgradedToPending
      ? '✓ Đã lưu bài giảng và gửi vào Hàng đợi Duyệt Xuất bản Toàn trường.'
      : '✓ Đã lưu bài giảng đa khối thành công.');
    await fetchHubFromServer(true);
  }

  function openBulkAssignModal() {
    const el = document.getElementById('vtResBulkClassChecks');
    el.innerHTML = state.classes.map(function (c) {
      return '<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer;"><input type="checkbox" class="vt-bulk-cls-cb" value="' + escapeAttr(c.classId) + '"> Lớp ' + escapeHtml(c.className) + ' (' + escapeHtml(c.gradeBlock) + ')</label>';
    }).join('');
    document.getElementById('vtResBulkBackdrop').classList.add('open');
  }

  async function handleBulkAssignConfirm() {
    const rIds = Object.keys(state.selectedBulkIds).filter(function (k) { return state.selectedBulkIds[k]; });
    const cIds = [];
    document.querySelectorAll('.vt-bulk-cls-cb:checked').forEach(function (cb) { cIds.push(cb.value); });
    if (!rIds.length || !cIds.length) { showNotice('⚠ Vui lòng chọn ít nhất một lớp.', true); return; }
    const res = await callApi('resources_bulk_manage', { operation: 'ASSIGN', resourceIds: rIds, classIds: cIds });
    if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
    document.getElementById('vtResBulkBackdrop').classList.remove('open');
    state.selectedBulkIds = {};
    showNotice('✓ Đã giao ' + rIds.length + ' học liệu tới ' + cIds.length + ' lớp.');
    await fetchHubFromServer(true);
  }


  /* ==========================================================================
   * 9B. CHẶNG IV — SECTOR 3: ĐẤU TRƯỜNG ĐỀ & TINH THÔNG (#vtExamsMount)
   *     4 Conquest Modes, SHA-256 Anti-Leak Verify, Interactive Graph Slider Q,
   *     Trap Diagnostics, Parameterized Twin Problems, 1s IndexedDB Auto-Draft,
   *     StarDust Lab Skins, Class Co-op Bar & Teacher Error Heatmap.
   * ========================================================================== */

  const LAB_SKINS = [
    { id: 'default', name: 'Chuẩn Học thuật', cost: 0, desc: 'Bảng vẽ mặc định sắc nét.' },
    { id: 'chalkboard', name: 'Bảng Phấn Cổ điển', cost: 20, desc: 'Tông bảng xanh phấn trắng dịu mắt.' },
    { id: 'blueprint', name: 'Bản vẽ Xanh Kỹ thuật', cost: 45, desc: 'Phong cách bản vẽ kỹ sư cổ điển.' },
    { id: 'observatory_gold', name: 'Đài Thiên văn Vàng kim', cost: 80, desc: 'Ánh vàng cổ điển của Đài Thiên văn.' }
  ];

  const EXAM_MODES_META = [
    { id: 'QUICK_DISCOVERY', icon: '⚡', name: 'Khám phá Nhanh (5p)', desc: '5 thẻ trực quan nắm bản chất hình học.' },
    { id: 'COMBO_ARENA', icon: '🔥', name: 'Đấu trường Combo', desc: 'Đúng liên tiếp nhân x2, x3, x5 Bụi Sao.' },
    { id: 'BOSS_BATTLE', icon: '👑', name: 'Đánh Trùm Chòm sao', desc: 'Bài toán tổng hợp mở khóa ngôi sao trung tâm.' },
    { id: 'NATIONAL_EXAM', icon: '🏛️', name: 'Phòng Thi Chuẩn QG', desc: 'Đồng hồ đếm ngược, chấm 100% máy chủ, tự lưu mỗi 1s.' }
  ];

  async function clientSha256Hex(str) {
    if (window.crypto && window.crypto.subtle) {
      const buf = new TextEncoder().encode(String(str));
      const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hashBuf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    return '';
  }

  async function saveExamDraftIdb(examId, draftObj) {
    const db = await openHubDb();
    if (!db || !db.objectStoreNames.contains('exam_drafts')) return;
    try {
      const tx = db.transaction('exam_drafts', 'readwrite');
      tx.objectStore('exam_drafts').put({ key: 'draft_' + examId, draft: draftObj, savedAt: Date.now() });
    } catch (e) {}
  }

  async function readExamDraftIdb(examId) {
    const db = await openHubDb();
    if (!db || !db.objectStoreNames.contains('exam_drafts')) return null;
    return new Promise(function (resolve) {
      try {
        const tx = db.transaction('exam_drafts', 'readonly');
        const req = tx.objectStore('exam_drafts').get('draft_' + examId);
        req.onsuccess = function () { resolve(req.result ? req.result.draft : null); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  // Algebraic Parameterized Twin Problem Generator (anti-guessing loop)
  function generateTwinProblem(q) {
    const a = 1 + Math.floor(Math.random() * 3); // 1..3
    const b = 1 + Math.floor(Math.random() * 4); // 1..4
    const correctAns = 2 * a * b;
    return {
      prompt: 'Bài tập Sinh đôi (Tính lại với bộ số mới): Tìm giá trị của $f\x27(' + b + ')$ với hàm số $f(x) = ' + a + 'x^2 + ' + b + '$.',
      correctNumeric: correctAns,
      hint: 'Áp dụng công thức $(ax^2 + b)\x27 = 2ax$, thay $x = ' + b + '$.'
    };
  }

  function applyLabSkin(skinId) {
    state.activeLabSkin = skinId || 'default';
    if (state.activeLabSkin === 'default') document.documentElement.removeAttribute('data-lab-skin');
    else document.documentElement.setAttribute('data-lab-skin', state.activeLabSkin);
    try { localStorage.setItem('vt_lab_skin_v6', state.activeLabSkin); } catch (e) {}
  }
  applyLabSkin(state.activeLabSkin);

  async function fetchExamsHub() {
    if (!getSession()) return;
    const res = await callApi('exams_get_hub');
    if (res && res.ok) {
      state.exams = Array.isArray(res.exams) ? res.exams : [];
      state.myExamSubmissions = Array.isArray(res.mySubmissions) ? res.mySubmissions : [];
      state.errorHeatmapByExam = res.errorHeatmapByExam || {};
      state.classCoopStarDust = Number(res.classCoopStarDust) || 0;
    }
    renderExamsSector();
  }

  let examTimerInterval = null;
  let examDraftInterval = null;
  let qOpenedAtMs = Date.now();

  function stopExamTimers() {
    if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
    if (examDraftInterval) { clearInterval(examDraftInterval); examDraftInterval = null; }
  }

  async function startExamSession(examId, mode) {
    showNotice('✦ Đang khởi tạo phiên làm bài bảo mật...');
    const res = await callApi('exam_get_session', { examId: examId, mode: mode });
    if (!res || !res.ok) {
      showNotice('⚠ ' + formatFriendlyError(res && res.error), true);
      return;
    }
    const savedDraft = mode === 'NATIONAL_EXAM' ? await readExamDraftIdb(examId) : null;
    state.activeExamResult = null;
    state.activeExamSession = {
      exam: res.exam,
      mode: mode,
      sessionSalt: res.sessionSalt || '',
      serverGradedOnly: Boolean(res.serverGradedOnly),
      startedAt: res.startedAt,
      endTimeMs: Date.now() + (Number(res.exam.durationMin) || 15) * 60000,
      questions: res.questions || [],
      answers: (savedDraft && savedDraft.answers) ? savedDraft.answers : {},
      timingSecByQ: {},
      currentIdx: 0,
      combo: 0,
      maxCombo: 0,
      feedbackHtml: '',
      twinActive: null
    };
    qOpenedAtMs = Date.now();
    stopExamTimers();

    // Auto-save draft every 1 second into IndexedDB for NATIONAL_EXAM
    if (mode === 'NATIONAL_EXAM') {
      examDraftInterval = setInterval(function () {
        if (state.activeExamSession) {
          saveExamDraftIdb(examId, { answers: state.activeExamSession.answers });
        }
      }, 1000);
      examTimerInterval = setInterval(function () {
        const el = document.getElementById('vtExamCountdown');
        if (!el || !state.activeExamSession) return;
        const leftSec = Math.max(0, Math.floor((state.activeExamSession.endTimeMs - Date.now()) / 1000));
        const mm = String(Math.floor(leftSec / 60)).padStart(2, '0');
        const ss = String(leftSec % 60).padStart(2, '0');
        el.textContent = '⏱ ' + mm + ':' + ss;
        if (leftSec === 0) submitActiveExam();
      }, 1000);
    }
    renderExamsSector();
  }

  async function submitActiveExam() {
    const ses = state.activeExamSession;
    if (!ses) return;
    stopExamTimers();
    showNotice('📤 Đang chấm điểm và đồng bộ Hồ sơ 360°...');
    const res = await callApi('exam_submit_result', {
      examId: ses.exam.examId,
      mode: ses.mode,
      answers: ses.answers,
      timingSecByQ: ses.timingSecByQ,
      maxCombo: ses.maxCombo,
      startedAt: ses.startedAt
    });
    if (!res || !res.ok) {
      showNotice('⚠ ' + formatFriendlyError(res && res.error), true);
      return;
    }
    state.activeExamResult = res;
    state.activeExamSession = null;
    showNotice('🏆 Hoàn thành! ' + res.score + '/' + res.maxScore + ' điểm • ' + res.masteryTier + ' (+' + res.starDustEarned + '★)');
    await fetchExamsHub();
    await fetchHubFromServer(true);
  }

  async function createStarterSampleExam() {
    const clsIds = state.classes.map(function (c) { return c.classId; });
    const res = await callApi("exams_upsert", {
      payload: {
        title: "Chinh phục Cực trị & Đồ thị Hàm số",
        subject: "Toán học",
        gradeBlock: "Khối 12",
        chapterConstellation: "Chòm sao Ứng dụng Đạo hàm",
        durationMin: 15,
        publishScope: isAdmin() ? "SCHOOL" : "CLASS_ONLY",
        assignedClassIds: clsIds,
        questions: [
          {
            id: "Q1", type: "MCQ", points: 2,
            prompt: "Hàm số $y = x^3 - 3x + 1$ đạt cực đại tại điểm nào?",
            options: ["A. $x = -1$", "B. $x = 1$", "C. $x = 0$", "D. $x = 3$"],
            correctAnswer: "A",
            trapReasons: {
              B: "Bẫy ngược dấu: Tại $x = 1$, $y\x27\x27(1) = 6 > 0$ nên đây là điểm cực tiểu, không phải cực đại.",
              C: "Tại $x = 0$, $y\x27(0) = -3 \\ne 0$ nên không phải điểm cực trị."
            },
            solution: "$y\x27 = 3x^2 - 3 = 0 \\Leftrightarrow x = \\pm 1$. Vì $y\x27\x27(-1) = -6 < 0$ nên $x = -1$ là điểm cực đại."
          },
          {
            id: "Q2", type: "GRAPH_SLIDER", points: 3,
            prompt: "Kéo thanh trượt tham số $m$ trên đồ thị để hàm số $y = x^3 - 3mx$ có đúng 2 điểm cực trị tại $x = \\pm 1$.",
            correctAnswer: 1,
            graphConfig: { expr: "x^3 - 3*m*x", min: -3, max: 3, step: 0.1, tolerance: 0.25 },
            solution: "$y\x27 = 3x^2 - 3m = 0 \\Leftrightarrow x^2 = m$. Để cực trị tại $x = \\pm 1$ thì $m = 1$."
          },
          {
            id: "Q3", type: "TRUE_FALSE", points: 3,
            prompt: "Xét hàm số $y = x^2 - 4x + 3$. Chọn Đúng hoặc Sai cho từng mệnh đề:",
            subItems: [
              { key: "a", text: "a) Đạo hàm của hàm số là $y\x27 = 2x - 4$." },
              { key: "b", text: "b) Hàm số đồng biến trên khoảng $(-\\infty; 2)$." },
              { key: "c", text: "c) Giá trị nhỏ nhất của hàm số bằng $-1$." },
              { key: "d", text: "d) Đồ thị cắt trục hoành tại 2 điểm phân biệt." }
            ],
            correctAnswer: { a: true, b: false, c: true, d: true },
            solution: "Đỉnh parabol là $(2; -1)$, hàm nghịch biến trên $(-\\infty; 2)$ và đồng biến trên $(2; +\\infty)$."
          },
          {
            id: "Q4", type: "SHORT_ANSWER", points: 2,
            prompt: "Tính giá trị cực tiểu của hàm số $y = x^2 - 6x + 10$. (Nhập số nguyên)",
            correctAnswer: "1",
            solution: "$y\x27 = 2x - 6 = 0 \\Leftrightarrow x = 3 \\Rightarrow y(3) = 9 - 18 + 10 = 1$."
          }
        ]
      }
    });
    if (!res || !res.ok) { showNotice("⚠ " + formatFriendlyError(res && res.error), true); return; }
    showNotice("✓ Đã tạo bộ đề mẫu đầy đủ 4 dạng câu hỏi (kèm Đồ thị tương tác).");
    await fetchExamsHub();
  }

  function renderExamsSector() {
    const mount = document.getElementById('vtExamsMount');
    if (!mount) return;

    // A. Active Exam Player View
    if (state.activeExamSession) {
      const ses = state.activeExamSession;
      const q = ses.questions[ses.currentIdx];
      if (!q) return;
      const comboMult = ses.combo >= 5 ? 5 : (ses.combo >= 3 ? 3 : (ses.combo >= 2 ? 2 : 1));
      const curAns = ses.answers[q.id];

      let inputUi = '';
      if (q.type === 'GRAPH_SLIDER') {
        const gc = q.graphConfig || { expr: 'x^3 - 3*m*x', min: -3, max: 3, step: 0.1 };
        const val = curAns !== undefined ? Number(curAns) : 0;
        inputUi = '<div class="vt-embed-lab-card">' +
          '<canvas id="vtExamGraphCanvas" class="vt-embed-lab-canvas"></canvas>' +
          '<div class="vt-embed-slider-row"><span>Tham số m = <b id="vtExamSliderVal">' + val.toFixed(1) + '</b></span><input id="vtExamSliderInput" type="range" min="' + (gc.min || -3) + '" max="' + (gc.max || 3) + '" step="' + (gc.step || 0.1) + '" value="' + val + '"></div>' +
        '</div>';
      } else if (q.type === 'TRUE_FALSE') {
        const ansObj = (curAns && typeof curAns === 'object') ? curAns : {};
        inputUi = (q.subItems || []).map(function (sub) {
          const isT = ansObj[sub.key] === true;
          const isF = ansObj[sub.key] === false;
          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:var(--surface-alt);border:1px solid var(--border);flex-wrap:wrap;">' +
            '<div>' + renderMathInText(sub.text) + '</div>' +
            '<div style="display:flex;gap:6px;">' +
              '<button type="button" class="btn btn-sm ' + (isT ? 'btn-primary' : '') + '" data-tf-key="' + escapeAttr(sub.key) + '" data-tf-val="true">Đúng</button>' +
              '<button type="button" class="btn btn-sm ' + (isF ? 'btn-primary' : '') + '" data-tf-key="' + escapeAttr(sub.key) + '" data-tf-val="false">Sai</button>' +
            '</div>' +
          '</div>';
        }).join('');
      } else if (q.type === 'SHORT_ANSWER') {
        inputUi = '<input id="vtExamShortInp" type="text" value="' + escapeAttr(curAns || '') + '" placeholder="Nhập đáp số của bạn..." style="width:100%;max-width:320px;padding:11px 14px;border-radius:14px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);font-size:15px;font-weight:700;">';
      } else {
        inputUi = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' +
          (q.options || []).map(function (opt, oi) {
            const letter = ['A', 'B', 'C', 'D'][oi] || String(oi + 1);
            const active = String(curAns || '').toUpperCase() === letter;
            return '<button type="button" class="btn ' + (active ? 'btn-primary' : '') + '" data-mcq-pick="' + letter + '" style="justify-content:flex-start;padding:12px 14px;border-radius:14px;text-align:left;white-space:normal;">' + renderMathInText(opt) + '</button>';
          }).join('') +
        '</div>';
      }

      const twinHtml = ses.twinActive
        ? '<div class="vt-twin-box">' +
            '<div style="font-weight:800;color:#B45309;">🧬 Bài tập Sinh đôi (Chống khoanh bừa)</div>' +
            '<div>' + renderMathInText(ses.twinActive.prompt) + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);">Gợi ý: ' + renderMathInText(ses.twinActive.hint) + '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;"><input id="vtTwinAnsInp" type="number" placeholder="Nhập đáp số..." style="padding:8px 12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);"><button id="vtTwinCheckBtn" class="btn btn-primary btn-sm" type="button">✓ Xác nhận Bài Sinh đôi</button></div>' +
          '</div>'
        : '';

      mount.innerHTML = `
        <div class="lcms-glass-tile" style="gap:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--border);">
            <div>
              <b style="font-size:16px;">${escapeHtml(ses.exam.title)}</b>
              <div style="font-size:12px;color:var(--text-soft);">Câu ${ses.currentIdx + 1} / ${ses.questions.length} ${ses.serverGradedOnly ? '• Tự động lưu nháp mỗi 1 giây' : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${ses.mode === 'COMBO_ARENA' && comboMult > 1 ? '<span class="vt-combo-badge">🔥 Combo x' + comboMult + ' Bụi Sao</span>' : ''}
              ${ses.mode === 'NATIONAL_EXAM' ? '<span id="vtExamCountdown" class="vt-res-pill pending" style="font-family:var(--font-mono);font-size:13px;">⏱ Đang tính giờ</span>' : ''}
              <button id="vtExamExitBtn" class="btn btn-sm" type="button">Thoát</button>
            </div>
          </div>

          <div style="font-size:16px;font-weight:600;line-height:1.65;">${renderMathInText(q.prompt)}</div>
          ${inputUi}
          ${ses.feedbackHtml}
          ${twinHtml}

          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--border);">
            <button id="vtExamPrevBtn" class="btn btn-sm" type="button" ${ses.currentIdx === 0 ? 'disabled' : ''}>← Câu trước</button>
            <div style="display:flex;gap:8px;">
              ${!ses.serverGradedOnly ? '<button id="vtExamCheckInstant" class="btn btn-sm" type="button">⚡ Kiểm tra ngay</button>' : ''}
              ${ses.currentIdx < ses.questions.length - 1
                ? '<button id="vtExamNextBtn" class="btn btn-primary btn-sm" type="button" ' + (ses.twinActive ? 'disabled' : '') + '>Câu tiếp theo →</button>'
                : '<button id="vtExamSubmitBtn" class="btn btn-primary btn-sm" type="button" ' + (ses.twinActive ? 'disabled' : '') + '>🏆 Nộp bài &amp; Chấm điểm</button>'}
            </div>
          </div>
        </div>`;

      wireActiveExamPlayerEvents(ses, q);
      return;
    }

    // B. Exam Result Summary View
    let resultBannerHtml = '';
    if (state.activeExamResult) {
      const r = state.activeExamResult;
      resultBannerHtml = `
        <div class="lcms-welcome-banner" style="margin-bottom:16px;">
          <div>
            <h2>🏆 Kết quả: ${r.score} / ${r.maxScore} điểm (${r.pct}%) — ${escapeHtml(r.masteryTier)}</h2>
            <p>${r.isRushedAttempt ? '⚠ Phát hiện thời gian làm bài quá nhanh — hệ thống không cộng Bụi Sao cho lượt làm đối phó.' : ('Xuất sắc! Bạn nhận được +' + r.starDustEarned + ' Bụi Sao và đã đồng bộ vào Hồ sơ Học sinh 360°.')}</p>
          </div>
          <button id="vtCloseExamRes" class="btn btn-sm" type="button">Đóng thông báo</button>
        </div>`;
    }

    // C. Main Arena Hub View
    const coopGoal = 500;
    const coopPct = Math.min(100, Math.round((state.classCoopStarDust / coopGoal) * 100));
    const coopHtml = `
      <div class="vt-coop-bar-wrap">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;font-weight:700;">
          <span>🌌 Thanh Năng lượng Hợp tác Cả lớp</span>
          <span style="font-family:var(--font-mono);color:var(--primary);">${state.classCoopStarDust} / ${coopGoal} Bụi Sao (${coopPct}%)</span>
        </div>
        <div class="vt-coop-track"><div class="vt-coop-fill" style="width:${coopPct}%;"></div></div>
      </div>`;

    const modesGridHtml = '<div class="vt-exam-modes-grid">' + EXAM_MODES_META.map(function (m) {
      return '<div class="vt-mode-pill-card"><div style="font-weight:800;font-size:14px;">' + m.icon + ' ' + escapeHtml(m.name) + '</div><div style="font-size:12px;color:var(--text-muted);line-height:1.45;">' + escapeHtml(m.desc) + '</div></div>';
    }).join('') + '</div>';

    const examsListHtml = state.exams.length
      ? state.exams.map(function (ex) {
          const hm = state.errorHeatmapByExam[ex.examId];
          let heatmapHtml = '';
          if (!isStudent() && hm && Object.keys(hm).length) {
            const bars = Object.keys(hm).sort(function (a, b) { return hm[b].wrongPct - hm[a].wrongPct; }).map(function (qid) {
              const pct = hm[qid].wrongPct;
              const col = pct >= 50 ? '#EF4444' : (pct >= 25 ? '#F59E0B' : '#10B981');
              return '<div class="vt-heat-bar"><span style="width:42px;font-weight:700;">' + escapeHtml(qid) + '</span><div class="vt-heat-track"><div style="width:' + pct + '%;height:100%;background:' + col + ';"></div></div><span style="width:82px;text-align:right;font-family:var(--font-mono);">' + pct + '% sai</span></div>';
            }).join('');
            heatmapHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);display:flex;flex-direction:column;gap:5px;"><div style="font-size:11.5px;font-weight:700;color:var(--text-soft);">🔥 Bản đồ Nhiệt Lỗi Sai của lớp</div>' + bars + '</div>';
          }
          return '<div class="lcms-glass-tile">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
              '<div><b style="font-size:16px;">' + escapeHtml(ex.title) + '</b><div style="font-size:12px;color:var(--text-soft);">' + escapeHtml(ex.gradeBlock) + ' • ' + escapeHtml(ex.chapterConstellation) + ' • ' + ex.questionCount + ' câu • ' + ex.durationMin + ' phút</div></div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                '<button class="btn btn-sm" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="QUICK_DISCOVERY">⚡ Nhanh</button>' +
                '<button class="btn btn-sm" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="COMBO_ARENA">🔥 Combo</button>' +
                '<button class="btn btn-sm" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="BOSS_BATTLE">👑 Trùm</button>' +
                '<button class="btn btn-sm btn-primary" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="NATIONAL_EXAM">🏛️ Phòng Thi</button>' +
              '</div>' +
            '</div>' +
            heatmapHtml +
          '</div>';
        }).join('')
      : '<div class="lcms-glass-tile" style="text-align:center;padding:28px;color:var(--text-soft);">Chưa có bộ đề luyện tập nào.' + ((isAdmin() || isTeacher()) ? ' Hãy bấm <b>+ Khởi tạo Bộ đề mẫu 4 định dạng</b> ở góc trên để tạo nhanh.' : '') + '</div>';

    const skinsHtml = '<div class="lcms-glass-tile" style="margin-top:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"><b>🎨 Giao diện Bảng vẽ Phòng Thí nghiệm (Mở khóa bằng Bụi Sao)</b><span class="vt-res-pill pending">★ Bụi Sao của bạn: ' + state.totalStarDust + '</span></div>' +
      '<div class="vt-skin-grid">' + LAB_SKINS.map(function (sk) {
        const unlocked = state.totalStarDust >= sk.cost || isAdmin() || isTeacher();
        const isAct = state.activeLabSkin === sk.id;
        return '<div class="vt-skin-card ' + (isAct ? 'active' : '') + '">' +
          '<b style="font-size:13.5px;">' + escapeHtml(sk.name) + '</b>' +
          '<span style="font-size:11.8px;color:var(--text-muted);">' + escapeHtml(sk.desc) + '</span>' +
          '<button type="button" class="btn btn-sm ' + (isAct ? 'btn-primary' : '') + '" data-pick-skin="' + sk.id + '" ' + (!unlocked ? 'disabled' : '') + '>' + (isAct ? '✓ Đang dùng' : (unlocked ? 'Áp dụng' : '🔒 Cần ' + sk.cost + '★')) + '</button>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';

    mount.innerHTML = `
      ${resultBannerHtml}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <h2 style="font-family:'Newsreader',serif;font-size:24px;margin:0;">🏆 Đấu trường Đề &amp; Tinh thông</h2>
        ${(isAdmin() || isTeacher()) ? '<button id="vtBtnCreateStarterExam" class="btn btn-primary btn-sm" type="button">+ Khởi tạo Bộ đề mẫu 4 định dạng</button>' : ''}
      </div>
      ${coopHtml}
      ${modesGridHtml}
      <div style="display:flex;flex-direction:column;gap:12px;">${examsListHtml}</div>
      ${skinsHtml}
    `;

    const closeRes = document.getElementById('vtCloseExamRes');
    if (closeRes) closeRes.addEventListener('click', function () { state.activeExamResult = null; renderExamsSector(); });
    const createStarter = document.getElementById('vtBtnCreateStarterExam');
    if (createStarter) createStarter.addEventListener('click', createStarterSampleExam);
    mount.querySelectorAll('[data-start-exam]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startExamSession(btn.getAttribute('data-start-exam'), btn.getAttribute('data-exam-mode'));
      });
    });
    mount.querySelectorAll('[data-pick-skin]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyLabSkin(btn.getAttribute('data-pick-skin'));
        showNotice('🎨 Đã đổi giao diện bảng vẽ Phòng Thí nghiệm 2D/3D.');
        renderExamsSector();
      });
    });
  }

  function wireActiveExamPlayerEvents(ses, q) {
    const recordTime = function () {
      const elapsed = Math.max(1, Math.round((Date.now() - qOpenedAtMs) / 1000));
      ses.timingSecByQ[q.id] = (ses.timingSecByQ[q.id] || 0) + elapsed;
      qOpenedAtMs = Date.now();
    };

    if (q.type === 'GRAPH_SLIDER') {
      const gc = q.graphConfig || { expr: 'x^3 - 3*m*x' };
      const canvas = document.getElementById('vtExamGraphCanvas');
      const slider = document.getElementById('vtExamSliderInput');
      const valEl = document.getElementById('vtExamSliderVal');
      const draw = function (mv) {
        drawEmbeddedLabCanvas(canvas, { exprs: [{ expr: gc.expr || 'x^3 - 3*m*x', color: '#38BDF8', visible: true }], params: { m: mv }, view: { xMin: -4, xMax: 4, yMin: -4, yMax: 4 } }, { yaw: 0, pitch: 0 });
      };
      draw(Number(slider.value));
      slider.addEventListener('input', function () {
        const mv = Number(slider.value);
        ses.answers[q.id] = mv;
        if (valEl) valEl.textContent = mv.toFixed(1);
        draw(mv);
      });
    }

    document.querySelectorAll('#vtExamsMount [data-mcq-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ses.answers[q.id] = btn.getAttribute('data-mcq-pick');
        renderExamsSector();
      });
    });

    document.querySelectorAll('#vtExamsMount [data-tf-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!ses.answers[q.id] || typeof ses.answers[q.id] !== 'object') ses.answers[q.id] = {};
        ses.answers[q.id][btn.getAttribute('data-tf-key')] = btn.getAttribute('data-tf-val') === 'true';
        renderExamsSector();
      });
    });

    const shortInp = document.getElementById('vtExamShortInp');
    if (shortInp) shortInp.addEventListener('input', function () { ses.answers[q.id] = shortInp.value.trim(); });

    const checkBtn = document.getElementById('vtExamCheckInstant');
    if (checkBtn) {
      checkBtn.addEventListener('click', async function () {
        recordTime();
        const ans = ses.answers[q.id];
        if (ans === undefined || ans === '') { showNotice('⚠ Vui lòng chọn hoặc nhập đáp án trước.', true); return; }
        const secSpent = ses.timingSecByQ[q.id] || 0;
        const normAns = typeof ans === 'object' ? JSON.stringify(ans) : String(ans).trim().replace(/\s+/g, '').replace(/,/g, '.').toUpperCase();
        const h = await clientSha256Hex(q.id + ':' + normAns + ':' + ses.sessionSalt);
        const isCorrect = q.answerHash && h === q.answerHash;

        if (isCorrect && secSpent >= 5) {
          ses.combo++;
          ses.maxCombo = Math.max(ses.maxCombo, ses.combo);
          ses.feedbackHtml = '<div class="vt-theorem-box">✓ Chính xác! Combo hiện tại: <b>' + ses.combo + '</b>.</div>';
          ses.twinActive = null;
        } else {
          ses.combo = 0;
          const trapMsg = (q.trapReasons && q.trapReasons[String(ans)])
            ? q.trapReasons[String(ans)]
            : (secSpent < 5 ? 'Bạn thao tác dưới 5 giây — hãy kiểm tra kỹ lại lập luận.' : 'Đáp án chưa chính xác — hãy giải Bài tập Sinh đôi bên dưới để củng cố bản chất.');
          ses.feedbackHtml = '<div class="vt-trap-box"><b>⚠ Chẩn đoán Bẫy Tư duy:</b> ' + renderMathInText(trapMsg) + '</div>';
          ses.twinActive = generateTwinProblem(q);
        }
        renderExamsSector();
      });
    }

    const twinBtn = document.getElementById('vtTwinCheckBtn');
    if (twinBtn && ses.twinActive) {
      twinBtn.addEventListener('click', function () {
        const val = Number(document.getElementById('vtTwinAnsInp').value);
        if (Math.abs(val - ses.twinActive.correctNumeric) <= 0.05) {
          ses.twinActive = null;
          ses.feedbackHtml = '<div class="vt-theorem-box">✓ Tuyệt vời! Bạn đã vượt qua Bài tập Sinh đôi và có thể đi tiếp.</div>';
          renderExamsSector();
        } else {
          showNotice('⚠ Chưa đúng, hãy tính lại theo gợi ý của Bài tập Sinh đôi.', true);
        }
      });
    }

    const prevBtn = document.getElementById('vtExamPrevBtn');
    if (prevBtn) prevBtn.addEventListener('click', function () { recordTime(); ses.currentIdx--; ses.feedbackHtml = ''; ses.twinActive = null; renderExamsSector(); });
    const nextBtn = document.getElementById('vtExamNextBtn');
    if (nextBtn) nextBtn.addEventListener('click', function () { recordTime(); ses.currentIdx++; ses.feedbackHtml = ''; ses.twinActive = null; renderExamsSector(); });
    const subBtn = document.getElementById('vtExamSubmitBtn');
    if (subBtn) subBtn.addEventListener('click', function () { recordTime(); submitActiveExam(); });
    const exitBtn = document.getElementById('vtExamExitBtn');
    if (exitBtn) exitBtn.addEventListener('click', function () { stopExamTimers(); state.activeExamSession = null; renderExamsSector(); });
  }

  /* ==========================================================================
   * 10. LIFECYCLE BINDING & PUBLIC API
   * ========================================================================== */

  function onSessionReady() {
    if (getSession()) {
      initHub();
      startHeartbeat();
    } else if (hbTimer) {
      clearInterval(hbTimer);
      hbTimer = null;
    }
  }

  window.addEventListener('vantesis:session-changed', onSessionReady);
  window.addEventListener('vanthesis:session-changed', onSessionReady);
  window.addEventListener('vanthesis:sector-changed', function (ev) {
    const sec = ev && ev.detail && ev.detail.sector;
    if ((sec === 'dashboard' || sec === 'resources') && getSession()) {
      if (!state.loaded) initHub();
      else { renderDashboard(); renderResourcesHub(); }
    }
  });

  if (getSession()) onSessionReady();

  window.VANTHESIS_RESOURCES = Object.freeze({
    refresh: function () { return fetchHubFromServer(false); },
    createFromStudio: function (labSnapshot) {
      injectStyles();
      ensureOverlaysDOM();
      if (typeof window.VANTHESIS_SWITCH_SECTOR === 'function') window.VANTHESIS_SWITCH_SECTOR('resources');
      openEditor(null, labSnapshot);
    },
    getState: function () { return Object.assign({}, state); }
  });
})();