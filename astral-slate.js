/**
 * VANTHESIS Constellation LCMS — Bảng Giảng Thiên Văn (Bước 3A + 3B + 3C)
 * File: astral-slate.js (đặt ngang hàng index.html, nạp sau vanthesis-core.js)
 * Namespace: window.VANTHESIS_SLATE
 * Phụ thuộc: window.VANTHESIS_CORE (bus, auth, api, policy, db, drive, ui)
 *
 * Bảo toàn 100% Bước 3A (Ma trận tọa độ, động cơ mực 2 lớp, 5 đầu bút, 2 tẩy,
 * khóa chạm lòng bàn tay, 6 mẫu giấy & dòng kẻ VIP, đa trang, đồng bộ .vtslate)
 * + Bước 3B (Tự nắn hình Draw & Hold, chỉnh sửa đối tượng vector & ảnh,
 * 4 dụng cụ toán học: Thước thẳng, Compa, Thước đo độ, Ê-ke)
 * + Bước 3C (Tiếp nhận đồ thị 2D/3D từ Phòng Thí nghiệm, chèn đề PDF/Ảnh từ ổ C/D
 * hoặc Kho Chòm sao, xuất tệp PDF nhiều trang & giao bài giải lên Kho Chòm sao).
 */
(function () {
  'use strict';

  const STYLE_ID = 'vt-slate-isolated-css';
  const LAST_SLATE_KEY = 'vt_slate_last_board_id_v1';
  const DRIVE_FOLDER_NAME = 'VANTHESIS_Bang_Giang';
  const RESOURCES_FOLDER_NAME = 'VANTHESIS_Hoc_Lieu';
  const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  const INK_COLORS = [
    { hex: '#0F172A', label: 'Đen mực' },
    { hex: '#1D4ED8', label: 'Xanh dương' },
    { hex: '#DC2626', label: 'Đỏ chấm bài' },
    { hex: '#059669', label: 'Xanh lục' },
    { hex: '#7C3AED', label: 'Tím giải tích' },
    { hex: '#D97706', label: 'Cam nhấn' },
    { hex: '#F8FAFC', label: 'Phấn trắng' },
    { hex: '#FACC15', label: 'Vàng dạ quang' }
  ];

  const PAPER_PRESETS = [
    { id: 'BLANK', label: 'Giấy trắng trơn', icon: '⬜' },
    { id: 'LINED', label: 'Kẻ ngang tập vở', icon: '☰' },
    { id: 'GRID', label: 'Ô ly vuông toán học', icon: '⊞' },
    { id: 'DOT', label: 'Chấm bi tối giản', icon: '⣿' },
    { id: 'COORD', label: 'Hệ trục Oxy', icon: '✛' },
    { id: 'CHALKBOARD', label: 'Bảng tối thiên văn', icon: '🌌' }
  ];

  const RULING_COLORS = [
    { hex: '#94A3B8', label: 'Xám trung tính' },
    { hex: '#38BDF8', label: 'Xanh vở học sinh' },
    { hex: '#F472B6', label: 'Hồng phấn nhẹ' },
    { hex: '#E2E8F0', label: 'Trắng mảnh (Bảng tối)' }
  ];

  const GRADE_BLOCKS = ['Khối 12', 'Khối 11', 'Khối 10', 'Ôn thi ĐGNL / ĐGTD'];

  function createDefaultPaperConfig() {
    return {
      preset: 'GRID',
      spacing: 28,
      lineOpacity: 0.24,
      lineColor: '#94A3B8',
      chalkVariant: 'slate'
    };
  }

  function createBlankPage(paperCfg) {
    return {
      id: 'pg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      paperConfig: Object.assign(createDefaultPaperConfig(), paperCfg || {}),
      strokes: [],
      shapes: [],
      images: []
    };
  }

  function createDefaultInstruments() {
    return {
      ruler: { visible: false, x: 420, y: 260, length: 420, height: 54, angle: 0 },
      compass: { visible: false, cx: 480, cy: 320, radius: 130, angle: -0.5 },
      protractor: { visible: false, cx: 520, cy: 380, radius: 145, angle: 0 },
      setsquare: { visible: false, x: 340, y: 400, legA: 260, legB: 150, angle: 0 }
    };
  }

  const state = {
    mounted: false,
    active: false,
    boardId: 'slate_' + Date.now().toString(36),
    title: 'Bảng Giảng Thiên Văn',
    driveFileId: '',
    pdfDriveFileId: '',
    pages: [createBlankPage()],
    activePageIndex: 0,

    // Viewport matrix
    zoom: 1.0,
    panX: 0,
    panY: 0,
    stageWidth: 0,
    stageHeight: 0,
    dpr: 1,

    // Tools & Ink
    tool: 'fountain',
    color: '#0F172A',
    width: 3,
    palmRejection: false,
    smartShapeEnabled: true,
    spacePressed: false,

    // Active pointer & multi-touch
    activePointers: new Map(),
    drawingPointerId: null,
    activeStroke: null,
    activeSnappedShape: null,
    holdTimer: null,
    holdAnchor: null,
    isPanning: false,
    panStart: null,
    pinchState: null,
    laserTrails: [],
    laserRafId: 0,

    // Vector & Image Selection (Bước 3B)
    selectedItem: null, // { kind: 'shape' | 'image', id: string }
    dragTransform: null, // { mode: 'move' | 'resize' | 'endpoint', handle, startWorld, snapshot }

    // Math Instruments (Bước 3B)
    instruments: createDefaultInstruments(),
    instrumentDrag: null, // { key, mode, startWorld, orig, sweepStartAngle, sweepCurrentAngle }

    // Undo / Redo per page
    undoMap: {},
    redoMap: {},

    // Persistence & Cloud
    saveStatus: 'Đã lưu tại máy',
    localSaveTimer: null,
    driveSyncTimer: null,
    driveSyncing: false,
    cloudBoards: [],
    cloudDrawerOpen: false,

    // Reference Doc split panel
    refDoc: null,

    // Publish modal cache (Bước 3C)
    hubClasses: [],
    hubChapters: [],
    publishing: false,
    exportingPdf: false,
    importingDoc: false,

    // Runtime image cache
    imageCache: new Map()
  };

  let committedCanvas = null;
  let committedCtx = null;
  let activeCanvas = null;
  let activeCtx = null;
  let resizeObs = null;
  let rafPending = false;
  let pdfJsPromise = null;
  let jsPdfPromise = null;

  /* ==========================================================================
   * 1. CORE HELPERS & UNIFIED PERSISTENCE (VANTHESIS_CORE)
   * ========================================================================== */

  function getCore() {
    return window.VANTHESIS_CORE || null;
  }

  function canPublishToConstellation() {
    const C = getCore();
    if (C && C.policy && typeof C.policy.can === 'function') {
      return Boolean(C.policy.can('upload_resource'));
    }
    return false;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function notify(msg, type) {
    const C = getCore();
    if (C && C.ui && typeof C.ui.toast === 'function') {
      C.ui.toast(msg, type || 'info');
    }
  }

  function setSaveStatus(txt) {
    state.saveStatus = txt;
    const el = document.getElementById('vtSlateSaveStatus');
    if (el) el.textContent = txt;
  }

  function getCurrentPage() {
    if (!state.pages.length) state.pages = [createBlankPage()];
    if (state.activePageIndex < 0) state.activePageIndex = 0;
    if (state.activePageIndex >= state.pages.length) state.activePageIndex = state.pages.length - 1;
    return state.pages[state.activePageIndex];
  }

  function sanitizeFilename(title, ext) {
    const clean = String(title || 'Bang_Giang')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Bang_Giang';
    return clean.slice(0, 64) + ext;
  }

  function makeId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  async function saveLocalDraftNow() {
    clearTimeout(state.localSaveTimer);
    state.localSaveTimer = null;
    const C = getCore();
    if (!C || !C.db) return;
    const rec = {
      boardId: state.boardId,
      title: state.title,
      driveFileId: state.driveFileId || '',
      pdfDriveFileId: state.pdfDriveFileId || '',
      activePageIndex: state.activePageIndex,
      pages: state.pages,
      updatedAt: new Date().toISOString()
    };
    await C.db.set('slate_drafts', rec);
    try { localStorage.setItem(LAST_SLATE_KEY, state.boardId); } catch (e) {}
    if (!state.driveSyncing) setSaveStatus('Đã lưu tại máy');
  }

  function scheduleAutoSave() {
    setSaveStatus('Đang lưu...');
    clearTimeout(state.localSaveTimer);
    state.localSaveTimer = setTimeout(function () {
      saveLocalDraftNow();
    }, 300);
    clearTimeout(state.driveSyncTimer);
    state.driveSyncTimer = setTimeout(function () {
      syncSlateToDrive(true);
    }, 5000);
  }

  async function restoreLocalDraft() {
    const C = getCore();
    if (!C || !C.db) return false;
    let targetId = state.boardId;
    try {
      const last = localStorage.getItem(LAST_SLATE_KEY);
      if (last) targetId = last;
    } catch (e) {}
    const rec = await C.db.get('slate_drafts', targetId);
    if (rec && Array.isArray(rec.pages) && rec.pages.length) {
      state.boardId = rec.boardId || targetId;
      state.title = rec.title || 'Bảng Giảng Thiên Văn';
      state.driveFileId = rec.driveFileId || '';
      state.pdfDriveFileId = rec.pdfDriveFileId || '';
      state.pages = rec.pages.map(function (p) {
        return {
          id: p.id || makeId('pg'),
          paperConfig: Object.assign(createDefaultPaperConfig(), p.paperConfig || {}),
          strokes: Array.isArray(p.strokes) ? p.strokes : [],
          shapes: Array.isArray(p.shapes) ? p.shapes : [],
          images: Array.isArray(p.images) ? p.images : []
        };
      });
      state.activePageIndex = Math.max(0, Math.min(state.pages.length - 1, Number(rec.activePageIndex) || 0));
      setSaveStatus('Đã lưu tại máy');
      return true;
    }
    return false;
  }

  function loadExternalScript(src) {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-vt-lib="' + src + '"]');
      if (existing) {
        if (existing.getAttribute('data-loaded') === '1') { resolve(); return; }
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('Không thể tải thành phần hỗ trợ.')); });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-vt-lib', src);
      s.onload = function () { s.setAttribute('data-loaded', '1'); resolve(); };
      s.onerror = function () { reject(new Error('Không thể tải thành phần hỗ trợ.')); };
      document.head.appendChild(s);
    });
  }

  async function ensurePdfReader() {
    if (window.pdfjsLib) return window.pdfjsLib;
    if (!pdfJsPromise) {
      pdfJsPromise = loadExternalScript(PDFJS_CDN).then(function () {
        if (!window.pdfjsLib) throw new Error('Không thể khởi động trình đọc tài liệu.');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
        return window.pdfjsLib;
      }).catch(function (err) {
        pdfJsPromise = null;
        throw err;
      });
    }
    return pdfJsPromise;
  }

  async function ensurePdfExporter() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (!jsPdfPromise) {
      jsPdfPromise = loadExternalScript(JSPDF_CDN).then(function () {
        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('Không thể khởi động bộ xuất tệp PDF.');
        return window.jspdf.jsPDF;
      }).catch(function (err) {
        jsPdfPromise = null;
        throw err;
      });
    }
    return jsPdfPromise;
  }

  /* ==========================================================================
   * 2. UNDO / REDO HISTORY ENGINE
   * ========================================================================== */

  function snapshotPage(page) {
    return JSON.stringify({
      paperConfig: page.paperConfig,
      strokes: page.strokes,
      shapes: page.shapes,
      images: page.images
    });
  }

  function pushUndo() {
    const page = getCurrentPage();
    if (!state.undoMap[page.id]) state.undoMap[page.id] = [];
    const stack = state.undoMap[page.id];
    stack.push(snapshotPage(page));
    if (stack.length > 50) stack.shift();
    state.redoMap[page.id] = [];
    syncUndoRedoBtns();
  }

  function performUndo() {
    const page = getCurrentPage();
    const uStack = state.undoMap[page.id];
    if (!uStack || !uStack.length) return;
    if (!state.redoMap[page.id]) state.redoMap[page.id] = [];
    state.redoMap[page.id].push(snapshotPage(page));
    const prev = JSON.parse(uStack.pop());
    page.paperConfig = prev.paperConfig;
    page.strokes = prev.strokes;
    page.shapes = prev.shapes;
    page.images = prev.images;
    state.selectedItem = null;
    syncSelectionBar();
    syncUndoRedoBtns();
    renderCommittedLayer();
    renderActiveLayer();
    scheduleAutoSave();
  }

  function performRedo() {
    const page = getCurrentPage();
    const rStack = state.redoMap[page.id];
    if (!rStack || !rStack.length) return;
    if (!state.undoMap[page.id]) state.undoMap[page.id] = [];
    state.undoMap[page.id].push(snapshotPage(page));
    const next = JSON.parse(rStack.pop());
    page.paperConfig = next.paperConfig;
    page.strokes = next.strokes;
    page.shapes = next.shapes;
    page.images = next.images;
    state.selectedItem = null;
    syncSelectionBar();
    syncUndoRedoBtns();
    renderCommittedLayer();
    renderActiveLayer();
    scheduleAutoSave();
  }

  function syncUndoRedoBtns() {
    const page = getCurrentPage();
    const u = document.getElementById('vtSlateUndoBtn');
    const r = document.getElementById('vtSlateRedoBtn');
    if (u) u.disabled = !(state.undoMap[page.id] && state.undoMap[page.id].length);
    if (r) r.disabled = !(state.redoMap[page.id] && state.redoMap[page.id].length);
  }

  /* ==========================================================================
   * 3. ISOLATED CSS (.vt-slate-* ONLY — ZERO GLOBAL POLLUTION)
   * ========================================================================== */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .vt-slate-root {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--bg);
        color: var(--text);
        font-family: var(--font-sans, 'Plus Jakarta Sans', system-ui, sans-serif);
        user-select: none;
        -webkit-user-select: none;
      }
      .vt-slate-topbar {
        height: 48px;
        min-height: 48px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        background: var(--surface);
        border-bottom: 1px solid var(--border-strong);
        z-index: 30;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .vt-slate-topbar::-webkit-scrollbar { display: none; }
      .vt-slate-top-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .vt-slate-title-inp {
        width: 175px;
        max-width: 24vw;
        padding: 5px 10px;
        border-radius: 9999px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text);
        font-family: 'Newsreader', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
      }
      .vt-slate-title-inp:hover, .vt-slate-title-inp:focus {
        border-color: var(--border-strong);
        background: var(--bg);
        outline: none;
      }
      .vt-slate-btn {
        height: 32px;
        padding: 0 10px;
        border-radius: 9999px;
        border: 1px solid var(--border-strong);
        background: var(--surface-alt, var(--bg));
        color: var(--text);
        font-size: 12px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.14s ease, border-color 0.14s ease, transform 0.12s ease;
      }
      .vt-slate-btn:hover:not(:disabled) {
        border-color: var(--primary, #2563EB);
        background: rgba(37, 99, 235, 0.08);
      }
      .vt-slate-btn.active {
        background: linear-gradient(135deg, #2563EB, #1D4ED8);
        color: #FFFFFF;
        border-color: transparent;
      }
      .vt-slate-btn.primary {
        background: linear-gradient(135deg, #2563EB, #4F46E5);
        color: #FFFFFF;
        border-color: transparent;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
      }
      .vt-slate-btn.primary:hover:not(:disabled) {
        filter: brightness(1.06);
      }
      .vt-slate-btn:disabled { opacity: 0.42; cursor: not-allowed; }
      .vt-slate-page-pill {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        font-weight: 800;
        padding: 0 6px;
        white-space: nowrap;
      }
      .vt-slate-save-pill {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 9999px;
        background: rgba(16, 185, 129, 0.12);
        color: #059669;
        border: 1px solid rgba(16, 185, 129, 0.28);
        white-space: nowrap;
      }
      html[data-theme="dark"] .vt-slate-save-pill { color: #6EE7B7; }

      .vt-slate-body {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
      .vt-slate-dock {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        width: 54px;
        max-height: calc(100% - 18px);
        overflow-y: auto;
        scrollbar-width: none;
        padding: 8px 6px;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(15, 23, 42, 0.12);
        box-shadow: 0 14px 36px rgba(15, 23, 42, 0.14);
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        z-index: 25;
        transition: opacity 0.18s ease;
      }
      .vt-slate-dock::-webkit-scrollbar { display: none; }
      html[data-theme="dark"] .vt-slate-dock {
        background: rgba(12, 20, 38, 0.90);
        border-color: rgba(148, 163, 184, 0.25);
        box-shadow: 0 16px 42px rgba(2, 6, 23, 0.56);
      }
      .vt-slate-dock.is-dimmed {
        opacity: 0.24;
        pointer-events: none;
      }
      .vt-slate-tool-btn {
        width: 40px;
        height: 34px;
        border-radius: 13px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text);
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
      }
      .vt-slate-tool-btn:hover { background: rgba(37, 99, 235, 0.12); }
      .vt-slate-tool-btn.active {
        background: linear-gradient(135deg, #2563EB, #1D4ED8);
        color: #FFFFFF;
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.34);
      }
      .vt-slate-tool-btn.palm-on {
        background: rgba(245, 158, 11, 0.20);
        border-color: rgba(217, 119, 6, 0.55);
        color: #D97706;
      }
      .vt-slate-tool-btn.smart-on {
        background: rgba(124, 58, 237, 0.16);
        border-color: rgba(124, 58, 237, 0.45);
        color: #7C3AED;
      }
      .vt-slate-sep { width: 28px; height: 1px; background: var(--border-strong); margin: 2px 0; flex-shrink: 0; }
      .vt-slate-swatch-grid { display: grid; grid-template-columns: repeat(2, 18px); gap: 5px; }
      .vt-slate-swatch {
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        border: 1.5px solid rgba(148, 163, 184, 0.55);
        cursor: pointer;
        padding: 0;
      }
      .vt-slate-swatch.active { transform: scale(1.18); box-shadow: 0 0 0 2px #2563EB; }
      .vt-slate-color-inp { width: 34px; height: 22px; border: 1px solid var(--border-strong); border-radius: 8px; padding: 0; cursor: pointer; background: transparent; }
      .vt-slate-size-dot { border-radius: 9999px; transition: width 0.1s ease, height 0.1s ease; }

      /* Strict scoped touch-action: none ONLY on board stage */
      .vt-slate-stage {
        position: relative;
        flex: 1;
        width: 100%;
        height: 100%;
        overflow: hidden;
        touch-action: none;
        cursor: crosshair;
      }
      .vt-slate-stage.is-pan { cursor: grab; }
      .vt-slate-stage.is-pan:active { cursor: grabbing; }
      .vt-slate-stage.is-select { cursor: default; }
      .vt-slate-stage.is-dragover::after {
        content: 'Thả tệp PDF hoặc Ảnh đề bài vào đây để đặt lên bảng';
        position: absolute;
        inset: 14px;
        border-radius: 22px;
        border: 2.5px dashed #2563EB;
        background: rgba(37, 99, 235, 0.12);
        backdrop-filter: blur(8px);
        color: var(--text);
        font-size: 16px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 45;
        pointer-events: none;
      }
      .vt-slate-layer { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      #vtSlateActiveLayer { pointer-events: none; }

      /* Floating selection action pill */
      .vt-slate-selbar {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        padding: 6px 10px;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid rgba(15, 23, 42, 0.14);
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        display: none;
        align-items: center;
        gap: 6px;
        z-index: 34;
      }
      html[data-theme="dark"] .vt-slate-selbar {
        background: rgba(12, 20, 38, 0.94);
        border-color: rgba(148, 163, 184, 0.28);
      }
      .vt-slate-selbar.open { display: flex; }

      /* Popovers (Paper, Instruments) */
      .vt-slate-popover {
        position: absolute;
        top: 54px;
        right: 12px;
        width: min(336px, 92vw);
        padding: 16px;
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(15, 23, 42, 0.14);
        box-shadow: 0 20px 54px rgba(15, 23, 42, 0.18);
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        z-index: 40;
        display: none;
        flex-direction: column;
        gap: 12px;
      }
      html[data-theme="dark"] .vt-slate-popover {
        background: rgba(12, 20, 38, 0.96);
        border-color: rgba(148, 163, 184, 0.28);
        box-shadow: 0 22px 58px rgba(2, 6, 23, 0.6);
      }
      .vt-slate-popover.open { display: flex; }
      .vt-slate-preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
      .vt-slate-preset-btn {
        padding: 8px 10px;
        border-radius: 14px;
        border: 1px solid var(--border-strong);
        background: var(--bg);
        color: var(--text);
        font-size: 12px;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .vt-slate-preset-btn.active { border-color: #2563EB; background: rgba(37, 99, 235, 0.12); color: var(--primary, #2563EB); }

      /* Cloud Saved Boards Drawer */
      .vt-slate-cloud-drawer {
        position: absolute;
        top: 48px;
        left: 0;
        bottom: 0;
        width: min(320px, 88vw);
        background: var(--surface);
        border-right: 1px solid var(--border-strong);
        box-shadow: 16px 0 42px rgba(15, 23, 42, 0.16);
        padding: 14px;
        display: none;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        z-index: 42;
      }
      .vt-slate-cloud-drawer.open { display: flex; }
      .vt-slate-cloud-item {
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid var(--border-strong);
        background: var(--bg);
        display: flex;
        flex-direction: column;
        gap: 4px;
        cursor: pointer;
      }
      .vt-slate-cloud-item:hover { border-color: #2563EB; }

      /* Reference Document Panel */
      .vt-slate-refdoc {
        width: 38%;
        min-width: 280px;
        max-width: 480px;
        border-right: 1px solid var(--border-strong);
        background: var(--surface);
        display: none;
        flex-direction: column;
        z-index: 20;
      }
      .vt-slate-refdoc.open { display: flex; }
      .vt-slate-refdoc-head {
        padding: 8px 12px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12.5px;
        font-weight: 700;
      }
      .vt-slate-refdoc iframe { flex: 1; width: 100%; border: 0; }

      /* Modals (Insert Document & Publish to Constellation) */
      .vt-slate-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.48);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        z-index: 60;
      }
      .vt-slate-modal-backdrop.open { display: flex; }
      .vt-slate-modal {
        width: min(490px, 95vw);
        max-height: 88vh;
        overflow-y: auto;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.97);
        border: 1px solid rgba(15, 23, 42, 0.14);
        box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      html[data-theme="dark"] .vt-slate-modal {
        background: rgba(12, 20, 38, 0.97);
        border-color: rgba(148, 163, 184, 0.28);
        box-shadow: 0 26px 68px rgba(2, 6, 23, 0.68);
      }
      .vt-slate-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .vt-slate-field label {
        font-size: 12px;
        font-weight: 700;
        color: var(--text-muted);
      }
      .vt-slate-input, .vt-slate-select, .vt-slate-textarea {
        width: 100%;
        padding: 9px 12px;
        border-radius: 12px;
        border: 1px solid var(--border-strong);
        background: var(--bg);
        color: var(--text);
        font-size: 13.5px;
        font-family: inherit;
        box-sizing: border-box;
      }
      .vt-slate-dropzone {
        border: 2px dashed var(--border-strong);
        border-radius: 18px;
        padding: 24px 16px;
        text-align: center;
        cursor: pointer;
        background: var(--bg);
        transition: border-color 0.16s ease, background 0.16s ease;
      }
      .vt-slate-dropzone:hover, .vt-slate-dropzone.over {
        border-color: #2563EB;
        background: rgba(37, 99, 235, 0.08);
      }
      .vt-slate-class-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
        max-height: 150px;
        overflow-y: auto;
        padding: 4px 2px;
      }
      .vt-slate-class-chip {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 7px 10px;
        border-radius: 12px;
        border: 1px solid var(--border-strong);
        background: var(--bg);
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .vt-slate-progress-bar {
        height: 8px;
        border-radius: 9999px;
        background: var(--border);
        overflow: hidden;
      }
      .vt-slate-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #2563EB, #7C3AED);
        transition: width 0.18s ease;
      }

      @media (max-width: 767px) {
        .vt-slate-title-inp { width: 120px; font-size: 13.5px; }
        .vt-slate-dock { left: 6px; width: 48px; padding: 6px 4px; }
        .vt-slate-tool-btn { width: 36px; height: 31px; font-size: 15px; }
        .vt-slate-refdoc { position: absolute; inset: 0; width: 100%; max-width: 100%; z-index: 38; }
        .vt-slate-class-grid { grid-template-columns: 1fr; }
      }
    
      /* === CELESTIAL OBSERVATORY INSTRUMENT CHROME (95% CLEAN BOARD PRESERVED) === */
      .vt-slate-topbar {
        background: var(--vt-cosmos-surface-strong, var(--surface)) !important;
        backdrop-filter: blur(22px) saturate(145%);
        -webkit-backdrop-filter: blur(22px) saturate(145%);
        border-bottom: 1px solid var(--vt-cosmos-border, var(--border-strong)) !important;
      }
      .vt-slate-dock {
        backdrop-filter: blur(24px) saturate(150%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(150%) !important;
        border-top: 1px solid var(--vt-cosmos-border-top, rgba(255, 255, 255, 0.24)) !important;
      }
      .vt-slate-tool-btn.active {
        background: linear-gradient(135deg, #1D4ED8, #4F46E5) !important;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.48), 0 8px 22px -4px rgba(37, 99, 235, 0.56) !important;
      }
      .vt-slate-title-inp {
        font-family: var(--vt-cosmos-font-display, 'Cormorant Garamond', Georgia, serif) !important;
        font-size: 16.5px !important;
      }

    `;
    document.head.appendChild(style);
  }

  /* ==========================================================================
   * 4. DOM MOUNTING & TOOLBAR WIRING
   * ========================================================================== */

  function mountSlateUI() {
    const host = document.getElementById('vtSlateMount');
    if (!host || state.mounted) return;
    injectStyles();

    const swatchesHtml = INK_COLORS.map(function (c) {
      return '<button type="button" class="vt-slate-swatch' + (c.hex === state.color ? ' active' : '') + '" data-sl-color="' + c.hex + '" title="' + c.label + '" style="background:' + c.hex + ';"></button>';
    }).join('');

    const presetsHtml = PAPER_PRESETS.map(function (p) {
      return '<button type="button" class="vt-slate-preset-btn" data-sl-preset="' + p.id + '"><span>' + p.icon + '</span><span>' + p.label + '</span></button>';
    }).join('');

    const rulingColsHtml = RULING_COLORS.map(function (c) {
      return '<button type="button" class="vt-slate-swatch" data-sl-rcolor="' + c.hex + '" title="' + c.label + '" style="background:' + c.hex + ';"></button>';
    }).join('');

    const gradeOptsHtml = GRADE_BLOCKS.map(function (g) {
      return '<option value="' + escapeAttr(g) + '">' + escapeHtml(g) + '</option>';
    }).join('');

    host.innerHTML = `
      <div class="vt-slate-root" id="vtSlateRoot">
        <div class="vt-slate-topbar">
          <div class="vt-slate-top-group">
            <button type="button" class="vt-slate-btn" id="vtSlateDriveBtn" title="Bản viết đã lưu trên Đám mây">☁ Đám mây</button>
            <input type="text" class="vt-slate-title-inp" id="vtSlateTitleInp" value="${escapeAttr(state.title)}" aria-label="Tiêu đề bảng giảng">
            <span class="vt-slate-save-pill" id="vtSlateSaveStatus">${escapeHtml(state.saveStatus)}</span>
          </div>

          <div class="vt-slate-top-group">
            <button type="button" class="vt-slate-btn" id="vtSlatePrevPage" title="Trang trước">◀</button>
            <span class="vt-slate-page-pill" id="vtSlatePageLabel">Trang 1 / 1</span>
            <button type="button" class="vt-slate-btn" id="vtSlateNextPage" title="Trang sau">▶</button>
            <button type="button" class="vt-slate-btn" id="vtSlateAddPage" title="Thêm trang mới">+ Trang</button>
            <button type="button" class="vt-slate-btn" id="vtSlateDupPage" title="Nhân bản trang hiện tại">⧉</button>
            <button type="button" class="vt-slate-btn" id="vtSlateDelPage" title="Xóa trang hiện tại">🗑</button>
          </div>

          <div class="vt-slate-top-group">
            <button type="button" class="vt-slate-btn" id="vtSlateInsertDocBtn" title="Chèn đề PDF hoặc Ảnh từ máy tính hoặc Kho Chòm sao">📄 Chèn Đề PDF / Ảnh</button>
            <button type="button" class="vt-slate-btn" id="vtSlateToolsBtn" title="Thước thẳng, Compa, Thước đo độ, Ê-ke">📐 Dụng cụ</button>
            <button type="button" class="vt-slate-btn" id="vtSlatePaperBtn" title="Mặt giấy & Dòng kẻ tùy biến">▤ Mặt giấy</button>
            <button type="button" class="vt-slate-btn" id="vtSlateUndoBtn" title="Hoàn tác (Ctrl+Z)" disabled>↶</button>
            <button type="button" class="vt-slate-btn" id="vtSlateRedoBtn" title="Làm lại (Ctrl+Y)" disabled>↷</button>
            <button type="button" class="vt-slate-btn" id="vtSlateZoomBtn" title="Đặt lại tỷ lệ 100%">100%</button>
            <button type="button" class="vt-slate-btn" id="vtSlateExportPdfBtn" title="Tải giáo án / bài giải dạng tệp PDF nhiều trang">⬇ Tải tệp PDF</button>
            <button type="button" class="vt-slate-btn primary" id="vtSlatePublishBtn" style="display:none;" title="Lưu bản giải PDF và giao lên Kho Chòm sao">🚀 Lưu & Giao lên Kho Chòm sao</button>
          </div>
        </div>

        <div class="vt-slate-body">
          <div class="vt-slate-refdoc" id="vtSlateRefDoc">
            <div class="vt-slate-refdoc-head">
              <span id="vtSlateRefDocTitle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Tài liệu đối chiếu</span>
              <button type="button" class="vt-slate-btn" id="vtSlateRefDocClose" style="height:26px;padding:0 8px;">✕ Đóng</button>
            </div>
            <iframe id="vtSlateRefDocFrame" title="Tài liệu học tập"></iframe>
          </div>

          <div class="vt-slate-stage" id="vtSlateStage">
            <canvas class="vt-slate-layer" id="vtSlateCommittedLayer"></canvas>
            <canvas class="vt-slate-layer" id="vtSlateActiveLayer"></canvas>

            <div class="vt-slate-dock" id="vtSlateDock">
              <button type="button" class="vt-slate-tool-btn active" data-sl-tool="fountain" title="Bút máy thanh-đậm">✒</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="ballpoint" title="Bút bi kỹ thuật">🖊</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="highlighter" title="Bút dạ quang nằm dưới nét mực">🖍</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="dashed" title="Bút nét đứt hình học">┄</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="laser" title="Bút Laser thuyết trình">🔴</button>
              <div class="vt-slate-sep"></div>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="select" title="Chọn, di chuyển & phóng to hình / ảnh">⬚</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="eraser_stroke" title="Tẩy cả nét">⌫</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="eraser_region" title="Tẩy vùng điểm">◌</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="pan" title="Di chuyển bảng (hoặc giữ Space)">✋</button>
              <div class="vt-slate-sep"></div>
              <button type="button" class="vt-slate-tool-btn smart-on" id="vtSlateSmartShapeBtn" title="Giữ yên đầu bút để tự nắn hình học">✨</button>
              <button type="button" class="vt-slate-tool-btn" id="vtSlatePalmBtn" title="Khóa chống chạm lòng bàn tay">🛡</button>
              <div class="vt-slate-sep"></div>
              <div class="vt-slate-swatch-grid">${swatchesHtml}</div>
              <input type="color" class="vt-slate-color-inp" id="vtSlateCustomColor" value="${state.color}" title="Chọn màu mực tùy ý">
              <div class="vt-slate-sep"></div>
              <div class="vt-slate-size-dot" id="vtSlateSizeDot" style="width:8px;height:8px;background:${state.color};"></div>
              <input type="range" id="vtSlateSizeSlider" min="1" max="24" value="${state.width}" style="width:40px;accent-color:#2563EB;" title="Cỡ nét mực">
            </div>

            <div class="vt-slate-selbar" id="vtSlateSelBar">
              <span id="vtSlateSelLabel" style="font-size:12px;font-weight:700;padding:0 6px;">Đối tượng đang chọn</span>
              <button type="button" class="vt-slate-btn" id="vtSlateSelLockBtn" title="Khóa/Mở khóa cố định trên nền">🔓 Khóa nền</button>
              <button type="button" class="vt-slate-btn" id="vtSlateSelDupBtn" title="Nhân bản đối tượng">⧉ Nhân bản</button>
              <button type="button" class="vt-slate-btn" id="vtSlateSelDelBtn" style="color:#DC2626;" title="Xóa đối tượng">🗑 Xóa</button>
            </div>
          </div>
        </div>

        <!-- Popover Mặt giấy & Dòng kẻ -->
        <div class="vt-slate-popover" id="vtSlatePaperPopover">
          <div style="font-size:13.5px;font-weight:800;">Mẫu mặt giấy & Dòng kẻ</div>
          <div class="vt-slate-preset-grid">${presetsHtml}</div>
          <div id="vtSlateChalkRow" style="display:none;gap:6px;align-items:center;">
            <span style="font-size:12px;font-weight:700;color:var(--text-muted);">Màu bảng tối:</span>
            <button type="button" class="vt-slate-btn" data-sl-chalk="slate" style="height:26px;font-size:11px;">Xanh đen thiên văn</button>
            <button type="button" class="vt-slate-btn" data-sl-chalk="green" style="height:26px;font-size:11px;">Bảng xanh lục</button>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px;">
              <span>Khoảng cách dòng kẻ</span><span id="vtSlateSpacingVal">28px</span>
            </div>
            <input type="range" id="vtSlateSpacingSlider" min="16" max="48" value="28" style="width:100%;accent-color:#2563EB;">
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px;">
              <span>Độ đậm dòng kẻ</span><span id="vtSlateOpacityVal">24%</span>
            </div>
            <input type="range" id="vtSlateOpacitySlider" min="10" max="60" value="24" style="width:100%;accent-color:#2563EB;">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:12px;font-weight:700;">Màu đường kẻ</span>
            <div style="display:flex;gap:7px;">${rulingColsHtml}</div>
          </div>
          <button type="button" class="vt-slate-btn active" id="vtSlateApplyAllPages" style="width:100%;justify-content:center;">Áp dụng cho toàn bộ các trang</button>
        </div>

        <!-- Popover Bộ Dụng Cụ Dựng Hình Toán Học (Bước 3B) -->
        <div class="vt-slate-popover" id="vtSlateToolsPopover" style="width:min(300px,90vw);">
          <div style="font-size:13.5px;font-weight:800;">Bộ Dụng Cụ Dựng Hình Toán Học</div>
          <div style="font-size:11.5px;color:var(--text-muted);line-height:1.45;">
            Kéo thân thước để di chuyển, kéo chấm tròn xanh để xoay góc. Đưa bút lại gần mép thước hoặc ê-ke để tự kẻ thẳng.
          </div>
          <div class="vt-slate-preset-grid">
            <button type="button" class="vt-slate-preset-btn" data-sl-inst="ruler"><span>📏</span><span>Thước thẳng</span></button>
            <button type="button" class="vt-slate-preset-btn" data-sl-inst="compass"><span>🧭</span><span>Compa</span></button>
            <button type="button" class="vt-slate-preset-btn" data-sl-inst="protractor"><span>📐</span><span>Thước đo độ</span></button>
            <button type="button" class="vt-slate-preset-btn" data-sl-inst="setsquare"><span>🔺</span><span>Ê-ke vuông</span></button>
          </div>
          <button type="button" class="vt-slate-btn" id="vtSlateHideAllInst" style="width:100%;justify-content:center;">Ẩn toàn bộ dụng cụ</button>
        </div>

        <!-- Cloud Boards Drawer -->
        <div class="vt-slate-cloud-drawer" id="vtSlateCloudDrawer">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:14.5px;font-weight:800;">☁ Bản viết trên Đám mây</div>
            <button type="button" class="vt-slate-btn" id="vtSlateCloudClose" style="height:26px;padding:0 8px;">✕</button>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="vt-slate-btn active" id="vtSlateNewBtn" style="flex:1;">+ Bảng mới</button>
            <button type="button" class="vt-slate-btn" id="vtSlateSyncNowBtn" style="flex:1;">↻ Lưu ngay</button>
          </div>
          <div id="vtSlateCloudList" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>

        <!-- Modal Chèn Đề PDF / Ảnh (Bước 3C) -->
        <div class="vt-slate-modal-backdrop" id="vtSlateInsertBackdrop">
          <div class="vt-slate-modal">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="font-size:16px;font-weight:800;">📄 Chèn Đề PDF hoặc Ảnh lên Bảng</div>
              <button type="button" class="vt-slate-btn" id="vtSlateInsertClose" style="height:28px;padding:0 9px;">✕</button>
            </div>
            <div class="vt-slate-dropzone" id="vtSlateDropzone">
              <div style="font-size:30px;margin-bottom:6px;">📂</div>
              <div style="font-size:14px;font-weight:800;margin-bottom:4px;">Kéo thả tệp PDF hoặc Ảnh (.png, .jpg) vào đây</div>
              <div style="font-size:12px;color:var(--text-muted);">Hoặc bấm để chọn từ máy tính / iPad. Mỗi trang PDF sẽ tự dàn sang 1 trang bảng kèm không gian viết lời giải.</div>
              <input type="file" id="vtSlateFileInput" accept=".pdf,image/png,image/jpeg,image/webp" style="display:none;">
            </div>
            <div id="vtSlateInsertProgressWrap" style="display:none;flex-direction:column;gap:6px;">
              <div id="vtSlateInsertProgressText" style="font-size:12.5px;font-weight:700;color:#2563EB;">Đang xử lý tài liệu...</div>
              <div class="vt-slate-progress-bar"><div class="vt-slate-progress-fill" id="vtSlateInsertProgressFill"></div></div>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:12.5px;font-weight:700;">Hoặc dán liên kết tệp Google Drive</div>
              <div style="display:flex;gap:8px;">
                <input type="text" class="vt-slate-input" id="vtSlateDriveLinkInp" placeholder="Dán liên kết chia sẻ tệp PDF hoặc ảnh...">
                <button type="button" class="vt-slate-btn active" id="vtSlateDriveImportBtn" style="height:38px;padding:0 14px;">Chèn ngay</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Lưu & Giao lên Kho Chòm sao (Bước 3C — Chỉ Admin & GV Bộ môn) -->
        <div class="vt-slate-modal-backdrop" id="vtSlatePublishBackdrop">
          <div class="vt-slate-modal">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="font-size:16px;font-weight:800;">🚀 Lưu & Giao Bài Giải lên Kho Chòm sao</div>
              <button type="button" class="vt-slate-btn" id="vtSlatePublishClose" style="height:28px;padding:0 9px;">✕</button>
            </div>
            <div class="vt-slate-field">
              <label for="vtSlatePubTitle">Tiêu đề bài giảng / lời giải viết tay</label>
              <input type="text" class="vt-slate-input" id="vtSlatePubTitle" placeholder="Ví dụ: Lời giải chi tiết Đề ôn tập Hàm số">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="vt-slate-field">
                <label for="vtSlatePubGrade">Khối lớp</label>
                <select class="vt-slate-select" id="vtSlatePubGrade">${gradeOptsHtml}</select>
              </div>
              <div class="vt-slate-field">
                <label for="vtSlatePubChapter">Chương / Chòm sao</label>
                <input type="text" class="vt-slate-input" id="vtSlatePubChapter" list="vtSlateChapterHints" placeholder="Ví dụ: Ứng dụng Đạo hàm">
                <datalist id="vtSlateChapterHints"></datalist>
              </div>
            </div>
            <div class="vt-slate-field">
              <label for="vtSlatePubSummary">Ghi chú ngắn cho học sinh (không bắt buộc)</label>
              <textarea class="vt-slate-textarea" id="vtSlatePubSummary" rows="2" placeholder="Tóm tắt trọng tâm bài giải viết tay..."></textarea>
            </div>
            <div class="vt-slate-field">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <label>Giao cho các lớp giảng dạy</label>
                <button type="button" class="vt-slate-btn" id="vtSlateSelectAllClassesBtn" style="height:26px;font-size:11.5px;">✓ Chọn tất cả lớp của tôi</button>
              </div>
              <div class="vt-slate-class-grid" id="vtSlatePubClassGrid"></div>
            </div>
            <div id="vtSlatePubProgressWrap" style="display:none;flex-direction:column;gap:6px;">
              <div id="vtSlatePubProgressText" style="font-size:12.5px;font-weight:700;color:#2563EB;">Đang đóng gói bản giải...</div>
              <div class="vt-slate-progress-bar"><div class="vt-slate-progress-fill" id="vtSlatePubProgressFill"></div></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
              <button type="button" class="vt-slate-btn" id="vtSlatePubCancelBtn">Hủy</button>
              <button type="button" class="vt-slate-btn primary" id="vtSlatePubSubmitBtn">🚀 Xác nhận Lưu & Giao bài</button>
            </div>
          </div>
        </div>
      </div>
    `;

    committedCanvas = document.getElementById('vtSlateCommittedLayer');
    activeCanvas = document.getElementById('vtSlateActiveLayer');
    committedCtx = committedCanvas.getContext('2d', { desynchronized: true });
    activeCtx = activeCanvas.getContext('2d', { desynchronized: true });

    state.mounted = true;
    wireUiEvents();
    wirePointerEvents();
    attachStageResizeObserver();
    syncRolePermissionsUI();
    syncPageHeaderUI();
    syncPaperControlsUI();
    syncInstrumentsPopoverUI();
    syncUndoRedoBtns();
  }

  function syncRolePermissionsUI() {
    const pubBtn = document.getElementById('vtSlatePublishBtn');
    if (pubBtn) {
      pubBtn.style.display = canPublishToConstellation() ? 'inline-flex' : 'none';
    }
  }

  function attachStageResizeObserver() {
    const stage = document.getElementById('vtSlateStage');
    if (!stage || typeof ResizeObserver === 'undefined') return;
    if (resizeObs) resizeObs.disconnect();
    resizeObs = new ResizeObserver(function () {
      if (state.active) resizeSlateLayers();
    });
    resizeObs.observe(stage);
  }

  function wireUiEvents() {
    document.getElementById('vtSlateTitleInp').addEventListener('input', function (e) {
      state.title = e.target.value.trim() || 'Bảng Giảng Thiên Văn';
      scheduleAutoSave();
    });

    document.getElementById('vtSlatePrevPage').addEventListener('click', function () {
      if (state.activePageIndex > 0) switchToPage(state.activePageIndex - 1);
    });
    document.getElementById('vtSlateNextPage').addEventListener('click', function () {
      if (state.activePageIndex < state.pages.length - 1) switchToPage(state.activePageIndex + 1);
    });
    document.getElementById('vtSlateAddPage').addEventListener('click', function () {
      const cur = getCurrentPage();
      state.pages.splice(state.activePageIndex + 1, 0, createBlankPage(cur.paperConfig));
      switchToPage(state.activePageIndex + 1);
      scheduleAutoSave();
      notify('✓ Đã thêm trang bảng giảng mới.', 'success');
    });
    document.getElementById('vtSlateDupPage').addEventListener('click', function () {
      const cur = getCurrentPage();
      const copy = JSON.parse(JSON.stringify(cur));
      copy.id = makeId('pg');
      state.pages.splice(state.activePageIndex + 1, 0, copy);
      switchToPage(state.activePageIndex + 1);
      scheduleAutoSave();
      notify('✓ Đã nhân bản trang hiện tại.', 'success');
    });
    document.getElementById('vtSlateDelPage').addEventListener('click', async function () {
      if (state.pages.length <= 1) {
        notify('Bảng giảng cần giữ tối thiểu 1 trang.', 'warn');
        return;
      }
      const C = getCore();
      const ok = C && C.ui ? await C.ui.confirm({ title: 'Xóa trang bảng giảng', message: 'Bạn có chắc chắn muốn xóa trang hiện tại không?', confirmText: 'Xóa trang', danger: true }) : true;
      if (!ok) return;
      state.pages.splice(state.activePageIndex, 1);
      if (state.activePageIndex >= state.pages.length) state.activePageIndex = state.pages.length - 1;
      switchToPage(state.activePageIndex);
      scheduleAutoSave();
      notify('✓ Đã xóa trang.', 'success');
    });

    const paperPop = document.getElementById('vtSlatePaperPopover');
    const toolsPop = document.getElementById('vtSlateToolsPopover');

    document.getElementById('vtSlatePaperBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      toolsPop.classList.remove('open');
      paperPop.classList.toggle('open');
      syncPaperControlsUI();
    });
    document.getElementById('vtSlateToolsBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      paperPop.classList.remove('open');
      toolsPop.classList.toggle('open');
      syncInstrumentsPopoverUI();
    });

    document.addEventListener('click', function (e) {
      if (paperPop.classList.contains('open') && !paperPop.contains(e.target) && e.target.id !== 'vtSlatePaperBtn') {
        paperPop.classList.remove('open');
      }
      if (toolsPop.classList.contains('open') && !toolsPop.contains(e.target) && e.target.id !== 'vtSlateToolsBtn') {
        toolsPop.classList.remove('open');
      }
    });

    paperPop.querySelectorAll('[data-sl-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pushUndo();
        const preset = btn.getAttribute('data-sl-preset');
        const page = getCurrentPage();
        page.paperConfig.preset = preset;
        if (preset === 'CHALKBOARD') {
          if (state.color === '#0F172A' || state.color === '#1D4ED8') {
            setInkColor('#F8FAFC');
            notify('✦ Đã tự động chuyển màu mực sáng cho nền bảng tối.', 'info');
          }
          page.paperConfig.lineColor = '#E2E8F0';
        } else if (state.color === '#F8FAFC') {
          setInkColor('#0F172A');
        }
        syncPaperControlsUI();
        renderCommittedLayer();
        scheduleAutoSave();
      });
    });

    paperPop.querySelectorAll('[data-sl-chalk]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pushUndo();
        getCurrentPage().paperConfig.chalkVariant = btn.getAttribute('data-sl-chalk');
        syncPaperControlsUI();
        renderCommittedLayer();
        scheduleAutoSave();
      });
    });

    document.getElementById('vtSlateSpacingSlider').addEventListener('input', function (e) {
      const val = Number(e.target.value);
      getCurrentPage().paperConfig.spacing = val;
      document.getElementById('vtSlateSpacingVal').textContent = val + 'px';
      renderCommittedLayer();
      scheduleAutoSave();
    });

    document.getElementById('vtSlateOpacitySlider').addEventListener('input', function (e) {
      const val = Number(e.target.value);
      getCurrentPage().paperConfig.lineOpacity = val / 100;
      document.getElementById('vtSlateOpacityVal').textContent = val + '%';
      renderCommittedLayer();
      scheduleAutoSave();
    });

    paperPop.querySelectorAll('[data-sl-rcolor]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        getCurrentPage().paperConfig.lineColor = btn.getAttribute('data-sl-rcolor');
        syncPaperControlsUI();
        renderCommittedLayer();
        scheduleAutoSave();
      });
    });

    document.getElementById('vtSlateApplyAllPages').addEventListener('click', function () {
      const curCfg = JSON.parse(JSON.stringify(getCurrentPage().paperConfig));
      state.pages.forEach(function (p) { p.paperConfig = JSON.parse(JSON.stringify(curCfg)); });
      renderCommittedLayer();
      scheduleAutoSave();
      paperPop.classList.remove('open');
      notify('✓ Đã áp dụng kiểu giấy cho toàn bộ ' + state.pages.length + ' trang.', 'success');
    });

    // Math Instruments popover wiring (Bước 3B)
    toolsPop.querySelectorAll('[data-sl-inst]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-sl-inst');
        const inst = state.instruments[key];
        if (!inst) return;
        inst.visible = !inst.visible;
        if (inst.visible) {
          const centerW = screenToWorld(
            (committedCanvas.getBoundingClientRect().left) + state.stageWidth / 2,
            (committedCanvas.getBoundingClientRect().top) + state.stageHeight / 2
          );
          if (key === 'ruler') { inst.x = centerW.x; inst.y = centerW.y; }
          else if (key === 'compass' || key === 'protractor') { inst.cx = centerW.x; inst.cy = centerW.y; }
          else if (key === 'setsquare') { inst.x = centerW.x - 100; inst.y = centerW.y + 60; }
        }
        syncInstrumentsPopoverUI();
        renderActiveLayer();
      });
    });
    document.getElementById('vtSlateHideAllInst').addEventListener('click', function () {
      Object.keys(state.instruments).forEach(function (k) { state.instruments[k].visible = false; });
      syncInstrumentsPopoverUI();
      renderActiveLayer();
      toolsPop.classList.remove('open');
    });

    document.getElementById('vtSlateUndoBtn').addEventListener('click', performUndo);
    document.getElementById('vtSlateRedoBtn').addEventListener('click', performRedo);
    document.getElementById('vtSlateZoomBtn').addEventListener('click', function () {
      state.zoom = 1.0;
      state.panX = 0;
      state.panY = 0;
      syncZoomBtn();
      renderCommittedLayer();
      renderActiveLayer();
    });

    // Cloud drawer
    document.getElementById('vtSlateDriveBtn').addEventListener('click', toggleCloudDrawer);
    document.getElementById('vtSlateCloudClose').addEventListener('click', function () {
      state.cloudDrawerOpen = false;
      document.getElementById('vtSlateCloudDrawer').classList.remove('open');
    });
    document.getElementById('vtSlateNewBtn').addEventListener('click', function () {
      state.boardId = 'slate_' + Date.now().toString(36);
      state.driveFileId = '';
      state.pdfDriveFileId = '';
      state.title = 'Bảng Giảng Thiên Văn';
      state.pages = [createBlankPage()];
      state.activePageIndex = 0;
      state.selectedItem = null;
      syncSelectionBar();
      syncPageHeaderUI();
      syncPaperControlsUI();
      renderCommittedLayer();
      renderActiveLayer();
      saveLocalDraftNow();
      state.cloudDrawerOpen = false;
      document.getElementById('vtSlateCloudDrawer').classList.remove('open');
      notify('✓ Đã mở phiên bảng giảng mới.', 'success');
    });
    document.getElementById('vtSlateSyncNowBtn').addEventListener('click', function () {
      syncSlateToDrive(false);
    });

    // Dock tools
    document.querySelectorAll('#vtSlateDock [data-sl-tool]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setActiveTool(btn.getAttribute('data-sl-tool'));
      });
    });
    document.querySelectorAll('#vtSlateDock [data-sl-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setInkColor(btn.getAttribute('data-sl-color'));
        if (state.tool === 'eraser_stroke' || state.tool === 'eraser_region' || state.tool === 'pan') {
          setActiveTool('fountain');
        }
      });
    });
    document.getElementById('vtSlateCustomColor').addEventListener('input', function (e) {
      setInkColor(e.target.value);
    });
    document.getElementById('vtSlateSizeSlider').addEventListener('input', function (e) {
      state.width = Number(e.target.value);
      syncSizeDot();
    });
    document.getElementById('vtSlateSmartShapeBtn').addEventListener('click', function () {
      state.smartShapeEnabled = !state.smartShapeEnabled;
      document.getElementById('vtSlateSmartShapeBtn').classList.toggle('smart-on', state.smartShapeEnabled);
      notify(state.smartShapeEnabled ? '✨ Đã bật Tự nắn hình học (giữ yên bút cuối nét).' : 'Đã tắt Tự nắn hình học.', 'info');
    });
    document.getElementById('vtSlatePalmBtn').addEventListener('click', function () {
      state.palmRejection = !state.palmRejection;
      document.getElementById('vtSlatePalmBtn').classList.toggle('palm-on', state.palmRejection);
      notify(state.palmRejection ? '🛡 Đã bật Khóa chạm lòng bàn tay.' : 'Đã tắt Khóa chạm lòng bàn tay.', 'info');
    });

    // Selection bar actions (Bước 3B)
    document.getElementById('vtSlateSelLockBtn').addEventListener('click', function () {
      const obj = getSelectedObject();
      if (!obj) return;
      pushUndo();
      obj.locked = !obj.locked;
      syncSelectionBar();
      renderCommittedLayer();
      renderActiveLayer();
      scheduleAutoSave();
      notify(obj.locked ? '🔒 Đã khóa cố định đối tượng trên nền.' : '🔓 Đã mở khóa di chuyển đối tượng.', 'info');
    });
    document.getElementById('vtSlateSelDupBtn').addEventListener('click', function () {
      const obj = getSelectedObject();
      if (!obj || !state.selectedItem) return;
      pushUndo();
      const page = getCurrentPage();
      const copy = JSON.parse(JSON.stringify(obj));
      copy.id = makeId(state.selectedItem.kind === 'image' ? 'img' : 'shp');
      copy.locked = false;
      offsetObject(copy, state.selectedItem.kind, 24, 24);
      if (state.selectedItem.kind === 'image') page.images.push(copy);
      else page.shapes.push(copy);
      state.selectedItem = { kind: state.selectedItem.kind, id: copy.id };
      syncSelectionBar();
      renderCommittedLayer();
      renderActiveLayer();
      scheduleAutoSave();
    });
    document.getElementById('vtSlateSelDelBtn').addEventListener('click', deleteSelectedObject);

    // Reference Doc close
    document.getElementById('vtSlateRefDocClose').addEventListener('click', function () {
      state.refDoc = null;
      document.getElementById('vtSlateRefDoc').classList.remove('open');
      setTimeout(resizeSlateLayers, 40);
    });

    // Insert PDF / Image Modal & Drag-Drop (Bước 3C)
    const insertBackdrop = document.getElementById('vtSlateInsertBackdrop');
    const dropzone = document.getElementById('vtSlateDropzone');
    const fileInput = document.getElementById('vtSlateFileInput');
    const stageEl = document.getElementById('vtSlateStage');

    document.getElementById('vtSlateInsertDocBtn').addEventListener('click', function () {
      insertBackdrop.classList.add('open');
    });
    document.getElementById('vtSlateInsertClose').addEventListener('click', function () {
      insertBackdrop.classList.remove('open');
    });
    insertBackdrop.addEventListener('click', function (e) {
      if (e.target === insertBackdrop) insertBackdrop.classList.remove('open');
    });
    dropzone.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) handleLocalFileImport(f);
    });
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('over');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('over');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleLocalFileImport(f);
    });

    // Direct drag-and-drop onto board stage
    stageEl.addEventListener('dragover', function (e) {
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') >= 0) {
        e.preventDefault();
        stageEl.classList.add('is-dragover');
      }
    });
    stageEl.addEventListener('dragleave', function () {
      stageEl.classList.remove('is-dragover');
    });
    stageEl.addEventListener('drop', function (e) {
      stageEl.classList.remove('is-dragover');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) {
        e.preventDefault();
        handleLocalFileImport(f);
      }
    });

    document.getElementById('vtSlateDriveImportBtn').addEventListener('click', function () {
      const raw = document.getElementById('vtSlateDriveLinkInp').value.trim();
      if (!raw) { notify('Vui lòng dán liên kết tệp Google Drive.', 'warn'); return; }
      const C = getCore();
      const fid = C && C.drive ? C.drive.parseDriveLink(raw) : '';
      if (!fid) { notify('Liên kết Google Drive chưa hợp lệ.', 'warn'); return; }
      insertBackdrop.classList.remove('open');
      openDocumentOnBoard({ fileId: fid, title: 'Đề bài từ Google Drive', previewUrl: 'https://drive.google.com/file/d/' + fid + '/preview' });
    });

    // Export PDF & Publish to Constellation (Bước 3C)
    document.getElementById('vtSlateExportPdfBtn').addEventListener('click', downloadBoardAsPdf);
    document.getElementById('vtSlatePublishBtn').addEventListener('click', openPublishModal);
    document.getElementById('vtSlatePublishClose').addEventListener('click', closePublishModal);
    document.getElementById('vtSlatePubCancelBtn').addEventListener('click', closePublishModal);
    document.getElementById('vtSlatePublishBackdrop').addEventListener('click', function (e) {
      if (e.target.id === 'vtSlatePublishBackdrop') closePublishModal();
    });
    document.getElementById('vtSlateSelectAllClassesBtn').addEventListener('click', function () {
      const cbs = document.querySelectorAll('#vtSlatePubClassGrid input[type="checkbox"]');
      let allChecked = true;
      cbs.forEach(function (cb) { if (!cb.checked) allChecked = false; });
      cbs.forEach(function (cb) { cb.checked = !allChecked; });
    });
    document.getElementById('vtSlatePubSubmitBtn').addEventListener('click', submitPublishToConstellation);

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      if (!state.active) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        performRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedItem) {
        e.preventDefault();
        deleteSelectedObject();
      } else if (e.code === 'Space' && !state.spacePressed) {
        state.spacePressed = true;
        const stg = document.getElementById('vtSlateStage');
        if (stg) stg.classList.add('is-pan');
      }
    });
    document.addEventListener('keyup', function (e) {
      if (e.code === 'Space' && state.spacePressed) {
        state.spacePressed = false;
        const stg = document.getElementById('vtSlateStage');
        if (stg && state.tool !== 'pan') stg.classList.remove('is-pan');
      }
    });
  }

  function setActiveTool(toolId) {
    state.tool = toolId;
    if (toolId !== 'select') {
      state.selectedItem = null;
      syncSelectionBar();
      renderActiveLayer();
    }
    document.querySelectorAll('#vtSlateDock [data-sl-tool]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-sl-tool') === toolId);
    });
    const stg = document.getElementById('vtSlateStage');
    if (stg) {
      stg.classList.toggle('is-pan', toolId === 'pan' || state.spacePressed);
      stg.classList.toggle('is-select', toolId === 'select');
    }
  }

  function setInkColor(hex) {
    state.color = hex;
    document.querySelectorAll('#vtSlateDock [data-sl-color]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-sl-color').toLowerCase() === hex.toLowerCase());
    });
    const pick = document.getElementById('vtSlateCustomColor');
    if (pick) pick.value = hex;
    syncSizeDot();
  }

  function syncSizeDot() {
    const dot = document.getElementById('vtSlateSizeDot');
    if (!dot) return;
    const d = Math.max(4, Math.min(20, state.width + 2));
    dot.style.width = d + 'px';
    dot.style.height = d + 'px';
    dot.style.background = state.color;
  }

  function syncZoomBtn() {
    const btn = document.getElementById('vtSlateZoomBtn');
    if (btn) btn.textContent = Math.round(state.zoom * 100) + '%';
  }

  function syncPageHeaderUI() {
    const lbl = document.getElementById('vtSlatePageLabel');
    if (lbl) lbl.textContent = 'Trang ' + (state.activePageIndex + 1) + ' / ' + state.pages.length;
    const prev = document.getElementById('vtSlatePrevPage');
    const next = document.getElementById('vtSlateNextPage');
    if (prev) prev.disabled = state.activePageIndex <= 0;
    if (next) next.disabled = state.activePageIndex >= state.pages.length - 1;
    const titleInp = document.getElementById('vtSlateTitleInp');
    if (titleInp && document.activeElement !== titleInp) titleInp.value = state.title;
  }

  function syncPaperControlsUI() {
    const cfg = getCurrentPage().paperConfig;
    const pop = document.getElementById('vtSlatePaperPopover');
    if (!pop) return;
    pop.querySelectorAll('[data-sl-preset]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-sl-preset') === cfg.preset);
    });
    const chalkRow = document.getElementById('vtSlateChalkRow');
    if (chalkRow) chalkRow.style.display = cfg.preset === 'CHALKBOARD' ? 'flex' : 'none';
    pop.querySelectorAll('[data-sl-chalk]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-sl-chalk') === (cfg.chalkVariant || 'slate'));
    });
    document.getElementById('vtSlateSpacingSlider').value = cfg.spacing;
    document.getElementById('vtSlateSpacingVal').textContent = cfg.spacing + 'px';
    const pct = Math.round((cfg.lineOpacity || 0.24) * 100);
    document.getElementById('vtSlateOpacitySlider').value = pct;
    document.getElementById('vtSlateOpacityVal').textContent = pct + '%';
  }

  function syncInstrumentsPopoverUI() {
    const pop = document.getElementById('vtSlateToolsPopover');
    if (!pop) return;
    pop.querySelectorAll('[data-sl-inst]').forEach(function (b) {
      const k = b.getAttribute('data-sl-inst');
      b.classList.toggle('active', Boolean(state.instruments[k] && state.instruments[k].visible));
    });
  }

  function syncSelectionBar() {
    const bar = document.getElementById('vtSlateSelBar');
    if (!bar) return;
    const obj = getSelectedObject();
    if (!obj || !state.selectedItem) {
      bar.classList.remove('open');
      return;
    }
    bar.classList.add('open');
    const lbl = document.getElementById('vtSlateSelLabel');
    if (lbl) {
      lbl.textContent = state.selectedItem.kind === 'image'
        ? (obj.caption || 'Khung hình / Đề bài')
        : 'Hình hình học';
    }
    const lockBtn = document.getElementById('vtSlateSelLockBtn');
    if (lockBtn) lockBtn.textContent = obj.locked ? '🔒 Đang khóa' : '🔓 Khóa nền';
  }

  function switchToPage(idx) {
    state.activePageIndex = Math.max(0, Math.min(state.pages.length - 1, idx));
    state.selectedItem = null;
    syncSelectionBar();
    syncPageHeaderUI();
    syncPaperControlsUI();
    syncUndoRedoBtns();
    renderCommittedLayer();
    renderActiveLayer();
  }

  /* ==========================================================================
   * 5. EXACT COORDINATE MATRIX & 60FPS DUAL-LAYER RENDERING ENGINE
   * ========================================================================== */

  function screenToWorld(clientX, clientY) {
    if (!committedCanvas) return { x: 0, y: 0 };
    const rect = committedCanvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.panX) / state.zoom,
      y: (clientY - rect.top - state.panY) / state.zoom
    };
  }

  function worldToScreen(wx, wy) {
    if (!committedCanvas) return { x: 0, y: 0 };
    const rect = committedCanvas.getBoundingClientRect();
    return {
      x: rect.left + state.panX + wx * state.zoom,
      y: rect.top + state.panY + wy * state.zoom
    };
  }

  function resizeSlateLayers() {
    const stage = document.getElementById('vtSlateStage');
    if (!stage || !committedCanvas || !activeCanvas) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w === state.stageWidth && h === state.stageHeight && dpr === state.dpr) return;

    state.stageWidth = w;
    state.stageHeight = h;
    state.dpr = dpr;

    committedCanvas.width = Math.round(w * dpr);
    committedCanvas.height = Math.round(h * dpr);
    committedCanvas.style.width = w + 'px';
    committedCanvas.style.height = h + 'px';

    activeCanvas.width = Math.round(w * dpr);
    activeCanvas.height = Math.round(h * dpr);
    activeCanvas.style.width = w + 'px';
    activeCanvas.style.height = h + 'px';

    renderCommittedLayer();
    renderActiveLayer();
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#0F172A').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(function (c) { return c + c; }).join('') : clean;
    const n = parseInt(full, 16);
    if (isNaN(n)) return 'rgba(15,23,42,' + alpha + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function drawPaperInBounds(ctx, page, minX, minY, maxX, maxY, zoomScale) {
    const cfg = page.paperConfig || createDefaultPaperConfig();
    const isDarkSite = document.documentElement.getAttribute('data-theme') === 'dark';

    let bg = isDarkSite ? '#0B1324' : '#FFFFFF';
    if (cfg.preset === 'CHALKBOARD') {
      bg = cfg.chalkVariant === 'green' ? '#123326' : '#0A1122';
    }
    ctx.fillStyle = bg;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    if (cfg.preset === 'BLANK') return;

    const sp = Math.max(14, Number(cfg.spacing) || 28);
    const alpha = Math.max(0.08, Math.min(0.65, Number(cfg.lineOpacity) || 0.24));
    const strokeStyle = hexToRgba(cfg.lineColor || '#94A3B8', alpha);
    const z = zoomScale || 1;

    const startX = Math.floor(minX / sp) * sp;
    const startY = Math.floor(minY / sp) * sp;

    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.fillStyle = strokeStyle;
    ctx.lineWidth = 1 / z;

    if (cfg.preset === 'LINED') {
      ctx.beginPath();
      for (let y = startY; y <= maxY; y += sp) {
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
      }
      ctx.stroke();
      ctx.strokeStyle = hexToRgba('#EF4444', Math.min(0.45, alpha + 0.14));
      ctx.lineWidth = 1.4 / z;
      ctx.beginPath();
      ctx.moveTo(96, minY);
      ctx.lineTo(96, maxY);
      ctx.stroke();
    } else if (cfg.preset === 'GRID' || cfg.preset === 'COORD' || cfg.preset === 'CHALKBOARD') {
      ctx.beginPath();
      for (let x = startX; x <= maxX; x += sp) {
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
      }
      for (let y = startY; y <= maxY; y += sp) {
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
      }
      ctx.stroke();

      if (cfg.preset === 'COORD') {
        const ox = Math.round(((minX + maxX) / 2) / sp) * sp;
        const oy = Math.round(((minY + maxY) / 2) / sp) * sp;
        ctx.strokeStyle = isDarkSite ? 'rgba(226,232,240,0.68)' : 'rgba(15,23,42,0.58)';
        ctx.lineWidth = 1.8 / z;
        ctx.beginPath();
        ctx.moveTo(minX, oy); ctx.lineTo(maxX, oy);
        ctx.moveTo(ox, minY); ctx.lineTo(ox, maxY);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '700 ' + (12 / z) + 'px system-ui, sans-serif';
        ctx.fillText('O', ox + 6 / z, oy + 15 / z);
        ctx.fillText('x', maxX - 18 / z, oy - 8 / z);
        ctx.fillText('y', ox + 8 / z, minY + 18 / z);
      }
    } else if (cfg.preset === 'DOT') {
      const r = Math.max(1.1, 1.45 / z);
      for (let x = startX; x <= maxX; x += sp) {
        for (let y = startY; y <= maxY; y += sp) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawPaper(ctx, page) {
    const minX = -state.panX / state.zoom;
    const minY = -state.panY / state.zoom;
    const maxX = (state.stageWidth - state.panX) / state.zoom;
    const maxY = (state.stageHeight - state.panY) / state.zoom;
    drawPaperInBounds(ctx, page, minX, minY, maxX, maxY, state.zoom);
  }

  function drawStroke(ctx, stroke) {
    if (!stroke || !stroke.points || !stroke.points.length) return;
    const pts = stroke.points;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.36;
      ctx.strokeStyle = stroke.color || '#FACC15';
      ctx.lineWidth = Math.max(12, (stroke.width || 4) * 3.8);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (stroke.tool === 'dashed') {
      const w = Math.max(1.5, stroke.width || 3);
      ctx.strokeStyle = stroke.color || '#0F172A';
      ctx.lineWidth = w;
      ctx.setLineDash([w * 3.4, w * 2.5]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (stroke.tool === 'fountain' && pts.length > 1) {
      ctx.strokeStyle = stroke.color || '#0F172A';
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.lineWidth = Math.max(0.9, p1.w || stroke.width || 3);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.strokeStyle = stroke.color || '#0F172A';
    ctx.lineWidth = Math.max(1, stroke.width || 3);
    if (pts.length === 1) {
      ctx.fillStyle = stroke.color || '#0F172A';
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVectorShape(ctx, shp) {
    if (!shp) return;
    ctx.save();
    ctx.strokeStyle = shp.color || '#0F172A';
    ctx.lineWidth = Math.max(1.2, shp.width || 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (shp.dashed) ctx.setLineDash([ctx.lineWidth * 3.4, ctx.lineWidth * 2.5]);

    ctx.beginPath();
    if (shp.kind === 'line') {
      ctx.moveTo(shp.x1, shp.y1);
      ctx.lineTo(shp.x2, shp.y2);
    } else if (shp.kind === 'circle') {
      ctx.arc(shp.cx, shp.cy, Math.max(2, shp.r), 0, Math.PI * 2);
    } else if (shp.kind === 'arc') {
      ctx.arc(shp.cx, shp.cy, Math.max(2, shp.r), shp.startAngle, shp.endAngle, Boolean(shp.ccw));
    } else if (shp.kind === 'ellipse') {
      ctx.ellipse(shp.cx, shp.cy, Math.max(2, shp.rx), Math.max(2, shp.ry), 0, 0, Math.PI * 2);
    } else if (shp.kind === 'rect') {
      ctx.rect(shp.x, shp.y, shp.w, shp.h);
    } else if (shp.kind === 'triangle' && Array.isArray(shp.vertices) && shp.vertices.length === 3) {
      ctx.moveTo(shp.vertices[0].x, shp.vertices[0].y);
      ctx.lineTo(shp.vertices[1].x, shp.vertices[1].y);
      ctx.lineTo(shp.vertices[2].x, shp.vertices[2].y);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawAttachedImages(ctx, page, onLoadRepaint) {
    if (!Array.isArray(page.images) || !page.images.length) return;
    page.images.forEach(function (imgRec) {
      if (!imgRec || !imgRec.dataUrl) return;
      let imgEl = state.imageCache.get(imgRec.dataUrl);
      if (!imgEl) {
        imgEl = new Image();
        imgEl.onload = function () { if (onLoadRepaint) onLoadRepaint(); };
        imgEl.src = imgRec.dataUrl;
        state.imageCache.set(imgRec.dataUrl, imgEl);
      }
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(15,23,42,0.12)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.fillRect(imgRec.x, imgRec.y, imgRec.w, imgRec.h);
        ctx.restore();

        ctx.drawImage(imgEl, imgRec.x, imgRec.y, imgRec.w, imgRec.h);
        ctx.save();
        ctx.strokeStyle = imgRec.locked ? 'rgba(148,163,184,0.35)' : 'rgba(37,99,235,0.45)';
        ctx.lineWidth = 1.2 / (state.zoom || 1);
        ctx.strokeRect(imgRec.x, imgRec.y, imgRec.w, imgRec.h);
        ctx.restore();
      }
    });
  }

  function renderCommittedLayer() {
    if (!committedCtx || !state.stageWidth) return;
    const page = getCurrentPage();
    committedCtx.save();
    committedCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    committedCtx.clearRect(0, 0, state.stageWidth, state.stageHeight);
    committedCtx.translate(state.panX, state.panY);
    committedCtx.scale(state.zoom, state.zoom);

    drawPaper(committedCtx, page);
    drawAttachedImages(committedCtx, page, renderCommittedLayer);

    // Under-ink highlighters first
    for (let i = 0; i < page.strokes.length; i++) {
      if (page.strokes[i].tool === 'highlighter') drawStroke(committedCtx, page.strokes[i]);
    }
    // Vector shapes
    if (Array.isArray(page.shapes)) {
      for (let i = 0; i < page.shapes.length; i++) {
        drawVectorShape(committedCtx, page.shapes[i]);
      }
    }
    // Regular ink strokes on top
    for (let i = 0; i < page.strokes.length; i++) {
      if (page.strokes[i].tool !== 'highlighter') drawStroke(committedCtx, page.strokes[i]);
    }
    committedCtx.restore();
  }

  function clearActiveLayer() {
    if (!activeCtx || !state.stageWidth) return;
    activeCtx.save();
    activeCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    activeCtx.clearRect(0, 0, state.stageWidth, state.stageHeight);
    activeCtx.restore();
  }

  function renderActiveLayer() {
    if (!activeCtx || !state.stageWidth) return;
    clearActiveLayer();
    activeCtx.save();
    activeCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    activeCtx.translate(state.panX, state.panY);
    activeCtx.scale(state.zoom, state.zoom);

    if (state.activeSnappedShape) {
      drawVectorShape(activeCtx, state.activeSnappedShape);
    } else if (state.activeStroke) {
      drawStroke(activeCtx, state.activeStroke);
    }

    // Laser trails (1.5s fade-out)
    const now = performance.now();
    state.laserTrails = state.laserTrails.filter(function (tr) { return now - tr.createdAt < 1500; });
    for (let i = 0; i < state.laserTrails.length; i++) {
      const tr = state.laserTrails[i];
      const life = Math.max(0, 1 - (now - tr.createdAt) / 1500);
      const pts = tr.points;
      if (pts.length > 1) {
        activeCtx.save();
        activeCtx.lineCap = 'round';
        activeCtx.lineJoin = 'round';
        activeCtx.strokeStyle = 'rgba(239,68,68,' + (life * 0.35) + ')';
        activeCtx.lineWidth = 11 / state.zoom;
        activeCtx.beginPath();
        activeCtx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) activeCtx.lineTo(pts[k].x, pts[k].y);
        activeCtx.stroke();

        activeCtx.strokeStyle = 'rgba(255,255,255,' + (life * 0.92) + ')';
        activeCtx.lineWidth = 3.2 / state.zoom;
        activeCtx.stroke();
        activeCtx.restore();
      }
    }

    // Selection overlay (Bước 3B)
    drawSelectionOverlay(activeCtx);

    // Interactive Math Instruments overlay (Bước 3B)
    drawAllInstruments(activeCtx);

    activeCtx.restore();

    if (state.laserTrails.length && !state.laserRafId) {
      state.laserRafId = requestAnimationFrame(function () {
        state.laserRafId = 0;
        renderActiveLayer();
      });
    }
  }

  /* ==========================================================================
   * 6. SMART SHAPE RECOGNITION (DRAW & HOLD) & VECTOR SELECTION (BƯỚC 3B)
   * ========================================================================== */

  function distPts(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function recognizeSmartShape(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 6) return null;
    const pts = stroke.points;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let pathLen = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (i > 0) pathLen += distPts(pts[i - 1], p);
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    const diag = Math.hypot(bw, bh);
    if (diag < 22) return null;

    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    const chord = distPts(pStart, pEnd);
    const dashed = stroke.tool === 'dashed';

    // 1. Straight line check
    if (chord > 20 && pathLen / chord < 1.14) {
      let x2 = pEnd.x, y2 = pEnd.y;
      const ang = Math.atan2(y2 - pStart.y, x2 - pStart.x);
      const deg = (ang * 180 / Math.PI + 360) % 360;
      const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      for (let s = 0; s < snapAngles.length; s++) {
        if (Math.abs(deg - snapAngles[s]) < 6.5) {
          const rad = snapAngles[s] * Math.PI / 180;
          x2 = pStart.x + chord * Math.cos(rad);
          y2 = pStart.y + chord * Math.sin(rad);
          break;
        }
      }
      return {
        id: makeId('shp'), kind: 'line',
        x1: pStart.x, y1: pStart.y, x2: x2, y2: y2,
        color: stroke.color, width: stroke.width, dashed: dashed
      };
    }

    // 2. Closed shape check (circle, ellipse, triangle, rect)
    if (chord < Math.max(42, diag * 0.34) && bw > 20 && bh > 20) {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = bw / 2;
      const ry = bh / 2;

      // Measure fit against ellipse
      let ellErr = 0;
      for (let i = 0; i < pts.length; i++) {
        const nx = (pts[i].x - cx) / rx;
        const ny = (pts[i].y - cy) / ry;
        ellErr += Math.abs(Math.hypot(nx, ny) - 1);
      }
      ellErr /= pts.length;

      // Measure fit against bounding rectangle
      let rectErr = 0;
      for (let i = 0; i < pts.length; i++) {
        const dLeft = Math.abs(pts[i].x - minX);
        const dRight = Math.abs(pts[i].x - maxX);
        const dTop = Math.abs(pts[i].y - minY);
        const dBot = Math.abs(pts[i].y - maxY);
        rectErr += Math.min(dLeft, dRight, dTop, dBot);
      }
      rectErr /= (pts.length * Math.min(rx, ry));

      // Detect dominant corners for triangle vs rectangle
      const corners = extractPolygonCorners(pts, diag * 0.12);

      if (ellErr < 0.16 && ellErr <= rectErr * 1.15) {
        const ratio = Math.max(rx, ry) / Math.min(rx, ry);
        if (ratio < 1.18) {
          return {
            id: makeId('shp'), kind: 'circle',
            cx: cx, cy: cy, r: (rx + ry) / 2,
            color: stroke.color, width: stroke.width, dashed: dashed
          };
        }
        return {
          id: makeId('shp'), kind: 'ellipse',
          cx: cx, cy: cy, rx: rx, ry: ry,
          color: stroke.color, width: stroke.width, dashed: dashed
        };
      }

      if (corners.length === 3) {
        return {
          id: makeId('shp'), kind: 'triangle',
          vertices: corners,
          color: stroke.color, width: stroke.width, dashed: dashed
        };
      }

      return {
        id: makeId('shp'), kind: 'rect',
        x: minX, y: minY, w: bw, h: bh,
        color: stroke.color, width: stroke.width, dashed: dashed
      };
    }

    return null;
  }

  function extractPolygonCorners(pts, eps) {
    // Douglas-Peucker simplification on closed loop
    function rdp(list, epsilon) {
      if (list.length < 3) return list;
      let maxD = 0, idx = 0;
      const a = list[0], b = list[list.length - 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      for (let i = 1; i < list.length - 1; i++) {
        const d = Math.abs(dy * list[i].x - dx * list[i].y + b.x * a.y - b.y * a.x) / len;
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > epsilon) {
        const left = rdp(list.slice(0, idx + 1), epsilon);
        const right = rdp(list.slice(idx), epsilon);
        return left.slice(0, -1).concat(right);
      }
      return [a, b];
    }
    const simplified = rdp(pts, eps);
    if (simplified.length > 1 && distPts(simplified[0], simplified[simplified.length - 1]) < eps * 1.4) {
      simplified.pop();
    }
    return simplified.map(function (p) { return { x: p.x, y: p.y }; });
  }

  function getObjectBounds(obj, kind) {
    if (!obj) return null;
    if (kind === 'image') return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    if (obj.kind === 'rect') return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    if (obj.kind === 'circle' || obj.kind === 'arc') {
      return { x: obj.cx - obj.r, y: obj.cy - obj.r, w: obj.r * 2, h: obj.r * 2 };
    }
    if (obj.kind === 'ellipse') {
      return { x: obj.cx - obj.rx, y: obj.cy - obj.ry, w: obj.rx * 2, h: obj.ry * 2 };
    }
    if (obj.kind === 'line') {
      const minX = Math.min(obj.x1, obj.x2), minY = Math.min(obj.y1, obj.y2);
      return { x: minX, y: minY, w: Math.max(8, Math.abs(obj.x2 - obj.x1)), h: Math.max(8, Math.abs(obj.y2 - obj.y1)) };
    }
    if (obj.kind === 'triangle' && obj.vertices) {
      const xs = obj.vertices.map(function (v) { return v.x; });
      const ys = obj.vertices.map(function (v) { return v.y; });
      const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      return { x: minX, y: minY, w: Math.max(8, maxX - minX), h: Math.max(8, maxY - minY) };
    }
    return null;
  }

  function offsetObject(obj, kind, dx, dy) {
    if (kind === 'image' || obj.kind === 'rect') {
      obj.x += dx; obj.y += dy;
    } else if (obj.kind === 'circle' || obj.kind === 'arc' || obj.kind === 'ellipse') {
      obj.cx += dx; obj.cy += dy;
    } else if (obj.kind === 'line') {
      obj.x1 += dx; obj.y1 += dy; obj.x2 += dx; obj.y2 += dy;
    } else if (obj.kind === 'triangle' && obj.vertices) {
      obj.vertices.forEach(function (v) { v.x += dx; v.y += dy; });
    }
  }

  function getSelectedObject() {
    if (!state.selectedItem) return null;
    const page = getCurrentPage();
    const list = state.selectedItem.kind === 'image' ? page.images : page.shapes;
    if (!Array.isArray(list)) return null;
    return list.find(function (x) { return x.id === state.selectedItem.id; }) || null;
  }

  function deleteSelectedObject() {
    if (!state.selectedItem) return;
    pushUndo();
    const page = getCurrentPage();
    if (state.selectedItem.kind === 'image') {
      page.images = page.images.filter(function (x) { return x.id !== state.selectedItem.id; });
    } else {
      page.shapes = page.shapes.filter(function (x) { return x.id !== state.selectedItem.id; });
    }
    state.selectedItem = null;
    syncSelectionBar();
    renderCommittedLayer();
    renderActiveLayer();
    scheduleAutoSave();
  }

  function hitTestSelectable(wp) {
    const page = getCurrentPage();
    const tol = 10 / state.zoom;
    // Check shapes first (on top of images)
    for (let i = page.shapes.length - 1; i >= 0; i--) {
      const s = page.shapes[i];
      const b = getObjectBounds(s, 'shape');
      if (b && wp.x >= b.x - tol && wp.x <= b.x + b.w + tol && wp.y >= b.y - tol && wp.y <= b.y + b.h + tol) {
        return { kind: 'shape', id: s.id, obj: s };
      }
    }
    // Check images
    for (let i = page.images.length - 1; i >= 0; i--) {
      const im = page.images[i];
      if (wp.x >= im.x && wp.x <= im.x + im.w && wp.y >= im.y && wp.y <= im.y + im.h) {
        return { kind: 'image', id: im.id, obj: im };
      }
    }
    return null;
  }

  function getResizeHandles(b) {
    return [
      { id: 'nw', x: b.x, y: b.y },
      { id: 'ne', x: b.x + b.w, y: b.y },
      { id: 'se', x: b.x + b.w, y: b.y + b.h },
      { id: 'sw', x: b.x, y: b.y + b.h }
    ];
  }

  function drawSelectionOverlay(ctx) {
    const obj = getSelectedObject();
    if (!obj || !state.selectedItem) return;
    const b = getObjectBounds(obj, state.selectedItem.kind);
    if (!b) return;
    const z = state.zoom || 1;
    ctx.save();
    ctx.strokeStyle = obj.locked ? '#94A3B8' : '#2563EB';
    ctx.lineWidth = 1.6 / z;
    ctx.setLineDash([6 / z, 4 / z]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);

    if (!obj.locked) {
      const handles = getResizeHandles(b);
      const r = 5.5 / z;
      handles.forEach(function (h) {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  /* ==========================================================================
   * 7. INTERACTIVE MATH INSTRUMENTS: RULER, COMPASS, PROTRACTOR, SET SQUARE
   * ========================================================================== */

  function drawAllInstruments(ctx) {
    const z = state.zoom || 1;
    const inst = state.instruments;

    // 1. Thước thẳng (Ruler)
    if (inst.ruler.visible) {
      const r = inst.ruler;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);
      ctx.fillStyle = 'rgba(250, 248, 243, 0.86)';
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.78)';
      ctx.lineWidth = 1.5 / z;
      ctx.beginPath();
      ctx.rect(-r.length / 2, -r.height / 2, r.length, r.height);
      ctx.fill();
      ctx.stroke();

      // Tick marks every 10px (0.5cm) & 20px (1cm)
      ctx.strokeStyle = '#334155';
      ctx.fillStyle = '#1E293B';
      ctx.font = '700 10px system-ui, sans-serif';
      for (let x = -r.length / 2 + 10, cm = 0; x <= r.length / 2 - 10; x += 10, cm++) {
        const major = cm % 2 === 0;
        const hTick = major ? 13 : 7;
        ctx.beginPath();
        ctx.moveTo(x, -r.height / 2);
        ctx.lineTo(x, -r.height / 2 + hTick);
        ctx.stroke();
        if (major && cm % 4 === 0) {
          ctx.fillText(String(cm / 2), x - 3, -r.height / 2 + 24);
        }
      }
      // Angle badge
      const deg = ((r.angle * 180 / Math.PI) % 360 + 360) % 360;
      ctx.fillStyle = '#2563EB';
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.fillText(deg.toFixed(1) + '°', -16, 12);

      // Rotate handle on right end
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(r.length / 2 - 16, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 10px sans-serif';
      ctx.fillText('↻', r.length / 2 - 20, 4);
      ctx.restore();
    }

    // 2. Thước đo độ (Protractor)
    if (inst.protractor.visible) {
      const p = inst.protractor;
      ctx.save();
      ctx.translate(p.cx, p.cy);
      ctx.rotate(p.angle);
      ctx.fillStyle = 'rgba(250, 248, 243, 0.80)';
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.80)';
      ctx.lineWidth = 1.6 / z;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Degree ticks
      ctx.strokeStyle = '#334155';
      ctx.fillStyle = '#1E293B';
      ctx.font = '700 9px system-ui, sans-serif';
      for (let d = 0; d <= 180; d += 5) {
        const rad = -d * Math.PI / 180;
        const len = d % 10 === 0 ? 12 : 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * p.radius, Math.sin(rad) * p.radius);
        ctx.lineTo(Math.cos(rad) * (p.radius - len), Math.sin(rad) * (p.radius - len));
        ctx.stroke();
        if (d % 30 === 0) {
          ctx.fillText(d + '°', Math.cos(rad) * (p.radius - 26) - 8, Math.sin(rad) * (p.radius - 26) + 3);
        }
      }
      // Center crosshair
      ctx.strokeStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
      ctx.moveTo(0, -8); ctx.lineTo(0, 4);
      ctx.stroke();
      // Rotate handle
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(p.radius - 16, -12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 10px sans-serif';
      ctx.fillText('↻', p.radius - 20, -8);
      ctx.restore();
    }

    // 3. Ê-ke vuông (Set Square 30-60-90)
    if (inst.setsquare.visible) {
      const s = inst.setsquare;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = 'rgba(236, 253, 245, 0.78)';
      ctx.strokeStyle = 'rgba(5, 150, 105, 0.78)';
      ctx.lineWidth = 1.6 / z;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s.legA, 0);
      ctx.lineTo(0, -s.legB);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right-angle square marker
      ctx.strokeRect(0, -14, 14, 14);
      // Ticks on bottom leg
      ctx.strokeStyle = '#065F46';
      for (let x = 20; x < s.legA - 12; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, -8);
        ctx.stroke();
      }
      // Rotate handle
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(s.legA - 36, -14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 10px sans-serif';
      ctx.fillText('↻', s.legA - 40, -10);
      ctx.restore();
    }

    // 4. Compa (Compass)
    if (inst.compass.visible) {
      const c = inst.compass;
      const tipX = c.cx + Math.cos(c.angle) * c.radius;
      const tipY = c.cy + Math.sin(c.angle) * c.radius;
      ctx.save();
      // Dashed guide circle
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.34)';
      ctx.lineWidth = 1.2 / z;
      ctx.setLineDash([5 / z, 4 / z]);
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, c.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Compass arms
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 3 / z;
      ctx.beginPath();
      ctx.moveTo(c.cx, c.cy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Center pin handle
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, 7 / z, 0, Math.PI * 2);
      ctx.fill();

      // Pencil sweep handle (drag to draw arc, or drag radially to resize)
      ctx.fillStyle = '#7C3AED';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 10 / z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 ' + (10 / z) + 'px sans-serif';
      ctx.fillText('✎', tipX - 4 / z, tipY + 4 / z);

      // Radius label
      ctx.fillStyle = '#6D28D9';
      ctx.font = '800 ' + (11 / z) + 'px system-ui, sans-serif';
      ctx.fillText('R = ' + (c.radius / 20).toFixed(1) + ' cm', (c.cx + tipX) / 2 + 8 / z, (c.cy + tipY) / 2 - 8 / z);

      // Live sweep preview
      if (state.instrumentDrag && state.instrumentDrag.key === 'compass' && state.instrumentDrag.mode === 'sweep') {
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.width;
        ctx.beginPath();
        ctx.arc(c.cx, c.cy, c.radius, state.instrumentDrag.sweepStartAngle, state.instrumentDrag.sweepCurrentAngle, state.instrumentDrag.ccw);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function hitTestInstruments(wp) {
    const inst = state.instruments;
    const z = state.zoom || 1;
    const handleR = 16 / z;

    if (inst.compass.visible) {
      const c = inst.compass;
      const tipX = c.cx + Math.cos(c.angle) * c.radius;
      const tipY = c.cy + Math.sin(c.angle) * c.radius;
      if (distPts(wp, { x: tipX, y: tipY }) < handleR) {
        return { key: 'compass', mode: 'sweep', sweepStartAngle: c.angle, sweepCurrentAngle: c.angle, ccw: false };
      }
      if (distPts(wp, { x: c.cx, y: c.cy }) < handleR) {
        return { key: 'compass', mode: 'move' };
      }
    }

    if (inst.ruler.visible) {
      const r = inst.ruler;
      const dx = wp.x - r.x, dy = wp.y - r.y;
      const cos = Math.cos(-r.angle), sin = Math.sin(-r.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.hypot(lx - (r.length / 2 - 16), ly) < handleR) return { key: 'ruler', mode: 'rotate' };
      if (lx >= -r.length / 2 && lx <= r.length / 2 && ly >= -r.height / 2 && ly <= r.height / 2) return { key: 'ruler', mode: 'move' };
    }

    if (inst.protractor.visible) {
      const p = inst.protractor;
      const dx = wp.x - p.cx, dy = wp.y - p.cy;
      const cos = Math.cos(-p.angle), sin = Math.sin(-p.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.hypot(lx - (p.radius - 16), ly + 12) < handleR) return { key: 'protractor', mode: 'rotate' };
      if (ly <= 4 && Math.hypot(lx, ly) <= p.radius) return { key: 'protractor', mode: 'move' };
    }

    if (inst.setsquare.visible) {
      const s = inst.setsquare;
      const dx = wp.x - s.x, dy = wp.y - s.y;
      const cos = Math.cos(-s.angle), sin = Math.sin(-s.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.hypot(lx - (s.legA - 36), ly + 14) < handleR) return { key: 'setsquare', mode: 'rotate' };
      if (lx >= 0 && ly <= 0 && (lx / s.legA - ly / s.legB) <= 1) return { key: 'setsquare', mode: 'move' };
    }
    return null;
  }

  function snapPointToStraightEdge(wp) {
    const tol = 22 / (state.zoom || 1);
    const inst = state.instruments;

    if (inst.ruler.visible) {
      const r = inst.ruler;
      const dx = wp.x - r.x, dy = wp.y - r.y;
      const cos = Math.cos(-r.angle), sin = Math.sin(-r.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (lx >= -r.length / 2 - 10 && lx <= r.length / 2 + 10) {
        if (Math.abs(ly - (-r.height / 2)) < tol) {
          const sy = -r.height / 2;
          return {
            x: r.x + lx * Math.cos(r.angle) - sy * Math.sin(r.angle),
            y: r.y + lx * Math.sin(r.angle) + sy * Math.cos(r.angle)
          };
        }
        if (Math.abs(ly - (r.height / 2)) < tol) {
          const sy = r.height / 2;
          return {
            x: r.x + lx * Math.cos(r.angle) - sy * Math.sin(r.angle),
            y: r.y + lx * Math.sin(r.angle) + sy * Math.cos(r.angle)
          };
        }
      }
    }

    if (inst.setsquare.visible) {
      const s = inst.setsquare;
      const dx = wp.x - s.x, dy = wp.y - s.y;
      const cos = Math.cos(-s.angle), sin = Math.sin(-s.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      // Bottom leg (y = 0)
      if (lx >= -6 && lx <= s.legA + 6 && Math.abs(ly) < tol) {
        return { x: s.x + lx * Math.cos(s.angle), y: s.y + lx * Math.sin(s.angle) };
      }
      // Left leg (x = 0)
      if (ly <= 6 && ly >= -s.legB - 6 && Math.abs(lx) < tol) {
        return { x: s.x - ly * Math.sin(s.angle), y: s.y + ly * Math.cos(s.angle) };
      }
    }
    return wp;
  }

  /* ==========================================================================
   * 8. POINTER EVENTS, COALESCED POINTS, ERASERS & 2-FINGER PINCH/PAN
   * ========================================================================== */

  function computeFountainWidth(baseW, prevPt, x, y, t, pressure, pointerType) {
    if (pointerType === 'pen' && pressure > 0 && pressure !== 0.5) {
      return Math.max(0.8, baseW * (0.45 + pressure * 1.35));
    }
    if (!prevPt) return baseW;
    const dist = Math.hypot(x - prevPt.x, y - prevPt.y);
    const dt = Math.max(1, t - (prevPt.t || t));
    const velocity = dist / dt;
    const factor = Math.max(0.45, Math.min(1.42, 1.32 - velocity * 0.42));
    return baseW * factor;
  }

  function eraseAtPoint(wp) {
    const page = getCurrentPage();
    const radius = Math.max(10, state.width * 3.5) / state.zoom;
    let changed = false;

    if (state.tool === 'eraser_stroke') {
      const beforeS = page.strokes.length;
      page.strokes = page.strokes.filter(function (st) {
        for (let i = 0; i < st.points.length; i++) {
          if (Math.hypot(st.points[i].x - wp.x, st.points[i].y - wp.y) <= radius) return false;
        }
        return true;
      });
      const beforeSh = page.shapes.length;
      page.shapes = page.shapes.filter(function (sh) {
        const b = getObjectBounds(sh, 'shape');
        if (!b) return true;
        return !(wp.x >= b.x - radius && wp.x <= b.x + b.w + radius && wp.y >= b.y - radius && wp.y <= b.y + b.h + radius);
      });
      changed = page.strokes.length !== beforeS || page.shapes.length !== beforeSh;
    } else if (state.tool === 'eraser_region') {
      const nextStrokes = [];
      for (let s = 0; s < page.strokes.length; s++) {
        const st = page.strokes[s];
        let seg = [];
        for (let i = 0; i < st.points.length; i++) {
          const p = st.points[i];
          if (Math.hypot(p.x - wp.x, p.y - wp.y) <= radius) {
            changed = true;
            if (seg.length > 1) {
              nextStrokes.push(Object.assign({}, st, { id: makeId('st'), points: seg }));
            }
            seg = [];
          } else {
            seg.push(p);
          }
        }
        if (seg.length > 0) {
          nextStrokes.push(seg.length === st.points.length ? st : Object.assign({}, st, { id: makeId('st'), points: seg }));
        }
      }
      if (changed) page.strokes = nextStrokes;
    }
    if (changed) {
      renderCommittedLayer();
      scheduleAutoSave();
    }
  }

  function clearHoldTimer() {
    if (state.holdTimer) {
      clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }
  }

  function scheduleHoldRecognition(wp) {
    clearHoldTimer();
    if (!state.smartShapeEnabled || !state.activeStroke) return;
    if (state.activeStroke.tool !== 'fountain' && state.activeStroke.tool !== 'ballpoint' && state.activeStroke.tool !== 'dashed') return;
    state.holdAnchor = { x: wp.x, y: wp.y };
    state.holdTimer = setTimeout(function () {
      if (!state.activeStroke || state.activeSnappedShape) return;
      const snapped = recognizeSmartShape(state.activeStroke);
      if (snapped) {
        state.activeSnappedShape = snapped;
        renderActiveLayer();
      }
    }, 480);
  }

  function wirePointerEvents() {
    const stage = document.getElementById('vtSlateStage');
    const dock = document.getElementById('vtSlateDock');
    if (!stage) return;

    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('#vtSlateDock') || e.target.closest('#vtSlateSelBar')) return;
      if (e.button === 2) return;

      stage.setPointerCapture(e.pointerId);
      state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

      // 2-finger pinch zoom & pan
      if (state.activePointers.size === 2) {
        clearHoldTimer();
        state.drawingPointerId = null;
        state.activeStroke = null;
        state.activeSnappedShape = null;
        state.instrumentDrag = null;
        state.dragTransform = null;
        const pts = Array.from(state.activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        state.pinchState = { dist: dist, midX: midX, midY: midY, zoom: state.zoom, panX: state.panX, panY: state.panY };
        return;
      }

      const wp = screenToWorld(e.clientX, e.clientY);

      // Check Math Instruments interaction first
      const hitInst = hitTestInstruments(wp);
      if (hitInst) {
        state.drawingPointerId = e.pointerId;
        state.instrumentDrag = Object.assign({
          startWorld: wp,
          orig: JSON.parse(JSON.stringify(state.instruments[hitInst.key]))
        }, hitInst);
        return;
      }

      // Pan mode
      if (state.tool === 'pan' || state.spacePressed || e.button === 1) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
        return;
      }

      // Select / Move / Resize mode (Bước 3B)
      if (state.tool === 'select') {
        state.drawingPointerId = e.pointerId;
        const selObj = getSelectedObject();
        if (selObj && !selObj.locked) {
          const b = getObjectBounds(selObj, state.selectedItem.kind);
          if (b) {
            const handles = getResizeHandles(b);
            for (let i = 0; i < handles.length; i++) {
              if (distPts(wp, handles[i]) <= 14 / state.zoom) {
                pushUndo();
                state.dragTransform = {
                  mode: 'resize',
                  handle: handles[i].id,
                  startWorld: wp,
                  origBounds: b,
                  snapshot: JSON.parse(JSON.stringify(selObj))
                };
                return;
              }
            }
          }
        }
        const hit = hitTestSelectable(wp);
        if (hit) {
          state.selectedItem = { kind: hit.kind, id: hit.id };
          syncSelectionBar();
          if (!hit.obj.locked) {
            pushUndo();
            state.dragTransform = {
              mode: 'move',
              startWorld: wp,
              snapshot: JSON.parse(JSON.stringify(hit.obj))
            };
          }
        } else {
          state.selectedItem = null;
          syncSelectionBar();
        }
        renderActiveLayer();
        return;
      }

      // Palm rejection guard
      if (state.palmRejection && e.pointerType === 'touch') return;

      state.drawingPointerId = e.pointerId;
      if (dock) dock.classList.add('is-dimmed');

      if (state.tool === 'eraser_stroke' || state.tool === 'eraser_region') {
        pushUndo();
        eraseAtPoint(wp);
        return;
      }

      const snappedPt = snapPointToStraightEdge(wp);
      const t = e.timeStamp || performance.now();
      const firstPt = {
        x: snappedPt.x,
        y: snappedPt.y,
        t: t,
        w: computeFountainWidth(state.width, null, snappedPt.x, snappedPt.y, t, e.pressure, e.pointerType)
      };

      if (state.tool === 'laser') {
        const trail = { points: [firstPt], createdAt: performance.now() };
        state.laserTrails.push(trail);
        state.activeStroke = trail;
        renderActiveLayer();
        return;
      }

      state.activeSnappedShape = null;
      state.activeStroke = {
        id: makeId('st'),
        tool: state.tool,
        color: state.color,
        width: state.width,
        points: [firstPt]
      };
      scheduleHoldRecognition(snappedPt);
      renderActiveLayer();
    });

    stage.addEventListener('pointermove', function (e) {
      if (state.activePointers.has(e.pointerId)) {
        state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      }

      // 2-finger pinch zoom & pan
      if (state.pinchState && state.activePointers.size === 2) {
        const pts = Array.from(state.activePointers.values());
        const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const rect = committedCanvas.getBoundingClientRect();
        const localMidX = midX - rect.left;
        const localMidY = midY - rect.top;

        const nextZoom = Math.max(0.3, Math.min(4.0, state.pinchState.zoom * (newDist / state.pinchState.dist)));
        const worldMidX = (state.pinchState.midX - rect.left - state.pinchState.panX) / state.pinchState.zoom;
        const worldMidY = (state.pinchState.midY - rect.top - state.pinchState.panY) / state.pinchState.zoom;

        state.zoom = nextZoom;
        state.panX = localMidX - worldMidX * nextZoom;
        state.panY = localMidY - worldMidY * nextZoom;
        syncZoomBtn();
        renderCommittedLayer();
        renderActiveLayer();
        return;
      }

      const wp = screenToWorld(e.clientX, e.clientY);

      // Dragging Math Instrument
      if (state.instrumentDrag && state.drawingPointerId === e.pointerId) {
        const d = state.instrumentDrag;
        const target = state.instruments[d.key];
        const dx = wp.x - d.startWorld.x;
        const dy = wp.y - d.startWorld.y;
        if (d.mode === 'move') {
          if (d.key === 'ruler' || d.key === 'setsquare') {
            target.x = d.orig.x + dx;
            target.y = d.orig.y + dy;
          } else {
            target.cx = d.orig.cx + dx;
            target.cy = d.orig.cy + dy;
          }
        } else if (d.mode === 'rotate') {
          const cx = (d.key === 'ruler' || d.key === 'setsquare') ? target.x : target.cx;
          const cy = (d.key === 'ruler' || d.key === 'setsquare') ? target.y : target.cy;
          const a0 = Math.atan2(d.startWorld.y - cy, d.startWorld.x - cx);
          const a1 = Math.atan2(wp.y - cy, wp.x - cx);
          let nextA = d.orig.angle + (a1 - a0);
          const deg = nextA * 180 / Math.PI;
          const snapDeg = Math.round(deg / 15) * 15;
          if (Math.abs(deg - snapDeg) < 2.2) nextA = snapDeg * Math.PI / 180;
          target.angle = nextA;
        } else if (d.mode === 'sweep' && d.key === 'compass') {
          const curR = Math.max(30, Math.min(360, distPts(wp, { x: target.cx, y: target.cy })));
          if (Math.abs(curR - d.orig.radius) > 16 && Math.abs(d.sweepCurrentAngle - d.sweepStartAngle) < 0.15) {
            target.radius = curR;
          } else {
            const ang = Math.atan2(wp.y - target.cy, wp.x - target.cx);
            target.angle = ang;
            d.sweepCurrentAngle = ang;
          }
        }
        renderActiveLayer();
        return;
      }

      if (state.isPanning && state.panStart) {
        state.panX = state.panStart.panX + (e.clientX - state.panStart.x);
        state.panY = state.panStart.panY + (e.clientY - state.panStart.y);
        renderCommittedLayer();
        renderActiveLayer();
        return;
      }

      // Select / Move / Resize
      if (state.dragTransform && state.drawingPointerId === e.pointerId) {
        const obj = getSelectedObject();
        if (!obj) return;
        const dt = state.dragTransform;
        const dx = wp.x - dt.startWorld.x;
        const dy = wp.y - dt.startWorld.y;
        if (dt.mode === 'move') {
          Object.assign(obj, JSON.parse(JSON.stringify(dt.snapshot)));
          offsetObject(obj, state.selectedItem.kind, dx, dy);
        } else if (dt.mode === 'resize') {
          applyObjectResize(obj, state.selectedItem.kind, dt.snapshot, dt.origBounds, dt.handle, dx, dy);
        }
        renderCommittedLayer();
        renderActiveLayer();
        return;
      }

      if (state.drawingPointerId !== e.pointerId) return;

      if (state.tool === 'eraser_stroke' || state.tool === 'eraser_region') {
        eraseAtPoint(wp);
        return;
      }

      if (state.activeSnappedShape) {
        // Live endpoint adjustment after Draw & Hold snap
        const shp = state.activeSnappedShape;
        if (shp.kind === 'line') { shp.x2 = wp.x; shp.y2 = wp.y; }
        else if (shp.kind === 'circle') { shp.r = Math.max(10, distPts(wp, { x: shp.cx, y: shp.cy })); }
        renderActiveLayer();
        return;
      }

      if (!state.activeStroke) return;

      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      const list = coalesced && coalesced.length ? coalesced : [e];

      for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        const pW = snapPointToStraightEdge(screenToWorld(ev.clientX, ev.clientY));
        const pts = state.activeStroke.points;
        const prev = pts[pts.length - 1];
        if (prev && Math.hypot(pW.x - prev.x, pW.y - prev.y) < 0.7) continue;
        const t = ev.timeStamp || performance.now();
        pts.push({
          x: pW.x,
          y: pW.y,
          t: t,
          w: computeFountainWidth(state.width, prev, pW.x, pW.y, t, ev.pressure, ev.pointerType)
        });
        if (state.holdAnchor && distPts(pW, state.holdAnchor) > 6 / state.zoom) {
          scheduleHoldRecognition(pW);
        }
      }

      if (state.tool === 'laser') {
        state.activeStroke.createdAt = performance.now();
      }

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(function () {
          rafPending = false;
          renderActiveLayer();
        });
      }
    });

    function endPointer(e) {
      state.activePointers.delete(e.pointerId);
      if (state.activePointers.size < 2) state.pinchState = null;

      if (state.instrumentDrag && state.drawingPointerId === e.pointerId) {
        const d = state.instrumentDrag;
        if (d.key === 'compass' && d.mode === 'sweep') {
          const c = state.instruments.compass;
          const delta = Math.abs(d.sweepCurrentAngle - d.sweepStartAngle);
          if (delta > 0.12) {
            pushUndo();
            const isFull = delta > Math.PI * 1.85;
            getCurrentPage().shapes.push(isFull ? {
              id: makeId('shp'), kind: 'circle', cx: c.cx, cy: c.cy, r: c.radius,
              color: state.color, width: state.width, dashed: state.tool === 'dashed'
            } : {
              id: makeId('shp'), kind: 'arc', cx: c.cx, cy: c.cy, r: c.radius,
              startAngle: d.sweepStartAngle, endAngle: d.sweepCurrentAngle, ccw: d.ccw,
              color: state.color, width: state.width, dashed: state.tool === 'dashed'
            });
            renderCommittedLayer();
            scheduleAutoSave();
          }
        }
        state.instrumentDrag = null;
        state.drawingPointerId = null;
        renderActiveLayer();
        return;
      }

      if (state.dragTransform && state.drawingPointerId === e.pointerId) {
        state.dragTransform = null;
        state.drawingPointerId = null;
        scheduleAutoSave();
        renderActiveLayer();
        return;
      }

      if (state.isPanning) {
        state.isPanning = false;
        state.panStart = null;
      }

      if (state.drawingPointerId !== e.pointerId) return;
      clearHoldTimer();
      state.drawingPointerId = null;
      if (dock) dock.classList.remove('is-dimmed');

      if (state.activeSnappedShape) {
        pushUndo();
        getCurrentPage().shapes.push(state.activeSnappedShape);
        state.activeSnappedShape = null;
        state.activeStroke = null;
        renderCommittedLayer();
        renderActiveLayer();
        scheduleAutoSave();
        return;
      }

      if (state.activeStroke && state.tool !== 'laser') {
        const st = state.activeStroke;
        state.activeStroke = null;
        if (st.tool === 'highlighter' && st.points.length >= 2) {
          const a = st.points[0];
          const b = st.points[st.points.length - 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          if (Math.hypot(dx, dy) > 24 && Math.abs(dy) < Math.abs(dx) * 0.24) {
            st.points = [{ x: a.x, y: a.y }, { x: b.x, y: a.y }];
          }
        }
        pushUndo();
        getCurrentPage().strokes.push(st);
        renderCommittedLayer();
        renderActiveLayer();
        scheduleAutoSave();
      } else if (state.tool === 'laser') {
        state.activeStroke = null;
        renderActiveLayer();
      }
    }

    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    // Wheel zoom (Ctrl+Wheel or pinch on trackpad)
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = committedCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wx = (mx - state.panX) / state.zoom;
        const wy = (my - state.panY) / state.zoom;
        const factor = e.deltaY < 0 ? 1.09 : 0.92;
        state.zoom = Math.max(0.3, Math.min(4.0, state.zoom * factor));
        state.panX = mx - wx * state.zoom;
        state.panY = my - wy * state.zoom;
        syncZoomBtn();
      } else {
        state.panX -= e.deltaX;
        state.panY -= e.deltaY;
      }
      renderCommittedLayer();
      renderActiveLayer();
    }, { passive: false });
  }

  function applyObjectResize(obj, kind, snap, origB, handle, dx, dy) {
    let x = origB.x, y = origB.y, w = origB.w, h = origB.h;
    if (handle.indexOf('e') >= 0) w = Math.max(24, origB.w + dx);
    if (handle.indexOf('s') >= 0) h = Math.max(24, origB.h + dy);
    if (handle.indexOf('w') >= 0) { x = origB.x + Math.min(dx, origB.w - 24); w = origB.w - (x - origB.x); }
    if (handle.indexOf('n') >= 0) { y = origB.y + Math.min(dy, origB.h - 24); h = origB.h - (y - origB.y); }

    if (kind === 'image') {
      const aspect = (snap.w || 1) / (snap.h || 1);
      h = w / aspect;
      obj.x = x; obj.y = y; obj.w = w; obj.h = h;
      return;
    }
    if (obj.kind === 'rect') {
      obj.x = x; obj.y = y; obj.w = w; obj.h = h;
    } else if (obj.kind === 'circle' || obj.kind === 'arc') {
      obj.cx = x + w / 2; obj.cy = y + h / 2; obj.r = Math.max(12, Math.min(w, h) / 2);
    } else if (obj.kind === 'ellipse') {
      obj.cx = x + w / 2; obj.cy = y + h / 2; obj.rx = Math.max(10, w / 2); obj.ry = Math.max(10, h / 2);
    } else if (obj.kind === 'line') {
      const sx = w / (origB.w || 1), sy = h / (origB.h || 1);
      obj.x1 = x + (snap.x1 - origB.x) * sx;
      obj.y1 = y + (snap.y1 - origB.y) * sy;
      obj.x2 = x + (snap.x2 - origB.x) * sx;
      obj.y2 = y + (snap.y2 - origB.y) * sy;
    } else if (obj.kind === 'triangle' && snap.vertices) {
      const sx = w / (origB.w || 1), sy = h / (origB.h || 1);
      obj.vertices = snap.vertices.map(function (v) {
        return { x: x + (v.x - origB.x) * sx, y: y + (v.y - origB.y) * sy };
      });
    }
  }

  /* ==========================================================================
   * 9. CLOUD .VTSLATE SYNC (VANTHESIS_Bang_Giang)
   * ========================================================================== */

  async function syncSlateToDrive(silent) {
    const C = getCore();
    if (!C || !C.auth || !C.auth.isSignedIn() || !C.auth.getAccessToken()) return;
    if (state.driveSyncing) return;

    state.driveSyncing = true;
    setSaveStatus('Đang đồng bộ...');
    try {
      await saveLocalDraftNow();
      const payload = {
        format: 'VANTHESIS_ASTRAL_SLATE_V1',
        boardId: state.boardId,
        title: state.title,
        activePageIndex: state.activePageIndex,
        pages: state.pages,
        updatedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/octet-stream' });
      const fileName = sanitizeFilename(state.title, '.vtslate');

      const uploaded = await C.drive.uploadFile({
        folderName: DRIVE_FOLDER_NAME,
        fileName: fileName,
        mimeType: 'application/octet-stream',
        fileOrBlob: blob,
        existingFileId: state.driveFileId || undefined
      });

      if (uploaded && uploaded.fileId) {
        state.driveFileId = uploaded.fileId;
        await saveLocalDraftNow();
        await C.api.post('whiteboard_upsert', {
          boardId: state.boardId,
          title: state.title,
          driveFileId: state.driveFileId,
          pdfDriveFileId: state.pdfDriveFileId || '',
          pageCount: state.pages.length
        });
      }
      setSaveStatus('Đã đồng bộ Đám mây ✓');
      if (!silent) notify('✓ Đã đồng bộ bản viết lên Đám mây an toàn.', 'success');
    } catch (err) {
      setSaveStatus('Đã lưu tại máy');
      if (!silent) notify((err && err.message) || 'Chưa thể đồng bộ Đám mây lúc này, bản viết vẫn an toàn tại máy.', 'warn');
    } finally {
      state.driveSyncing = false;
    }
  }

  async function toggleCloudDrawer() {
    const drawer = document.getElementById('vtSlateCloudDrawer');
    if (!drawer) return;
    state.cloudDrawerOpen = !state.cloudDrawerOpen;
    drawer.classList.toggle('open', state.cloudDrawerOpen);
    if (!state.cloudDrawerOpen) return;

    const listEl = document.getElementById('vtSlateCloudList');
    const C = getCore();
    if (!C) return;
    listEl.innerHTML = C.ui.skeleton(3);
    const res = await C.api.post('whiteboard_list', {});
    if (!res || !res.ok) {
      listEl.innerHTML = '<div style="font-size:12.5px;color:var(--text-muted);padding:8px;">Chưa thể tải danh sách bản viết từ Đám mây.</div>';
      return;
    }
    state.cloudBoards = Array.isArray(res.boards) ? res.boards : [];
    renderCloudBoards();
  }

  function renderCloudBoards() {
    const listEl = document.getElementById('vtSlateCloudList');
    if (!listEl) return;
    if (!state.cloudBoards.length) {
      listEl.innerHTML = '<div style="font-size:12.5px;color:var(--text-muted);padding:10px;text-align:center;">Bạn chưa có bản viết nào trên Đám mây. Hãy viết và bấm "Lưu ngay".</div>';
      return;
    }
    listEl.innerHTML = state.cloudBoards.map(function (b) {
      return '<div class="vt-slate-cloud-item" data-sl-open="' + escapeAttr(b.boardId) + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
          '<strong style="font-size:13px;">' + escapeHtml(b.title || 'Bảng Giảng') + '</strong>' +
          '<button type="button" class="vt-slate-btn" data-sl-del="' + escapeAttr(b.boardId) + '" style="height:24px;padding:0 7px;font-size:11px;">🗑</button>' +
        '</div>' +
        '<div style="font-size:11.5px;color:var(--text-muted);">' + (b.pageCount || 1) + ' trang • ' + escapeHtml((b.updatedAt || '').slice(0, 10)) + '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('[data-sl-open]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-sl-del]')) return;
        const bid = card.getAttribute('data-sl-open');
        const found = state.cloudBoards.find(function (x) { return x.boardId === bid; });
        if (found) loadSlateFromDrive(found);
      });
    });

    listEl.querySelectorAll('[data-sl-del]').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const bid = btn.getAttribute('data-sl-del');
        const C = getCore();
        const ok = C && C.ui ? await C.ui.confirm({ title: 'Xóa bản viết', message: 'Bạn có chắc chắn muốn xóa bản viết này khỏi danh sách không?', confirmText: 'Xóa bản viết', danger: true }) : true;
        if (!ok) return;
        const r = await C.api.post('whiteboard_delete', { boardId: bid });
        if (r && r.ok) {
          state.cloudBoards = state.cloudBoards.filter(function (x) { return x.boardId !== bid; });
          renderCloudBoards();
          notify('✓ Đã xóa bản viết.', 'success');
        }
      });
    });
  }

  async function loadSlateFromDrive(meta) {
    const C = getCore();
    if (!C || !C.drive || !meta || !meta.driveFileId) return;
    notify('Đang tải bản viết từ Đám mây...', 'info');
    try {
      const txt = await C.drive.downloadText(meta.driveFileId);
      const parsed = JSON.parse(txt);
      if (!parsed || !Array.isArray(parsed.pages) || !parsed.pages.length) {
        throw new Error('Nội dung bản viết không hợp lệ.');
      }
      state.boardId = parsed.boardId || meta.boardId;
      state.title = parsed.title || meta.title || 'Bảng Giảng Thiên Văn';
      state.driveFileId = meta.driveFileId;
      state.pdfDriveFileId = meta.pdfDriveFileId || '';
      state.pages = parsed.pages;
      state.activePageIndex = Math.max(0, Math.min(state.pages.length - 1, Number(parsed.activePageIndex) || 0));
      state.selectedItem = null;
      syncSelectionBar();
      syncPageHeaderUI();
      syncPaperControlsUI();
      renderCommittedLayer();
      renderActiveLayer();
      await saveLocalDraftNow();
      setSaveStatus('Đã đồng bộ Đám mây ✓');
      state.cloudDrawerOpen = false;
      document.getElementById('vtSlateCloudDrawer').classList.remove('open');
      notify('✓ Đã mở bản viết "' + state.title + '".', 'success');
    } catch (err) {
      notify((err && err.message) || 'Không thể mở bản viết từ Đám mây.', 'error');
    }
  }

  /* ==========================================================================
   * 10. BƯỚC 3C — LAB 2D/3D CAPTURE, PDF/IMAGE INSERTION & MULTI-PAGE PDF
   * ========================================================================== */

  function compressImageToDataUrl(imgOrCanvas, maxDim) {
    const limit = maxDim || 1600;
    const natW = imgOrCanvas.naturalWidth || imgOrCanvas.width || 800;
    const natH = imgOrCanvas.naturalHeight || imgOrCanvas.height || 600;
    const scale = Math.min(1, limit / Math.max(natW, natH));
    const w = Math.max(1, Math.round(natW * scale));
    const h = Math.max(1, Math.round(natH * scale));
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = '#FFFFFF';
    tctx.fillRect(0, 0, w, h);
    tctx.drawImage(imgOrCanvas, 0, 0, w, h);
    return {
      dataUrl: tmp.toDataURL('image/jpeg', 0.90),
      natW: w,
      natH: h
    };
  }

  function placeImageOnPage(page, dataUrl, natW, natH, opts) {
    const o = opts || {};
    const aspect = (natW || 4) / (natH || 3);
    const viewW = Math.max(320, (state.stageWidth || 1000) / (state.zoom || 1));
    const viewH = Math.max(260, (state.stageHeight || 640) / (state.zoom || 1));
    const originX = (-state.panX / (state.zoom || 1));
    const originY = (-state.panY / (state.zoom || 1));

    let targetW = o.w || Math.min(viewW * 0.44, 480);
    let targetH = targetW / aspect;
    if (targetH > viewH * 0.84) {
      targetH = viewH * 0.84;
      targetW = targetH * aspect;
    }

    const x = o.x != null ? o.x : (o.alignLeft ? originX + 74 : originX + (viewW - targetW) / 2);
    const y = o.y != null ? o.y : (o.alignLeft ? originY + 24 : originY + Math.max(28, (viewH - targetH) / 2));

    const rec = {
      id: makeId('img'),
      dataUrl: dataUrl,
      x: x,
      y: y,
      w: targetW,
      h: targetH,
      caption: o.caption || 'Hình đính kèm',
      locked: Boolean(o.locked)
    };
    page.images.push(rec);
    return rec;
  }

  function insertLabCapture(capture) {
    if (!capture || !capture.dataUrl) return;
    const img = new Image();
    img.onload = function () {
      pushUndo();
      const page = getCurrentPage();
      const rec = placeImageOnPage(page, capture.dataUrl, img.naturalWidth, img.naturalHeight, {
        caption: capture.caption || 'Đồ thị Phòng Thí nghiệm 2D/3D'
      });
      state.selectedItem = { kind: 'image', id: rec.id };
      syncSelectionBar();
      renderCommittedLayer();
      renderActiveLayer();
      scheduleAutoSave();
      notify('✓ Đã dán đồ thị từ Phòng Thí nghiệm lên Bảng Giảng. Dùng công cụ ⬚ để di chuyển hoặc phóng to.', 'success');
    };
    img.onerror = function () {
      notify('Không thể đọc ảnh đồ thị vừa chụp.', 'error');
    };
    img.src = capture.dataUrl;
  }

  function setInsertProgress(visible, text, pct) {
    const wrap = document.getElementById('vtSlateInsertProgressWrap');
    const txtEl = document.getElementById('vtSlateInsertProgressText');
    const fillEl = document.getElementById('vtSlateInsertProgressFill');
    if (wrap) wrap.style.display = visible ? 'flex' : 'none';
    if (txtEl && text) txtEl.textContent = text;
    if (fillEl && pct != null) fillEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  async function handleLocalFileImport(file) {
    if (!file || state.importingDoc) return;
    const name = file.name || 'Tai_lieu';
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(name);
    const isImage = /^image\//i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(name);

    if (!isPdf && !isImage) {
      notify('Chỉ hỗ trợ chèn tệp PDF hoặc ảnh (.png, .jpg, .webp).', 'warn');
      return;
    }

    state.importingDoc = true;
    try {
      if (isImage) {
        await insertImageBlobToCurrentPage(file, name);
      } else {
        const buf = await file.arrayBuffer();
        await importPdfArrayBufferToPages(buf, name);
      }
      const bd = document.getElementById('vtSlateInsertBackdrop');
      if (bd) bd.classList.remove('open');
    } catch (err) {
      notify((err && err.message) || 'Không thể chèn tệp đề bài lúc này.', 'error');
    } finally {
      state.importingDoc = false;
      setInsertProgress(false);
    }
  }

  function insertImageBlobToCurrentPage(blob, caption) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        const compressed = compressImageToDataUrl(img, 1600);
        pushUndo();
        const page = getCurrentPage();
        const rec = placeImageOnPage(page, compressed.dataUrl, compressed.natW, compressed.natH, {
          alignLeft: true,
          caption: caption || 'Đề bài ảnh'
        });
        state.selectedItem = { kind: 'image', id: rec.id };
        syncSelectionBar();
        renderCommittedLayer();
        renderActiveLayer();
        scheduleAutoSave();
        notify('✓ Đã đặt ảnh đề bài lên trang hiện tại.', 'success');
        resolve();
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Không thể đọc tệp ảnh đã chọn.'));
      };
      img.src = url;
    });
  }

  async function importPdfArrayBufferToPages(arrayBuffer, docTitle) {
    setInsertProgress(true, 'Đang khởi động trình đọc tài liệu...', 10);
    const pdfLib = await ensurePdfReader();
    const loadingTask = pdfLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const total = Math.min(pdfDoc.numPages || 0, 30);
    if (!total) throw new Error('Tệp PDF không có trang nội dung nào.');

    if (pdfDoc.numPages > 30) {
      notify('Tệp có nhiều trang — hệ thống tự động dàn 30 trang đầu để giữ bảng mượt mà.', 'info');
    }

    const basePaper = JSON.parse(JSON.stringify(getCurrentPage().paperConfig));
    const curPage = getCurrentPage();
    const curIsEmpty = !curPage.strokes.length && !curPage.shapes.length && !curPage.images.length;
    let firstInsertedIdx = curIsEmpty ? state.activePageIndex : state.activePageIndex + 1;

    for (let pNum = 1; pNum <= total; pNum++) {
      setInsertProgress(true, 'Đang dàn trang đề bài ' + pNum + ' / ' + total + '...', Math.round(15 + (pNum / total) * 80));
      const pdfPage = await pdfDoc.getPage(pNum);
      const viewport = pdfPage.getViewport({ scale: 1.75 });
      const off = document.createElement('canvas');
      off.width = Math.round(viewport.width);
      off.height = Math.round(viewport.height);
      const octx = off.getContext('2d');
      octx.fillStyle = '#FFFFFF';
      octx.fillRect(0, 0, off.width, off.height);
      await pdfPage.render({ canvasContext: octx, viewport: viewport }).promise;

      const compressed = compressImageToDataUrl(off, 1600);
      let targetPage;
      if (pNum === 1 && curIsEmpty) {
        targetPage = curPage;
      } else {
        targetPage = createBlankPage(basePaper);
        state.pages.splice(firstInsertedIdx + pNum - 1, 0, targetPage);
      }

      // Place PDF page neatly on the left half so right half has generous ruled space
      placeImageOnPage(targetPage, compressed.dataUrl, compressed.natW, compressed.natH, {
        alignLeft: true,
        caption: (docTitle || 'Đề bài PDF') + ' — Trang ' + pNum,
        locked: false
      });
    }

    if (docTitle && state.title === 'Bảng Giảng Thiên Văn') {
      state.title = String(docTitle).replace(/\.pdf$/i, '').slice(0, 80);
    }

    switchToPage(firstInsertedIdx);
    scheduleAutoSave();
    notify('✓ Đã chèn ' + total + ' trang đề bài PDF lên Bảng Giảng kèm vùng viết lời giải.', 'success');
  }

  async function openDocumentOnBoard(doc) {
    if (!doc) return;
    const C = getCore();
    const fid = doc.fileId || (C && C.drive && doc.previewUrl ? C.drive.parseDriveLink(doc.previewUrl) : '');
    const title = doc.title || doc.name || 'Tài liệu đề bài';
    const mime = String(doc.mimeType || '').toLowerCase();

    // Try downloading actual PDF/Image from Drive to place directly on board pages
    if (fid && C && C.drive && typeof C.drive.downloadBlob === 'function' && C.auth && C.auth.getAccessToken()) {
      try {
        notify('Đang tải tài liệu "' + title + '" lên Bảng Giảng...', 'info');
        const blob = await C.drive.downloadBlob(fid);
        if (blob && blob.size > 0) {
          const bType = String(blob.type || mime).toLowerCase();
          if (bType.indexOf('pdf') >= 0 || /\.pdf$/i.test(title)) {
            const buf = await blob.arrayBuffer();
            await importPdfArrayBufferToPages(buf, title);
            return;
          }
          if (bType.indexOf('image/') === 0 || /\.(png|jpe?g|webp)$/i.test(title)) {
            await insertImageBlobToCurrentPage(blob, title);
            return;
          }
        }
      } catch (e) {
        // Fallback smoothly to split reference panel
      }
    }

    // Fallback: open in split-screen reference panel
    if (doc.previewUrl || fid) {
      state.refDoc = doc;
      const panel = document.getElementById('vtSlateRefDoc');
      const titleEl = document.getElementById('vtSlateRefDocTitle');
      const frame = document.getElementById('vtSlateRefDocFrame');
      if (titleEl) titleEl.textContent = title;
      if (frame) frame.src = doc.previewUrl || ('https://drive.google.com/file/d/' + fid + '/preview');
      if (panel) panel.classList.add('open');
      setTimeout(resizeSlateLayers, 50);
      notify('✓ Đã mở tài liệu đối chiếu bên cạnh Bảng Giảng.', 'success');
    }
  }

  function loadImagePromise(src) {
    return new Promise(function (resolve) {
      const cached = state.imageCache.get(src);
      if (cached && cached.complete && cached.naturalWidth > 0) { resolve(cached); return; }
      const img = new Image();
      img.onload = function () { state.imageCache.set(src, img); resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function computePageWorldBounds(page) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function expand(x, y) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    (page.images || []).forEach(function (im) {
      expand(im.x, im.y);
      expand(im.x + im.w, im.y + im.h);
    });
    (page.shapes || []).forEach(function (sh) {
      const b = getObjectBounds(sh, 'shape');
      if (b) { expand(b.x, b.y); expand(b.x + b.w, b.y + b.h); }
    });
    (page.strokes || []).forEach(function (st) {
      (st.points || []).forEach(function (p) { expand(p.x, p.y); });
    });

    const fallbackW = Math.max(1060, state.stageWidth || 1060);
    const fallbackH = Math.max(660, state.stageHeight || 660);

    if (!isFinite(minX)) {
      return { x: 0, y: 0, w: fallbackW, h: fallbackH };
    }
    const pad = 48;
    minX = Math.min(0, minX - pad);
    minY = Math.min(0, minY - pad);
    maxX = Math.max(minX + fallbackW, maxX + pad);
    maxY = Math.max(minY + fallbackH, maxY + pad);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  async function renderPageToExportImage(page) {
    // Preload all attached images on this page
    const imgs = page.images || [];
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i] && imgs[i].dataUrl) await loadImagePromise(imgs[i].dataUrl);
    }

    const bounds = computePageWorldBounds(page);
    const maxPx = 2200;
    const scale = Math.min(2.0, maxPx / Math.max(bounds.w, bounds.h));
    const outW = Math.max(1, Math.round(bounds.w * scale));
    const outH = Math.max(1, Math.round(bounds.h * scale));

    const off = document.createElement('canvas');
    off.width = outW;
    off.height = outH;
    const ctx = off.getContext('2d');
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-bounds.x, -bounds.y);

    drawPaperInBounds(ctx, page, bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h, 1);

    // Draw attached images
    imgs.forEach(function (im) {
      const el = state.imageCache.get(im.dataUrl);
      if (el && el.complete && el.naturalWidth > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(im.x, im.y, im.w, im.h);
        ctx.drawImage(el, im.x, im.y, im.w, im.h);
      }
    });

    // Highlighters under ink
    (page.strokes || []).forEach(function (st) {
      if (st.tool === 'highlighter') drawStroke(ctx, st);
    });
    // Vector shapes
    (page.shapes || []).forEach(function (sh) {
      drawVectorShape(ctx, sh);
    });
    // Regular ink
    (page.strokes || []).forEach(function (st) {
      if (st.tool !== 'highlighter') drawStroke(ctx, st);
    });
    ctx.restore();

    return {
      dataUrl: off.toDataURL('image/jpeg', 0.92),
      width: outW,
      height: outH
    };
  }

  async function buildMultiPagePdfBlob(onProgress) {
    const JsPDFCtor = await ensurePdfExporter();
    const doc = new JsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 6;
    const footerH = 6;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - footerH;

    for (let i = 0; i < state.pages.length; i++) {
      if (onProgress) onProgress(i + 1, state.pages.length);
      if (i > 0) doc.addPage('a4', 'landscape');
      const rendered = await renderPageToExportImage(state.pages[i]);
      const imgAspect = rendered.width / rendered.height;
      let drawW = availW;
      let drawH = drawW / imgAspect;
      if (drawH > availH) {
        drawH = availH;
        drawW = drawH * imgAspect;
      }
      const dx = margin + (availW - drawW) / 2;
      const dy = margin + (availH - drawH) / 2;

      doc.addImage(rendered.dataUrl, 'JPEG', dx, dy, drawW, drawH, undefined, 'FAST');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const cleanFooterTitle = String(state.title || 'Bang Giang Thien Van')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
      doc.text('VANTHESIS • ' + cleanFooterTitle + ' • Trang ' + (i + 1) + '/' + state.pages.length, pageW / 2, pageH - 3.5, { align: 'center' });
    }

    return doc.output('blob');
  }

  async function downloadBoardAsPdf() {
    if (state.exportingPdf) return;
    state.exportingPdf = true;
    const btn = document.getElementById('vtSlateExportPdfBtn');
    const origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xuất PDF...'; }
    try {
      const blob = await buildMultiPagePdfBlob(function (cur, tot) {
        if (btn) btn.textContent = '⏳ Trang ' + cur + '/' + tot + '...';
      });
      const fileName = sanitizeFilename(state.title, '.pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      notify('✓ Đã tải xuống tệp "' + fileName + '" (' + state.pages.length + ' trang).', 'success');
    } catch (err) {
      notify((err && err.message) || 'Chưa thể xuất tệp PDF lúc này.', 'error');
    } finally {
      state.exportingPdf = false;
      if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
  }

  /* ==========================================================================
   * 11. BƯỚC 3C — PUBLISH HANDWRITTEN SOLUTION TO CONSTELLATION HUB
   * ========================================================================== */

  function setPublishProgress(visible, text, pct) {
    const wrap = document.getElementById('vtSlatePubProgressWrap');
    const txtEl = document.getElementById('vtSlatePubProgressText');
    const fillEl = document.getElementById('vtSlatePubProgressFill');
    if (wrap) wrap.style.display = visible ? 'flex' : 'none';
    if (txtEl && text) txtEl.textContent = text;
    if (fillEl && pct != null) fillEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  async function openPublishModal() {
    if (!canPublishToConstellation()) {
      notify('Tính năng giao bài lên Kho Chòm sao chỉ dành cho Giáo viên Bộ môn và Quản trị viên.', 'warn');
      return;
    }
    const backdrop = document.getElementById('vtSlatePublishBackdrop');
    if (!backdrop) return;
    document.getElementById('vtSlatePubTitle').value = state.title || 'Bài giảng viết tay';
    document.getElementById('vtSlatePubSummary').value = '';
    setPublishProgress(false);
    backdrop.classList.add('open');

    const grid = document.getElementById('vtSlatePubClassGrid');
    const C = getCore();
    if (!C) return;
    grid.innerHTML = '<div style="font-size:12px;color:var(--text-muted);grid-column:1/-1;">Đang tải danh sách lớp giảng dạy...</div>';

    try {
      const hub = await C.api.post('resources_hub_init', {});
      const allClasses = hub && Array.isArray(hub.classes) ? hub.classes : [];
      const resources = hub && Array.isArray(hub.resources) ? hub.resources : [];

      // Filter classes allowed for this teacher
      state.hubClasses = allClasses.filter(function (cls) {
        if (C.policy && typeof C.policy.canTeachClass === 'function') {
          return C.policy.canTeachClass(cls.classId);
        }
        return true;
      });
      if (!state.hubClasses.length && allClasses.length) {
        state.hubClasses = allClasses;
      }

      // Extract chapter suggestions
      const chapSet = new Set();
      resources.forEach(function (r) {
        if (r && r.chapterConstellation) chapSet.add(r.chapterConstellation);
      });
      state.hubChapters = Array.from(chapSet);
      const hintList = document.getElementById('vtSlateChapterHints');
      if (hintList) {
        hintList.innerHTML = state.hubChapters.map(function (ch) {
          return '<option value="' + escapeAttr(ch) + '"></option>';
        }).join('');
      }
      const chapInp = document.getElementById('vtSlatePubChapter');
      if (chapInp && !chapInp.value && state.hubChapters.length) {
        chapInp.value = state.hubChapters[0];
      }

      if (!state.hubClasses.length) {
        grid.innerHTML = '<div style="font-size:12px;color:var(--text-muted);grid-column:1/-1;">Chưa có lớp học nào được phân công. Bài giảng sẽ được lưu ở phạm vi riêng tư của bạn.</div>';
      } else {
        grid.innerHTML = state.hubClasses.map(function (c) {
          return '<label class="vt-slate-class-chip"><input type="checkbox" value="' + escapeAttr(c.classId) + '" checked> <span>Lớp ' + escapeHtml(c.className) + ' (' + escapeHtml(c.gradeBlock || '') + ')</span></label>';
        }).join('');
      }
    } catch (err) {
      grid.innerHTML = '<div style="font-size:12px;color:#DC2626;grid-column:1/-1;">Không thể tải danh sách lớp lúc này.</div>';
    }
  }

  function closePublishModal() {
    if (state.publishing) return;
    const bd = document.getElementById('vtSlatePublishBackdrop');
    if (bd) bd.classList.remove('open');
  }

  async function submitPublishToConstellation() {
    if (state.publishing || !canPublishToConstellation()) return;
    const C = getCore();
    if (!C) return;

    const title = document.getElementById('vtSlatePubTitle').value.trim();
    const gradeBlock = document.getElementById('vtSlatePubGrade').value || 'Khối 12';
    const chapterConstellation = document.getElementById('vtSlatePubChapter').value.trim() || 'Bài giải Bảng Giảng';
    const summary = document.getElementById('vtSlatePubSummary').value.trim() || ('Bài giải viết tay gồm ' + state.pages.length + ' trang từ Bảng Giảng Thiên Văn.');

    if (!title) {
      notify('Vui lòng nhập tiêu đề bài giảng trước khi giao.', 'warn');
      return;
    }

    const assignedClassIds = [];
    document.querySelectorAll('#vtSlatePubClassGrid input[type="checkbox"]:checked').forEach(function (cb) {
      assignedClassIds.push(cb.value);
    });

    state.publishing = true;
    const submitBtn = document.getElementById('vtSlatePubSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;

    try {
      setPublishProgress(true, 'Đang đóng gói tệp PDF nhiều trang...', 15);
      const pdfBlob = await buildMultiPagePdfBlob(function (cur, tot) {
        setPublishProgress(true, 'Đang kết xuất trang ' + cur + ' / ' + tot + '...', Math.round(15 + (cur / tot) * 35));
      });

      const fileName = sanitizeFilename(title, '.pdf');
      setPublishProgress(true, 'Đang tải bản giải lên Google Drive...', 55);
      const uploaded = await C.drive.uploadFile({
        folderName: RESOURCES_FOLDER_NAME,
        fileName: fileName,
        mimeType: 'application/pdf',
        fileOrBlob: pdfBlob,
        makePublicViewer: true,
        onProgress: function (pct) {
          setPublishProgress(true, 'Đang tải bản giải lên Google Drive (' + pct + '%)...', Math.round(55 + pct * 0.30));
        }
      });

      if (!uploaded || !uploaded.fileId) {
        throw new Error('Không thể tải tệp PDF lên thư mục học liệu.');
      }
      state.pdfDriveFileId = uploaded.fileId;

      setPublishProgress(true, 'Đang gắn ngôi sao mới lên Kho Chòm sao...', 90);
      const publishScope = assignedClassIds.length ? 'CLASS_ASSIGNED' : 'PRIVATE';
      const payload = {
        title: title,
        subject: 'Toán học',
        gradeBlock: gradeBlock,
        chapterConstellation: chapterConstellation,
        topicPattern: 'Bài giải viết tay',
        cognitiveLevel: 'THONG_HIEU',
        resourceType: 'PDF_HANDOUT',
        publishScope: publishScope,
        starOrder: 1,
        summary: summary,
        files: [{
          fileId: uploaded.fileId,
          name: uploaded.name || fileName,
          mimeType: 'application/pdf',
          previewUrl: uploaded.previewUrl,
          downloadUrl: uploaded.downloadUrl
        }],
        blocks: [],
        assignedClassIds: assignedClassIds
      };

      const res = await C.api.post('resources_upsert', { payload: payload });
      if (!res || !res.ok) {
        throw new Error((res && res.friendlyMessage) || 'Chưa thể lưu bài giảng lên Kho Chòm sao.');
      }

      setPublishProgress(true, 'Hoàn tất xuất bản!', 100);
      state.title = title;
      syncPageHeaderUI();
      syncSlateToDrive(true);
      if (C.bus && typeof C.bus.emit === 'function') {
        C.bus.emit('resources-updated', { source: 'astral-slate', resourceId: res.resourceId || '' });
      }

      state.publishing = false;
      if (submitBtn) submitBtn.disabled = false;
      closePublishModal();
      notify('🚀 Đã lưu và giao bài giải "' + title + '" lên Kho Chòm sao thành công!', 'success');
    } catch (err) {
      notify((err && err.message) || 'Chưa thể giao bài giải lên Kho Chòm sao.', 'error');
      state.publishing = false;
      if (submitBtn) submitBtn.disabled = false;
      setPublishProgress(false);
    }
  }

  /* ==========================================================================
   * 12. LIFECYCLE API & STICKY BUS SUBSCRIPTIONS
   * ========================================================================== */

  async function onActivate() {
    state.active = true;
    if (!state.mounted) {
      mountSlateUI();
      await restoreLocalDraft();
      syncPageHeaderUI();
      syncPaperControlsUI();
    }
    syncRolePermissionsUI();
    requestAnimationFrame(function () {
      resizeSlateLayers();
      renderCommittedLayer();
      renderActiveLayer();
    });

    if (window.__VT_PENDING_LAB_CAPTURE__) {
      const cap = window.__VT_PENDING_LAB_CAPTURE__;
      window.__VT_PENDING_LAB_CAPTURE__ = null;
      insertLabCapture(cap);
    }
    if (window.__VT_PENDING_SLATE_DOC__) {
      const doc = window.__VT_PENDING_SLATE_DOC__;
      window.__VT_PENDING_SLATE_DOC__ = null;
      openDocumentOnBoard(doc);
    }
  }

  function onDeactivate() {
    state.active = false;
    clearHoldTimer();
    saveLocalDraftNow();
  }

  const C0 = getCore();
  if (C0 && C0.bus) {
    C0.bus.on('session-changed', function () {
      syncRolePermissionsUI();
      if (state.mounted) {
        renderCommittedLayer();
        renderActiveLayer();
      }
    });
    C0.bus.on('slate-insert-lab', function (payload) {
      if (!payload) return;
      if (!state.mounted) {
        window.__VT_PENDING_LAB_CAPTURE__ = payload;
        return;
      }
      insertLabCapture(payload);
    });
    C0.bus.on('slate-open-document', function (payload) {
      if (!payload) return;
      if (!state.mounted) {
        window.__VT_PENDING_SLATE_DOC__ = payload;
        return;
      }
      openDocumentOnBoard(payload);
    });
  }

  window.VANTHESIS_SLATE = Object.freeze({
    onActivate: onActivate,
    onDeactivate: onDeactivate,
    insertLabCapture: insertLabCapture,
    openDocumentOnBoard: openDocumentOnBoard,
    downloadBoardAsPdf: downloadBoardAsPdf,
    screenToWorld: screenToWorld,
    worldToScreen: worldToScreen,
    getState: function () {
      return {
        boardId: state.boardId,
        title: state.title,
        activePageIndex: state.activePageIndex,
        pages: state.pages
      };
    }
  });
})();