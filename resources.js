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
  const DB_NAME = 'vanthesis_constellation_cache';
  const DB_STORE = 'hub_cache';
  const HEARTBEAT_MS = 8000;

  const COGNITIVE_LABELS = {
    NHAN_BIET: 'Nhận biết',
    THONG_HIEU: 'Thông hiểu',
    VAN_DUNG: 'Vận dụng',
    VAN_DUNG_CAO: 'Vận dụng cao'
  };

  const TYPE_META = {
    INTERACTIVE_LESSON: { label: 'Bài giảng & Đồ thị', color: '#1D4ED8', icon: '📘' },
    LESSON: { label: 'Bài giảng tương tác', color: '#1D4ED8', icon: '📘' },
    LAB_SIMULATION: { label: 'Mô phỏng 2D/3D', color: '#1D4ED8', icon: '∫' },
    LAB: { label: 'Mô phỏng 2D/3D', color: '#1D4ED8', icon: '∫' },
    EXAM_SPLIT: { label: 'Đề thi PDF / Word', color: '#D97706', icon: '📝' },
    EXERCISE: { label: 'Đề luyện tập', color: '#D97706', icon: '✍️' },
    DRIVE_BUNDLE: { label: 'Tài liệu PDF / Slide', color: '#7C3AED', icon: '📄' },
    PDF: { label: 'Tài liệu PDF / Word', color: '#7C3AED', icon: '📄' },
    SLIDE: { label: 'Bài trình chiếu', color: '#7C3AED', icon: '📽️' },
    VIDEO: { label: 'Video bài giảng', color: '#059669', icon: '🎬' }
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
    editorTab: 'drop', // 'drop' | 'exam_pdf' | 'blocks'
    editorFiles: [],
    editorBlocks: [],
    selectedBulkIds: {},
    uploadingDrive: false,

    // CHẶNG III: Bidirectional Lab Bridge, Lesson TOC, Editor Preview & Presentation Mode
    returnLessonId: '',
    returnBlockIndex: -1,
    returnScrollTop: 0,
    editorPreviewOpen: {},
    presentation: {
      open: false,
      resourceId: '',
      mode: 'slide', // 'slide' | 'scroll'
      slideIdx: 0,
      fontScale: 1.0
    },

    // CHẶNG IV: Exam Arena & Mastery State
    exams: [],
    myExamSubmissions: [],
    errorHeatmapByExam: {},
    classCoopStarDust: 0,
    activeExamSession: null,
    activeExamResult: null,
    examModeFilter: 'ALL',
    examSoundEnabled: true,
    examBuilderQuestions: [],
    examBuilderDriveFile: null,
    examSplitMobileTab: 'paper', // 'paper' | 'sheet'
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
      FORBIDDEN_NOT_SUBJECT_TEACHER: 'Chỉ Giáo viên Bộ môn được phân công giảng dạy hoặc Quản trị viên mới có quyền tạo và chỉnh sửa học liệu.',
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
    if (window.VANTHESIS_CORE && window.VANTHESIS_CORE.ui && typeof window.VANTHESIS_CORE.ui.toast === 'function') {
      window.VANTHESIS_CORE.ui.toast(msg, isErr ? 'error' : 'success');
      return;
    }
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

  const QUICK_MATH_SYMBOLS = [
    { lbl: 'Phân số', ins: '$\\frac{a}{b}$' },
    { lbl: 'Căn bậc hai', ins: '$\\sqrt{x}$' },
    { lbl: 'Tích phân', ins: '$\\int_{a}^{b} f(x)\\,dx$' },
    { lbl: 'Giới hạn', ins: '$\\lim_{x \\to x_0} f(x)$' },
    { lbl: 'Tổng', ins: '$\\sum_{i=1}^{n} x_i$' },
    { lbl: 'Hệ phương trình', ins: '$$\\begin{cases} a_1 x + b_1 y = c_1 \\\\ a_2 x + b_2 y = c_2 \\end{cases}$$' },
    { lbl: '≤', ins: '$\\le$' },
    { lbl: '≥', ins: '$\\ge$' },
    { lbl: '⇒', ins: '$\\Rightarrow$' }
  ];

  function formatMathFallback(expr, displayMode) {
    let s = escapeHtml(decodeHtmlEntities(expr || '').trim());
    // Systems of equations
    s = s.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, function (_m, inner) {
      const rows = inner.split(/\\\\/).map(function (r) {
        return '<div>' + r.replace(/&amp;/g, ' ').trim() + '</div>';
      }).join('');
      return '<span class="vt-mf-cases"><span class="vt-mf-brace">{</span><span class="vt-mf-cases-rows">' + rows + '</span></span>';
    });
    // Fractions (up to 2 passes for nested)
    for (let pass = 0; pass < 2; pass++) {
      s = s.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="vt-mf-frac"><span class="vt-mf-num">$1</span><span class="vt-mf-den">$2</span></span>');
    }
    // Square roots
    s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '<span class="vt-mf-sqrt"><sup>$1</sup>&radic;<span class="vt-mf-rad">$2</span></span>');
    s = s.replace(/\\sqrt\{([^{}]+)\}/g, '<span class="vt-mf-sqrt">&radic;<span class="vt-mf-rad">$1</span></span>');
    // Big operators with limits
    s = s.replace(/\\int_\{([^{}]+)\}\^\{([^{}]+)\}/g, '<span class="vt-mf-op">&int;<sub>$1</sub><sup>$2</sup></span>');
    s = s.replace(/\\int_([a-zA-Z0-9])\^([a-zA-Z0-9])/g, '<span class="vt-mf-op">&int;<sub>$1</sub><sup>$2</sup></span>');
    s = s.replace(/\\sum_\{([^{}]+)\}\^\{([^{}]+)\}/g, '<span class="vt-mf-op">&sum;<sub>$1</sub><sup>$2</sup></span>');
    s = s.replace(/\\lim_\{([^{}]+)\}/g, '<span class="vt-mf-op">lim<sub>$1</sub></span>');
    // Superscripts & subscripts
    s = s.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
    s = s.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
    s = s.replace(/\^([a-zA-Z0-9\-\+])/g, '<sup>$1</sup>');
    s = s.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
    // Greek letters & math symbols
    const symMap = [
      [/\\Rightarrow/g, '&rArr;'], [/\\Leftrightarrow/g, '&hArr;'], [/\\Leftarrow/g, '&lArr;'],
      [/\\rightarrow|\\to\b/g, '&rarr;'], [/\\leftarrow/g, '&larr;'],
      [/\\le\b|\\leq\b/g, '&le;'], [/\\ge\b|\\geq\b/g, '&ge;'], [/\\neq\b|\\ne\b/g, '&ne;'],
      [/\\approx\b/g, '&asymp;'], [/\\pm\b/g, '&plusmn;'], [/\\mp\b/g, '&#8723;'],
      [/\\times\b/g, '&times;'], [/\\cdot\b/g, '&middot;'], [/\\div\b/g, '&divide;'],
      [/\\infty\b/g, '&infin;'], [/\\in\b/g, '&isin;'], [/\\notin\b/g, '&notin;'],
      [/\\forall\b/g, '&forall;'], [/\\exists\b/g, '&exist;'], [/\\emptyset\b/g, '&empty;'],
      [/\\cup\b/g, '&cup;'], [/\\cap\b/g, '&cap;'], [/\\subset\b/g, '&sub;'],
      [/\\int\b/g, '&int;'], [/\\sum\b/g, '&sum;'], [/\\lim\b/g, 'lim'],
      [/\\Delta\b/g, '&Delta;'], [/\\delta\b/g, '&delta;'], [/\\alpha\b/g, '&alpha;'],
      [/\\beta\b/g, '&beta;'], [/\\gamma\b/g, '&gamma;'], [/\\theta\b/g, '&theta;'],
      [/\\lambda\b/g, '&lambda;'], [/\\pi\b/g, '&pi;'], [/\\omega\b/g, '&omega;'],
      [/\\Omega\b/g, '&Omega;'], [/\\varphi\b|\\phi\b/g, '&phi;'], [/\\sigma\b/g, '&sigma;'],
      [/\\Sigma\b/g, '&Sigma;'], [/\\mathbb\{R\}/g, '&#8477;'], [/\\mathbb\{N\}/g, '&#8469;'],
      [/\\mathbb\{Z\}/g, '&#8484;'], [/\\mathbb\{Q\}/g, '&#8474;'],
      [/\\(sin|cos|tan|cot|ln|log|exp|max|min)\b/g, '$1'],
      [/\\left|\\right|\\,|\\;|\\!/g, '']
    ];
    for (let i = 0; i < symMap.length; i++) s = s.replace(symMap[i][0], symMap[i][1]);
    return displayMode
      ? '<div class="vt-math-display vt-mf-block">' + s + '</div>'
      : '<span class="vt-mf-inline">' + s + '</span>';
  }

  function renderMathInText(rawText) {
    let safe = escapeHtml(rawText || '');
    const useKatex = Boolean(window.katex && typeof window.katex.renderToString === 'function');
    // 1. Display math $$...$$
    safe = safe.replace(/\$\$([\s\S]+?)\$\$/g, function (_m, expr) {
      if (useKatex) {
        try {
          return '<div class="vt-math-display">' + window.katex.renderToString(decodeHtmlEntities(expr), { throwOnError: false, displayMode: true }) + '</div>';
        } catch (e) {
          return formatMathFallback(expr, true);
        }
      }
      return formatMathFallback(expr, true);
    });
    // 2. Inline math $...$
    safe = safe.replace(/\$([^$\n]+)\$/g, function (_m, expr) {
      if (useKatex) {
        try {
          return window.katex.renderToString(decodeHtmlEntities(expr), { throwOnError: false, displayMode: false });
        } catch (e) {
          return formatMathFallback(expr, false);
        }
      }
      return formatMathFallback(expr, false);
    });
    return safe.replace(/\n/g, '<br>');
  }

  function renderMathInElementSafe(container) {
    if (!container) return;
    try {
      container.querySelectorAll('[data-vt-math-src]').forEach(function (el) {
        const raw = el.getAttribute('data-vt-math-src') || '';
        el.innerHTML = renderMathInText(raw);
      });
      if (!window.katex && window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        window.MathJax.typesetPromise([container]).catch(function () {});
      }
    } catch (e) {}
  }

  function getCore() { return window.VANTHESIS_CORE || null; }

  function getSession() {
    const C = getCore();
    if (C && C.auth) return C.auth.getSession();
    const ctx = window.VANTHESIS_SESSION_CONTEXT;
    if (!ctx || !ctx.bridgeUrl || !ctx.accessToken) return null;
    return ctx;
  }

  function isAdmin() { const C = getCore(); const P = (C && C.policy) || window.VANTHESIS_POLICY; return Boolean(P && P.isAdmin()); }
  function isTeacher() { const C = getCore(); const P = (C && C.policy) || window.VANTHESIS_POLICY; return Boolean(P && P.isTeacher()); }
  function isStudent() { const C = getCore(); const P = (C && C.policy) || window.VANTHESIS_POLICY; return Boolean(P && P.isStudent()); }
  function canUploadResource() { const C = getCore(); const P = (C && C.policy) || window.VANTHESIS_POLICY; return Boolean(P && P.can('upload_resource')); }
  function canUploadExam() { const C = getCore(); const P = (C && C.policy) || window.VANTHESIS_POLICY; return Boolean(P && (P.can('upload_exam') || P.can('upload_resource'))); }

  /* ==========================================================================
   * 2. UNIFIED CORE BRIDGE (VANTHESIS_CORE.db, api & drive — ZERO DUPLICATION)
   * ========================================================================== */

  async function readCache(email) {
    const C = getCore();
    if (!C || !C.db) return null;
    return C.db.get('resources_cache', 'hub_' + email);
  }

  async function writeCache(email, syncRev, data) {
    const C = getCore();
    if (!C || !C.db) return;
    await C.db.set('resources_cache', { key: 'hub_' + email, syncRev: syncRev, data: data, savedAt: Date.now() });
  }

  async function callApi(action, body) {
    const C = getCore();
    if (!C || !C.api) return { ok: false, error: 'Hệ thống lõi chưa sẵn sàng.' };
    const res = await C.api.post(action, body || {});
    if (res && typeof res.syncRev === 'number' && res.syncRev > state.localSyncRev) {
      state.localSyncRev = res.syncRev;
    }
    return res;
  }

  async function uploadFileToGoogleDrive(file, onProgress) {
    const C = getCore();
    if (!C || !C.drive) throw new Error('Dịch vụ lưu trữ Google Drive chưa sẵn sàng.');
    return C.drive.uploadFile({
      fileOrBlob: file,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      folderName: 'VANTHESIS_Hoc_Lieu',
      makePublicViewer: true,
      onProgress: onProgress
    });
  }

  function uploadFileToDrive(file, onProgress) {
    return uploadFileToGoogleDrive(file, onProgress);
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

      /* 15-Second Drag-and-Drop Zone & Real-time Progress Bar */
      .vt-drop-zone {
        border: 2px dashed rgba(29, 78, 216, 0.35);
        border-radius: 18px;
        padding: 20px 16px;
        text-align: center;
        background: var(--surface-alt);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .vt-drop-zone.drag-over {
        border-color: #D97706;
        background: rgba(254, 243, 199, 0.35);
        transform: scale(1.01);
      }
      .vt-upload-prog-wrap {
        display: none;
        margin-top: 10px;
      }
      .vt-upload-prog-wrap.active { display: block; }
      .vt-upload-prog-track {
        height: 8px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.25);
        overflow: hidden;
      }
      .vt-upload-prog-fill {
        height: 100%;
        width: 0%;
        border-radius: 999px;
        background: linear-gradient(90deg, #1D4ED8, #10B981);
        transition: width 0.15s linear;
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
      /* CHẶNG III: Offline Math Fallback, Lesson TOC, Collapsible Method, Return Pill & Classroom Presentation */
      .vt-mf-inline { font-family: 'Newsreader', 'Times New Roman', serif; font-style: italic; font-size: 1.04em; padding: 0 2px; }
      .vt-mf-block { font-family: 'Newsreader', 'Times New Roman', serif; font-size: 1.12em; text-align: center; padding: 10px 14px; border-radius: 12px; background: rgba(148,163,184,0.08); }
      .vt-mf-frac { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; margin: 0 3px; font-style: normal; line-height: 1.1; }
      .vt-mf-num { padding: 0 4px 2px; border-bottom: 1.4px solid currentColor; font-size: 0.9em; }
      .vt-mf-den { padding: 2px 4px 0; font-size: 0.9em; }
      .vt-mf-sqrt { display: inline-flex; align-items: baseline; }
      .vt-mf-rad { border-top: 1.3px solid currentColor; padding: 0 3px; margin-left: 1px; }
      .vt-mf-cases { display: inline-flex; align-items: center; gap: 6px; text-align: left; }
      .vt-mf-brace { font-size: 2.2em; line-height: 1; font-weight: 300; }
      .vt-mf-cases-rows { display: flex; flex-direction: column; gap: 4px; }
      .vt-mf-op { font-style: normal; margin-right: 3px; }

      .vt-res-drawer { width: min(1060px, 98vw) !important; }
      .vt-lesson-layout { display: grid; grid-template-columns: minmax(0, 1fr) 230px; gap: 20px; align-items: start; }
      .vt-lesson-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      .vt-lesson-toc { position: sticky; top: 8px; padding: 14px; border-radius: 18px; background: var(--surface-alt); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
      .vt-lesson-toc-title { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-soft); margin-bottom: 4px; }
      .vt-toc-link { text-align: left; border: 0; background: transparent; color: var(--text-muted); font-size: 12.5px; font-weight: 600; padding: 6px 9px; border-radius: 10px; cursor: pointer; transition: background 0.16s ease, color 0.16s ease; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .vt-toc-link:hover, .vt-toc-link.active { background: rgba(37, 99, 235, 0.12); color: var(--primary); }
      .vt-lesson-mobile-jump { display: none; gap: 6px; overflow-x: auto; padding: 4px 0 8px; -webkit-overflow-scrolling: touch; }
      .vt-lesson-mobile-jump .vt-toc-chip { flex: 0 0 auto; border: 1px solid var(--border-strong); background: var(--surface-alt); color: var(--text); font-size: 12px; font-weight: 700; padding: 5px 11px; border-radius: 9999px; cursor: pointer; }

      .vt-method-solution { margin-top: 10px; border-radius: 12px; background: rgba(29, 78, 216, 0.06); border: 1px dashed rgba(37, 99, 235, 0.34); padding: 10px 14px; }
      .vt-method-solution summary { cursor: pointer; font-weight: 800; font-size: 13px; color: var(--primary); list-style: none; display: flex; align-items: center; gap: 6px; }
      .vt-method-solution summary::-webkit-details-marker { display: none; }
      .vt-method-solution[open] summary { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }

      .vt-role-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.03em; }
      .vt-role-badge.admin { background: rgba(245, 158, 11, 0.18); color: #D97706; border: 1px solid rgba(217, 119, 6, 0.35); }
      .vt-role-badge.teacher { background: rgba(37, 99, 235, 0.14); color: #1D4ED8; border: 1px solid rgba(37, 99, 235, 0.32); }
      .vt-role-badge.student { background: rgba(16, 185, 129, 0.14); color: #059669; border: 1px solid rgba(16, 185, 129, 0.32); }
      html[data-theme="dark"] .vt-role-badge.admin { color: #FCD34D; }
      html[data-theme="dark"] .vt-role-badge.teacher { color: #93C5FD; }
      html[data-theme="dark"] .vt-role-badge.student { color: #6EE7B7; }

      .vt-comment-preview, .vt-blk-math-preview { margin-top: 6px; padding: 10px 12px; border-radius: 12px; background: var(--surface-alt); border: 1px dashed var(--border-strong); font-size: 13.5px; line-height: 1.65; color: var(--text); }
      .vt-blk-math-preview-label { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-soft); margin-bottom: 4px; }

      /* Floating Liquid Glass Return-to-Lesson Pill in Lab Sector */
      #vtReturnToLessonPill { position: fixed; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%) translateY(16px); z-index: 950; display: none; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 9999px; background: rgba(15, 23, 42, 0.88); color: #F8FAFC; border: 1.5px solid rgba(251, 191, 36, 0.58); box-shadow: 0 18px 42px rgba(2, 6, 23, 0.45); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); font-size: 13.5px; font-weight: 800; cursor: pointer; opacity: 0; transition: opacity 0.2s ease, transform 0.2s ease; }
      #vtReturnToLessonPill.visible { display: inline-flex; opacity: 1; transform: translateX(-50%) translateY(0); }
      #vtReturnToLessonPill:hover { border-color: #FBBF24; box-shadow: 0 20px 48px rgba(245, 158, 11, 0.28); }
      html[data-theme="light"] #vtReturnToLessonPill { background: rgba(255, 255, 255, 0.94); color: #0F172A; border-color: rgba(29, 78, 216, 0.45); box-shadow: 0 14px 36px rgba(15, 23, 42, 0.16); }

      /* Dedicated Full-Screen Classroom Presentation Overlay */
      #vtPresentationOverlay { position: fixed; inset: 0; z-index: 1200; display: none; flex-direction: column; background: var(--bg); color: var(--text); }
      #vtPresentationOverlay.open { display: flex; }
      html[data-theme="light"] #vtPresentationOverlay { background: #FAF9F6; color: #0F172A; }
      html[data-theme="dark"] #vtPresentationOverlay { background: #060B19; color: #F8FAFC; }
      .vt-pres-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 24px; border-bottom: 1px solid var(--border); background: var(--surface); }
      .vt-pres-stage { flex: 1; overflow-y: auto; padding: 28px clamp(18px, 6vw, 84px) 110px; display: flex; flex-direction: column; gap: 22px; align-items: center; }
      .vt-pres-slide-card { width: min(1040px, 100%); padding: clamp(22px, 3.2vw, 38px); border-radius: 26px; background: var(--surface); border: 1.5px solid var(--border-strong); box-shadow: 0 20px 56px rgba(15, 23, 42, 0.12); font-size: calc(18px * var(--vt-pres-scale, 1)); line-height: 1.75; }
      .vt-pres-dock { position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 1210; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; padding: 8px 14px; border-radius: 9999px; background: rgba(15, 23, 42, 0.90); color: #F8FAFC; border: 1px solid rgba(148, 163, 184, 0.35); box-shadow: 0 18px 48px rgba(2, 6, 23, 0.5); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); max-width: 96vw; }
      html[data-theme="light"] .vt-pres-dock { background: rgba(255, 255, 255, 0.94); color: #0F172A; border-color: rgba(15, 23, 42, 0.14); box-shadow: 0 14px 36px rgba(15, 23, 42, 0.16); }
      .vt-pres-dock-btn { border: 1px solid rgba(148, 163, 184, 0.3); background: transparent; color: inherit; font-size: 12.5px; font-weight: 700; padding: 6px 12px; border-radius: 9999px; cursor: pointer; white-space: nowrap; }
      .vt-pres-dock-btn:hover { background: rgba(37, 99, 235, 0.16); }
      .vt-pres-dock-btn.primary { background: linear-gradient(135deg, #2563EB, #1D4ED8); color: #FFFFFF; border-color: transparent; }
      .vt-pres-dock-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      /* CHẶNG IV-B: Exam Arena Stats, Split-Screen PDF/Word Exam, Lab Skin Shop & Heatmap Modal */
      .vt-exam-stats-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
      .vt-exam-stat-card { padding: 12px 14px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 3px; }
      .vt-exam-stat-val { font-family: var(--font-mono); font-size: 20px; font-weight: 800; color: var(--primary); }
      .vt-exam-stat-lbl { font-size: 11.5px; color: var(--text-soft); font-weight: 700; }
      .vt-mode-pill-card { cursor: pointer; transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease; }
      .vt-mode-pill-card:hover { transform: translateY(-2px); border-color: var(--primary); }
      .vt-mode-pill-card.active { border-color: #D97706; box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.28); background: rgba(245, 158, 11, 0.08); }

      /* Split-Screen PDF/Word Exam (55% Left Preview / 45% Right Smart Answer Sheet) */
      .vt-split-exam-wrap { display: grid; grid-template-columns: 55% 45%; gap: 14px; align-items: stretch; min-height: 74vh; }
      .vt-split-left { border-radius: 22px; overflow: hidden; border: 1px solid var(--border-strong); background: var(--surface); display: flex; flex-direction: column; }
      .vt-split-left iframe { width: 100%; flex: 1; min-height: 68vh; border: 0; }
      .vt-split-right { border-radius: 22px; border: 1px solid var(--border-strong); background: var(--surface); padding: 16px; display: flex; flex-direction: column; gap: 12px; max-height: 78vh; overflow-y: auto; }
      .vt-split-mobile-bar { display: none; gap: 8px; margin-bottom: 10px; }
      .vt-q-jump-grid { display: flex; flex-wrap: wrap; gap: 6px; }
      .vt-q-jump-btn { width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface-alt); color: var(--text); font-size: 12px; font-weight: 800; cursor: pointer; }
      .vt-q-jump-btn.answered { background: rgba(37, 99, 235, 0.16); border-color: var(--primary); color: var(--primary); }
      .vt-q-jump-btn.current { background: linear-gradient(135deg, #2563EB, #1D4ED8); color: #FFFFFF; border-color: transparent; }

      .vt-heat-bar-row { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 14px; background: var(--surface-alt); border: 1px solid var(--border); }
      .vt-heat-bar-row.danger { border-color: rgba(239, 68, 68, 0.55); background: rgba(239, 68, 68, 0.08); }

      @media (max-width: 900px) {
        .vt-exam-stats-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 767px) {
        .vt-split-mobile-bar { display: flex; }
        .vt-split-exam-wrap { grid-template-columns: 1fr; min-height: auto; }
        .vt-split-left.mob-hidden, .vt-split-right.mob-hidden { display: none; }
      }
      @media (max-width: 900px) {
        .vt-lesson-layout { grid-template-columns: 1fr; }
        .vt-lesson-toc { display: none; }
        .vt-lesson-mobile-jump { display: flex; }
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
    
      /* === CELESTIAL OBSERVATORY & DEEP COSMOS POLISH === */
      .vt-constellation-stage {
        position: relative;
        overflow: hidden;
        border-radius: var(--vt-cosmos-radius-frame, 22px);
        background:
          radial-gradient(520px circle at calc(22% + var(--vt-par-x, 0px)) calc(26% + var(--vt-par-y, 0px)), rgba(56, 189, 248, 0.16), transparent 62%),
          radial-gradient(460px circle at calc(78% - var(--vt-par-x, 0px)) calc(74% - var(--vt-par-y, 0px)), rgba(251, 191, 36, 0.12), transparent 60%),
          linear-gradient(145deg, #050B1D 0%, #0A1432 55%, #070F26 100%) !important;
        border: 1px solid rgba(56, 189, 248, 0.24) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.22) !important;
        box-shadow: 0 22px 54px -18px rgba(2, 6, 23, 0.65);
      }
      .vt-star-corona {
        transform-box: fill-box;
        transform-origin: center;
        animation: vtStarBreathe 3.4s ease-in-out infinite;
      }
      .vt-star-node { cursor: pointer; transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1); }
      .vt-star-node:hover .vt-star-core { filter: drop-shadow(0 0 8px currentColor); }
      @keyframes vtStarBreathe {
        0%, 100% { opacity: 0.24; transform: scale(0.94); }
        50% { opacity: 0.56; transform: scale(1.12); }
      }
      .vt-star-tooltip {
        position: absolute;
        pointer-events: none;
        z-index: 25;
        padding: 9px 13px;
        border-radius: 16px;
        background: rgba(8, 15, 36, 0.92);
        color: #F8FAFC;
        border: 1px solid rgba(56, 189, 248, 0.35);
        border-top: 1px solid rgba(255, 255, 255, 0.26);
        box-shadow: 0 16px 36px rgba(2, 6, 23, 0.52);
        backdrop-filter: blur(18px) saturate(145%);
        -webkit-backdrop-filter: blur(18px) saturate(145%);
        font-size: 12px;
        line-height: 1.45;
        max-width: 240px;
        opacity: 0;
        transform: translate(-50%, -115%) scale(0.96);
        transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .vt-star-tooltip.visible {
        opacity: 1;
        transform: translate(-50%, -122%) scale(1);
      }

      /* Starlight Glass Bento Cards & Featured Orbital Curve */
      .vt-res-card, .vt-bento-card, .lcms-glass-tile {
        position: relative;
        overflow: hidden;
        border-radius: var(--vt-cosmos-radius-frame, 22px) !important;
        backdrop-filter: blur(22px) saturate(145%) !important;
        -webkit-backdrop-filter: blur(22px) saturate(145%) !important;
        border-top: 1px solid var(--vt-cosmos-border-top, rgba(255, 255, 255, 0.22)) !important;
        transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.24s ease, border-color 0.24s ease;
      }
      .vt-res-card::before, .lcms-glass-tile::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        background: radial-gradient(360px circle at var(--vt-card-mx, 50%) var(--vt-card-my, 0%), var(--vt-cosmos-glow, rgba(56,189,248,0.14)), transparent 62%);
        transition: opacity 0.25s ease;
      }
      .vt-res-card:hover::before, .lcms-glass-tile:hover::before { opacity: 1; }
      .vt-res-card.is-featured::after {
        content: '';
        position: absolute;
        right: -30px;
        bottom: -24px;
        width: 220px;
        height: 120px;
        pointer-events: none;
        opacity: 0.28;
        background: radial-gradient(ellipse at 70% 70%, rgba(56, 189, 248, 0.42), rgba(251, 191, 36, 0.16) 52%, transparent 74%);
        border-top: 1.5px solid rgba(56, 189, 248, 0.55);
        border-radius: 50%;
        transform: rotate(-14deg);
      }

      /* Nebula Accretion Belt Progress Bar */
      .vt-coop-fill, .vt-exam-coop-fill, .vt-res-progress-fill {
        background: linear-gradient(90deg, #38BDF8 0%, #818CF8 52%, #FBBF24 100%) !important;
        background-size: 200% 100% !important;
        box-shadow: 0 0 16px rgba(56, 189, 248, 0.45);
        animation: vtNebulaBeltFlow 4.5s linear infinite;
      }
      @keyframes vtNebulaBeltFlow {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }

      /* Supernova Combo Pulse & Rising Stardust Particles */
      .vt-supernova-pulse {
        animation: vtSupernovaBurst 0.65s cubic-bezier(0.22, 1, 0.36, 1);
      }
      @keyframes vtSupernovaBurst {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.85); }
        45% { transform: scale(1.14); box-shadow: 0 0 28px 8px rgba(251, 191, 36, 0.55); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
      }
      .vt-stardust-mote {
        position: fixed;
        pointer-events: none;
        z-index: 9990;
        font-size: 13px;
        color: #FBBF24;
        text-shadow: 0 0 10px rgba(251, 191, 36, 0.9);
        animation: vtStardustRise 0.95s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      @keyframes vtStardustRise {
        0% { opacity: 1; transform: translate(0, 0) scale(0.7); }
        60% { opacity: 0.95; transform: translate(var(--dx, 12px), -54px) scale(1.15); }
        100% { opacity: 0; transform: translate(var(--dx2, 24px), -105px) scale(0.4); }
      }

    
      /* === CELESTIAL PLANETARIUM & ASTROLABE LECTURE SYSTEM (60FPS) === */
      .vt-orbital-lecture-shell {
        border-radius: 22px;
        padding: 18px;
        border: 1px solid var(--border-strong);
      }
      html[data-theme="light"] .vt-orbital-lecture-shell {
        background-color: #FAF8F3;
        background-image:
          linear-gradient(to right, rgba(180, 83, 9, 0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(180, 83, 9, 0.06) 1px, transparent 1px);
        background-size: 48px 48px;
      }
      html[data-theme="dark"] .vt-orbital-lecture-shell {
        background-color: #040816;
        background-image:
          radial-gradient(620px circle at 18% 12%, rgba(56, 189, 248, 0.09), transparent 60%),
          radial-gradient(540px circle at 84% 82%, rgba(251, 191, 36, 0.06), transparent 62%);
      }

      /* Orbital Timeline Rail */
      .vt-lesson-toc.vt-orbital-rail {
        position: sticky;
        top: 12px;
        border-radius: 18px;
        padding: 14px 12px;
        background: var(--surface);
        border: 1px solid var(--border-strong);
      }
      .vt-orbital-progress-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11.5px;
        font-weight: 800;
        margin-bottom: 8px;
      }
      .vt-orbital-track {
        position: relative;
        padding-left: 18px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .vt-orbital-track::before {
        content: '';
        position: absolute;
        left: 6px;
        top: 8px;
        bottom: 8px;
        width: 2px;
        background: rgba(148, 163, 184, 0.28);
        border-radius: 9999px;
      }
      .vt-orbital-node-btn {
        position: relative;
        width: 100%;
        text-align: left;
        padding: 6px 8px;
        border-radius: 10px;
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: color 150ms ease, background-color 150ms ease;
      }
      .vt-orbital-node-btn::before {
        content: '';
        position: absolute;
        left: -16px;
        top: 50%;
        transform: translateY(-50%);
        width: 10px;
        height: 10px;
        border-radius: 9999px;
        background: var(--surface);
        border: 2px solid rgba(148, 163, 184, 0.55);
        transition: background-color 150ms ease, border-color 150ms ease, transform 150ms ease;
      }
      .vt-orbital-node-btn.is-read::before {
        background: #FBBF24;
        border-color: #F59E0B;
      }
      .vt-orbital-node-btn.active {
        color: var(--primary);
        background: rgba(37, 99, 235, 0.10);
        font-weight: 800;
      }
      .vt-orbital-node-btn.active::before {
        background: #38BDF8;
        border-color: #2563EB;
        transform: translateY(-50%) scale(1.22);
      }

      /* 5 Upgraded Academic Block Styles */
      .vt-blk-theory {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px 20px;
        line-height: 1.82;
        font-size: 15.2px;
      }
      .vt-blk-theory-title {
        font-family: 'Cormorant Garamond', 'Newsreader', Georgia, serif;
        font-size: 21px;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .vt-blk-theory-body::first-letter {
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-size: 1.38em;
        font-weight: 700;
        color: var(--primary);
      }

      /* Theorem Star-Core Box with 4 Astrolabe Corner Reticles */
      .vt-theorem-box.vt-blk-theorem-star {
        position: relative;
        border-radius: 20px;
        padding: 20px 22px;
        background: linear-gradient(145deg, rgba(29, 78, 216, 0.06), rgba(180, 83, 9, 0.06)), var(--surface);
        border: 1.5px solid rgba(180, 83, 9, 0.42);
      }
      html[data-theme="dark"] .vt-theorem-box.vt-blk-theorem-star {
        border-color: rgba(251, 191, 36, 0.45);
        background: linear-gradient(145deg, rgba(56, 189, 248, 0.09), rgba(251, 191, 36, 0.06)), rgba(10, 17, 38, 0.92);
      }
      .vt-astrolabe-corner {
        position: absolute;
        width: 12px;
        height: 12px;
        border-color: rgba(180, 83, 9, 0.65);
        border-style: solid;
        pointer-events: none;
      }
      html[data-theme="dark"] .vt-astrolabe-corner { border-color: rgba(251, 191, 36, 0.72); }
      .vt-astrolabe-corner.tl { top: 8px; left: 8px; border-width: 1.5px 0 0 1.5px; }
      .vt-astrolabe-corner.tr { top: 8px; right: 8px; border-width: 1.5px 1.5px 0 0; }
      .vt-astrolabe-corner.bl { bottom: 8px; left: 8px; border-width: 0 0 1.5px 1.5px; }
      .vt-astrolabe-corner.br { bottom: 8px; right: 8px; border-width: 0 1.5px 1.5px 0; }
      .vt-blk-theorem-star .vt-theorem-kicker {
        font-family: 'Cormorant Garamond', 'Newsreader', Georgia, serif;
        font-size: 20px;
        font-weight: 700;
        color: #B45309;
        margin-bottom: 8px;
      }
      html[data-theme="dark"] .vt-blk-theorem-star .vt-theorem-kicker { color: #FBBF24; }

      /* Method Eclipse Reveal & Inline Ruled Scratchpad */
      .vt-eclipse-steps {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }
      .vt-eclipse-step {
        padding: 10px 14px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--bg);
        line-height: 1.72;
        transition: filter 220ms ease, opacity 220ms ease, border-color 180ms ease;
      }
      .vt-eclipse-step.is-veiled {
        filter: blur(5.5px);
        opacity: 0.42;
        user-select: none;
        cursor: pointer;
      }
      .vt-eclipse-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      .vt-scratchpad-wrap {
        margin-top: 12px;
        border-radius: 16px;
        border: 1.5px solid var(--border-strong);
        background: #FFFFFF;
        overflow: hidden;
        display: none;
        flex-direction: column;
      }
      html[data-theme="dark"] .vt-scratchpad-wrap { background: #0B1324; }
      .vt-scratchpad-wrap.open { display: flex; }
      .vt-scratchpad-bar {
        padding: 7px 12px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 12px;
        font-weight: 700;
      }
      .vt-inline-scratchpad {
        width: 100%;
        height: 220px;
        display: block;
        touch-action: none;
        cursor: crosshair;
        background-image:
          linear-gradient(to right, rgba(148, 163, 184, 0.22) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(148, 163, 184, 0.22) 1px, transparent 1px);
        background-size: 24px 24px;
      }

      /* Planetarium Presentation Mode: Spotlight Focus + Meteor Laser */
      #vtPresentationOverlay {
        background: radial-gradient(760px circle at 18% 12%, rgba(56, 189, 248, 0.10), transparent 60%), #040816 !important;
      }
      html[data-theme="light"] #vtPresentationOverlay {
        background: #FAF8F3 !important;
      }
      .vt-pres-slide-card {
        transition: opacity 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms ease;
      }
      .vt-pres-stage.is-scroll-spotlight .vt-pres-slide-card {
        opacity: 0.44;
        cursor: pointer;
      }
      .vt-pres-stage.is-scroll-spotlight .vt-pres-slide-card.is-spotlight {
        opacity: 1;
        border-color: rgba(56, 189, 248, 0.55);
        box-shadow: 0 22px 54px -14px rgba(37, 99, 235, 0.24);
      }
      #vtPresLaserCanvas {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10002;
        pointer-events: none;
      }
      #vtPresLaserCanvas.is-armed {
        pointer-events: auto;
        cursor: crosshair;
      }
      .vt-pres-dock-btn.laser-on {
        background: linear-gradient(135deg, #DC2626, #EA580C) !important;
        color: #FFFFFF !important;
        border-color: transparent !important;
      }

      /* Side-by-Side Live Preview in Block Editor */
      .vt-ed-split-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
        gap: 12px;
        align-items: start;
      }
      .vt-ed-live-preview {
        padding: 12px;
        border-radius: 14px;
        border: 1px dashed var(--border-strong);
        background: var(--bg);
        min-height: 110px;
        font-size: 13.5px;
      }
      @media (max-width: 820px) {
        .vt-ed-split-grid { grid-template-columns: 1fr; }
        .vt-lesson-toc.vt-orbital-rail { position: static; margin-bottom: 12px; }
        .vt-orbital-track { flex-direction: row; overflow-x: auto; padding-left: 0; padding-bottom: 4px; }
        .vt-orbital-track::before, .vt-orbital-node-btn::before { display: none; }
        .vt-orbital-node-btn { white-space: nowrap; width: auto; border: 1px solid var(--border); }
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
          <div class="vt-res-drawer-head" style="flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
              <button id="vtResDrawerClose" class="btn btn-sm" type="button">← Quay lại Kho Chòm sao</button>
              <div style="min-width:0;">
                <div style="font-family:'Newsreader',serif;font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="vtResDrawerTitle">Học liệu</div>
                <div style="font-size:11.5px;color:var(--text-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="vtResDrawerSubtitle"></div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
              <button id="vtResOpenInWbBtn" class="btn btn-sm" type="button" style="display:none;" title="Mở tài liệu này trên Bảng Viết để giảng bài hoặc viết nháp lời giải">✍️ Mở trên Bảng Giảng để chữa / nháp bài</button>
              <button id="vtResPresentToggle" class="btn btn-sm" type="button" title="Mở chế độ trình chiếu toàn màn hình cho lớp học">🖥️ Trình chiếu Lớp học</button>
              <button id="vtResDrawerEditBtn" class="btn btn-sm" type="button" style="display:none;">✏️ Chỉnh sửa Bài giảng</button>
              <button id="vtResDrawerDoneBtn" class="btn btn-primary btn-sm" type="button" style="display:none;">✓ Hoàn thành Bài học</button>
            </div>
          </div>
          <div class="vt-res-drawer-body" id="vtResDrawerBody"></div>
        </div>
      </div>

      <!-- Resource Composer / Editor Modal (with Google Drive Upload) -->
      <div class="vt-res-modal-backdrop" id="vtResEditorBackdrop" role="dialog" aria-modal="true" aria-label="Biên soạn Học liệu">
        <div class="vt-res-modal">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-family:'Newsreader',serif;font-size:21px;margin:0;" id="vtResEditorHeading">Đăng tải Học liệu &amp; Đề thi</h3>
            <button id="vtResEditorClose" class="btn btn-sm" type="button">✕</button>
          </div>
          <div class="vt-res-seg-tabs" style="margin-bottom:14px;" id="vtEditorModeTabs">
            <button type="button" class="vt-res-seg-btn active" data-edtab="drop">☁️ Kéo thả Tệp (Ổ C / D)</button>
            <button type="button" class="vt-res-seg-btn" data-edtab="exam_pdf">📝 Tạo Đề thi PDF / Word</button>
            <button type="button" class="vt-res-seg-btn" data-edtab="blocks">🧩 Soạn Bài giảng Đa khối</button>
          </div>
          <form id="vtResEditorForm" novalidate>
            <!-- Tab 1 & 2: 15-Second Multi-File Drag & Drop Zone + Drive Link Paste -->
            <div id="vtEdDropPane" style="margin-bottom:12px;">
              <div id="vtDropZone" class="vt-drop-zone">
                <div style="font-size:24px;margin-bottom:4px;">☁️</div>
                <div style="font-weight:700;font-size:13.5px;">Kéo thả nhiều tệp PDF, Word, Slide, Excel, Ảnh, Video vào đây</div>
                <div style="font-size:12px;color:var(--text-soft);margin-top:3px;">Hoặc chạm để chọn tệp từ ổ C / D — tự động lưu lên Google Drive cá nhân</div>
                <input id="vtEdMultiFileInput" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,video/*" style="display:none;">
              </div>
              <div id="vtUploadProgWrap" class="vt-upload-prog-wrap">
                <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;margin-bottom:4px;"><span id="vtUploadProgLabel">Đang tải tệp lên Google Drive...</span><span id="vtUploadProgPct">0%</span></div>
                <div class="vt-upload-prog-track"><div id="vtUploadProgFill" class="vt-upload-prog-fill"></div></div>
              </div>
              <div style="display:flex;gap:8px;margin-top:8px;">
                <input id="vtPasteDriveUrl" type="url" placeholder="Hoặc dán nhanh đường liên kết Google Drive có sẵn..." style="flex:1;padding:8px 12px;border-radius:12px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);font-size:12.5px;">
                <button id="vtBtnAddDriveLink" class="btn btn-sm" type="button">+ Gắn liên kết</button>
              </div>
              <div id="vtEdAttachedFilesList" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;"></div>
            </div>
            <!-- Tab 2 Extra: Quick Answer Key for PDF/Word Split-Screen Exam -->
            <div id="vtEdExamKeyPane" style="display:none;margin-bottom:12px;padding:12px 14px;border-radius:14px;background:rgba(245,158,11,0.10);border:1px solid rgba(217,119,6,0.34);">
              <label for="vtEdQuickAnswerKey" style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;">🔑 Nhập nhanh bảng đáp án cho Đề PDF / Word (VD: 1A 2C 3D 4B 5A...)</label>
              <input id="vtEdQuickAnswerKey" type="text" placeholder="1A 2C 3D 4B 5A 6B..." style="width:100%;padding:9px 12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-family:var(--font-mono);font-size:13px;">
            </div>
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
                <input id="vtEdChapter" list="vtChapterDatalist" type="text" placeholder="Chọn hoặc nhập tên Chương / Chòm sao">
                <datalist id="vtChapterDatalist"></datalist>
              </div>
              <div class="vt-res-field">
                <label for="vtEdPattern">Dạng toán &amp; Phương pháp giải</label>
                <input id="vtEdPattern" list="vtPatternDatalist" type="text" placeholder="Chọn hoặc nhập Dạng toán">
                <datalist id="vtPatternDatalist"></datalist>
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
                <button class="btn btn-sm btn-primary" type="button" id="vtAddTemplate4Stages">✦ Tạo khung bài giảng chuẩn 4 chặng</button>
                <button class="btn btn-sm" type="button" id="vtAddBlkTheory">+ Lý thuyết</button>
                <button class="btn btn-sm" type="button" id="vtAddBlkTheorem">+ Định lý / Công thức</button>
                <button class="btn btn-sm" type="button" id="vtAddBlkMethod">+ Phương pháp giải</button>
                <button class="btn btn-sm" type="button" id="vtAddBlkLab">+ Đồ thị 2D/3D</button>
                <label class="btn btn-sm" style="cursor:pointer;">
                  <span>+ Tệp Google Drive</span>
                  <input id="vtEdDriveFileInput" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,video/*" style="display:none;">
                </label>
              </div>
              <div id="vtEdBlockBuilderList" class="vt-block-builder-list"></div>
            </div>

            <!-- Class Assignment Checkboxes with 1-Click Select All My Classes -->
            <div style="margin-bottom:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <span style="font-size:12px;font-weight:700;color:var(--text-muted);">Giao tới các lớp giảng dạy của bạn:</span>
                <div style="display:flex;gap:6px;"><button id="vtBtnSelectAllMyClasses" class="btn btn-sm" type="button" style="padding:3px 10px;font-size:11.5px;">✓ Chọn tất cả lớp tôi dạy</button><button id="vtBtnClearAllMyClasses" class="btn btn-sm" type="button" style="padding:3px 10px;font-size:11.5px;">Bỏ chọn</button></div>
              </div>
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

      <!-- Floating Return-to-Lesson Pill inside Lab Sector -->
      <button id="vtReturnToLessonPill" type="button" aria-label="Quay lại bài giảng đang học">
        <span>← Quay lại bài giảng đang học</span>
      </button>

      <!-- Full-Screen Classroom Presentation Overlay -->
      <div id="vtPresentationOverlay" role="dialog" aria-modal="true" aria-label="Chế độ Trình chiếu Lớp học">
        <div class="vt-pres-topbar">
          <div style="min-width:0;">
            <div id="vtPresTitle" style="font-family:'Newsreader',serif;font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Bài giảng</div>
            <div id="vtPresSub" style="font-size:12px;color:var(--text-soft);"></div>
          </div>
          <div id="vtPresCounter" style="font-size:13px;font-weight:800;color:var(--primary);white-space:nowrap;"></div>
        </div>
        <div class="vt-pres-stage" id="vtPresStage"></div>
        <canvas id="vtPresLaserCanvas" aria-hidden="true"></canvas>
        <div class="vt-pres-dock">
          <button id="vtPresModeBtn" class="vt-pres-dock-btn" type="button">Chế độ Cuộn liên tục</button>
          <button id="vtPresPrevBtn" class="vt-pres-dock-btn" type="button">← Khối trước</button>
          <button id="vtPresNextBtn" class="vt-pres-dock-btn" type="button">Khối tiếp theo →</button>
          <button id="vtPresLaserBtn" class="vt-pres-dock-btn" type="button" title="Bật/tắt Bút Laser Thiên thạch chỉ điểm công thức">🔴 Bút Laser</button>
          <button id="vtPresFontDec" class="vt-pres-dock-btn" type="button" title="Thu nhỏ cỡ chữ">A-</button>
          <button id="vtPresFontInc" class="vt-pres-dock-btn" type="button" title="Phóng to cỡ chữ">A+</button>
          <button id="vtPresOpenLabBtn" class="vt-pres-dock-btn primary" type="button">🔭 Phòng Thí nghiệm</button>
          <button id="vtPresOpenSlateBtn" class="vt-pres-dock-btn" type="button">✍️ Bảng Giảng</button>
          <button id="vtPresExitBtn" class="vt-pres-dock-btn" type="button">✕ Thoát</button>
        </div>
      </div>

      <!-- Lab Skin Shop Modal -->
      <div class="vt-res-modal-backdrop" id="vtSkinShopBackdrop" role="dialog" aria-modal="true" aria-label="Cửa hàng Giao diện Phòng Thí nghiệm">
        <div class="vt-res-modal" style="max-width:620px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-family:'Newsreader',serif;font-size:21px;margin:0;">✨ Cửa hàng Giao diện Phòng Thí nghiệm</h3>
            <button id="vtSkinShopClose" class="btn btn-sm" type="button">✕</button>
          </div>
          <div id="vtSkinShopBody"></div>
        </div>
      </div>

      <!-- Exam Builder Modal (Subject Teacher & Super Admin Only) -->
      <div class="vt-res-modal-backdrop" id="vtExamBuilderBackdrop" role="dialog" aria-modal="true" aria-label="Tạo Đề thi và Thử thách Tương tác">
        <div class="vt-res-modal" style="max-width:780px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-family:'Newsreader',serif;font-size:21px;margin:0;">+ Tạo Đề thi &amp; Thử thách Tương tác</h3>
            <button id="vtExamBuilderClose" class="btn btn-sm" type="button">✕</button>
          </div>
          <form id="vtExamBuilderForm" novalidate>
            <div class="vt-res-form-grid">
              <div class="vt-res-field" style="grid-column:1 / -1;">
                <label for="vtExTitle">Tiêu đề đề thi / thử thách *</label>
                <input id="vtExTitle" type="text" required placeholder="VD: Kiểm tra 15 phút Ứng dụng Đạo hàm">
              </div>
              <div class="vt-res-field">
                <label for="vtExGrade">Khối lớp</label>
                <select id="vtExGrade"><option>Khối 10</option><option>Khối 11</option><option selected>Khối 12</option><option>Đại học</option></select>
              </div>
              <div class="vt-res-field">
                <label for="vtExChapter">Chương / Chòm sao</label>
                <input id="vtExChapter" type="text" placeholder="VD: Ứng dụng Đạo hàm">
              </div>
              <div class="vt-res-field">
                <label for="vtExMode">Chế độ chinh phục mặc định</label>
                <select id="vtExMode">
                  <option value="DISCOVERY_5M">✦ Khám phá Nhanh (5 phút)</option>
                  <option value="COMBO_ARENA">⚡ Đấu trường Combo</option>
                  <option value="BOSS_CHALLENGE">👑 Đánh Trùm Chòm sao</option>
                  <option value="OFFICIAL_EXAM">⏱️ Phòng Thi Chuẩn Quốc gia</option>
                  <option value="EXAM_SPLIT">📄 Đề File Gốc Chia đôi Màn hình</option>
                </select>
              </div>
              <div class="vt-res-field">
                <label for="vtExDuration">Thời lượng (phút)</label>
                <input id="vtExDuration" type="number" min="5" value="15">
              </div>
              <div class="vt-res-field">
                <label for="vtExScope">Phạm vi xuất bản</label>
                <select id="vtExScope">
                  <option value="CLASS_ONLY">Theo lớp được giao</option>
                  <option value="SCHOOL">Đề xuất / Xuất bản Toàn trường</option>
                  <option value="PRIVATE">Riêng tư</option>
                </select>
              </div>
              <div class="vt-res-field">
                <label for="vtExDueDate">Hạn hoàn thành (tùy chọn)</label>
                <input id="vtExDueDate" type="date">
              </div>
            </div>

            <!-- Optional PDF/Word File for Split-Screen Exam -->
            <div style="padding:12px 14px;border-radius:14px;background:var(--bg);border:1px solid var(--border-strong);margin-bottom:12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <b style="font-size:12.5px;">📄 Đính kèm File Đề gốc PDF / Word (dùng cho Thi Chia đôi Màn hình)</b>
                <label class="btn btn-sm" style="cursor:pointer;">
                  <span>☁️ Tải tệp lên Google Drive</span>
                  <input id="vtExDriveFileInp" type="file" accept=".pdf,.doc,.docx" style="display:none;">
                </label>
              </div>
              <div id="vtExDriveFileStatus" style="font-size:12px;color:var(--text-soft);">Chưa đính kèm tệp đề gốc.</div>
              <div style="margin-top:8px;">
                <input id="vtExQuickKeyInp" type="text" placeholder="Tạo nhanh câu trắc nghiệm từ chuỗi đáp án (VD: 1A 2C 3D 4B 5A)..." style="width:100%;padding:8px 11px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12.5px;">
              </div>
            </div>

            <!-- Interactive Question List Builder -->
            <div style="padding:12px 14px;border-radius:16px;background:var(--bg);border:1px solid var(--border-strong);margin-bottom:12px;">
              <div style="font-size:12.5px;font-weight:800;margin-bottom:8px;">🧩 Danh sách Câu hỏi Tương tác</div>
              <div class="vt-block-add-bar">
                <button type="button" class="btn btn-sm" id="vtAddQMcq">+ Trắc nghiệm 4 lựa chọn</button>
                <button type="button" class="btn btn-sm" id="vtAddQTf">+ Đúng / Sai 4 ý</button>
                <button type="button" class="btn btn-sm" id="vtAddQShort">+ Trả lời ngắn</button>
                <button type="button" class="btn btn-sm" id="vtAddQGraph">+ Kéo &amp; Khớp Đồ thị</button>
              </div>
              <div id="vtExQuestionsList" class="vt-block-builder-list"></div>
            </div>

            <!-- Class Assignment -->
            <div style="margin-bottom:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:12px;font-weight:700;color:var(--text-muted);">Giao đề tới các lớp giảng dạy:</span>
                <button type="button" id="vtExSelectAllClasses" class="btn btn-sm" style="padding:3px 10px;font-size:11.5px;">✓ Chọn tất cả lớp của tôi</button>
              </div>
              <div id="vtExClassChecks" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button id="vtExamBuilderCancel" class="btn" type="button">Hủy</button>
              <button id="vtExamBuilderSubmit" class="btn btn-primary" type="submit">💾 Lưu &amp; Xuất bản Đề thi</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Teacher Error Heatmap & Analytics Modal -->
      <div class="vt-res-modal-backdrop" id="vtExamAnalyticsBackdrop" role="dialog" aria-modal="true" aria-label="Phân tích và Bản đồ Nhiệt Lỗi Sai">
        <div class="vt-res-modal" style="max-width:740px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-family:'Newsreader',serif;font-size:21px;margin:0;" id="vtExamAnalyticsTitle">📊 Phân tích &amp; Bản đồ Nhiệt Lỗi Sai</h3>
            <button id="vtExamAnalyticsClose" class="btn btn-sm" type="button">✕</button>
          </div>
          <div id="vtExamAnalyticsBody"></div>
        </div>
      </div>

      <div id="vtResToast" role="status" aria-live="polite"></div>
    `;
    document.body.appendChild(host);

    // Wire static overlay events
    document.getElementById('vtResDrawerClose').addEventListener('click', closeDrawer);
    document.getElementById('vtResPresentToggle').addEventListener('click', function () {
      const r = state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
      if (r) openPresentationMode(r);
    });
    document.getElementById('vtResOpenInWbBtn').addEventListener('click', function () {
      const r = state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
      if (!r) return;
      openResourceFileInWhiteboard(r, null);
    });
    document.getElementById('vtResDrawerEditBtn').addEventListener('click', function () {
      const r = state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
      if (!r) return;
      closeDrawer();
      openEditor(r, null);
    });
    document.getElementById('vtResDrawerDoneBtn').addEventListener('click', function () {
      if (state.activeResourceId) markProgress(state.activeResourceId, 'COMPLETED');
    });
    document.getElementById('vtReturnToLessonPill').addEventListener('click', returnToLessonFromLab);

    // Presentation overlay controls & iPad swipe
    document.getElementById('vtPresExitBtn').addEventListener('click', closePresentationMode);
    document.getElementById('vtPresModeBtn').addEventListener('click', function () {
      state.presentation.mode = state.presentation.mode === 'slide' ? 'scroll' : 'slide';
      renderPresentationStage();
    });
    document.getElementById('vtPresPrevBtn').addEventListener('click', function () {
      if (state.presentation.slideIdx > 0) { state.presentation.slideIdx--; renderPresentationStage(); }
    });
    document.getElementById('vtPresNextBtn').addEventListener('click', function () {
      state.presentation.slideIdx++;
      renderPresentationStage();
    });
    document.getElementById('vtPresFontDec').addEventListener('click', function () {
      state.presentation.fontScale = Math.max(0.85, Number((state.presentation.fontScale - 0.1).toFixed(2)));
      document.getElementById('vtPresentationOverlay').style.setProperty('--vt-pres-scale', String(state.presentation.fontScale));
    });
    document.getElementById('vtPresFontInc').addEventListener('click', function () {
      state.presentation.fontScale = Math.min(1.6, Number((state.presentation.fontScale + 0.1).toFixed(2)));
      document.getElementById('vtPresentationOverlay').style.setProperty('--vt-pres-scale', String(state.presentation.fontScale));
    });
    document.getElementById('vtPresOpenLabBtn').addEventListener('click', function () {
      const r = state.resources.find(function (x) { return x.resourceId === state.presentation.resourceId; });
      if (!r) return;
      const items = getLessonRenderItems(r);
      let snap = null;
      let bIdx = -1;
      const cur = items[state.presentation.slideIdx];
      if (cur && cur.kind === 'LAB_EMBED' && cur.labSnapshot) { snap = cur.labSnapshot; bIdx = state.presentation.slideIdx; }
      else {
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'LAB_EMBED' && items[i].labSnapshot) { snap = items[i].labSnapshot; bIdx = i; break; }
        }
      }
      closePresentationMode();
      launchLabFromLesson(r.resourceId, bIdx, snap);
    });
    const presStageEl = document.getElementById('vtPresStage');
    let presTouchX = 0;
    presStageEl.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches[0]) presTouchX = e.touches[0].clientX;
    }, { passive: true });
    presStageEl.addEventListener('touchend', function (e) {
      if (state.presentation.mode !== 'slide' || !e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - presTouchX;
      if (Math.abs(dx) < 55) return;
      if (dx < 0) { state.presentation.slideIdx++; renderPresentationStage(); }
      else if (state.presentation.slideIdx > 0) { state.presentation.slideIdx--; renderPresentationStage(); }
    }, { passive: true });

    const tpl4Btn = document.getElementById('vtAddTemplate4Stages');
    if (tpl4Btn) {
      tpl4Btn.addEventListener('click', function () {
        state.editorBlocks.push(
          { type: 'THEORY', title: 'Chặng 1: Khởi động & Lý thuyết trọng tâm', text: 'Trình bày khái niệm cốt lõi và ý nghĩa hình học của bài học...' },
          { type: 'THEOREM', title: 'Chặng 2: Định lý Hạt nhân Sao', text: 'Cho hàm số $y = f(x)$ liên tục trên $[a;b]$. Khi đó: $f\'(x) = 0$ xác định các điểm tới hạn.' },
          { type: 'METHOD', title: 'Chặng 3: Phương pháp giải & Ví dụ mẫu', text: 'Ví dụ: Tìm cực trị của hàm số $y = x^3 - 3x + 2$.', solution: 'Tính đạo hàm $y\' = 3x^2 - 3$.\nGiải $y\' = 0 \\Leftrightarrow x = \\pm 1$.\nLập bảng biến thiên và kết luận cực đại tại $x=-1$, cực tiểu tại $x=1$.' },
          { type: 'LAB_EMBED', title: 'Chặng 4: Khám phá trực quan 2D/3D', labSnapshot: { mode: 'standard', exprs: [{ expr: 'x^3 - 3*m*x + 2' }], params: { m: 1 } } }
        );
        renderEditorBlockBuilder();
        showNotice('✦ Đã tạo sẵn khung bài giảng chuẩn 4 chặng. Bạn có thể chỉnh sửa trực tiếp từng khối.');
      });
    }
    document.getElementById('vtAddBlkTheory').addEventListener('click', function () {
      state.editorBlocks.push({ type: 'THEORY', style: 'plain', title: 'Lý thuyết trọng tâm', text: '' });
      renderEditorBlockBuilder();
    });
    document.getElementById('vtAddBlkTheorem').addEventListener('click', function () {
      state.editorBlocks.push({ type: 'THEOREM', style: 'theorem', title: 'Định lý & Công thức trọng tâm', text: '' });
      renderEditorBlockBuilder();
    });
    document.getElementById('vtAddBlkMethod').addEventListener('click', function () {
      state.editorBlocks.push({ type: 'METHOD', style: 'method', title: 'Phương pháp giải & Ví dụ mẫu', text: 'Bước 1: ...\nBước 2: ...', solution: '' });
      renderEditorBlockBuilder();
    });
    document.getElementById('vtAddBlkLab').addEventListener('click', function () {
      const snap = {
        exprs: [{ expr: 'x^3 - 3*m*x', color: '#38BDF8', visible: true }],
        params: { m: 1 },
        mode: 'standard',
        solid3D: false,
        view: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
      };
      state.editorBlocks.push({
        type: 'LAB_EMBED',
        title: 'Mô phỏng Đồ thị 2D/3D Tương tác',
        labSnapshot: snap,
        snapshot: snap
      });
      renderEditorBlockBuilder();
    });
    document.addEventListener('keydown', function (e) {
      if (state.presentation.open) {
        if (e.key === 'Escape') { closePresentationMode(); return; }
        if (state.presentation.mode === 'slide') {
          if (e.key === 'ArrowRight') { state.presentation.slideIdx++; renderPresentationStage(); }
          else if (e.key === 'ArrowLeft' && state.presentation.slideIdx > 0) { state.presentation.slideIdx--; renderPresentationStage(); }
        }
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
    const dropZone = document.getElementById('vtDropZone');
    const multiInp = document.getElementById('vtEdMultiFileInput');
    if (dropZone && multiInp) {
      dropZone.addEventListener('click', function () { multiInp.click(); });
      dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('drag-over'); });
      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          handleMultiDriveFiles(Array.from(e.dataTransfer.files));
        }
      });
      multiInp.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length) handleMultiDriveFiles(Array.from(e.target.files));
        e.target.value = '';
      });
    }
    const addLinkBtn = document.getElementById('vtBtnAddDriveLink');
    if (addLinkBtn) {
      addLinkBtn.addEventListener('click', function () {
        const inp = document.getElementById('vtPasteDriveUrl');
        const url = (inp && inp.value || '').trim();
        const m = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
        if (!m) { showNotice('⚠ Đường liên kết Google Drive chưa đúng định dạng.', true); return; }
        const fid = m[1];
        state.editorFiles.push({
          fileId: fid,
          name: 'Tài liệu Google Drive (' + fid.slice(0, 6) + ')',
          previewUrl: 'https://drive.google.com/file/d/' + fid + '/preview',
          downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fid
        });
        inp.value = '';
        renderAttachedFilesList();
        showNotice('✓ Đã gắn liên kết Google Drive.');
      });
    }
    document.querySelectorAll('#vtEditorModeTabs [data-edtab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.editorTab = btn.getAttribute('data-edtab');
        syncEditorTabVisibility();
      });
    });
    const selAllBtn = document.getElementById('vtBtnSelectAllMyClasses');
    if (selAllBtn) {
      selAllBtn.addEventListener('click', function () {
        document.querySelectorAll('.vt-ed-cls-cb').forEach(function (cb) { cb.checked = true; });
      });
    }
    const clrAllBtn = document.getElementById('vtBtnClearAllMyClasses');
    if (clrAllBtn) {
      clrAllBtn.addEventListener('click', function () {
        document.querySelectorAll('.vt-ed-cls-cb').forEach(function (cb) { cb.checked = false; });
      });
    }
    document.getElementById('vtResEditorForm').addEventListener('submit', handleEditorSubmit);
    document.getElementById('vtResBulkConfirm').addEventListener('click', handleBulkAssignConfirm);
    document.getElementById('vtSkinShopClose').addEventListener('click', function () {
      document.getElementById('vtSkinShopBackdrop').classList.remove('open');
    });
    document.getElementById('vtExamAnalyticsClose').addEventListener('click', function () {
      document.getElementById('vtExamAnalyticsBackdrop').classList.remove('open');
    });
    document.getElementById('vtExamBuilderClose').addEventListener('click', closeExamBuilder);
    document.getElementById('vtExamBuilderCancel').addEventListener('click', closeExamBuilder);
    document.getElementById('vtExamBuilderForm').addEventListener('submit', handleExamBuilderSubmit);
    document.getElementById('vtExSelectAllClasses').addEventListener('click', function () {
      document.querySelectorAll('.vt-ex-cls-cb').forEach(function (cb) { cb.checked = true; });
    });
    document.getElementById('vtAddQMcq').addEventListener('click', function () {
      state.examBuilderQuestions.push({ id: 'Q' + (state.examBuilderQuestions.length + 1), type: 'MCQ', prompt: '', options: ['A. ', 'B. ', 'C. ', 'D. '], correctAnswer: 'A', points: 1, solution: '', trapReasons: {} });
      renderExamBuilderQuestions();
    });
    document.getElementById('vtAddQTf').addEventListener('click', function () {
      state.examBuilderQuestions.push({ id: 'Q' + (state.examBuilderQuestions.length + 1), type: 'TRUE_FALSE', prompt: '', subItems: [{ key: 'a', text: 'a) ' }, { key: 'b', text: 'b) ' }, { key: 'c', text: 'c) ' }, { key: 'd', text: 'd) ' }], correctAnswer: { a: true, b: false, c: true, d: false }, points: 1, solution: '' });
      renderExamBuilderQuestions();
    });
    document.getElementById('vtAddQShort').addEventListener('click', function () {
      state.examBuilderQuestions.push({ id: 'Q' + (state.examBuilderQuestions.length + 1), type: 'SHORT_ANSWER', prompt: '', correctAnswer: '', points: 1, solution: '' });
      renderExamBuilderQuestions();
    });
    document.getElementById('vtAddQGraph').addEventListener('click', function () {
      state.examBuilderQuestions.push({ id: 'Q' + (state.examBuilderQuestions.length + 1), type: 'GRAPH_TARGET', prompt: 'Kéo thanh trượt tham số $m$ để đồ thị khớp với đường cong nét đứt.', correctAnswer: 1, points: 2, graphConfig: { expr: 'x^3 - 3*m*x', targetM: 1, min: -3, max: 3, step: 0.1, tolerance: 0.25 }, solution: '' });
      renderExamBuilderQuestions();
    });
    document.getElementById('vtExDriveFileInp').addEventListener('change', async function (ev) {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const st = document.getElementById('vtExDriveFileStatus');
      if (st) st.textContent = 'Đang tải ' + f.name + ' lên Google Drive...';
      try {
        const up = await uploadFileToGoogleDrive(f, function (pct) {
          if (st) st.textContent = 'Đang tải ' + f.name + ' (' + pct + '%)...';
        });
        state.examBuilderDriveFile = up;
        if (st) st.innerHTML = '✓ Đã gắn tệp: <b>' + escapeHtml(up.name) + '</b>';
        const modeSel = document.getElementById('vtExMode');
        if (modeSel) modeSel.value = 'EXAM_SPLIT';
      } catch (err) {
        if (st) st.textContent = '⚠ ' + formatFriendlyError(err.message);
      }
      ev.target.value = '';
    });
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
    injectStyles();
    ensureOverlaysDOM();
    const ctx = getSession();
    if (!ctx) return;

    const C = getCore();
    if (!state.loaded) {
      const resMount = document.getElementById('vtResourcesMount');
      if (resMount && C && C.ui && typeof C.ui.skeleton === 'function') {
        resMount.innerHTML = C.ui.skeleton(5);
      }
      const cached = await readCache(ctx.email);
      if (cached && cached.data) {
        state.localSyncRev = Number(cached.syncRev) || 0;
        applyHubData(cached.data);
      }
    }
    await fetchHubFromServer(state.loaded);
  }

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
    const W = 940, H = 228;
    const pts = showList.map(function (r, idx) {
      const x = showList.length === 1 ? W / 2 : 68 + (idx / (showList.length - 1)) * (W - 136);
      const y = 114 + Math.sin(idx * 1.18 + 0.5) * 56 + (idx % 2 === 0 ? -12 : 14);
      let isLit = false;
      let statusLabel = 'Chưa khám phá';
      let ratio = 0;
      if (isStudent()) {
        const pr = state.myProgress[r.resourceId];
        isLit = Boolean(pr && (pr.status === 'COMPLETED' || pr.status === 'MASTERED'));
        statusLabel = isLit ? '★ Đã hoàn thành sáng rực' : (pr ? '✦ Đang khám phá' : '○ Ngôi sao mới');
        ratio = isLit ? 1 : (pr ? 0.5 : 0.18);
      } else {
        const st = state.completionStats[r.resourceId];
        ratio = st && st.started > 0 ? Math.min(1, st.completed / st.started) : 0.35;
        isLit = ratio >= 0.6;
        statusLabel = st && st.started > 0 ? ('Hoàn thành ' + Math.round(ratio * 100) + '% lớp') : 'Sẵn sàng giao bài';
      }
      return { x: x, y: y, r: r, isLit: isLit, ratio: ratio, statusLabel: statusLabel };
    });

    // Subtle celestial equatorial grid lines
    let gridLines = '';
    for (let gx = 94; gx < W; gx += 94) {
      gridLines += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '" stroke="rgba(148,163,184,0.09)" stroke-width="0.6"/>';
    }
    for (let gy = 56; gy < H; gy += 56) {
      gridLines += '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" stroke="rgba(148,163,184,0.09)" stroke-width="0.6"/>';
    }

    // Per-segment star beams: golden glowing beam when source star is lit
    let beamsSvg = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (a.isLit) {
        beamsSvg += '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" stroke="rgba(251,191,36,0.78)" stroke-width="2.2" filter="url(#vtStarGlow)"/>';
      } else {
        beamsSvg += '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" stroke="rgba(147,197,253,0.34)" stroke-width="1.4" stroke-dasharray="5 7"/>';
      }
    }

    const nodesSvg = pts.map(function (p, idx) {
      const fill = p.isLit ? '#FBBF24' : '#38BDF8';
      const shortTitle = p.r.title.length > 18 ? p.r.title.slice(0, 17) + '…' : p.r.title;
      const delay = (idx * 0.28).toFixed(2);
      return '<g class="vt-star-node" data-open-res="' + escapeAttr(p.r.resourceId) + '" data-star-title="' + escapeAttr(p.r.title) + '" data-star-chap="' + escapeAttr(p.r.chapterConstellation || 'Chòm sao Tri thức') + '" data-star-status="' + escapeAttr(p.statusLabel) + '">' +
        '<circle class="vt-star-corona" style="animation-delay:' + delay + 's" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="22" fill="' + fill + '" opacity="0.34"/>' +
        '<circle class="vt-star-core" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (p.isLit ? '8.2' : '7.2') + '" fill="' + fill + '" stroke="#FFFFFF" stroke-width="1.8" filter="url(#vtStarGlow)"/>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 25).toFixed(1) + '" text-anchor="middle" fill="#E2E8F0" font-size="11" font-weight="600">' + escapeHtml(shortTitle) + '</text>' +
      '</g>';
    }).join('');

    setTimeout(bindLivingStarChartInteractions, 0);

    return '<div class="vt-star-tooltip" id="vtStarHoverTip"></div>' +
      '<svg class="vt-constellation-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      '<defs><filter id="vtStarGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      gridLines +
      beamsSvg +
      nodesSvg +
    '</svg>';
  }

  function bindLivingStarChartInteractions() {
    const stage = document.querySelector('.vt-constellation-stage');
    const tip = document.getElementById('vtStarHoverTip');
    if (!stage || stage.getAttribute('data-parallax-wired') === '1') return;
    stage.setAttribute('data-parallax-wired', '1');

    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!isCoarse) {
      stage.addEventListener('pointermove', function (e) {
        const rect = stage.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 28;
        const ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 20;
        stage.style.setProperty('--vt-par-x', nx.toFixed(1) + 'px');
        stage.style.setProperty('--vt-par-y', ny.toFixed(1) + 'px');
      }, { passive: true });
    }

    stage.addEventListener('pointerover', function (e) {
      const node = e.target.closest && e.target.closest('.vt-star-node');
      if (!node || !tip) return;
      const rect = stage.getBoundingClientRect();
      const nRect = node.getBoundingClientRect();
      tip.innerHTML = '<div style="font-weight:800;color:#F8FAFC;margin-bottom:2px;">' + escapeHtml(node.getAttribute('data-star-title') || '') + '</div>' +
        '<div style="color:#94A3B8;font-size:11px;">' + escapeHtml(node.getAttribute('data-star-chap') || '') + '</div>' +
        '<div style="color:#FBBF24;font-weight:700;font-size:11px;margin-top:3px;">' + escapeHtml(node.getAttribute('data-star-status') || '') + '</div>';
      tip.style.left = Math.max(110, Math.min(rect.width - 110, (nRect.left + nRect.width / 2) - rect.left)) + 'px';
      tip.style.top = Math.max(52, (nRect.top - rect.top)) + 'px';
      tip.classList.add('visible');
    });
    stage.addEventListener('pointerout', function (e) {
      const node = e.target.closest && e.target.closest('.vt-star-node');
      if (node && tip) tip.classList.remove('visible');
    });
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

    const canManage = canUploadResource();
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
      ? '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          (state.resources.length === 0 ? '<button id="vtBtnSeedConstellation" class="btn" type="button">✦ Nạp bộ Chòm sao Mẫu (Khối 12)</button>' : '') +
          '<button id="vtBtnNewResource" class="btn btn-primary" type="button">+ Đăng tải Học liệu &amp; Đề thi</button>' +
        '</div>'
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
    const btnSeed = document.getElementById('vtBtnSeedConstellation');
    if (btnSeed) btnSeed.addEventListener('click', seedSampleConstellations);

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

  function normalizeBlockItem(blk, fallbackIdx) {
    if (!blk || typeof blk !== 'object') {
      return { kind: 'THEORY', title: 'Nội dung ' + (fallbackIdx + 1), text: '' };
    }
    const rawType = String(blk.type || '').toUpperCase();
    if (rawType === 'DRIVE_MEDIA' || rawType === 'DRIVE_EMBED' || blk.previewUrl) {
      return {
        kind: 'DRIVE_MEDIA',
        title: blk.title || blk.name || 'Tài liệu đính kèm',
        name: blk.name || blk.title || 'Tài liệu gốc',
        fileId: blk.fileId || '',
        previewUrl: blk.previewUrl || (blk.fileId ? ('https://drive.google.com/file/d/' + blk.fileId + '/preview') : ''),
        downloadUrl: blk.downloadUrl || (blk.fileId ? ('https://drive.google.com/uc?export=download&id=' + blk.fileId) : (blk.previewUrl || ''))
      };
    }
    if (rawType === 'LAB_EMBED' || rawType === 'LAB_SNAPSHOT' || blk.labSnapshot || blk.snapshot) {
      const snap = blk.labSnapshot || blk.snapshot || { exprs: [{ expr: 'x^3 - 3*m*x', color: '#38BDF8', visible: true }], params: { m: 1 }, mode: 'standard' };
      return {
        kind: 'LAB_EMBED',
        title: blk.title || 'Mô phỏng Đồ thị 2D/3D Tương tác',
        labSnapshot: snap
      };
    }
    if (rawType === 'THEOREM' || blk.style === 'theorem') {
      return { kind: 'THEOREM', title: blk.title || 'Định lý & Công thức trọng tâm', text: blk.text || '' };
    }
    if (rawType === 'METHOD' || blk.style === 'method') {
      let mainText = blk.text || '';
      let solText = blk.solution || '';
      if (!solText && /Lời giải chi tiết\s*:/i.test(mainText)) {
        const parts = mainText.split(/Lời giải chi tiết\s*:/i);
        mainText = parts[0].trim();
        solText = parts.slice(1).join('Lời giải chi tiết:').trim();
      }
      return { kind: 'METHOD', title: blk.title || 'Phương pháp giải & Ví dụ mẫu', text: mainText, solution: solText };
    }
    return { kind: 'THEORY', title: blk.title || 'Lý thuyết trọng tâm', text: blk.text || '' };
  }

  function getLessonRenderItems(r) {
    const items = [];
    (r.files || []).forEach(function (f, i) {
      const pUrl = f.previewUrl || (f.fileId ? ('https://drive.google.com/file/d/' + f.fileId + '/preview') : '');
      const dUrl = f.downloadUrl || (f.fileId ? ('https://drive.google.com/uc?export=download&id=' + f.fileId) : pUrl);
      if (pUrl) {
        items.push({
          kind: 'DRIVE_MEDIA',
          title: f.name || ('Tài liệu đính kèm ' + (i + 1)),
          name: f.name || ('Tài liệu đính kèm ' + (i + 1)),
          fileId: f.fileId || '',
          previewUrl: pUrl,
          downloadUrl: dUrl
        });
      }
    });
    (r.blocks || []).forEach(function (blk, i) {
      items.push(normalizeBlockItem(blk, i));
    });
    if (!items.length && r.summary) {
      items.push({ kind: 'THEORY', title: 'Tổng quan bài học', text: r.summary });
    }
    return items;
  }

  function showReturnToLessonPill(show) {
    const pill = document.getElementById('vtReturnToLessonPill');
    if (!pill) return;
    if (show && state.returnLessonId) pill.classList.add('visible');
    else pill.classList.remove('visible');
  }

  function launchLabFromLesson(resourceId, blockIdx, snap) {
    const bodyEl = document.getElementById('vtResDrawerBody');
    state.returnLessonId = resourceId || state.activeResourceId || '';
    state.returnBlockIndex = typeof blockIdx === 'number' ? blockIdx : -1;
    state.returnScrollTop = bodyEl ? bodyEl.scrollTop : 0;
    closeDrawer();
    if (snap && typeof window.VANTHESIS_LOAD_LAB_SNAPSHOT === 'function') {
      window.VANTHESIS_LOAD_LAB_SNAPSHOT(snap);
    } else if (typeof window.VANTHESIS_SWITCH_SECTOR === 'function') {
      window.VANTHESIS_SWITCH_SECTOR('lab');
    }
    showReturnToLessonPill(true);
  }

  function returnToLessonFromLab() {
    const targetId = state.returnLessonId;
    const targetIdx = state.returnBlockIndex;
    const savedScroll = state.returnScrollTop;
    showReturnToLessonPill(false);
    if (typeof window.VANTHESIS_SWITCH_SECTOR === 'function') {
      window.VANTHESIS_SWITCH_SECTOR('resources');
    }
    if (targetId) {
      openDrawer(targetId);
      setTimeout(function () {
        const bodyEl = document.getElementById('vtResDrawerBody');
        const blkEl = targetIdx >= 0 ? document.getElementById('vtLessonBlock_' + targetIdx) : null;
        if (blkEl && typeof blkEl.scrollIntoView === 'function') {
          blkEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (bodyEl && savedScroll > 0) {
          bodyEl.scrollTop = savedScroll;
        }
      }, 120);
    }
  }

  function openDrawer(resourceId) {
    state.activeResourceId = resourceId;
    document.getElementById('vtResDrawerBackdrop').classList.add('open');
    renderDrawerContent();
    if (isStudent() && !state.myProgress[resourceId]) {
      callApi('resources_mark_progress', { resourceId: resourceId, status: 'VIEWED' }).then(function () {
        fetchHubFromServer(true);
      });
    }
  }

  function openPresentationMode(resource) {
    const r = resource || state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
    if (!r) return;
    state.presentation.open = true;
    state.presentation.resourceId = r.resourceId;
    state.presentation.slideIdx = 0;
    const ov = document.getElementById('vtPresentationOverlay');
    if (ov) {
      ov.style.setProperty('--vt-pres-scale', String(state.presentation.fontScale || 1));
      ov.classList.add('open');
    }
    renderPresentationStage();
  }

  function closePresentationMode() {
    state.presentation.open = false;
    const ov = document.getElementById('vtPresentationOverlay');
    if (ov) ov.classList.remove('open');
  }

  function togglePresentationMode(forceState) {
    if (forceState === false) { closePresentationMode(); return; }
    const r = state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
    if (r) openPresentationMode(r);
  }

  function closeDrawer() {
    state.activeResourceId = '';
    const bd = document.getElementById('vtResDrawerBackdrop');
    if (bd) {
      bd.classList.remove('open');
      bd.classList.remove('is-presenting');
    }
  }

  function getLabModeLabel(snap) {
    if (!snap) return 'Đồ thị 2D';
    if (snap.solid3D || snap.mode === 'solid3d') return 'Khối tròn xoay 3D';
    if (snap.mode === 'trig' || snap.mode === 'unit_circle') return 'Vòng tròn lượng giác';
    return 'Đồ thị 2D';
  }

  // Safe lightweight expression evaluator for embedded 2D/3D lesson preview
  function evalEmbedExpr(exprStr, xVal, paramsObj) {
    try {
      let s = String(exprStr || '').trim()
        .replace(/\^/g, '**')
        .replace(/\b(sin|cos|tan|abs|sqrt|exp|log|ln)\b/gi, function (m) {
          const low = m.toLowerCase();
          return low === 'ln' ? 'Math.log' : ('Math.' + low);
        })
        .replace(/\bpi\b/gi, 'Math.PI');
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
    const isTrig = Boolean(snap.mode === 'trig' || snap.mode === 'unit_circle');

    if (isTrig) {
      const cx = w * 0.5, cy = h * 0.5, rad = Math.min(w, h) * 0.36;
      const angle = Number(params.m !== undefined ? params.m : (params.a !== undefined ? params.a : 0.8));
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx - rad - 24, cy); ctx.lineTo(cx + rad + 24, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - rad - 24); ctx.lineTo(cx, cy + rad + 24); ctx.stroke();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      const px = cx + Math.cos(angle) * rad;
      const py = cy - Math.sin(angle) * rad;
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#34D399';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
      ctx.strokeStyle = '#A78BFA';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillText('cos = ' + Math.cos(angle).toFixed(2) + '   sin = ' + Math.sin(angle).toFixed(2), 14, h - 14);
      return;
    }

    if (is3D) {
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
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.58)';
      ctx.lineWidth = 1.15;
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
      ctx.fillText('Kéo chuột hoặc chạm để xoay khối tròn xoay 3D', 12, h - 12);
      return;
    }

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

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 1.4;
    const ox = toPx(0), oy = toPy(0);
    if (oy >= 0 && oy <= h) { ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke(); }
    if (ox >= 0 && ox <= w) { ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke(); }

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

  function splitSolutionSteps(rawSol) {
    const lines = String(rawSol || '').split(/\r?\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    return lines.length ? lines : [];
  }

  function renderSingleLessonBlockHtml(item, idx, forPresentation) {
    const idAttr = forPresentation ? '' : (' id="vtLessonBlock_' + idx + '" data-lesson-block-idx="' + idx + '"');
    if (item.kind === 'DRIVE_MEDIA' && item.previewUrl) {
      return '<div class="lcms-glass-tile"' + idAttr + '>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
          '<b style="font-size:14.5px;">📎 ' + escapeHtml(item.name || item.title || 'Tài liệu đính kèm') + '</b>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button class="btn btn-sm btn-primary" type="button" data-open-wb-idx="' + idx + '">✍️ Đưa đề lên Bảng Giảng Thiên Văn</button>' +
            '<a class="btn btn-sm" href="' + escapeAttr(item.previewUrl) + '" target="_blank" rel="noopener">↗ Mở toàn màn hình</a>' +
            '<a class="btn btn-sm" href="' + escapeAttr(item.downloadUrl || item.previewUrl) + '" target="_blank" rel="noopener">⬇ Tải bản gốc</a>' +
          '</div>' +
        '</div>' +
        '<iframe class="vt-drive-preview-frame" src="' + escapeAttr(item.previewUrl) + '" allow="autoplay"></iframe>' +
      '</div>';
    }
    if (item.kind === 'LAB_EMBED' && item.labSnapshot) {
      const snap = item.labSnapshot;
      const paramKeys = Object.keys(snap.params || {});
      const slidersHtml = paramKeys.map(function (pk) {
        const val = Number(snap.params[pk]);
        const curVal = isFinite(val) ? val : 1;
        return '<div class="vt-embed-slider-row"><span>Tham số <b>' + escapeHtml(pk) + '</b> = <b data-embed-param-val="' + escapeAttr(pk) + '">' + curVal.toFixed(1) + '</b></span><input type="range" min="-5" max="5" step="0.1" value="' + curVal + '" data-embed-param="' + escapeAttr(pk) + '"></div>';
      }).join('');
      const exprBadges = (snap.exprs || []).map(function (e) {
        return '<span class="vt-res-pill" style="font-size:12px;">' + renderMathInText('$y = ' + String(e.expr || '').replace(/\*/g, '') + '$') + '</span>';
      }).join(' ');
      return '<div class="vt-embed-lab-card"' + idAttr + ' data-embed-lab-idx="' + idx + '">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
          '<div style="font-family:\'Cormorant Garamond\',serif;font-weight:700;font-size:19px;">∫ ' + escapeHtml(item.title || 'Mô phỏng Đồ thị 2D/3D Trực tiếp') + '</div>' +
          '<span class="vt-res-pill class">' + escapeHtml(getLabModeLabel(snap)) + '</span>' +
        '</div>' +
        (exprBadges ? '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + exprBadges + '</div>' : '') +
        '<canvas class="vt-embed-lab-canvas" aria-label="Khung mô phỏng đồ thị tương tác"></canvas>' +
        slidersHtml +
        '<button class="btn btn-primary btn-sm" type="button" data-load-snap="' + idx + '" style="align-self:flex-start;">🔭 Mở rộng sang Phòng Thí nghiệm 2D/3D</button>' +
      '</div>';
    }
    if (item.kind === 'THEOREM') {
      return '<div class="vt-theorem-box vt-blk-theorem-star"' + idAttr + '>' +
        '<span class="vt-astrolabe-corner tl"></span><span class="vt-astrolabe-corner tr"></span>' +
        '<span class="vt-astrolabe-corner bl"></span><span class="vt-astrolabe-corner br"></span>' +
        '<div class="vt-theorem-kicker">✦ ' + escapeHtml(item.title || 'Định lý Hạt nhân Sao') + '</div>' +
        '<div style="line-height:1.8;">' + renderMathInText(item.text || '') + '</div>' +
      '</div>';
    }
    if (item.kind === 'METHOD') {
      const steps = splitSolutionSteps(item.solution);
      let eclipseHtml = '';
      if (steps.length) {
        const stepsHtml = steps.map(function (st, sIdx) {
          const veiled = sIdx > 0 ? ' is-veiled' : '';
          return '<div class="vt-eclipse-step' + veiled + '" data-eclipse-step="' + sIdx + '"><strong style="color:var(--primary);margin-right:6px;">Bước ' + (sIdx + 1) + ':</strong>' + renderMathInText(st) + '</div>';
        }).join('');
        eclipseHtml =
          '<div class="vt-eclipse-wrap" data-eclipse-block="' + idx + '">' +
            '<div class="vt-eclipse-steps">' + stepsHtml + '</div>' +
            '<div class="vt-eclipse-controls">' +
              '<button type="button" class="btn btn-sm btn-primary" data-eclipse-next="' + idx + '">✨ Hé lộ từng bước</button>' +
              '<button type="button" class="btn btn-sm" data-eclipse-all="' + idx + '">Mở toàn bộ lời giải</button>' +
              '<button type="button" class="btn btn-sm" data-scratch-toggle="' + idx + '">✍️ Mở giấy nháp ngay tại đây</button>' +
            '</div>' +
          '</div>';
      } else {
        eclipseHtml =
          '<div class="vt-eclipse-controls">' +
            '<button type="button" class="btn btn-sm" data-scratch-toggle="' + idx + '">✍️ Mở giấy nháp ngay tại đây</button>' +
          '</div>';
      }
      const scratchpadHtml =
        '<div class="vt-scratchpad-wrap" data-scratch-wrap="' + idx + '">' +
          '<div class="vt-scratchpad-bar">' +
            '<span>Giấy nháp ô ly trực tiếp</span>' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              '<button type="button" class="btn btn-sm" data-scratch-color="#0F172A" style="padding:2px 8px;">Đen</button>' +
              '<button type="button" class="btn btn-sm" data-scratch-color="#1D4ED8" style="padding:2px 8px;color:#1D4ED8;">Xanh</button>' +
              '<button type="button" class="btn btn-sm" data-scratch-color="#DC2626" style="padding:2px 8px;color:#DC2626;">Đỏ</button>' +
              '<button type="button" class="btn btn-sm" data-scratch-clear="' + idx + '" style="padding:2px 8px;">Xóa nháp</button>' +
            '</div>' +
          '</div>' +
          '<canvas class="vt-inline-scratchpad" data-scratch-canvas="' + idx + '"></canvas>' +
        '</div>';

      return '<div class="vt-method-box"' + idAttr + '>' +
        '<div class="vt-method-kicker" style="font-family:\'Cormorant Garamond\',serif;font-size:20px;font-weight:700;">🧭 ' + escapeHtml(item.title || 'Phương pháp giải & Ví dụ mẫu') + '</div>' +
        '<div style="line-height:1.78;">' + renderMathInText(item.text || '') + '</div>' +
        eclipseHtml +
        scratchpadHtml +
      '</div>';
    }
    return '<div class="vt-blk-theory"' + idAttr + '>' +
      (item.title ? '<div class="vt-blk-theory-title">' + escapeHtml(item.title) + '</div>' : '') +
      '<div class="vt-blk-theory-body">' + renderMathInText(item.text || '') + '</div></div>';
  }

  function wireEclipseAndScratchpads(rootEl) {
    if (!rootEl) return;
    // Eclipse step-by-step reveal
    rootEl.querySelectorAll('[data-eclipse-next]').forEach(function (btn) {
      if (btn._vtBound) return;
      btn._vtBound = true;
      btn.addEventListener('click', function () {
        const wrap = btn.closest('.vt-eclipse-wrap');
        if (!wrap) return;
        const nextVeiled = wrap.querySelector('.vt-eclipse-step.is-veiled');
        if (nextVeiled) nextVeiled.classList.remove('is-veiled');
      });
    });
    rootEl.querySelectorAll('[data-eclipse-all]').forEach(function (btn) {
      if (btn._vtBound) return;
      btn._vtBound = true;
      btn.addEventListener('click', function () {
        const wrap = btn.closest('.vt-eclipse-wrap');
        if (!wrap) return;
        wrap.querySelectorAll('.vt-eclipse-step.is-veiled').forEach(function (el) { el.classList.remove('is-veiled'); });
      });
    });
    rootEl.querySelectorAll('.vt-eclipse-step.is-veiled').forEach(function (st) {
      if (st._vtBound) return;
      st._vtBound = true;
      st.addEventListener('click', function () { st.classList.remove('is-veiled'); });
    });

    // Inline ruled scratchpad toggle & drawing
    rootEl.querySelectorAll('[data-scratch-toggle]').forEach(function (btn) {
      if (btn._vtBound) return;
      btn._vtBound = true;
      btn.addEventListener('click', function () {
        const idx = btn.getAttribute('data-scratch-toggle');
        const wrap = rootEl.querySelector('[data-scratch-wrap="' + idx + '"]');
        if (!wrap) return;
        const isOpen = wrap.classList.toggle('open');
        btn.textContent = isOpen ? 'Ẩn giấy nháp' : '✍️ Mở giấy nháp ngay tại đây';
        if (isOpen) initSingleInlineScratchpad(wrap);
      });
    });
  }

  function initSingleInlineScratchpad(wrap) {
    const cvs = wrap.querySelector('.vt-inline-scratchpad');
    if (!cvs || cvs._vtScratchReady) return;
    cvs._vtScratchReady = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = cvs.getBoundingClientRect();
    cvs.width = Math.max(300, Math.floor(rect.width * dpr));
    cvs.height = Math.max(180, Math.floor(rect.height * dpr));
    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    let inkColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#F8FAFC' : '#0F172A';
    let drawing = false;

    wrap.querySelectorAll('[data-scratch-color]').forEach(function (b) {
      b.addEventListener('click', function () {
        inkColor = b.getAttribute('data-scratch-color');
        if (inkColor === '#0F172A' && document.documentElement.getAttribute('data-theme') === 'dark') inkColor = '#F8FAFC';
      });
    });
    const clrBtn = wrap.querySelector('[data-scratch-clear]');
    if (clrBtn) {
      clrBtn.addEventListener('click', function () { ctx.clearRect(0, 0, cvs.width, cvs.height); });
    }

    function getPos(e) {
      const r = cvs.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    cvs.addEventListener('pointerdown', function (e) {
      drawing = true;
      try { cvs.setPointerCapture(e.pointerId); } catch (err) {}
      const p = getPos(e);
      ctx.strokeStyle = inkColor;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });
    cvs.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    function stop(e) {
      drawing = false;
      try { cvs.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    cvs.addEventListener('pointerup', stop);
    cvs.addEventListener('pointercancel', stop);
  }

  function wireOrbitalTimelineProgress(rootEl) {
    if (!rootEl) return;
    const nodes = Array.from(rootEl.querySelectorAll('.vt-orbital-node-btn'));
    const blocks = Array.from(rootEl.querySelectorAll('[data-lesson-block-idx]'));
    const pctEl = rootEl.querySelector('#vtOrbitalPct');
    if (!nodes.length || !blocks.length) return;

    function updateOrbital(activeIdx) {
      nodes.forEach(function (n, i) {
        n.classList.toggle('active', i === activeIdx);
        if (i <= activeIdx) n.classList.add('is-read');
      });
      if (pctEl) {
        const pct = Math.min(100, Math.round(((activeIdx + 1) / blocks.length) * 100));
        pctEl.textContent = pct + '%';
      }
    }
    updateOrbital(0);

    if (typeof IntersectionObserver !== 'undefined') {
      const obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (ent) {
          if (ent.isIntersecting) {
            const idx = Number(ent.target.getAttribute('data-lesson-block-idx')) || 0;
            updateOrbital(idx);
          }
        });
      }, { threshold: 0.35 });
      blocks.forEach(function (b) { obs.observe(b); });
    }
  }

  function initEmbeddedLabCanvasesInRoot(rootEl, resourceObj, items) {
    if (!rootEl || !resourceObj) return;
    rootEl.querySelectorAll('[data-embed-lab-idx]').forEach(function (wrap) {
      const idx = Number(wrap.getAttribute('data-embed-lab-idx'));
      const item = items && items[idx];
      if (!item || !item.labSnapshot) return;
      const liveSnap = JSON.parse(JSON.stringify(item.labSnapshot));
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
          if (state.presentation.open) closePresentationMode();
          launchLabFromLesson(resourceObj.resourceId, idx, liveSnap);
        });
      }
    });
  }

  function initAllEmbeddedLabCanvases() {
    const r = state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
    if (!r) return;
    const bodyEl = document.getElementById('vtResDrawerBody');
    initEmbeddedLabCanvasesInRoot(bodyEl, r, getLessonRenderItems(r));
  }

  function renderPresentationStage() {
    const r = state.resources.find(function (x) { return x.resourceId === state.presentation.resourceId; });
    if (!r) return;
    const items = getLessonRenderItems(r);
    const total = Math.max(1, items.length);
    if (state.presentation.slideIdx >= total) state.presentation.slideIdx = total - 1;
    if (state.presentation.slideIdx < 0) state.presentation.slideIdx = 0;

    document.getElementById('vtPresTitle').textContent = r.title;
    document.getElementById('vtPresSub').textContent = [r.gradeBlock, r.chapterConstellation, r.topicPattern].filter(Boolean).join(' • ');
    const modeBtn = document.getElementById('vtPresModeBtn');
    const prevBtn = document.getElementById('vtPresPrevBtn');
    const nextBtn = document.getElementById('vtPresNextBtn');
    const counterEl = document.getElementById('vtPresCounter');
    const stageEl = document.getElementById('vtPresStage');

    if (state.presentation.mode === 'slide') {
      modeBtn.textContent = 'Chế độ Cuộn liên tục';
      prevBtn.style.display = '';
      nextBtn.style.display = '';
      prevBtn.disabled = state.presentation.slideIdx <= 0;
      nextBtn.disabled = state.presentation.slideIdx >= total - 1;
      counterEl.textContent = 'Khối ' + (state.presentation.slideIdx + 1) + ' / ' + total;
      const curItem = items[state.presentation.slideIdx];
      stageEl.innerHTML = curItem
        ? '<div class="vt-pres-slide-card">' + renderSingleLessonBlockHtml(curItem, state.presentation.slideIdx, true) + '</div>'
        : '<div class="vt-pres-slide-card">Chưa có nội dung trình chiếu.</div>';
    } else {
      modeBtn.textContent = 'Chế độ Từng khối (Slide)';
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      counterEl.textContent = total + ' khối nội dung';
      stageEl.innerHTML = items.map(function (it, idx) {
        return '<div class="vt-pres-slide-card">' + renderSingleLessonBlockHtml(it, idx, true) + '</div>';
      }).join('');
    }
    renderMathInElementSafe(stageEl);
    wireEclipseAndScratchpads(stageEl);
    stageEl.classList.toggle('is-scroll-spotlight', state.presentation.mode !== 'slide');
    const cards = Array.from(stageEl.querySelectorAll('.vt-pres-slide-card'));
    if (cards.length) {
      cards.forEach(function (c, i) {
        c.classList.toggle('is-spotlight', i === state.presentation.slideIdx);
        c.addEventListener('click', function () {
          if (state.presentation.mode !== 'slide') {
            state.presentation.slideIdx = i;
            cards.forEach(function (x, j) { x.classList.toggle('is-spotlight', j === i); });
          }
        });
      });
    }
    wirePlanetariumLaserAndControls();
    setTimeout(function () { initEmbeddedLabCanvasesInRoot(stageEl, r, items); }, 50);
  }

  let presLaserWired = false;
  let presLaserArmed = false;
  let presLaserTrails = [];
  let presLaserRaf = 0;

  function wirePlanetariumLaserAndControls() {
    if (presLaserWired) return;
    presLaserWired = true;
    const laserBtn = document.getElementById('vtPresLaserBtn');
    const laserCvs = document.getElementById('vtPresLaserCanvas');
    const slateBtn = document.getElementById('vtPresOpenSlateBtn');

    if (slateBtn) {
      slateBtn.addEventListener('click', function () {
        closePresentationMode();
        if (typeof window.VANTHESIS_SWITCH_SECTOR === 'function') window.VANTHESIS_SWITCH_SECTOR('slate');
      });
    }

    function resizeLaser() {
      if (!laserCvs) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      laserCvs.width = Math.floor(window.innerWidth * dpr);
      laserCvs.height = Math.floor(window.innerHeight * dpr);
      const ctx = laserCvs.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function renderLaserFrame() {
      presLaserRaf = 0;
      if (!laserCvs) return;
      const ctx = laserCvs.getContext('2d');
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const now = performance.now();
      presLaserTrails = presLaserTrails.filter(function (tr) { return now - tr.t < 1500; });
      for (let i = 0; i < presLaserTrails.length; i++) {
        const tr = presLaserTrails[i];
        const life = Math.max(0, 1 - (now - tr.t) / 1500);
        if (tr.pts.length > 1) {
          ctx.save();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(239, 68, 68, ' + (life * 0.42) + ')';
          ctx.lineWidth = 11;
          ctx.beginPath();
          ctx.moveTo(tr.pts[0].x, tr.pts[0].y);
          for (let k = 1; k < tr.pts.length; k++) ctx.lineTo(tr.pts[k].x, tr.pts[k].y);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(251, 191, 36, ' + (life * 0.95) + ')';
          ctx.lineWidth = 3.2;
          ctx.stroke();
          ctx.restore();
        }
      }
      if (presLaserTrails.length) {
        presLaserRaf = requestAnimationFrame(renderLaserFrame);
      }
    }

    if (laserBtn && laserCvs) {
      laserBtn.addEventListener('click', function () {
        presLaserArmed = !presLaserArmed;
        laserBtn.classList.toggle('laser-on', presLaserArmed);
        laserCvs.classList.toggle('is-armed', presLaserArmed);
        if (presLaserArmed) resizeLaser();
      });

      let curTrail = null;
      laserCvs.addEventListener('pointerdown', function (e) {
        if (!presLaserArmed) return;
        curTrail = { t: performance.now(), pts: [{ x: e.clientX, y: e.clientY }] };
        presLaserTrails.push(curTrail);
        if (!presLaserRaf) presLaserRaf = requestAnimationFrame(renderLaserFrame);
      });
      laserCvs.addEventListener('pointermove', function (e) {
        if (!presLaserArmed || !curTrail) return;
        curTrail.t = performance.now();
        curTrail.pts.push({ x: e.clientX, y: e.clientY });
        if (!presLaserRaf) presLaserRaf = requestAnimationFrame(renderLaserFrame);
      });
      const stopLaser = function () { curTrail = null; };
      laserCvs.addEventListener('pointerup', stopLaser);
      laserCvs.addEventListener('pointercancel', stopLaser);
    }

    // Spacebar reveals next Eclipse step in active presentation slide
    document.addEventListener('keydown', function (e) {
      if (!state.presentation.open) return;
      if (e.code === 'Space') {
        const stageEl = document.getElementById('vtPresStage');
        const nextVeiled = stageEl && stageEl.querySelector('.vt-eclipse-step.is-veiled');
        if (nextVeiled) {
          e.preventDefault();
          nextVeiled.classList.remove('is-veiled');
        }
      }
    });
  }

  function getCommentRoleBadge(cm) {
    const role = String(cm.authorRole || cm.role || '').toUpperCase();
    const email = String(cm.authorEmail || '').toLowerCase();
    if (role === 'SUPER_ADMIN' || email === 'kientdvct@gmail.com') {
      return '<span class="vt-role-badge admin">Super Admin</span>';
    }
    if (role === 'TEACHER' || role === 'SUBJECT_TEACHER' || role === 'HOMEROOM_TEACHER') {
      return '<span class="vt-role-badge teacher">Giáo viên</span>';
    }
    return '<span class="vt-role-badge student">Học sinh</span>';
  }

  function findPrimaryResourceFile(r) {
    if (!r) return null;
    if (Array.isArray(r.files) && r.files.length && (r.files[0].previewUrl || r.files[0].fileId)) {
      const f = r.files[0];
      return {
        fileId: f.fileId || '',
        previewUrl: f.previewUrl || ('https://drive.google.com/file/d/' + f.fileId + '/preview'),
        mimeType: f.mimeType || 'application/pdf'
      };
    }
    const items = getLessonRenderItems(r);
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'DRIVE_MEDIA' && (items[i].previewUrl || items[i].fileId)) {
        return {
          fileId: items[i].fileId || '',
          previewUrl: items[i].previewUrl || ('https://drive.google.com/file/d/' + items[i].fileId + '/preview'),
          mimeType: items[i].mimeType || 'application/pdf'
        };
      }
    }
    return null;
  }

  function openResourceFileInWhiteboard(resource, specificItem) {
    const primaryFile = specificItem
      ? {
          fileId: specificItem.fileId || '',
          previewUrl: specificItem.previewUrl || (specificItem.fileId ? ('https://drive.google.com/file/d/' + specificItem.fileId + '/preview') : ''),
          mimeType: specificItem.mimeType || 'application/pdf'
        }
      : findPrimaryResourceFile(resource);
    if (!primaryFile || !primaryFile.previewUrl) {
      showNotice('⚠ Học liệu này chưa có tệp đính kèm để mở trên Bảng Viết.', true);
      return;
    }
    closeDrawer();
    if (typeof window.VANTHESIS_OPEN_IN_SLATE === 'function') {
      window.VANTHESIS_OPEN_IN_SLATE({
        title: resource.title,
        driveFileId: primaryFile.fileId,
        previewUrl: primaryFile.previewUrl,
        mimeType: primaryFile.mimeType,
        sourceResourceId: resource.resourceId
      });
    } else {
      showNotice('⚠ Không gian Bảng Giảng Thiên Văn đang sẵn sàng — vui lòng thử lại sau giây lát.', true);
    }
  }

  function renderDrawerContent() {
    const r = state.resources.find(function (x) { return x.resourceId === state.activeResourceId; });
    if (!r) return;
    document.getElementById('vtResDrawerTitle').textContent = r.title;
    const subEl = document.getElementById('vtResDrawerSubtitle');
    if (subEl) subEl.textContent = [r.chapterConstellation, r.topicPattern].filter(Boolean).join(' • ');

    const sess = getSession();
    const myEmail = sess && sess.email ? String(sess.email).toLowerCase() : '';
    const isOwner = myEmail && String(r.authorEmail || '').toLowerCase() === myEmail;
    const wbBtn = document.getElementById('vtResOpenInWbBtn');
    if (wbBtn) wbBtn.style.display = findPrimaryResourceFile(r) ? '' : 'none';
    const editBtn = document.getElementById('vtResDrawerEditBtn');
    if (editBtn) editBtn.style.display = (canUploadResource() && (isAdmin() || isOwner)) ? '' : 'none';
    const doneBtn = document.getElementById('vtResDrawerDoneBtn');
    if (doneBtn) {
      doneBtn.style.display = isStudent() ? '' : 'none';
      const st = state.myProgress[r.resourceId];
      doneBtn.textContent = (st && (st.status === 'COMPLETED' || st.status === 'MASTERED')) ? '★ Đã Hoàn thành' : '✓ Hoàn thành Bài học';
    }

    const bodyEl = document.getElementById('vtResDrawerBody');
    const assignedClasses = state.assignments
      .filter(function (a) { return a.resourceId === r.resourceId; })
      .map(function (a) {
        const c = state.classes.find(function (cl) { return cl.classId === a.classId; });
        return c ? ('Lớp ' + c.className) : a.classId;
      });

    const items = getLessonRenderItems(r);
    const blocksHtml = items.map(function (it, idx) {
      return renderSingleLessonBlockHtml(it, idx, false);
    }).join('') || '<div class="lcms-glass-tile" style="color:var(--text-muted);">Chưa có nội dung chi tiết.</div>';

    const tocEntries = items.map(function (it, idx) {
      return { id: 'vtLessonBlock_' + idx, label: (idx + 1) + '. ' + (it.title || 'Phần ' + (idx + 1)) };
    });
    tocEntries.push({ id: 'vtLessonQaSection', label: '💬 Hỏi – Đáp bài học' });

    const tocSidebarHtml = '<aside class="vt-lesson-toc vt-orbital-rail" aria-label="Quỹ đạo tiến trình bài giảng">' +
      '<div class="vt-orbital-progress-head"><span>✦ Quỹ đạo bài giảng</span><span id="vtOrbitalPct" style="color:var(--primary);">0%</span></div>' +
      '<div class="vt-orbital-track">' +
      tocEntries.map(function (t, i) {
        return '<button type="button" class="vt-toc-link' + (i === 0 ? ' active' : '') + '" data-toc-target="' + escapeAttr(t.id) + '">' + escapeHtml(t.label) + '</button>';
      }).join('') +
    '</div></aside>';

    const mobileJumpHtml = '<div class="vt-lesson-mobile-jump" aria-label="Chuyển nhanh phần bài giảng">' +
      tocEntries.map(function (t) {
        return '<button type="button" class="vt-toc-chip" data-toc-target="' + escapeAttr(t.id) + '">' + escapeHtml(t.label) + '</button>';
      }).join('') +
    '</div>';

    const comments = state.commentsByResource[r.resourceId] || [];
    const commentsHtml = comments.map(function (cm) {
      return '<div style="padding:11px 13px;border-radius:14px;background:var(--surface-alt);border:1px solid var(--border);">' +
        '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px;color:var(--text-soft);margin-bottom:5px;">' +
          '<b style="color:var(--text);">' + escapeHtml(cm.authorName || 'Thành viên') + '</b>' +
          getCommentRoleBadge(cm) +
          '<span>• ' + escapeHtml(String(cm.createdAt || '').replace('T', ' ').slice(0, 16)) + '</span>' +
        '</div>' +
        '<div style="font-size:13.8px;line-height:1.68;">' + renderMathInText(cm.contentLatex) + '</div>' +
      '</div>';
    }).join('') || '<div style="font-size:12.5px;color:var(--text-soft);">Chưa có câu hỏi thảo luận nào cho bài giảng này.</div>';

    const quickBarHtml = '<div class="vt-math-quickbar">' + QUICK_MATH_SYMBOLS.map(function (s) {
      return '<button type="button" class="vt-math-sym-btn" data-ins-sym="' + escapeAttr(s.ins) + '">' + escapeHtml(s.lbl) + '</button>';
    }).join('') + '</div>';

    const progBtns = isStudent()
      ? '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button id="vtBtnMarkDone" class="btn btn-primary btn-sm" type="button">✓ Hoàn thành Bài học (+10★)</button><button id="vtBtnMarkMaster" class="btn btn-sm" type="button">★ Đạt mức Tinh thông (+25★)</button></div>'
      : '';

    bodyEl.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
        '<span class="vt-res-pill">' + escapeHtml(r.gradeBlock) + '</span>' +
        '<span class="vt-res-pill">' + escapeHtml(r.chapterConstellation) + '</span>' +
        '<span class="vt-res-pill">' + escapeHtml(COGNITIVE_LABELS[r.cognitiveLevel] || r.cognitiveLevel) + '</span>' +
        (assignedClasses.length ? '<span class="vt-res-pill class">Đã giao: ' + escapeHtml(assignedClasses.join(', ')) + '</span>' : '') +
      '</div>' +
      mobileJumpHtml +
      '<div class="vt-lesson-layout">' +
        '<div class="vt-lesson-main">' +
          progBtns +
          blocksHtml +
          '<div id="vtLessonQaSection" style="margin-top:8px;padding-top:16px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px;">' +
            '<div style="font-weight:800;font-size:15px;">💬 Hỏi – Đáp Công thức Theo Bài Giảng</div>' +
            commentsHtml +
            quickBarHtml +
            '<form id="vtResCommentForm" style="display:flex;flex-direction:column;gap:8px;">' +
              '<div style="display:flex;gap:8px;">' +
                '<input id="vtResCommentInput" type="text" placeholder="Nhập câu hỏi hoặc giải đáp (dùng $...$ cho công thức Toán)..." style="flex:1;padding:10px 12px;border-radius:12px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);">' +
                '<button class="btn btn-primary btn-sm" type="submit">Gửi trao đổi</button>' +
              '</div>' +
              '<div id="vtResCommentPreview" class="vt-comment-preview" style="display:none;"></div>' +
            '</form>' +
          '</div>' +
        '</div>' +
        tocSidebarHtml +
      '</div>';

    renderMathInElementSafe(bodyEl);
    initEmbeddedLabCanvasesInRoot(bodyEl, r, items);
      wireEclipseAndScratchpads(bodyEl);
      wireOrbitalTimelineProgress(bodyEl);

    bodyEl.querySelectorAll('[data-open-wb-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = Number(btn.getAttribute('data-open-wb-idx'));
        openResourceFileInWhiteboard(r, items[idx] || null);
      });
    });

    bodyEl.querySelectorAll('[data-toc-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = document.getElementById(btn.getAttribute('data-toc-target'));
        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        bodyEl.querySelectorAll('.vt-toc-link').forEach(function (l) { l.classList.remove('active'); });
        if (btn.classList.contains('vt-toc-link')) btn.classList.add('active');
      });
    });

    const cInput = document.getElementById('vtResCommentInput');
    const cPreview = document.getElementById('vtResCommentPreview');
    const updateCommentPreview = function () {
      if (!cInput || !cPreview) return;
      const val = cInput.value.trim();
      if (!val) { cPreview.style.display = 'none'; cPreview.innerHTML = ''; return; }
      cPreview.style.display = '';
      cPreview.innerHTML = '<div class="vt-blk-math-preview-label">Xem trước công thức</div><div>' + renderMathInText(val) + '</div>';
      renderMathInElementSafe(cPreview);
    };
    if (cInput) cInput.addEventListener('input', updateCommentPreview);

    bodyEl.querySelectorAll('[data-ins-sym]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!cInput) return;
        const sym = btn.getAttribute('data-ins-sym') || '';
        const start = cInput.selectionStart || cInput.value.length;
        cInput.value = cInput.value.slice(0, start) + sym + cInput.value.slice(start);
        cInput.focus();
        updateCommentPreview();
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
        const val = cInput.value.trim();
        if (!val) return;
        const res = await callApi('resources_comment_upsert', { resourceId: r.resourceId, contentLatex: val });
        if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
        cInput.value = '';
        updateCommentPreview();
        showNotice('✓ Đã gửi trao đổi lên bài giảng.');
        await fetchHubFromServer(true);
      });
    }
  }

  async function markProgress(resourceId, status) {
    const res = await callApi('resources_mark_progress', { resourceId: resourceId, status: status });
    if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
    showNotice(status === 'MASTERED' ? '★ Xuất sắc! Ngôi sao bài học đã đạt mức Tinh thông (+25 Bụi Sao).' : '✓ Đã hoàn thành bài học và thắp sáng ngôi sao (+10 Bụi Sao).');
    await fetchHubFromServer(true);
  }

  /* ==========================================================================
   * 9. RESOURCE EDITOR, BLOCK-BASED LESSON STUDIO, DRIVE UPLOAD & BULK ASSIGN
   * ========================================================================== */

  function syncEditorTabVisibility() {
    document.querySelectorAll('#vtEditorModeTabs [data-edtab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-edtab') === state.editorTab);
    });
    const dropPane = document.getElementById('vtEdDropPane');
    const keyPane = document.getElementById('vtEdExamKeyPane');
    if (dropPane) dropPane.style.display = (state.editorTab === 'drop' || state.editorTab === 'exam_pdf') ? '' : 'none';
    if (keyPane) keyPane.style.display = state.editorTab === 'exam_pdf' ? '' : 'none';
  }

  function renderAttachedFilesList() {
    const el = document.getElementById('vtEdAttachedFilesList');
    if (!el) return;
    el.innerHTML = state.editorFiles.map(function (f, idx) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:10px;background:var(--surface);border:1px solid var(--border);font-size:12.5px;">' +
        '<span>📎 <b>' + escapeHtml(f.name) + '</b></span>' +
        '<button type="button" class="btn btn-sm" data-rm-file="' + idx + '" style="color:var(--danger);">✕</button>' +
      '</div>';
    }).join('');
    el.querySelectorAll('[data-rm-file]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.editorFiles.splice(Number(btn.getAttribute('data-rm-file')), 1);
        renderAttachedFilesList();
      });
    });
  }

  async function handleMultiDriveFiles(fileList) {
    const wrap = document.getElementById('vtUploadProgWrap');
    const fill = document.getElementById('vtUploadProgFill');
    const pctEl = document.getElementById('vtUploadProgPct');
    const lblEl = document.getElementById('vtUploadProgLabel');
    if (wrap) wrap.classList.add('active');

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const mbStr = (f.size / (1024 * 1024)).toFixed(2) + ' MB';
      if (lblEl) lblEl.textContent = 'Đang tải (' + (i + 1) + '/' + fileList.length + '): ' + f.name + ' (' + mbStr + ')';
      try {
        const up = await uploadFileToGoogleDrive(f, function (pct) {
          if (fill) fill.style.width = pct + '%';
          if (pctEl) pctEl.textContent = pct + '%';
        });
        state.editorFiles.push(up);
        const titleInp = document.getElementById('vtEdTitle');
        if (titleInp && !titleInp.value.trim()) {
          titleInp.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        }
        const typeSel = document.getElementById('vtEdType');
        if (typeSel && i === 0) {
          if (state.editorTab === 'exam_pdf') typeSel.value = 'EXERCISE';
          else if (/video/i.test(f.type)) typeSel.value = 'VIDEO';
          else typeSel.value = 'PDF';
        }
        renderAttachedFilesList();
      } catch (err) {
        showNotice('⚠ ' + formatFriendlyError(err.message), true);
      }
    }
    if (wrap) wrap.classList.remove('active');
    showNotice('✓ Đã tải xong ' + fileList.length + ' tệp lên Google Drive.');
  }

  async function seedSampleConstellations() {
    const clsIds = state.classes.map(function (c) { return c.classId; });
    const scope = isAdmin() ? 'SCHOOL' : 'CLASS_ONLY';
    const samples = [
      {
        title: 'Đơn điệu & Cực trị Hàm bậc ba',
        gradeBlock: 'Khối 12',
        chapterConstellation: 'Ứng dụng Đạo hàm',
        topicPattern: 'Cực trị hàm đa thức',
        cognitiveLevel: 'THONG_HIEU',
        starOrder: 1,
        featuredBento: true,
        resourceType: 'LESSON',
        summary: 'Trực quan hóa điều kiện $f\x27(x)=0$ đổi dấu qua điểm cực trị.',
        blocks: [
          { type: 'THEOREM', style: 'theorem', title: 'Điều kiện tồn tại hai điểm cực trị', text: 'Hàm số $y = x^3 - 3mx$ có hai điểm cực trị khi phương trình $y\x27 = 3x^2 - 3m = 0$ có hai nghiệm phân biệt $\Leftrightarrow m > 0$.' },
          { type: 'METHOD', style: 'method', title: 'Phương pháp khảo sát nhanh cực trị', text: 'Bước 1: Tính đạo hàm $y\x27 = 3x^2 - 3m$.\nBước 2: Giải $y\x27 = 0$ và lập bảng xét dấu.', solution: 'Với $m = 1$, ta có $y\x27 = 3x^2 - 3 = 0 \Leftrightarrow x = \pm 1$. Hàm số đạt cực đại tại $x = -1$ và cực tiểu tại $x = 1$.' },
          { type: 'LAB_EMBED', title: 'Mô phỏng Đồ thị $y = x^3 - 3mx$', labSnapshot: { exprs: [{ expr: 'x^3 - 3*m*x', color: '#38BDF8', visible: true }], params: { m: 1 }, mode: 'standard', solid3D: false, view: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 } } }
        ]
      },
      {
        title: 'Đường Tiệm cận & Khảo sát Hàm phân thức',
        gradeBlock: 'Khối 12',
        chapterConstellation: 'Ứng dụng Đạo hàm',
        topicPattern: 'Tiệm cận đứng và ngang',
        cognitiveLevel: 'VAN_DUNG',
        starOrder: 2,
        featuredBento: false,
        resourceType: 'LAB',
        summary: 'Khám phá tiệm cận đồ thị hàm bậc nhất trên bậc nhất.',
        blocks: [
          { type: 'THEORY', title: 'Khái niệm đường tiệm cận', text: 'Xét hàm phân thức $y = \frac{ax+b}{cx+d}$ với $ad - bc \neq 0$. Tiệm cận đứng là $x = -\frac{d}{c}$ và tiệm cận ngang là $y = \frac{a}{c}$.' },
          { type: 'LAB_EMBED', title: 'Mô phỏng Hàm phân thức', labSnapshot: { exprs: [{ expr: '(2*x + m)/(x - 1)', color: '#FBBF24', visible: true }], params: { m: 1 }, mode: 'standard', solid3D: false, view: { xMin: -6, xMax: 6, yMin: -6, yMax: 6 } } }
        ]
      },
      {
        title: 'Bảng Nguyên hàm Cơ bản & Đổi biến số',
        gradeBlock: 'Khối 12',
        chapterConstellation: 'Nguyên hàm – Tích phân',
        topicPattern: 'Phương pháp đổi biến',
        cognitiveLevel: 'NHAN_BIET',
        starOrder: 1,
        featuredBento: true,
        resourceType: 'LESSON',
        summary: 'Hệ thống công thức nguyên hàm trọng tâm kèm ví dụ từng bước.',
        blocks: [
          { type: 'THEOREM', style: 'theorem', title: 'Công thức nguyên hàm cốt lõi', text: '$$\int x^\alpha \,dx = \frac{x^{\alpha+1}}{\alpha+1} + C \quad (\alpha \neq -1)$$' }
        ]
      },
      {
        title: 'Ứng dụng Tích phân tính Thể tích Khối tròn xoay',
        gradeBlock: 'Khối 12',
        chapterConstellation: 'Nguyên hàm – Tích phân',
        topicPattern: 'Thể tích vật thể tròn xoay',
        cognitiveLevel: 'VAN_DUNG_CAO',
        starOrder: 2,
        featuredBento: false,
        resourceType: 'LAB',
        summary: 'Mô phỏng trực tiếp công thức $V = \pi \int_a^b [f(x)]^2 dx$ trong không gian 3D.',
        blocks: [
          { type: 'THEOREM', style: 'theorem', title: 'Công thức Thể tích khối tròn xoay', text: '$$V = \pi \int_{a}^{b} [f(x)]^2 \,dx$$' },
          { type: 'LAB_EMBED', title: 'Khối tròn xoay 3D quanh trục Ox', labSnapshot: { exprs: [{ expr: 'sqrt(abs(m*x)) + 0.5', color: '#38BDF8', visible: true }], params: { m: 1 }, mode: 'solid3d', solid3D: true, view: { xMin: -4, xMax: 4, yMin: -4, yMax: 4 } } }
        ]
      }
    ];
    showNotice('✦ Đang nạp 4 học liệu mẫu thuộc 2 chòm sao Khối 12...');
    for (let i = 0; i < samples.length; i++) {
      await callApi('resources_upsert', { payload: Object.assign({ subject: 'Toán học', publishScope: scope, assignedClassIds: clsIds }, samples[i]) });
    }
    showNotice('✓ Đã nạp hoàn tất Bộ Chòm sao Mẫu Khối 12!');
    await fetchHubFromServer(false);
  }

  function openEditor(existingRes, initialLabSnapshot) {
    if (!canUploadResource()) {
      showNotice('⚠ Chỉ Giáo viên Bộ môn được phân công giảng dạy hoặc Quản trị viên mới có quyền tạo và chỉnh sửa học liệu.', true);
      return;
    }
    state.editingResource = existingRes || null;
    state.editorPreviewOpen = {};
    state.editorTab = initialLabSnapshot ? 'blocks' : (existingRes && Array.isArray(existingRes.blocks) && existingRes.blocks.length ? 'blocks' : 'drop');
    state.editorFiles = existingRes && Array.isArray(existingRes.files) ? JSON.parse(JSON.stringify(existingRes.files)) : [];
    state.editorBlocks = existingRes && Array.isArray(existingRes.blocks)
      ? JSON.parse(JSON.stringify(existingRes.blocks))
      : [];

    let suggestedTitle = '';
    if (initialLabSnapshot) {
      const snapClone = JSON.parse(JSON.stringify(initialLabSnapshot));
      const firstExpr = snapClone.exprs && snapClone.exprs[0] && snapClone.exprs[0].expr ? String(snapClone.exprs[0].expr).trim() : '';
      suggestedTitle = firstExpr ? ('Khảo sát & Mô phỏng hàm số y = ' + firstExpr) : 'Khảo sát & Mô phỏng Đồ thị 2D/3D';
      state.editorBlocks.push({
        type: 'LAB_EMBED',
        title: 'Khối Đồ thị 2D/3D Tương tác',
        labSnapshot: snapClone,
        snapshot: snapClone
      });
    }
    if (state.editorBlocks.length === 0) {
      state.editorBlocks.push({ type: 'THEORY', style: 'plain', title: 'Lý thuyết trọng tâm', text: '' });
    }

    document.getElementById('vtResEditorHeading').textContent = existingRes
      ? 'Chỉnh sửa Bài giảng Đa khối'
      : (initialLabSnapshot ? 'Đóng gói Mô phỏng 2D/3D thành Bài giảng' : 'Đăng tải Học liệu & Bài giảng Đa khối');
    document.getElementById('vtEdTitle').value = existingRes ? existingRes.title : suggestedTitle;
    document.getElementById('vtEdGrade').value = existingRes ? existingRes.gradeBlock : 'Khối 12';
    document.getElementById('vtEdSubject').value = existingRes ? existingRes.subject : 'Toán học';
    document.getElementById('vtEdChapter').value = existingRes ? existingRes.chapterConstellation : '';
    document.getElementById('vtEdPattern').value = existingRes ? existingRes.topicPattern : '';
    document.getElementById('vtEdCognitive').value = existingRes ? existingRes.cognitiveLevel : 'THONG_HIEU';
    document.getElementById('vtEdType').value = existingRes ? existingRes.resourceType : 'LESSON';
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

    const chSet = [], ptSet = [];
    state.resources.forEach(function (r) {
      if (r.chapterConstellation && chSet.indexOf(r.chapterConstellation) === -1) chSet.push(r.chapterConstellation);
      if (r.topicPattern && ptSet.indexOf(r.topicPattern) === -1) ptSet.push(r.topicPattern);
    });
    const chDl = document.getElementById('vtChapterDatalist');
    if (chDl) chDl.innerHTML = chSet.map(function (c) { return '<option value="' + escapeAttr(c) + '">'; }).join('');
    const ptDl = document.getElementById('vtPatternDatalist');
    if (ptDl) ptDl.innerHTML = ptSet.map(function (p) { return '<option value="' + escapeAttr(p) + '">'; }).join('');
    const selAllBtn = document.getElementById('vtBtnSelectAllMyClasses');
    if (selAllBtn) selAllBtn.textContent = '✓ Chọn tất cả lớp của tôi (' + state.classes.length + ' lớp)';

    syncEditorTabVisibility();
    renderAttachedFilesList();
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
      const norm = normalizeBlockItem(blk, idx);
      const badgeLabel = norm.kind === 'DRIVE_MEDIA'
        ? '📎 Khối Tài liệu Google Drive'
        : (norm.kind === 'LAB_EMBED'
          ? '∫ Khối Đồ thị 2D/3D Tương tác'
          : (norm.kind === 'THEOREM' ? '✦ Khối Định lý & Công thức' : (norm.kind === 'METHOD' ? '🧭 Khối Phương pháp giải' : '📘 Khối Lý thuyết')));

      let innerFields = '';
      if (norm.kind === 'DRIVE_MEDIA') {
        innerFields = '<div style="font-size:12.5px;color:var(--text-muted);">Tệp đính kèm: <b>' + escapeHtml(norm.name || 'Tài liệu') + '</b></div>';
      } else if (norm.kind === 'LAB_EMBED') {
        const snap = norm.labSnapshot || { exprs: [{ expr: 'x^3 - 3*m*x' }], params: { m: 1 }, mode: 'standard' };
        const exprVal = (snap.exprs && snap.exprs[0] && snap.exprs[0].expr) || '';
        const mVal = snap.params && snap.params.m !== undefined ? snap.params.m : 1;
        const modeVal = (snap.mode === 'solid3d' || snap.solid3D) ? 'solid3d' : ((snap.mode === 'trig' || snap.mode === 'unit_circle') ? 'trig' : 'standard');
        innerFields =
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">' +
            '<input type="text" data-blk-title="' + idx + '" value="' + escapeAttr(blk.title || norm.title) + '" placeholder="Tiêu đề khối đồ thị..." style="flex:1;min-width:180px;padding:7px 10px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12.5px;font-weight:700;">' +
            '<button type="button" class="btn btn-sm" data-blk-pull-lab="' + idx + '">📥 Lấy cấu hình đang mở ở Phòng Thí nghiệm</button>' +
          '</div>' +
          '<div class="vt-res-form-grid" style="margin:0;">' +
            '<div class="vt-res-field"><label>Hàm số chính f(x)</label><input type="text" data-blk-lab-expr="' + idx + '" value="' + escapeAttr(exprVal) + '"></div>' +
            '<div class="vt-res-field"><label>Chế độ &amp; Tham số m</label><div style="display:flex;gap:6px;"><select data-blk-lab-mode="' + idx + '" style="flex:1;"><option value="standard" ' + (modeVal === 'standard' ? 'selected' : '') + '>Đồ thị 2D</option><option value="trig" ' + (modeVal === 'trig' ? 'selected' : '') + '>Vòng tròn lượng giác</option><option value="solid3d" ' + (modeVal === 'solid3d' ? 'selected' : '') + '>Khối tròn xoay 3D</option></select><input type="number" step="0.5" data-blk-lab-m="' + idx + '" value="' + escapeAttr(mVal) + '" style="width:74px;"></div></div>' +
          '</div>';
      } else {
        const symBar = '<div class="vt-math-quickbar">' + QUICK_MATH_SYMBOLS.map(function (s) {
          return '<button type="button" class="vt-math-sym-btn" data-blk-ins-idx="' + idx + '" data-blk-ins-sym="' + escapeAttr(s.ins) + '">' + escapeHtml(s.lbl) + '</button>';
        }).join('') + '</div>';
        const isPrev = Boolean(state.editorPreviewOpen[idx]);
        const solField = norm.kind === 'METHOD'
          ? '<textarea rows="2" data-blk-solution="' + idx + '" placeholder="Lời giải chi tiết (tùy chọn — học sinh bấm để mở rộng xem sau khi tự thử sức)..." style="padding:8px 10px;border-radius:10px;border:1px dashed var(--border-strong);background:var(--surface);color:var(--text);font-size:12.5px;">' + escapeHtml(blk.solution || '') + '</textarea>'
          : '';
        innerFields =
          '<input type="text" data-blk-title="' + idx + '" value="' + escapeAttr(blk.title || '') + '" placeholder="Tiêu đề khối..." style="padding:7px 10px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12.5px;font-weight:700;">' +
          symBar +
          '<div class="vt-ed-split-grid">' +
            '<div style="display:flex;flex-direction:column;gap:8px;">' +
              '<textarea rows="3" data-blk-text="' + idx + '" placeholder="Nhập nội dung (dùng $...$ hoặc $...$ cho công thức Toán học)..." style="padding:8px 10px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12.8px;">' + escapeHtml(blk.text || '') + '</textarea>' +
              solField +
            '</div>' +
            '<div class="vt-ed-live-preview" data-blk-live-prev="' + idx + '">' +
              '<div style="font-size:11px;font-weight:800;color:var(--primary);margin-bottom:6px;">✦ Xem trước trực tiếp</div>' +
              '<div data-blk-live-body="' + idx + '">' + renderSingleLessonBlockHtml(norm, idx, true) + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:flex-start;">' +
            '<button type="button" class="btn btn-sm" data-blk-toggle-prev="' + idx + '">' + (isPrev ? '🙈 Ẩn xem trước công thức' : '👁️ Xem trước công thức') + '</button>' +
          '</div>' +
          (isPrev
            ? '<div class="vt-blk-math-preview" data-blk-prev-box="' + idx + '"><div class="vt-blk-math-preview-label">Xem trước hiển thị</div><div>' + renderMathInText(blk.text || '') + (blk.solution ? ('<hr style="border:0;border-top:1px dashed var(--border);margin:8px 0;"><div><b>Lời giải chi tiết:</b><br>' + renderMathInText(blk.solution) + '</div>') : '') + '</div></div>'
            : '');
      }

      return '<div class="vt-block-item">' +
        '<div class="vt-block-item-head">' +
          '<span>' + (idx + 1) + '. ' + badgeLabel + '</span>' +
          '<div style="display:flex;gap:4px;">' +
            '<button type="button" class="btn btn-sm" data-blk-up="' + idx + '" ' + (idx === 0 ? 'disabled' : '') + ' title="Di chuyển lên">↑</button>' +
            '<button type="button" class="btn btn-sm" data-blk-down="' + idx + '" ' + (idx === state.editorBlocks.length - 1 ? 'disabled' : '') + ' title="Di chuyển xuống">↓</button>' +
            '<button type="button" class="btn btn-sm" data-blk-dup="' + idx + '" title="Nhân bản khối">⧉</button>' +
            '<button type="button" class="btn btn-sm" data-blk-del="' + idx + '" style="color:var(--danger);" title="Xóa khối">✕</button>' +
          '</div>' +
        '</div>' +
        innerFields +
      '</div>';
    }).join('');

    renderMathInElementSafe(listEl);

    listEl.querySelectorAll('[data-blk-title]').forEach(function (inp) {
      inp.addEventListener('input', function () { state.editorBlocks[Number(inp.getAttribute('data-blk-title'))].title = inp.value; });
    });
    const refreshBlkPreview = function (idx) {
      const box = listEl.querySelector('[data-blk-prev-box="' + idx + '"]');
      const b = state.editorBlocks[idx];
      if (!box || !b) return;
      box.innerHTML = '<div class="vt-blk-math-preview-label">Xem trước hiển thị</div><div>' + renderMathInText(b.text || '') + (b.solution ? ('<hr style="border:0;border-top:1px dashed var(--border);margin:8px 0;"><div><b>Lời giải chi tiết:</b><br>' + renderMathInText(b.solution) + '</div>') : '') + '</div>';
      renderMathInElementSafe(box);
    };
    listEl.querySelectorAll('[data-blk-text]').forEach(function (ta) {
      ta.addEventListener('input', function () {
        const i = Number(ta.getAttribute('data-blk-text'));
        state.editorBlocks[i].text = ta.value;
        if (state.editorPreviewOpen[i]) refreshBlkPreview(i);
      });
    });
    listEl.querySelectorAll('[data-blk-solution]').forEach(function (ta) {
      ta.addEventListener('input', function () {
        const i = Number(ta.getAttribute('data-blk-solution'));
        state.editorBlocks[i].solution = ta.value;
        if (state.editorPreviewOpen[i]) refreshBlkPreview(i);
      });
    });
    listEl.querySelectorAll('[data-blk-ins-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.getAttribute('data-blk-ins-idx'));
        const sym = btn.getAttribute('data-blk-ins-sym') || '';
        const ta = listEl.querySelector('[data-blk-text="' + i + '"]');
        if (!ta) return;
        const start = ta.selectionStart || ta.value.length;
        ta.value = ta.value.slice(0, start) + sym + ta.value.slice(start);
        state.editorBlocks[i].text = ta.value;
        ta.focus();
        if (state.editorPreviewOpen[i]) refreshBlkPreview(i);
      });
    });
    listEl.querySelectorAll('[data-blk-toggle-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.getAttribute('data-blk-toggle-prev'));
        state.editorPreviewOpen[i] = !state.editorPreviewOpen[i];
        renderEditorBlockBuilder();
      });
    });
    listEl.querySelectorAll('[data-blk-pull-lab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.getAttribute('data-blk-pull-lab'));
        if (typeof window.VANTHESIS_GET_LAB_SNAPSHOT !== 'function') {
          showNotice('⚠ Phòng Thí nghiệm 2D/3D chưa sẵn sàng cấu hình.', true);
          return;
        }
        const snap = window.VANTHESIS_GET_LAB_SNAPSHOT();
        if (!snap) { showNotice('⚠ Chưa có hàm số nào đang mở ở Phòng Thí nghiệm.', true); return; }
        const clone = JSON.parse(JSON.stringify(snap));
        state.editorBlocks[i].labSnapshot = clone;
        state.editorBlocks[i].snapshot = clone;
        renderEditorBlockBuilder();
        showNotice('✓ Đã đồng bộ cấu hình từ Phòng Thí nghiệm 2D/3D.');
      });
    });
    listEl.querySelectorAll('[data-blk-lab-expr]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const b = state.editorBlocks[Number(inp.getAttribute('data-blk-lab-expr'))];
        const snap = b.labSnapshot || b.snapshot || { exprs: [{ expr: '', color: '#38BDF8', visible: true }], params: { m: 1 }, mode: 'standard' };
        if (!snap.exprs || !snap.exprs.length) snap.exprs = [{ expr: '', color: '#38BDF8', visible: true }];
        snap.exprs[0].expr = inp.value;
        b.labSnapshot = snap; b.snapshot = snap;
      });
    });
    listEl.querySelectorAll('[data-blk-lab-mode]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        const b = state.editorBlocks[Number(sel.getAttribute('data-blk-lab-mode'))];
        const snap = b.labSnapshot || b.snapshot;
        if (snap) {
          snap.mode = sel.value;
          snap.solid3D = sel.value === 'solid3d';
          b.labSnapshot = snap; b.snapshot = snap;
        }
      });
    });
    listEl.querySelectorAll('[data-blk-lab-m]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const b = state.editorBlocks[Number(inp.getAttribute('data-blk-lab-m'))];
        const snap = b.labSnapshot || b.snapshot;
        if (snap) {
          snap.params = snap.params || {};
          snap.params.m = Number(inp.value) || 0;
          b.labSnapshot = snap; b.snapshot = snap;
        }
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
    listEl.querySelectorAll('[data-blk-dup]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.getAttribute('data-blk-dup'));
        const copy = JSON.parse(JSON.stringify(state.editorBlocks[i]));
        state.editorBlocks.splice(i + 1, 0, copy);
        renderEditorBlockBuilder();
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
        type: 'DRIVE_MEDIA',
        fileId: uploaded.fileId,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        previewUrl: uploaded.previewUrl,
        downloadUrl: uploaded.downloadUrl
      });
      renderEditorBlockBuilder();
      showNotice('✓ Đã thêm khối tài liệu ' + uploaded.name + '.');
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
      files: state.editorFiles.slice(),
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
   * 9B. CHẶNG IV-B — SECTOR 3: ĐẤU TRƯỜNG ĐỀ & TINH THÔNG (#vtExamsMount)
   *     4 Conquest Modes, Split-Screen PDF/Word Exam, GRAPH_TARGET Dashed Curve,
   *     Trap Diagnostics + Parameterized Twin Problems (Zero eval),
   *     1s Local Auto-Draft, Tab-Switch Trust Tracking, StarDust Lab Skin Shop,
   *     Class Co-op Bar & Teacher Error Heatmap Analytics.
   * ========================================================================== */

  const LAB_SKINS = [
    { id: 'default', name: 'Chuẩn Học thuật', cost: 0, desc: 'Tông màu sắc nét, chuẩn mực cho giảng dạy hàng ngày.' },
    { id: 'chalkboard', name: 'Bảng phấn Cổ điển', cost: 20, desc: 'Tông bảng xanh phấn trắng dịu mắt khi luyện tập lâu.' },
    { id: 'violet_nebula', name: 'Tinh vân Tím', cost: 45, desc: 'Sắc tím vũ trụ sâu lắng kết hợp đường đồ thị phát sáng.' },
    { id: 'observatory_gold', name: 'Thiên văn Hoàng kim', cost: 80, desc: 'Ánh vàng hoàng kim sang trọng của Đài Thiên văn.' }
  ];

  const EXAM_MODES_META = [
    { id: 'DISCOVERY_5M', icon: '✦', name: 'Khám phá Nhanh (5 phút)', desc: 'Chuỗi 5 thẻ tương tác trực quan nắm bản chất hình học trước khi tính toán.' },
    { id: 'COMBO_ARENA', icon: '⚡', name: 'Đấu trường Combo', desc: 'Đúng liên tiếp kích hoạt huy hiệu Combo x2, x3, x5 Bụi Sao cùng âm thanh tinh tế.' },
    { id: 'BOSS_CHALLENGE', icon: '👑', name: 'Đánh Trùm Chòm sao', desc: 'Thử thách tổng hợp chương; chinh phục thành công thắp sáng ngôi sao trung tâm.' },
    { id: 'OFFICIAL_EXAM', icon: '⏱️', name: 'Phòng Thi Chuẩn Quốc gia & Đề File Gốc', desc: 'Đề kiểm tra định kỳ và đề file gốc chia đôi màn hình, tự lưu nháp mỗi giây.' }
  ];

  function triggerSupernovaCombo(comboCount) {
    if (typeof document === 'undefined' || (comboCount || 0) < 2) return;
    const badge = document.querySelector('[data-vt-combo-badge], .vt-combo-badge, #vtExamComboBadge');
    const originRect = badge ? badge.getBoundingClientRect() : { left: window.innerWidth * 0.5, top: window.innerHeight * 0.35, width: 40 };
    if (badge) {
      badge.classList.remove('vt-supernova-pulse');
      void badge.offsetWidth;
      badge.classList.add('vt-supernova-pulse');
    }
    const count = Math.min(12, 5 + (comboCount || 2));
    for (let i = 0; i < count; i++) {
      const mote = document.createElement('span');
      mote.className = 'vt-stardust-mote';
      mote.textContent = i % 2 === 0 ? '✦' : '★';
      mote.style.left = (originRect.left + (originRect.width || 40) / 2 + (Math.random() - 0.5) * 44) + 'px';
      mote.style.top = (originRect.top + (Math.random() - 0.5) * 14) + 'px';
      mote.style.setProperty('--dx', ((Math.random() - 0.5) * 56).toFixed(0) + 'px');
      mote.style.setProperty('--dx2', ((Math.random() - 0.5) * 90).toFixed(0) + 'px');
      document.body.appendChild(mote);
      setTimeout(function () { if (mote.parentNode) mote.parentNode.removeChild(mote); }, 980);
    }
  }

  function playComboTone(isCorrect, comboCount) {
    if (isCorrect && (comboCount || 0) >= 2) { try { triggerSupernovaCombo(comboCount); } catch (e) {} }
    if (!state.examSoundEnabled) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isCorrect ? 'sine' : 'triangle';
      const baseFreq = isCorrect ? (440 + Math.min(6, comboCount || 0) * 65) : 210;
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      if (isCorrect) osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } catch (e) {}
  }

  async function clientSha256Hex(str) {
    if (window.crypto && window.crypto.subtle) {
      const buf = new TextEncoder().encode(String(str));
      const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hashBuf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    return '';
  }

  async function saveExamDraftIdb(examId, draftObj) {
    const C = getCore();
    if (!C || !C.db) return;
    await C.db.set('exam_drafts', { examId: String(examId), key: 'draft_' + examId, draft: draftObj, savedAt: Date.now() });
  }

  async function readExamDraftIdb(examId) {
    const C = getCore();
    if (!C || !C.db) return null;
    const rec = await C.db.get('exam_drafts', String(examId));
    return rec && rec.draft ? rec.draft : null;
  }

  async function clearExamDraftIdb(examId) {
    const C = getCore();
    if (!C || !C.db) return;
    await C.db.remove('exam_drafts', String(examId));
  }

  // Safe numeric parser supporting integers, decimals and fractions (a/b) without eval()
  function parseSafeMathNumber(raw) {
    const s = String(raw == null ? '' : raw).trim().replace(/\s+/g, '').replace(/,/g, '.');
    if (!s) return NaN;
    const fm = s.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/);
    if (fm) {
      const n = Number(fm[1]), d = Number(fm[2]);
      return (isFinite(n) && isFinite(d) && d !== 0) ? (n / d) : NaN;
    }
    const v = Number(s);
    return isFinite(v) ? v : NaN;
  }

  // Safe Algebraic Parameterized Twin Problem Generator (zero eval)
  function generateTwinProblem(q) {
    const a = 1 + Math.floor(Math.random() * 3); // 1..3
    const b = 1 + Math.floor(Math.random() * 4); // 1..4
    const m = 1 + Math.floor(Math.random() * 3); // 1..3
    const variant = Math.floor(Math.random() * 3);
    if (variant === 0) {
      const ans = 2 * a * b;
      return {
        prompt: 'Tính giá trị đạo hàm $f\x27(' + b + ')$ của hàm số $f(x) = ' + a + 'x^2 + ' + m + '$.',
        correctNumeric: ans,
        hint: 'Áp dụng công thức $(ax^2 + m)\x27 = 2ax$, sau đó thay $x = ' + b + '$.'
      };
    }
    if (variant === 1) {
      const ans = 3 * a * m * m - b;
      return {
        prompt: 'Tính giá trị $y\x27(' + m + ')$ của hàm số $y = ' + a + 'x^3 - ' + b + 'x + 2$.',
        correctNumeric: ans,
        hint: 'Tính đạo hàm $y\x27 = ' + (3 * a) + 'x^2 - ' + b + '$, rồi thay $x = ' + m + '$.'
      };
    }
    const ans = b * b - a * m;
    return {
      prompt: 'Tính giá trị cực tiểu của hàm số $y = (x - ' + a + ')^2 + ' + ans + '$.',
      correctNumeric: ans,
      hint: 'Bình phương $(x - ' + a + ')^2 \ge 0$ với mọi $x$, dấu bằng đạt tại $x = ' + a + '$.'
    };
  }

  function applyLabSkin(skinId) {
    state.activeLabSkin = skinId || 'default';
    if (state.activeLabSkin === 'default') document.documentElement.removeAttribute('data-lab-skin');
    else document.documentElement.setAttribute('data-lab-skin', state.activeLabSkin);
    try { localStorage.setItem('vt_lab_skin_v6', state.activeLabSkin); } catch (e) {}
    window.dispatchEvent(new CustomEvent('vantesis:apply-lab-skin', { detail: { skinId: state.activeLabSkin } }));
  }
  applyLabSkin(state.activeLabSkin);

  function computePracticeStreakDays() {
    const dates = {};
    (state.myExamSubmissions || []).forEach(function (s) {
      const d = String(s.submittedAt || '').slice(0, 10);
      if (d) dates[d] = true;
    });
    const list = Object.keys(dates).sort().reverse();
    if (!list.length) return 0;
    let streak = 1;
    for (let i = 1; i < list.length; i++) {
      const prev = new Date(list[i - 1] + 'T00:00:00Z').getTime();
      const cur = new Date(list[i] + 'T00:00:00Z').getTime();
      if (Math.round((prev - cur) / 86400000) === 1) streak++;
      else break;
    }
    return streak;
  }

  function openSkinShopModal() {
    const body = document.getElementById('vtSkinShopBody');
    if (!body) return;
    body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
        '<span style="font-size:13px;color:var(--text-muted);">Dùng Bụi Sao tích lũy để mở khóa giao diện độc quyền cho Phòng Thí nghiệm 2D/3D.</span>' +
        '<span class="vt-res-pill pending">★ Bụi Sao của bạn: ' + state.totalStarDust + '</span>' +
      '</div>' +
      '<div class="vt-skin-grid">' + LAB_SKINS.map(function (sk) {
        const unlocked = state.totalStarDust >= sk.cost || isAdmin() || isTeacher();
        const isAct = state.activeLabSkin === sk.id;
        return '<div class="vt-skin-card ' + (isAct ? 'active' : '') + '">' +
          '<b style="font-size:14px;">' + escapeHtml(sk.name) + '</b>' +
          '<span style="font-size:12px;color:var(--text-muted);line-height:1.45;">' + escapeHtml(sk.desc) + '</span>' +
          '<button type="button" class="btn btn-sm ' + (isAct ? 'btn-primary' : '') + '" data-shop-skin="' + sk.id + '" ' + (!unlocked ? 'disabled' : '') + '>' + (isAct ? '✓ Đang dùng' : (unlocked ? 'Áp dụng ngay' : '🔒 Cần ' + sk.cost + '★')) + '</button>' +
        '</div>';
      }).join('') + '</div>';
    body.querySelectorAll('[data-shop-skin]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyLabSkin(btn.getAttribute('data-shop-skin'));
        showNotice('✨ Đã áp dụng giao diện mới cho Phòng Thí nghiệm 2D/3D.');
        openSkinShopModal();
      });
    });
    document.getElementById('vtSkinShopBackdrop').classList.add('open');
  }

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
  let examVisibilityHandler = null;
  let qOpenedAtMs = Date.now();

  function stopExamTimers() {
    if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
    if (examDraftInterval) { clearInterval(examDraftInterval); examDraftInterval = null; }
    if (examVisibilityHandler) {
      document.removeEventListener('visibilitychange', examVisibilityHandler);
      examVisibilityHandler = null;
    }
  }

  async function startExamSession(examId, mode) {
    showNotice('✦ Đang khởi tạo phòng làm bài bảo mật...');
    const res = await callApi('exam_get_session', { examId: examId, mode: mode });
    if (!res || !res.ok) {
      showNotice('⚠ ' + formatFriendlyError(res && res.error), true);
      return;
    }
    const savedDraft = await readExamDraftIdb(examId);
    const actualMode = (res.exam && res.exam.examMode) || mode || 'DISCOVERY_5M';
    const isTimed = actualMode === 'OFFICIAL_EXAM' || actualMode === 'EXAM_SPLIT';

    // Find linked PDF/Word preview URL if EXAM_SPLIT
    let splitPreviewUrl = '';
    if (res.exam && res.exam.resourceId) {
      const linkedRes = state.resources.find(function (r) { return r.resourceId === res.exam.resourceId; });
      if (linkedRes && linkedRes.files && linkedRes.files[0]) {
        splitPreviewUrl = linkedRes.files[0].previewUrl || ('https://drive.google.com/file/d/' + linkedRes.files[0].fileId + '/preview');
      }
    }
    if (!splitPreviewUrl && res.questions && res.questions[0] && res.questions[0].drivePreviewUrl) {
      splitPreviewUrl = res.questions[0].drivePreviewUrl;
    }

    state.activeExamResult = null;
    state.examSplitMobileTab = 'paper';
    state.activeExamSession = {
      exam: res.exam,
      mode: actualMode,
      sessionSalt: res.sessionSalt || '',
      serverGradedOnly: Boolean(res.serverGradedOnly),
      splitPreviewUrl: splitPreviewUrl,
      startedAt: res.startedAt,
      startedAtMs: Date.now(),
      endTimeMs: Date.now() + (Number(res.exam.durationMinutes || res.exam.durationMin) || 15) * 60000,
      questions: res.questions || [],
      answers: (savedDraft && savedDraft.answers) ? savedDraft.answers : {},
      timingSecByQ: (savedDraft && savedDraft.timingSecByQ) ? savedDraft.timingSecByQ : {},
      tabSwitches: (savedDraft && savedDraft.tabSwitches) ? Number(savedDraft.tabSwitches) : 0,
      twinSolvedCount: 0,
      currentIdx: 0,
      combo: 0,
      maxCombo: 0,
      feedbackHtml: '',
      twinActive: null
    };
    if (savedDraft && savedDraft.answers && Object.keys(savedDraft.answers).length > 0) {
      showNotice('✓ Đã khôi phục bài làm đang dở trước đó của bạn.');
    }
    qOpenedAtMs = Date.now();
    stopExamTimers();

    // Auto-save draft every 1 second to prevent network loss
    examDraftInterval = setInterval(function () {
      if (state.activeExamSession) {
        saveExamDraftIdb(examId, {
          answers: state.activeExamSession.answers,
          timingSecByQ: state.activeExamSession.timingSecByQ,
          tabSwitches: state.activeExamSession.tabSwitches
        });
      }
    }, 1000);

    // Track tab switches during OFFICIAL_EXAM & EXAM_SPLIT
    if (isTimed) {
      examVisibilityHandler = function () {
        if (document.hidden && state.activeExamSession) {
          state.activeExamSession.tabSwitches++;
        }
      };
      document.addEventListener('visibilitychange', examVisibilityHandler);

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
    const durationSec = Math.max(1, Math.round((Date.now() - (ses.startedAtMs || Date.now())) / 1000));
    showNotice('📤 Đang chấm điểm độc lập và đồng bộ Hồ sơ Học sinh 360°...');
    const res = await callApi('exam_submit_result', {
      examId: ses.exam.examId,
      mode: ses.mode,
      answersMap: ses.answers,
      answers: ses.answers,
      timingSecByQ: ses.timingSecByQ,
      durationSec: durationSec,
      tabSwitches: ses.tabSwitches || 0,
      twinSolvedCount: ses.twinSolvedCount || 0,
      maxCombo: ses.maxCombo || 0,
      startedAt: ses.startedAt
    });
    if (!res || !res.ok) {
      showNotice('⚠ ' + formatFriendlyError(res && res.error), true);
      return;
    }
    await clearExamDraftIdb(ses.exam.examId);
    state.activeExamResult = res;
    state.activeExamSession = null;
    playComboTone(true, 4);
    showNotice('🏆 Hoàn thành! ' + res.score + '/10 điểm • ' + (res.masteryTier || res.masteryLevel) + ' (+' + res.starDustEarned + '★)');
    await fetchExamsHub();
    await fetchHubFromServer(true);
  }

  function drawGraphTargetCanvas(canvas, gc, currentM) {
    if (!canvas || !gc) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.floor(rect.width));
    const h = Math.max(210, Math.floor(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#060B19';
    ctx.fillRect(0, 0, w, h);

    const xMin = -4, xMax = 4, yMin = -4, yMax = 4;
    const toPx = function (x) { return ((x - xMin) / (xMax - xMin)) * w; };
    const toPy = function (y) { return h - ((y - yMin) / (yMax - yMin)) * h; };

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let gx = -4; gx <= 4; gx++) { ctx.beginPath(); ctx.moveTo(toPx(gx), 0); ctx.lineTo(toPx(gx), h); ctx.stroke(); }
    for (let gy = -4; gy <= 4; gy++) { ctx.beginPath(); ctx.moveTo(0, toPy(gy)); ctx.lineTo(w, toPy(gy)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, toPy(0)); ctx.lineTo(w, toPy(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toPx(0), 0); ctx.lineTo(toPx(0), h); ctx.stroke();

    const expr = gc.expr || 'x^3 - 3*m*x';
    // 1. Dashed target curve (golden guide)
    if (gc.targetM !== undefined && isFinite(Number(gc.targetM))) {
      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      let st = false;
      for (let px = 0; px <= w; px += 2) {
        const xv = xMin + (px / w) * (xMax - xMin);
        const yv = evalEmbedExpr(expr, xv, { m: Number(gc.targetM) });
        const py = toPy(yv);
        if (!isFinite(yv) || py < -h || py > h * 2) { st = false; continue; }
        if (!st) { ctx.moveTo(px, py); st = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Student live interactive curve
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= w; px += 2) {
      const xv = xMin + (px / w) * (xMax - xMin);
      const yv = evalEmbedExpr(expr, xv, { m: Number(currentM) });
      const py = toPy(yv);
      if (!isFinite(yv) || py < -h || py > h * 2) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = '#FDE68A';
    ctx.font = '600 11.5px "JetBrains Mono", monospace';
    ctx.fillText('Nét đứt vàng: Mục tiêu  |  Đường xanh: Đồ thị của bạn', 12, h - 12);
  }

  function openExamBuilder() {
    if (!canUploadExam()) {
      showNotice('⚠ Chỉ Giáo viên Bộ môn được phân công giảng dạy hoặc Quản trị viên mới có quyền tạo đề thi.', true);
      return;
    }
    state.examBuilderDriveFile = null;
    state.examBuilderQuestions = [
      { id: 'Q1', type: 'MCQ', prompt: '', options: ['A. ', 'B. ', 'C. ', 'D. '], correctAnswer: 'A', points: 2, solution: '', trapReasons: {} }
    ];
    document.getElementById('vtExTitle').value = '';
    document.getElementById('vtExChapter').value = '';
    document.getElementById('vtExDuration').value = '15';
    document.getElementById('vtExQuickKeyInp').value = '';
    document.getElementById('vtExDriveFileStatus').textContent = 'Chưa đính kèm tệp đề gốc.';
    const checksEl = document.getElementById('vtExClassChecks');
    checksEl.innerHTML = state.classes.length
      ? state.classes.map(function (c) {
          return '<label class="vt-res-pill" style="cursor:pointer;"><input type="checkbox" class="vt-ex-cls-cb" value="' + escapeAttr(c.classId) + '"> Lớp ' + escapeHtml(c.className) + '</label>';
        }).join('')
      : '<span style="font-size:12px;color:var(--text-soft);">Chưa có lớp nào trong phạm vi phân công.</span>';
    renderExamBuilderQuestions();
    document.getElementById('vtExamBuilderBackdrop').classList.add('open');
  }

  function closeExamBuilder() {
    document.getElementById('vtExamBuilderBackdrop').classList.remove('open');
  }

  function renderExamBuilderQuestions() {
    const el = document.getElementById('vtExQuestionsList');
    if (!el) return;
    if (!state.examBuilderQuestions.length) {
      el.innerHTML = '<div style="text-align:center;padding:12px;font-size:12.5px;color:var(--text-soft);">Bấm các nút phía trên để thêm câu hỏi hoặc nhập nhanh chuỗi đáp án cho đề PDF/Word.</div>';
      return;
    }
    el.innerHTML = state.examBuilderQuestions.map(function (q, idx) {
      const lbl = q.type === 'GRAPH_TARGET' ? '∫ Kéo & Khớp Đồ thị' : (q.type === 'TRUE_FALSE' ? '✓✗ Đúng / Sai 4 ý' : (q.type === 'SHORT_ANSWER' ? '✍️ Trả lời ngắn' : '🔘 Trắc nghiệm 4 lựa chọn'));
      let extra = '';
      if (q.type === 'MCQ') {
        extra = '<div class="vt-res-form-grid" style="margin:0;">' +
          '<div class="vt-res-field"><label>4 phương án (cách nhau bằng dấu |)</label><input type="text" data-eq-opts="' + idx + '" value="' + escapeAttr((q.options || []).join(' | ')) + '"></div>' +
          '<div class="vt-res-field"><label>Đáp án đúng (A/B/C/D)</label><select data-eq-ans="' + idx + '"><option value="A" ' + (q.correctAnswer === 'A' ? 'selected' : '') + '>A</option><option value="B" ' + (q.correctAnswer === 'B' ? 'selected' : '') + '>B</option><option value="C" ' + (q.correctAnswer === 'C' ? 'selected' : '') + '>C</option><option value="D" ' + (q.correctAnswer === 'D' ? 'selected' : '') + '>D</option></select></div>' +
        '</div>';
      } else if (q.type === 'GRAPH_TARGET') {
        const gc = q.graphConfig || { expr: 'x^3 - 3*m*x', targetM: 1 };
        extra = '<div class="vt-res-form-grid" style="margin:0;">' +
          '<div class="vt-res-field"><label>Hàm số chứa tham số m</label><input type="text" data-eq-gexpr="' + idx + '" value="' + escapeAttr(gc.expr || 'x^3 - 3*m*x') + '"></div>' +
          '<div class="vt-res-field"><label>Giá trị mục tiêu m đúng</label><input type="number" step="0.1" data-eq-gtgt="' + idx + '" value="' + escapeAttr(q.correctAnswer || 1) + '"></div>' +
        '</div>';
      } else if (q.type === 'TRUE_FALSE') {
        const ans = q.correctAnswer || { a: true, b: false, c: true, d: false };
        extra = '<div style="display:flex;flex-direction:column;gap:5px;">' + ['a', 'b', 'c', 'd'].map(function (k, ki) {
          const txt = (q.subItems && q.subItems[ki] && q.subItems[ki].text) || (k + ') ');
          return '<div style="display:flex;gap:6px;"><input type="text" data-eq-tf-txt="' + idx + ':' + ki + '" value="' + escapeAttr(txt) + '" style="flex:1;padding:6px 9px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12px;"><select data-eq-tf-ans="' + idx + ':' + k + '" style="width:82px;padding:6px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12px;"><option value="true" ' + (ans[k] ? 'selected' : '') + '>Đúng</option><option value="false" ' + (!ans[k] ? 'selected' : '') + '>Sai</option></select></div>';
        }).join('') + '</div>';
      } else {
        extra = '<div class="vt-res-field"><label>Đáp số đúng (số thập phân hoặc phân số VD: 3/4)</label><input type="text" data-eq-ans="' + idx + '" value="' + escapeAttr(q.correctAnswer || '') + '"></div>';
      }
      return '<div class="vt-block-item">' +
        '<div class="vt-block-item-head"><span>Câu ' + (idx + 1) + ' • ' + lbl + '</span><button type="button" class="btn btn-sm" data-eq-del="' + idx + '" style="color:var(--danger);">✕</button></div>' +
        '<textarea rows="2" data-eq-prompt="' + idx + '" placeholder="Nhập đề bài (hỗ trợ $...$)..." style="padding:7px 10px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:12.5px;">' + escapeHtml(q.prompt || '') + '</textarea>' +
        extra +
        '<input type="text" data-eq-sol="' + idx + '" value="' + escapeAttr(q.solution || '') + '" placeholder="Lời giải chi tiết (hiển thị sau khi học sinh nộp bài)..." style="padding:7px 10px;border-radius:10px;border:1px dashed var(--border-strong);background:var(--surface);color:var(--text);font-size:12px;">' +
      '</div>';
    }).join('');

    el.querySelectorAll('[data-eq-prompt]').forEach(function (ta) {
      ta.addEventListener('input', function () { state.examBuilderQuestions[Number(ta.getAttribute('data-eq-prompt'))].prompt = ta.value; });
    });
    el.querySelectorAll('[data-eq-sol]').forEach(function (inp) {
      inp.addEventListener('input', function () { state.examBuilderQuestions[Number(inp.getAttribute('data-eq-sol'))].solution = inp.value; });
    });
    el.querySelectorAll('[data-eq-opts]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        state.examBuilderQuestions[Number(inp.getAttribute('data-eq-opts'))].options = inp.value.split('|').map(function (s) { return s.trim(); });
      });
    });
    el.querySelectorAll('[data-eq-ans]').forEach(function (inp) {
      inp.addEventListener('input', function () { state.examBuilderQuestions[Number(inp.getAttribute('data-eq-ans'))].correctAnswer = inp.value.trim(); });
      inp.addEventListener('change', function () { state.examBuilderQuestions[Number(inp.getAttribute('data-eq-ans'))].correctAnswer = inp.value.trim(); });
    });
    el.querySelectorAll('[data-eq-gexpr]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const q = state.examBuilderQuestions[Number(inp.getAttribute('data-eq-gexpr'))];
        q.graphConfig = q.graphConfig || { min: -3, max: 3, step: 0.1, tolerance: 0.25 };
        q.graphConfig.expr = inp.value;
      });
    });
    el.querySelectorAll('[data-eq-gtgt]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const q = state.examBuilderQuestions[Number(inp.getAttribute('data-eq-gtgt'))];
        const v = Number(inp.value) || 0;
        q.correctAnswer = v;
        q.graphConfig = q.graphConfig || { expr: 'x^3 - 3*m*x', min: -3, max: 3, step: 0.1, tolerance: 0.25 };
        q.graphConfig.targetM = v;
      });
    });
    el.querySelectorAll('[data-eq-tf-txt]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const p = inp.getAttribute('data-eq-tf-txt').split(':');
        const q = state.examBuilderQuestions[Number(p[0])];
        if (q && q.subItems && q.subItems[Number(p[1])]) q.subItems[Number(p[1])].text = inp.value;
      });
    });
    el.querySelectorAll('[data-eq-tf-ans]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        const p = sel.getAttribute('data-eq-tf-ans').split(':');
        const q = state.examBuilderQuestions[Number(p[0])];
        if (q) { q.correctAnswer = q.correctAnswer || {}; q.correctAnswer[p[1]] = sel.value === 'true'; }
      });
    });
    el.querySelectorAll('[data-eq-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.examBuilderQuestions.splice(Number(btn.getAttribute('data-eq-del')), 1);
        renderExamBuilderQuestions();
      });
    });
  }

  async function handleExamBuilderSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('vtExTitle').value.trim();
    if (!title) { showNotice('⚠ Vui lòng nhập tiêu đề đề thi.', true); return; }

    let questions = state.examBuilderQuestions.filter(function (q) { return q.prompt && q.prompt.trim(); });
    const quickKey = (document.getElementById('vtExQuickKeyInp').value || '').trim();
    if (quickKey) {
      const pairs = quickKey.match(/\d+\s*[A-Da-d]/g) || [];
      if (pairs.length) {
        questions = pairs.map(function (pair, idx) {
          const letter = pair.slice(-1).toUpperCase();
          return {
            id: 'Q' + (idx + 1),
            type: 'MCQ',
            prompt: 'Câu ' + (idx + 1) + ' (xem trên file đề gốc)',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: letter,
            points: 1,
            drivePreviewUrl: state.examBuilderDriveFile ? state.examBuilderDriveFile.previewUrl : ''
          };
        });
      }
    }
    if (!questions.length) { showNotice('⚠ Vui lòng thêm ít nhất 1 câu hỏi hoặc nhập chuỗi đáp án nhanh.', true); return; }
    if (state.examBuilderDriveFile && questions[0]) {
      questions[0].drivePreviewUrl = state.examBuilderDriveFile.previewUrl;
    }

    const assignedClassIds = [];
    document.querySelectorAll('.vt-ex-cls-cb:checked').forEach(function (cb) { assignedClassIds.push(cb.value); });

    const btn = document.getElementById('vtExamBuilderSubmit');
    btn.disabled = true;
    const res = await callApi('exam_upsert', {
      payload: {
        title: title,
        subject: 'Toán học',
        gradeBlock: document.getElementById('vtExGrade').value,
        chapterConstellation: document.getElementById('vtExChapter').value.trim() || 'Chòm sao Chung',
        examMode: document.getElementById('vtExMode').value,
        durationMinutes: Number(document.getElementById('vtExDuration').value) || 15,
        publishScope: document.getElementById('vtExScope').value,
        dueDate: document.getElementById('vtExDueDate').value || '',
        isMandatory: Boolean(document.getElementById('vtExDueDate').value),
        assignedClassIds: assignedClassIds,
        questions: questions
      }
    });
    btn.disabled = false;
    if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
    closeExamBuilder();
    showNotice(res.downgradedToPending ? '✓ Đã tạo đề thi và gửi vào hàng đợi duyệt Toàn trường.' : '✓ Đã xuất bản đề thi thành công!');
    await fetchExamsHub();
  }

  async function openExamAnalyticsModal(examObj, initialClassId) {
    if (!canUploadExam()) return;
    const targetCls = initialClassId || (examObj.assignedClassIds && examObj.assignedClassIds[0]) || (state.classes[0] && state.classes[0].classId) || '';
    const titleEl = document.getElementById('vtExamAnalyticsTitle');
    const bodyEl = document.getElementById('vtExamAnalyticsBody');
    if (titleEl) titleEl.textContent = '📊 Phân tích & Bản đồ Nhiệt Lỗi Sai — ' + examObj.title;
    if (!targetCls) {
      bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-soft);">Chưa có lớp nào được phân công để thống kê.</div>';
      document.getElementById('vtExamAnalyticsBackdrop').classList.add('open');
      return;
    }
    bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-soft);">Đang tổng hợp dữ liệu bài nộp của lớp...</div>';
    document.getElementById('vtExamAnalyticsBackdrop').classList.add('open');

    const res = await callApi('exam_get_analytics', { examId: examObj.examId, classId: targetCls });
    if (!res || !res.ok) {
      bodyEl.innerHTML = '<div style="padding:20px;color:var(--danger);">⚠ ' + formatFriendlyError(res && res.error) + '</div>';
      return;
    }

    const clsOpts = state.classes.map(function (c) {
      return '<option value="' + escapeAttr(c.classId) + '" ' + (c.classId === targetCls ? 'selected' : '') + '>Lớp ' + escapeHtml(c.className) + '</option>';
    }).join('');

    const hmHtml = (res.questionHeatmap || []).length
      ? res.questionHeatmap.map(function (q) {
          const isDanger = q.wrongPct > 50;
          const barCol = isDanger ? '#EF4444' : (q.wrongPct >= 25 ? '#F59E0B' : '#10B981');
          const tagsHtml = (q.topMistakeTags || []).map(function (t) {
            return '<span class="vt-res-pill" style="font-size:11px;">⚠ ' + escapeHtml(t.tag) + ' (' + t.count + ')</span>';
          }).join(' ');
          return '<div class="vt-heat-bar-row ' + (isDanger ? 'danger' : '') + '">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:700;">' +
              '<span>' + escapeHtml(q.questionId) + (q.prompt ? ': ' + escapeHtml(q.prompt.slice(0, 70)) : '') + '</span>' +
              '<span style="color:' + barCol + ';white-space:nowrap;">' + q.wrongPct + '% làm sai (' + q.wrongCount + '/' + q.totalAttempts + ')</span>' +
            '</div>' +
            '<div class="vt-heat-track"><div style="width:' + q.wrongPct + '%;height:100%;background:' + barCol + ';"></div></div>' +
            (tagsHtml ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">' + tagsHtml + '</div>' : '') +
          '</div>';
        }).join('')
      : '<div style="padding:14px;text-align:center;font-size:13px;color:var(--text-soft);">Chưa có học sinh nào trong lớp nộp bài cho đề này.</div>';

    const missingHtml = (res.missingStudents || []).length
      ? '<div style="font-size:12.5px;color:var(--text-muted);"><b>Chưa nộp (' + res.missingStudents.length + ' HS):</b> ' + res.missingStudents.map(function (s) { return escapeHtml(s.fullName); }).join(', ') + '</div>'
      : '<div style="font-size:12.5px;color:#059669;font-weight:700;">✓ 100% học sinh trong lớp đã nộp bài.</div>';

    bodyEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<select id="vtAnClassSel" style="padding:7px 12px;border-radius:12px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-weight:700;">' + clsOpts + '</select>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button id="vtAnSyncGradesBtn" class="btn btn-sm" type="button">📥 Đồng bộ điểm sang Sổ theo dõi</button>' +
          '<button id="vtAnCreateReviewBtn" class="btn btn-primary btn-sm" type="button">💡 Tạo bài ôn tập củng cố chuyên đề này</button>' +
        '</div>' +
      '</div>' +
      '<div class="vt-exam-stats-strip" style="margin-bottom:12px;">' +
        '<div class="vt-exam-stat-card"><span class="vt-exam-stat-val">' + res.averageScore + '/10</span><span class="vt-exam-stat-lbl">Điểm trung bình lớp</span></div>' +
        '<div class="vt-exam-stat-card"><span class="vt-exam-stat-val">' + res.completionRate + '%</span><span class="vt-exam-stat-lbl">Tỷ lệ hoàn thành (' + res.submittedCount + '/' + res.totalStudents + ')</span></div>' +
        '<div class="vt-exam-stat-card"><span class="vt-exam-stat-val" style="color:' + (res.lowTrustCount > 0 ? '#EF4444' : '#10B981') + ';">' + res.lowTrustCount + '</span><span class="vt-exam-stat-lbl">Cảnh báo độ tin cậy</span></div>' +
        '<div class="vt-exam-stat-card"><span class="vt-exam-stat-val">' + (res.scoreDistribution ? res.scoreDistribution.from8to10 : 0) + '</span><span class="vt-exam-stat-lbl">Đạt mức Tinh thông (≥8)</span></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;">' + missingHtml + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' + hmHtml + '</div>';

    const clsSel = document.getElementById('vtAnClassSel');
    if (clsSel) clsSel.addEventListener('change', function () { openExamAnalyticsModal(examObj, clsSel.value); });

    const syncBtn = document.getElementById('vtAnSyncGradesBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async function () {
        syncBtn.disabled = true;
        const imp = await callApi('classroom_import_exam_grades', { examId: examObj.examId, classId: targetCls, subject: examObj.subject || 'Toán học' });
        syncBtn.disabled = false;
        if (!imp || !imp.ok) { showNotice('⚠ ' + formatFriendlyError(imp && imp.error), true); return; }
        showNotice('✓ Đã đồng bộ điểm của ' + imp.importedCount + ' học sinh sang Sổ theo dõi.');
      });
    }

    const reviewBtn = document.getElementById('vtAnCreateReviewBtn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', function () {
        document.getElementById('vtExamAnalyticsBackdrop').classList.remove('open');
        const hardQs = (res.questionHeatmap || []).filter(function (q) { return q.wrongPct > 50; });
        const summaryLines = hardQs.length
          ? hardQs.map(function (q) { return '- ' + q.questionId + ' (' + q.wrongPct + '% lớp sai): ' + q.prompt; }).join('\n')
          : 'Ôn tập củng cố các dạng toán trọng tâm của chuyên đề ' + (examObj.chapterConstellation || examObj.title);
        openEditor(null, null);
        document.getElementById('vtEdTitle').value = 'Bài ôn tập củng cố: ' + examObj.title;
        document.getElementById('vtEdChapter').value = examObj.chapterConstellation || '';
        state.editorTab = 'blocks';
        state.editorBlocks = [
          { type: 'THEOREM', style: 'theorem', title: 'Trọng tâm kiến thức cần khắc phục', text: 'Tổng hợp những lỗi sai phổ biến của lớp sau bài ' + examObj.title + '.' },
          { type: 'METHOD', style: 'method', title: 'Phân tích các câu hỏi dễ nhầm lẫn', text: summaryLines, solution: '' }
        ];
        syncEditorTabVisibility();
        renderEditorBlockBuilder();
      });
    }
  }

  async function createStarterSampleExam() {
    if (!canUploadExam()) {
      showNotice('⚠ Chỉ Giáo viên Bộ môn hoặc Quản trị viên mới có quyền khởi tạo đề thi.', true);
      return;
    }
    const clsIds = state.classes.map(function (c) { return c.classId; });
    const res = await callApi('exam_upsert', {
      payload: {
        title: 'Chinh phục Cực trị & Đồ thị Hàm số',
        subject: 'Toán học',
        gradeBlock: 'Khối 12',
        chapterConstellation: 'Ứng dụng Đạo hàm',
        examMode: 'COMBO_ARENA',
        durationMinutes: 15,
        publishScope: isAdmin() ? 'SCHOOL' : 'CLASS_ONLY',
        assignedClassIds: clsIds,
        questions: [
          {
            id: 'Q1', type: 'MCQ', points: 2,
            prompt: 'Hàm số $y = x^3 - 3x + 1$ đạt cực đại tại điểm nào?',
            options: ['A. $x = -1$', 'B. $x = 1$', 'C. $x = 0$', 'D. $x = 3$'],
            correctAnswer: 'A',
            trapReasons: {
              B: 'Bẫy ngược dấu: Tại $x = 1$, $y\x27\x27(1) = 6 > 0$ nên đây là điểm cực tiểu, không phải cực đại.',
              C: 'Tại $x = 0$, $y\x27(0) = -3 \ne 0$ nên không phải điểm cực trị.'
            },
            solution: '$y\x27 = 3x^2 - 3 = 0 \Leftrightarrow x = \pm 1$. Vì $y\x27\x27(-1) = -6 < 0$ nên $x = -1$ là điểm cực đại.'
          },
          {
            id: 'Q2', type: 'GRAPH_TARGET', points: 3,
            prompt: 'Kéo thanh trượt tham số $m$ trên đồ thị để hàm số $y = x^3 - 3mx$ khớp với đường cong mục tiêu nét đứt (có cực trị tại $x = \pm 1$).',
            correctAnswer: 1,
            graphConfig: { expr: 'x^3 - 3*m*x', targetM: 1, min: -3, max: 3, step: 0.1, tolerance: 0.25 },
            solution: '$y\x27 = 3x^2 - 3m = 0 \Leftrightarrow x^2 = m$. Để cực trị tại $x = \pm 1$ thì $m = 1$.'
          },
          {
            id: 'Q3', type: 'TRUE_FALSE', points: 3,
            prompt: 'Xét hàm số $y = x^2 - 4x + 3$. Chọn Đúng hoặc Sai cho từng mệnh đề:',
            subItems: [
              { key: 'a', text: 'a) Đạo hàm của hàm số là $y\x27 = 2x - 4$.' },
              { key: 'b', text: 'b) Hàm số đồng biến trên khoảng $(-\infty; 2)$.' },
              { key: 'c', text: 'c) Giá trị nhỏ nhất của hàm số bằng $-1$.' },
              { key: 'd', text: 'd) Đồ thị cắt trục hoành tại 2 điểm phân biệt.' }
            ],
            correctAnswer: { a: true, b: false, c: true, d: true },
            solution: 'Đỉnh parabol là $(2; -1)$, hàm nghịch biến trên $(-\infty; 2)$ và đồng biến trên $(2; +\infty)$.'
          },
          {
            id: 'Q4', type: 'SHORT_ANSWER', points: 2,
            prompt: 'Tính giá trị cực tiểu của hàm số $y = x^2 - 6x + 10$. (Nhập số nguyên)',
            correctAnswer: '1',
            solution: '$y\x27 = 2x - 6 = 0 \Leftrightarrow x = 3 \Rightarrow y(3) = 9 - 18 + 10 = 1$.'
          }
        ]
      }
    });
    if (!res || !res.ok) { showNotice('⚠ ' + formatFriendlyError(res && res.error), true); return; }
    showNotice('✓ Đã tạo bộ đề mẫu đầy đủ 4 định dạng tương tác.');
    await fetchExamsHub();
  }

  function renderExamsSector() {
    const mount = document.getElementById('vtExamsMount');
    if (!mount) return;

    // A. Active Exam Player View (including Split-Screen PDF/Word Exam Mode)
    if (state.activeExamSession) {
      const ses = state.activeExamSession;
      const isSplit = ses.mode === 'EXAM_SPLIT' && Boolean(ses.splitPreviewUrl);

      if (isSplit) {
        const jumpBtns = ses.questions.map(function (qq, idx) {
          const isAns = ses.answers[qq.id] !== undefined && ses.answers[qq.id] !== '';
          return '<button type="button" class="vt-q-jump-btn ' + (isAns ? 'answered ' : '') + (idx === ses.currentIdx ? 'current' : '') + '" data-split-jump="' + idx + '">' + (idx + 1) + '</button>';
        }).join('');
        const sheetRows = ses.questions.map(function (qq, idx) {
          const curA = ses.answers[qq.id] || '';
          return '<div id="vtSplitRow_' + idx + '" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:12px;background:var(--surface-alt);border:1px solid var(--border);">' +
            '<b style="font-size:13px;min-width:54px;">Câu ' + (idx + 1) + '</b>' +
            '<div style="display:flex;gap:6px;">' + ['A', 'B', 'C', 'D'].map(function (lt) {
              return '<button type="button" class="btn btn-sm ' + (curA === lt ? 'btn-primary' : '') + '" data-split-pick="' + escapeAttr(qq.id) + ':' + lt + '">' + lt + '</button>';
            }).join('') + '</div>' +
          '</div>';
        }).join('');

        mount.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;">' +
            '<div><b style="font-size:16px;">📄 ' + escapeHtml(ses.exam.title) + '</b><div style="font-size:12px;color:var(--text-soft);">Chế độ Thi Chia đôi Màn hình • Tự lưu nháp mỗi giây</div></div>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span id="vtExamCountdown" class="vt-res-pill pending" style="font-family:var(--font-mono);font-size:13px;">⏱ Đang tính giờ</span>' +
              '<button id="vtExamSubmitBtn" class="btn btn-primary btn-sm" type="button">🏆 Nộp bài</button>' +
              '<button id="vtExamExitBtn" class="btn btn-sm" type="button">Thoát</button>' +
            '</div>' +
          '</div>' +
          '<div class="vt-split-mobile-bar" style="position:sticky;top:0;z-index:18;background:var(--surface);padding:6px 0;">' +
            '<button type="button" class="btn btn-sm ' + (state.examSplitMobileTab === 'paper' ? 'btn-primary' : '') + '" id="vtSplitMobPaper" style="flex:1;min-height:40px;">📄 Đề bài</button>' +
            '<button type="button" class="btn btn-sm ' + (state.examSplitMobileTab === 'sheet' ? 'btn-primary' : '') + '" id="vtSplitMobSheet" style="flex:1;min-height:40px;">✍️ Phiếu trả lời (' + Object.keys(ses.answers || {}).length + '/' + ses.questions.length + ')</button>' +
          '</div>' +
          '<div class="vt-split-exam-wrap">' +
            '<div class="vt-split-left ' + (state.examSplitMobileTab === 'sheet' ? 'mob-hidden' : '') + '">' +
              '<iframe src="' + escapeAttr(ses.splitPreviewUrl) + '" allow="autoplay"></iframe>' +
            '</div>' +
            '<div class="vt-split-right ' + (state.examSplitMobileTab === 'paper' ? 'mob-hidden' : '') + '">' +
              '<div style="font-size:12px;font-weight:800;color:var(--text-soft);">CHUYỂN NHANH CÂU HỎI</div>' +
              '<div class="vt-q-jump-grid">' + jumpBtns + '</div>' +
              '<div style="display:flex;flex-direction:column;gap:8px;">' + sheetRows + '</div>' +
            '</div>' +
          '</div>';

        const mp = document.getElementById('vtSplitMobPaper');
        const ms = document.getElementById('vtSplitMobSheet');
        if (mp) mp.addEventListener('click', function () { state.examSplitMobileTab = 'paper'; renderExamsSector(); });
        if (ms) ms.addEventListener('click', function () { state.examSplitMobileTab = 'sheet'; renderExamsSector(); });
        mount.querySelectorAll('[data-split-pick]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const parts = btn.getAttribute('data-split-pick').split(':');
            ses.answers[parts[0]] = parts[1];
            renderExamsSector();
          });
        });
        mount.querySelectorAll('[data-split-jump]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const idx = Number(btn.getAttribute('data-split-jump'));
            ses.currentIdx = idx;
            const row = document.getElementById('vtSplitRow_' + idx);
            if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        });
        document.getElementById('vtExamSubmitBtn').addEventListener('click', submitActiveExam);
        document.getElementById('vtExamExitBtn').addEventListener('click', function () { stopExamTimers(); state.activeExamSession = null; renderExamsSector(); });
        return;
      }

      const q = ses.questions[ses.currentIdx];
      if (!q) return;
      const comboMult = ses.combo >= 5 ? 5 : (ses.combo >= 3 ? 3 : (ses.combo >= 2 ? 2 : 1));
      const curAns = ses.answers[q.id];

      let inputUi = '';
      if (q.type === 'GRAPH_TARGET' || q.type === 'GRAPH_SLIDER') {
        const gc = q.graphConfig || { expr: 'x^3 - 3*m*x', min: -3, max: 3, step: 0.1 };
        const val = curAns !== undefined ? Number(curAns) : 0;
        inputUi = '<div class="vt-embed-lab-card">' +
          '<canvas id="vtExamGraphCanvas" class="vt-embed-lab-canvas" aria-label="Đồ thị tương tác câu hỏi"></canvas>' +
          '<div class="vt-embed-slider-row"><span>Tham số <b>m</b> = <b id="vtExamSliderVal">' + val.toFixed(1) + '</b></span><input id="vtExamSliderInput" type="range" min="' + (gc.min || -3) + '" max="' + (gc.max || 3) + '" step="' + (gc.step || 0.1) + '" value="' + val + '"></div>' +
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
        inputUi = '<input id="vtExamShortInp" type="text" value="' + escapeAttr(curAns || '') + '" placeholder="Nhập đáp số (VD: 1, 0.75 hoặc 3/4)..." style="width:100%;max-width:340px;padding:11px 14px;border-radius:14px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);font-size:15px;font-weight:700;">';
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
            '<div style="font-weight:800;color:#B45309;">🧬 Bài tập Sinh đôi — Củng cố Bản chất</div>' +
            '<div>' + renderMathInText(ses.twinActive.prompt) + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);">Gợi ý: ' + renderMathInText(ses.twinActive.hint) + '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;"><input id="vtTwinAnsInp" type="text" placeholder="Nhập đáp số bài sinh đôi..." style="padding:8px 12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);"><button id="vtTwinCheckBtn" class="btn btn-primary btn-sm" type="button">✓ Xác nhận Bài Sinh đôi</button></div>' +
          '</div>'
        : '';

      mount.innerHTML =
        '<div class="lcms-glass-tile" style="gap:14px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--border);">' +
            '<div>' +
              '<b style="font-size:16px;">' + escapeHtml(ses.exam.title) + '</b>' +
              '<div style="font-size:12px;color:var(--text-soft);">Câu ' + (ses.currentIdx + 1) + ' / ' + ses.questions.length + ' • Tự động lưu bài làm mỗi giây</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
              (ses.mode === 'COMBO_ARENA' && comboMult > 1 ? '<span class="vt-combo-badge">⚡ Combo x' + comboMult + ' Bụi Sao</span>' : '') +
              (ses.mode === 'OFFICIAL_EXAM' ? '<span id="vtExamCountdown" class="vt-res-pill pending" style="font-family:var(--font-mono);font-size:13px;">⏱ Đang tính giờ</span>' : '') +
              '<button id="vtExamSoundToggle" class="btn btn-sm" type="button">' + (state.examSoundEnabled ? '🔊 Âm thanh' : '🔇 Tắt tiếng') + '</button>' +
              '<button id="vtExamExitBtn" class="btn btn-sm" type="button">Thoát</button>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:16px;font-weight:600;line-height:1.68;">' + renderMathInText(q.prompt) + '</div>' +
          inputUi +
          ses.feedbackHtml +
          twinHtml +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--border);">' +
            '<button id="vtExamPrevBtn" class="btn btn-sm" type="button" ' + (ses.currentIdx === 0 ? 'disabled' : '') + '>← Câu trước</button>' +
            '<div style="display:flex;gap:8px;">' +
              (!ses.serverGradedOnly ? '<button id="vtExamCheckInstant" class="btn btn-sm" type="button">⚡ Xác nhận &amp; Kiểm tra ngay</button>' : '') +
              (ses.currentIdx < ses.questions.length - 1
                ? '<button id="vtExamNextBtn" class="btn btn-primary btn-sm" type="button" ' + (ses.twinActive ? 'disabled' : '') + '>Câu tiếp theo →</button>'
                : '<button id="vtExamSubmitBtn" class="btn btn-primary btn-sm" type="button" ' + (ses.twinActive ? 'disabled' : '') + '>🏆 Nộp bài &amp; Chấm điểm</button>') +
            '</div>' +
          '</div>' +
        '</div>';

      renderMathInElementSafe(mount);
      wireActiveExamPlayerEvents(ses, q);
      return;
    }

    // B. Exam Result Summary View (with Trust Score & Detailed Solutions)
    let resultBannerHtml = '';
    if (state.activeExamResult) {
      const r = state.activeExamResult;
      const solsHtml = (r.questionsWithSolutions || r.gradedDetails || []).map(function (d, idx) {
        return '<div style="padding:10px 12px;border-radius:12px;background:var(--surface);border:1px solid ' + (d.isCorrect ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)') + ';">' +
          '<div style="font-weight:700;font-size:13px;">' + (d.isCorrect ? '✓' : '✗') + ' Câu ' + (idx + 1) + ' (' + d.earned + '/' + d.maxPoints + ' đ)</div>' +
          (d.trapReason ? '<div style="font-size:12px;color:#B45309;margin-top:3px;">⚠ ' + renderMathInText(d.trapReason) + '</div>' : '') +
          (d.solution ? '<div style="font-size:12.5px;color:var(--text-muted);margin-top:4px;"><b>Lời giải:</b> ' + renderMathInText(d.solution) + '</div>' : '') +
        '</div>';
      }).join('');
      resultBannerHtml =
        '<div class="lcms-glass-tile" style="margin-bottom:16px;border-color:rgba(245,158,11,0.5);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
            '<div>' +
              '<h3 style="margin:0;font-family:\x27Newsreader\x27,serif;font-size:21px;">🏆 Kết quả: ' + r.score + ' / 10 điểm — ' + escapeHtml(r.masteryTier || r.masteryLevel || '') + '</h3>' +
              '<div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Độ tin cậy bài làm: <b>' + (r.trustScore !== undefined ? r.trustScore : 100) + '/100</b> • Thưởng: <b>+' + r.starDustEarned + ' Bụi Sao</b></div>' +
            '</div>' +
            '<button id="vtCloseExamRes" class="btn btn-sm" type="button">Đóng kết quả</button>' +
          '</div>' +
          (solsHtml ? '<details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:700;font-size:13px;color:var(--primary);">▸ Xem đáp án &amp; lời giải chi tiết từng câu</summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">' + solsHtml + '</div></details>' : '') +
        '</div>';
    }

    // C. Main Arena Hub View
    const streakDays = computePracticeStreakDays();
    const masteredCount = Object.keys(state.myProgress || {}).filter(function (k) {
      const p = state.myProgress[k];
      return p && (p.status === 'MASTERED' || p.masteryLevel === 'MASTERED');
    }).length;
    const coopGoal = 500;
    const coopPct = Math.min(100, Math.round((state.classCoopStarDust / coopGoal) * 100));

    const statsStripHtml =
      '<div class="vt-exam-stats-strip">' +
        '<div class="vt-exam-stat-card"><span class="vt-exam-stat-val">★ ' + state.totalStarDust + '</span><span class="vt-exam-stat-lbl">Bụi Sao tích lũy</span></div>' +
        '<div class="vt-exam-stat-card"><span class="vt-exam-stat-val">🔥 ' + streakDays + ' ngày</span><span class="vt-exam-stat-lbl">Chuỗi luyện tập liên tục</span></div>' +
        '<div class="vt-exam-stat-card"><span class="vt-exam-stat-val">✦ ' + masteredCount + '</span><span class="vt-exam-stat-lbl">Chuyên đề Tinh thông</span></div>' +
        '<div class="vt-exam-stat-card" style="justify-content:center;"><button id="vtOpenSkinShopBtn" class="btn btn-sm btn-primary" type="button" style="width:100%;">✨ Cửa hàng Giao diện Phòng Thí nghiệm</button></div>' +
      '</div>';

    const coopHtml =
      '<div class="vt-coop-bar-wrap">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;font-weight:700;">' +
          '<span>🌌 Thanh Năng lượng Hợp tác Cả lớp</span>' +
          '<span style="font-family:var(--font-mono);color:var(--primary);">' + state.classCoopStarDust + ' / ' + coopGoal + ' Bụi Sao (' + coopPct + '%)</span>' +
        '</div>' +
        '<div class="vt-coop-track"><div class="vt-coop-fill" style="width:' + coopPct + '%;"></div></div>' +
      '</div>';

    const modesGridHtml = '<div class="vt-exam-modes-grid">' + EXAM_MODES_META.map(function (m) {
      const isAct = state.examModeFilter === m.id;
      return '<div class="vt-mode-pill-card ' + (isAct ? 'active' : '') + '" data-mode-filter="' + m.id + '">' +
        '<div style="font-weight:800;font-size:14px;">' + m.icon + ' ' + escapeHtml(m.name) + '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);line-height:1.45;">' + escapeHtml(m.desc) + '</div>' +
      '</div>';
    }).join('') + '</div>';

    const filteredExams = state.exams.filter(function (ex) {
      if (state.examModeFilter === 'ALL') return true;
      const em = ex.examMode || (ex.modes && ex.modes[0]) || 'DISCOVERY_5M';
      if (state.examModeFilter === 'OFFICIAL_EXAM') return em === 'OFFICIAL_EXAM' || em === 'EXAM_SPLIT';
      return em === state.examModeFilter;
    });

    const examsListHtml = filteredExams.length
      ? filteredExams.map(function (ex) {
          const isSplitCard = ex.examMode === 'EXAM_SPLIT';
          return '<div class="lcms-glass-tile">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
              '<div>' +
                '<b style="font-size:16px;">' + escapeHtml(ex.title) + '</b>' +
                '<div style="font-size:12px;color:var(--text-soft);">' + escapeHtml(ex.gradeBlock) + ' • ' + escapeHtml(ex.chapterConstellation) + ' • ' + ex.questionCount + ' câu • ' + (ex.durationMinutes || ex.durationMin || 15) + ' phút</div>' +
              '</div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                (isSplitCard
                  ? '<button class="btn btn-sm btn-primary" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="EXAM_SPLIT">📄 Thi Chia đôi Màn hình</button>'
                  : ('<button class="btn btn-sm" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="DISCOVERY_5M">✦ Nhanh 5p</button>' +
                     '<button class="btn btn-sm" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="COMBO_ARENA">⚡ Combo</button>' +
                     '<button class="btn btn-sm" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="BOSS_CHALLENGE">👑 Đánh Trùm</button>' +
                     '<button class="btn btn-sm btn-primary" type="button" data-start-exam="' + escapeAttr(ex.examId) + '" data-exam-mode="OFFICIAL_EXAM">⏱️ Phòng Thi</button>')) +
                (canUploadExam() ? '<button class="btn btn-sm" type="button" data-open-analytics="' + escapeAttr(ex.examId) + '">📊 Phân tích &amp; Bản đồ Nhiệt Lỗi Sai</button>' : '') +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('')
      : '<div class="lcms-glass-tile" style="text-align:center;padding:28px;color:var(--text-soft);">Chưa có đề thi nào phù hợp bộ lọc hiện tại.' + (canUploadExam() ? ' Hãy bấm <b>+ Tạo Đề thi &amp; Thử thách Tương tác</b> ở góc trên.' : '') + '</div>';

    mount.innerHTML =
      resultBannerHtml +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<h2 style="font-family:\x27Newsreader\x27,serif;font-size:24px;margin:0;">🏆 Đấu trường Đề &amp; Tinh thông</h2>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          (state.examModeFilter !== 'ALL' ? '<button id="vtClearExamFilter" class="btn btn-sm" type="button">Hiện tất cả chế độ</button>' : '') +
          (canUploadExam() ? '<button id="vtBtnCreateStarterExam" class="btn btn-sm" type="button">✦ Nạp bộ đề mẫu</button><button id="vtBtnOpenExamBuilder" class="btn btn-primary btn-sm" type="button">+ Tạo Đề thi &amp; Thử thách Tương tác</button>' : '') +
        '</div>' +
      '</div>' +
      statsStripHtml +
      coopHtml +
      modesGridHtml +
      '<div style="display:flex;flex-direction:column;gap:12px;">' + examsListHtml + '</div>';

    renderMathInElementSafe(mount);

    const closeRes = document.getElementById('vtCloseExamRes');
    if (closeRes) closeRes.addEventListener('click', function () { state.activeExamResult = null; renderExamsSector(); });
    const shopBtn = document.getElementById('vtOpenSkinShopBtn');
    if (shopBtn) shopBtn.addEventListener('click', openSkinShopModal);
    const clrFlt = document.getElementById('vtClearExamFilter');
    if (clrFlt) clrFlt.addEventListener('click', function () { state.examModeFilter = 'ALL'; renderExamsSector(); });
    const createStarter = document.getElementById('vtBtnCreateStarterExam');
    if (createStarter) createStarter.addEventListener('click', createStarterSampleExam);
    const openBuilder = document.getElementById('vtBtnOpenExamBuilder');
    if (openBuilder) openBuilder.addEventListener('click', openExamBuilder);

    mount.querySelectorAll('[data-mode-filter]').forEach(function (card) {
      card.addEventListener('click', function () {
        const m = card.getAttribute('data-mode-filter');
        state.examModeFilter = state.examModeFilter === m ? 'ALL' : m;
        renderExamsSector();
      });
    });
    mount.querySelectorAll('[data-start-exam]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startExamSession(btn.getAttribute('data-start-exam'), btn.getAttribute('data-exam-mode'));
      });
    });
    mount.querySelectorAll('[data-open-analytics]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const ex = state.exams.find(function (x) { return x.examId === btn.getAttribute('data-open-analytics'); });
        if (ex) openExamAnalyticsModal(ex, '');
      });
    });
  }

  function wireActiveExamPlayerEvents(ses, q) {
    const recordTime = function () {
      const elapsed = Math.max(1, Math.round((Date.now() - qOpenedAtMs) / 1000));
      ses.timingSecByQ[q.id] = (ses.timingSecByQ[q.id] || 0) + elapsed;
      qOpenedAtMs = Date.now();
    };

    const sndBtn = document.getElementById('vtExamSoundToggle');
    if (sndBtn) sndBtn.addEventListener('click', function () { state.examSoundEnabled = !state.examSoundEnabled; renderExamsSector(); });

    if (q.type === 'GRAPH_TARGET' || q.type === 'GRAPH_SLIDER') {
      const gc = q.graphConfig || { expr: 'x^3 - 3*m*x', targetM: 1 };
      const canvas = document.getElementById('vtExamGraphCanvas');
      const slider = document.getElementById('vtExamSliderInput');
      const valEl = document.getElementById('vtExamSliderVal');
      drawGraphTargetCanvas(canvas, gc, Number(slider.value));
      slider.addEventListener('input', function () {
        const mv = Number(slider.value);
        ses.answers[q.id] = mv;
        if (valEl) valEl.textContent = mv.toFixed(1);
        drawGraphTargetCanvas(canvas, gc, mv);
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
        const isCorrect = Boolean(q.answerHash && h === q.answerHash);

        if (isCorrect && secSpent >= 5) {
          ses.combo++;
          ses.maxCombo = Math.max(ses.maxCombo, ses.combo);
          playComboTone(true, ses.combo);
          ses.feedbackHtml = '<div class="vt-theorem-box">✓ Chính xác! Chuỗi Combo hiện tại: <b>' + ses.combo + '</b>.</div>';
          ses.twinActive = null;
        } else {
          ses.combo = 0;
          playComboTone(false, 0);
          const trapMsg = (q.trapReasons && q.trapReasons[String(ans)])
            ? q.trapReasons[String(ans)]
            : (secSpent < 5 ? 'Bạn thao tác dưới 5 giây — hãy bình tĩnh rà soát lại bước lập luận.' : 'Đáp án chưa chính xác — hãy giải Bài tập Sinh đôi bên dưới để nắm vững bản chất.');
          ses.feedbackHtml = '<div class="vt-trap-box"><b>⚠ Chẩn đoán Bẫy Tư duy:</b> ' + renderMathInText(trapMsg) + '</div>';
          ses.twinActive = generateTwinProblem(q);
        }
        renderExamsSector();
      });
    }

    const twinBtn = document.getElementById('vtTwinCheckBtn');
    if (twinBtn && ses.twinActive) {
      twinBtn.addEventListener('click', function () {
        const val = parseSafeMathNumber(document.getElementById('vtTwinAnsInp').value);
        if (isFinite(val) && Math.abs(val - ses.twinActive.correctNumeric) <= 0.05) {
          ses.twinActive = null;
          ses.twinSolvedCount = (ses.twinSolvedCount || 0) + 1;
          playComboTone(true, 2);
          ses.feedbackHtml = '<div class="vt-theorem-box">✓ Tuyệt vời! Bạn đã vượt qua Bài tập Sinh đôi và có thể chuyển sang câu tiếp theo.</div>';
          renderExamsSector();
        } else {
          playComboTone(false, 0);
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
    }
  }

  function handleSectorChanged(detailOrEv) {
    const sec = (detailOrEv && detailOrEv.sector) || (detailOrEv && detailOrEv.detail && detailOrEv.detail.sector);
    if (sec !== 'lab') {
      showReturnToLessonPill(false);
    }
    if ((sec === 'dashboard' || sec === 'resources') && getSession()) {
      if (!state.loaded) initHub();
      else { renderDashboard(); renderResourcesHub(); }
    } else if (sec === 'exams' && getSession()) {
      fetchExamsHub();
    }
  }

  const coreBus = window.VANTHESIS_CORE && window.VANTHESIS_CORE.bus;
  if (coreBus) {
    coreBus.on('session-changed', onSessionReady);
    coreBus.on('sector-changed', handleSectorChanged);
    coreBus.on('sync-rev-changed', function (info) {
      if (info && Number(info.syncRev) > state.localSyncRev && getSession()) {
        state.localSyncRev = Number(info.syncRev);
        fetchHubFromServer(true);
      }
    }, { replay: false });
  } else {
    window.addEventListener('vantesis:session-changed', onSessionReady);
    window.addEventListener('vanthesis:session-changed', onSessionReady);
    window.addEventListener('vantesis:sector-changed', handleSectorChanged);
    window.addEventListener('vanthesis:sector-changed', handleSectorChanged);
    if (getSession()) onSessionReady();
  }

  window.VANTHESIS_RESOURCES = Object.freeze({
    refresh: function () { return fetchHubFromServer(false); },
    openLesson: function (resourceId) {
      injectStyles();
      ensureOverlaysDOM();
      openDrawer(resourceId);
    },
    openPresentationMode: function (resource) {
      injectStyles();
      ensureOverlaysDOM();
      openPresentationMode(resource);
    },
    renderMathInElementSafe: renderMathInElementSafe,
    createFromStudio: function (labSnapshot) {
      injectStyles();
      ensureOverlaysDOM();
      if (!canUploadResource()) {
        showNotice('⚠ Chỉ Giáo viên Bộ môn được phân công giảng dạy hoặc Quản trị viên mới có quyền đóng gói bài giảng.', true);
        return;
      }
      if (typeof window.VANTHESIS_SWITCH_SECTOR === 'function') window.VANTHESIS_SWITCH_SECTOR('resources');
      openEditor(null, labSnapshot);
    },
    getState: function () { return Object.assign({}, state); }
  });
})();
