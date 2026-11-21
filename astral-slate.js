/**
 * VANTHESIS Constellation LCMS — Bảng Giảng Thiên Văn v2.0
 * File: astral-slate.js (đặt ngang hàng index.html, nạp sau vanthesis-core.js)
 * Namespace: window.VANTHESIS_SLATE
 * Phụ thuộc: window.VANTHESIS_CORE (bus, auth, api, policy, db, drive, ui)
 *
 * Kiến trúc v2.0:
 * - Bàn làm việc chuyên nghiệp với Khổ giấy có đầu có cuối (A4 Dọc, A4 Ngang, 16:9) & Số trang
 * - Động cơ mực 60fps 2 lớp, tách ảnh khỏi auto-save nét vẽ, dirty-flag rendering
 * - Zoom 40%-300% quanh tâm con trỏ + Vừa khung + Toàn màn hình tương tác 100%
 * - Chỉnh sửa Ảnh/Hình ưu tiên 8 nút góc/cạnh (vùng bắt 22px) + thanh nổi tự lật vị trí
 * - Thanh đỉnh 7 cụm gọn sạch không tràn mép, 100% icon nét mảnh tinh xảo
 * - Quản lý Thư mục & Tệp mở tức thì 0ms + Lưu theo Thư mục con trên Google Drive
 * - Chèn đề PDF/Ảnh, tiếp nhận đồ thị 2D/3D, xuất PDF nhiều trang & giao lên Kho Chòm sao
 */
(function () {
  'use strict';

  const STYLE_ID = 'vt-slate-v2-css';
  const LAST_SLATE_KEY = 'vt_slate_last_board_id_v2';
  const LOCAL_INDEX_KEY = 'vt_slate_local_index_v2';
  const DRIVE_FOLDER_NAME = 'VANTHESIS_Bang_Giang';
  const RESOURCES_FOLDER_NAME = 'VANTHESIS_Hoc_Lieu';
  const DEFAULT_FOLDER = 'Chung';
  const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  const PAGE_FORMATS = {
    A4_PORTRAIT: { id: 'A4_PORTRAIT', label: 'A4 Dọc (794×1123)', w: 794, h: 1123, pdfOrient: 'portrait' },
    A4_LANDSCAPE: { id: 'A4_LANDSCAPE', label: 'A4 Ngang (1123×794)', w: 1123, h: 794, pdfOrient: 'landscape' },
    SLIDE_16_9: { id: 'SLIDE_16_9', label: 'Trình chiếu 16:9', w: 1280, h: 720, pdfOrient: 'landscape' }
  };

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
    { id: 'BLANK', label: 'Giấy trắng trơn' },
    { id: 'LINED', label: 'Kẻ ngang tập vở' },
    { id: 'GRID', label: 'Ô ly vuông toán học' },
    { id: 'DOT', label: 'Chấm bi tối giản' },
    { id: 'COORD', label: 'Hệ trục Oxy' },
    { id: 'CHALKBOARD', label: 'Bảng tối thiên văn' }
  ];

  const RULING_COLORS = [
    { hex: '#94A3B8', label: 'Xám trung tính' },
    { hex: '#38BDF8', label: 'Xanh vở học sinh' },
    { hex: '#F472B6', label: 'Hồng phấn nhẹ' },
    { hex: '#E2E8F0', label: 'Trắng mảnh (Bảng tối)' }
  ];

  const GRADE_BLOCKS = ['Khối 12', 'Khối 11', 'Khối 10', 'Ôn thi ĐGNL / ĐGTD'];

  /* Crisp thin-stroke inline icons (stroke-width="1.8", zero raw emojis) */
  function ic(pathMarkup, size) {
    const s = size || 16;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + pathMarkup + '</svg>';
  }

  const ICONS = {
    folder: ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    chevLeft: ic('<polyline points="15 18 9 12 15 6"/>', 15),
    chevRight: ic('<polyline points="9 18 15 12 9 6"/>', 15),
    chevDown: ic('<polyline points="6 9 12 15 18 9"/>', 13),
    plus: ic('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 15),
    minus: ic('<line x1="5" y1="12" x2="19" y2="12"/>', 15),
    copy: ic('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', 15),
    trash: ic('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>', 15),
    filePlus: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>'),
    compass: ic('<circle cx="12" cy="5" r="2"/><path d="M11 7 6 21"/><path d="M13 7 18 21"/><path d="M8 16a7 7 0 0 0 8 0"/>'),
    grid: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>'),
    undo: ic('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 15),
    redo: ic('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>', 15),
    fit: ic('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>', 15),
    fullscreen: ic('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>', 15),
    exitFullscreen: ic('<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>', 15),
    save: ic('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
    cloudUp: ic('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="12 12 12 17"/><polyline points="9.5 14.5 12 12 14.5 14.5"/>', 15),
    download: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', 15),
    send: ic('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>', 15),
    close: ic('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 14),
    lock: ic('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 14),
    unlock: ic('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>', 14),
    fountain: ic('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/>'),
    ballpoint: ic('<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>'),
    highlighter: ic('<path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
    dashed: ic('<line x1="3" y1="12" x2="7" y2="12"/><line x1="10" y1="12" x2="14" y2="12"/><line x1="17" y1="12" x2="21" y2="12"/>'),
    laser: ic('<circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>'),
    select: ic('<path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>'),
    eraser: ic('<path d="M20 20H7L3 16a2 2 0 0 1 0-2.83l9.17-9.17a2 2 0 0 1 2.83 0l6.17 6.17a2 2 0 0 1 0 2.83L14 20"/>'),
    eraserPart: ic('<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>'),
    hand: ic('<path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-6.5-3.3l-2.3-3.2a2 2 0 0 1 3.1-2.5L6 14"/>'),
    spark: ic('<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>'),
    palm: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    ruler: ic('<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/><line x1="14.5" y1="12.5" x2="16" y2="11"/><line x1="11.5" y1="9.5" x2="13" y2="8"/><line x1="8.5" y1="6.5" x2="10" y2="5"/>'),
    protractor: ic('<path d="M2 18h20a10 10 0 0 0-20 0z"/><line x1="12" y1="18" x2="12" y2="14"/>'),
    setsquare: ic('<polygon points="4 20 20 20 4 4 4 20"/><polygon points="8 16 13 16 8 11 8 16"/>'),
    refresh: ic('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>', 14),
    edit: ic('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>', 13)
  };

  /* In-memory binary store: decouples heavy image data from fast stroke auto-saves */
  const imageBinaryStore = new Map();
  const imageElementCache = new Map();

  function createDefaultPaperConfig() {
    return {
      format: 'A4_LANDSCAPE',
      preset: 'GRID',
      spacing: 28,
      lineOpacity: 0.22,
      lineColor: '#94A3B8',
      chalkVariant: 'slate'
    };
  }

  function getPageDims(page) {
    const fmtId = (page && page.paperConfig && page.paperConfig.format) || 'A4_LANDSCAPE';
    return PAGE_FORMATS[fmtId] || PAGE_FORMATS.A4_LANDSCAPE;
  }

  function createBlankPage(paperCfg) {
    return {
      id: 'pg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      paperConfig: Object.assign(createDefaultPaperConfig(), paperCfg || {}),
      strokes: [],
      shapes: [],
      images: [] // Lightweight metadata: { id, x, y, w, h, caption, locked } (binary in imageBinaryStore)
    };
  }

  function createDefaultInstruments() {
    return {
      ruler: { visible: false, x: 560, y: 380, length: 420, height: 52, angle: 0 },
      compass: { visible: false, cx: 560, cy: 380, radius: 130, angle: -0.5 },
      protractor: { visible: false, cx: 560, cy: 420, radius: 145, angle: 0 },
      setsquare: { visible: false, x: 420, y: 460, legA: 250, legB: 145, angle: 0 }
    };
  }

  const state = {
    mounted: false,
    active: false,
    isFullscreen: false,
    boardId: 'slate_' + Date.now().toString(36),
    title: 'Bảng Giảng Thiên Văn',
    folderName: DEFAULT_FOLDER,
    driveFileId: '',
    pdfDriveFileId: '',
    pages: [createBlankPage()],
    activePageIndex: 0,

    // Viewport matrix (origin 0,0 = top-left of bounded paper sheet)
    zoom: 1.0,
    panX: 40,
    panY: 28,
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

    // Vector & Image Selection
    selectedItem: null, // { kind: 'shape' | 'image', id: string }
    dragTransform: null,

    // Math Instruments
    instruments: createDefaultInstruments(),
    instrumentDrag: null,

    // Undo / Redo per page (lightweight vector snapshots, no base64 duplication)
    undoMap: {},
    redoMap: {},

    // Persistence & Folders
    saveStatus: 'Đã lưu tại máy',
    localSaveTimer: null,
    driveSyncing: false,
    cloudBoards: [],
    cloudFolders: [DEFAULT_FOLDER],
    cloudLoadError: '',
    cloudDrawerOpen: false,
    collapsedFolders: {},

    // Reference Doc split panel
    refDoc: null,

    // Publish / Export / Import flags
    hubClasses: [],
    hubChapters: [],
    publishing: false,
    exportingPdf: false,
    importingDoc: false
  };

  let committedCanvas = null;
  let committedCtx = null;
  let activeCanvas = null;
  let activeCtx = null;
  let resizeObs = null;
  let activeDirtyRaf = 0;
  let pdfJsPromise = null;
  let jsPdfPromise = null;

  /* ==========================================================================
   * 1. CORE HELPERS & FAST NON-BLOCKING LOCAL PERSISTENCE
   * ========================================================================== */

  function getCore() { return window.VANTHESIS_CORE || null; }

  function canPublishToConstellation() {
    const C = getCore();
    return Boolean(C && C.policy && typeof C.policy.can === 'function' && C.policy.can('upload_resource'));
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(str) { return escapeHtml(str); }

  function notify(msg, type, opts) {
    const C = getCore();
    if (C && C.ui && typeof C.ui.toast === 'function') C.ui.toast(msg, type || 'info', opts);
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

  /* Strip binary image dataUrls when saving fast local vector drafts -> 60fps zero-stutter */
  function stripHeavyImagesForVectorDraft(pages) {
    return pages.map(function (p) {
      return {
        id: p.id,
        paperConfig: p.paperConfig,
        strokes: p.strokes,
        shapes: p.shapes,
        images: (p.images || []).map(function (im) {
          return { id: im.id, x: im.x, y: im.y, w: im.w, h: im.h, caption: im.caption || '', locked: Boolean(im.locked) };
        })
      };
    });
  }

  /* Pack full image binaries ONLY on explicit Cloud Save (.vtslate) */
  function packPagesWithImages(pages) {
    return pages.map(function (p) {
      return {
        id: p.id,
        paperConfig: p.paperConfig,
        strokes: p.strokes,
        shapes: p.shapes,
        images: (p.images || []).map(function (im) {
          const dataUrl = imageBinaryStore.get(im.id) || im.dataUrl || '';
          return { id: im.id, dataUrl: dataUrl, x: im.x, y: im.y, w: im.w, h: im.h, caption: im.caption || '', locked: Boolean(im.locked) };
        })
      };
    });
  }

  /* Hydrate images into separate binary store so page.images stays tiny */
  function hydratePagesFromPayload(rawPages) {
    return (rawPages || []).map(function (p) {
      const imgs = (Array.isArray(p.images) ? p.images : []).map(function (im) {
        const id = im.id || makeId('img');
        if (im.dataUrl) {
          imageBinaryStore.set(id, im.dataUrl);
          persistImageBinaryAsync(id, im.dataUrl);
        }
        return { id: id, x: Number(im.x) || 40, y: Number(im.y) || 40, w: Number(im.w) || 320, h: Number(im.h) || 240, caption: im.caption || 'Hình đính kèm', locked: Boolean(im.locked) };
      });
      return {
        id: p.id || makeId('pg'),
        paperConfig: Object.assign(createDefaultPaperConfig(), p.paperConfig || {}),
        strokes: Array.isArray(p.strokes) ? p.strokes : [],
        shapes: Array.isArray(p.shapes) ? p.shapes : [],
        images: imgs
      };
    });
  }

  function persistImageBinaryAsync(imgId, dataUrl) {
    const C = getCore();
    if (!C || !C.db || !imgId || !dataUrl) return;
    C.db.set('slate_drafts', { boardId: '__img__' + imgId, dataUrl: dataUrl, updatedAt: Date.now() }).catch(function () {});
  }

  async function hydrateMissingImageBinaries(pages) {
    const C = getCore();
    if (!C || !C.db) return;
    let loadedAny = false;
    for (let i = 0; i < pages.length; i++) {
      const imgs = pages[i].images || [];
      for (let j = 0; j < imgs.length; j++) {
        const id = imgs[j].id;
        if (id && !imageBinaryStore.has(id)) {
          try {
            const rec = await C.db.get('slate_drafts', '__img__' + id);
            if (rec && rec.dataUrl) {
              imageBinaryStore.set(id, rec.dataUrl);
              loadedAny = true;
            }
          } catch (e) {}
        }
      }
    }
    if (loadedAny) renderCommittedLayer();
  }

  function readLocalBoardIndex() {
    try {
      const raw = localStorage.getItem(LOCAL_INDEX_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function upsertLocalBoardIndex(meta) {
    try {
      const list = readLocalBoardIndex().filter(function (x) { return x && x.boardId !== meta.boardId; });
      list.unshift(meta);
      localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(list.slice(0, 40)));
    } catch (e) {}
  }

  function removeLocalBoardIndex(boardId) {
    try {
      const list = readLocalBoardIndex().filter(function (x) { return x && x.boardId !== boardId; });
      localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  async function saveLocalDraftNow() {
    clearTimeout(state.localSaveTimer);
    state.localSaveTimer = null;
    const C = getCore();
    if (!C || !C.db) return;
    const nowIso = new Date().toISOString();
    const rec = {
      boardId: state.boardId,
      title: state.title,
      folderName: state.folderName || DEFAULT_FOLDER,
      driveFileId: state.driveFileId || '',
      pdfDriveFileId: state.pdfDriveFileId || '',
      activePageIndex: state.activePageIndex,
      pages: stripHeavyImagesForVectorDraft(state.pages),
      updatedAt: nowIso
    };
    await C.db.set('slate_drafts', rec);
    upsertLocalBoardIndex({
      boardId: state.boardId,
      title: state.title,
      folderName: state.folderName || DEFAULT_FOLDER,
      driveFileId: state.driveFileId || '',
      pageCount: state.pages.length,
      updatedAt: nowIso,
      localOnly: !state.driveFileId
    });
    try { localStorage.setItem(LAST_SLATE_KEY, state.boardId); } catch (e) {}
    if (!state.driveSyncing) setSaveStatus('Đã lưu tại máy');
  }

  function scheduleLocalAutoSave() {
    setSaveStatus('Đang lưu...');
    clearTimeout(state.localSaveTimer);
    state.localSaveTimer = setTimeout(function () {
      saveLocalDraftNow();
    }, 350);
  }

  async function restoreLocalDraft(optionalBoardId) {
    const C = getCore();
    if (!C || !C.db) return false;
    let targetId = optionalBoardId || state.boardId;
    if (!optionalBoardId) {
      try {
        const last = localStorage.getItem(LAST_SLATE_KEY);
        if (last) targetId = last;
      } catch (e) {}
    }
    const rec = await C.db.get('slate_drafts', targetId);
    if (rec && Array.isArray(rec.pages) && rec.pages.length) {
      state.boardId = rec.boardId || targetId;
      state.title = rec.title || 'Bảng Giảng Thiên Văn';
      state.folderName = rec.folderName || DEFAULT_FOLDER;
      state.driveFileId = rec.driveFileId || '';
      state.pdfDriveFileId = rec.pdfDriveFileId || '';
      state.pages = hydratePagesFromPayload(rec.pages);
      state.activePageIndex = Math.max(0, Math.min(state.pages.length - 1, Number(rec.activePageIndex) || 0));
      setSaveStatus(state.driveFileId ? 'Đã đồng bộ Đám mây' : 'Đã lưu tại máy');
      hydrateMissingImageBinaries(state.pages);
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
      }).catch(function (err) { pdfJsPromise = null; throw err; });
    }
    return pdfJsPromise;
  }

  async function ensurePdfExporter() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (!jsPdfPromise) {
      jsPdfPromise = loadExternalScript(JSPDF_CDN).then(function () {
        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('Không thể khởi động bộ xuất tệp PDF.');
        return window.jspdf.jsPDF;
      }).catch(function (err) { jsPdfPromise = null; throw err; });
    }
    return jsPdfPromise;
  }

  /* ==========================================================================
   * 2. LIGHTWEIGHT UNDO / REDO ENGINE (NO BASE64 IN SNAPSHOTS)
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
    scheduleActiveRender();
    scheduleLocalAutoSave();
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
    scheduleActiveRender();
    scheduleLocalAutoSave();
  }

  function syncUndoRedoBtns() {
    const page = getCurrentPage();
    const u = document.getElementById('vtSlateUndoBtn');
    const r = document.getElementById('vtSlateRedoBtn');
    if (u) u.disabled = !(state.undoMap[page.id] && state.undoMap[page.id].length);
    if (r) r.disabled = !(state.redoMap[page.id] && state.redoMap[page.id].length);
  }

  /* ==========================================================================
   * 3. ISOLATED CSS (.vt-slate-* — 60FPS, OVERFLOW-PROOF, INTERACTIVE FULLSCREEN)
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
        background: #E8ECF2;
        color: var(--text, #0F172A);
        font-family: var(--font-sans, 'Plus Jakarta Sans', system-ui, sans-serif);
        user-select: none;
        -webkit-user-select: none;
      }
      html[data-theme="dark"] .vt-slate-root {
        background: #0B1221;
      }
      .vt-slate-root.is-fullscreen {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 9999 !important;
      }

      /* 7-Cluster Compact Overflow-Proof Topbar */
      .vt-slate-topbar {
        height: 48px;
        min-height: 48px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        background: rgba(255, 253, 248, 0.94);
        border-bottom: 1px solid rgba(15, 23, 42, 0.10);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 35;
      }
      html[data-theme="dark"] .vt-slate-topbar {
        background: rgba(10, 17, 38, 0.92);
        border-bottom-color: rgba(148, 163, 184, 0.20);
      }
      .vt-slate-cluster {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        position: relative;
      }
      .vt-slate-cluster.is-title {
        flex: 1 1 120px;
        min-width: 80px;
        max-width: 210px;
      }
      .vt-slate-title-inp {
        width: 100%;
        min-width: 0;
        padding: 5px 9px;
        border-radius: 9999px;
        border: 1px solid transparent;
        background: transparent;
        color: inherit;
        font-family: var(--vt-cosmos-font-display, 'Cormorant Garamond', Georgia, serif);
        font-size: 16px;
        font-weight: 700;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }
      .vt-slate-title-inp:hover, .vt-slate-title-inp:focus {
        border-color: rgba(37, 99, 235, 0.35);
        background: var(--bg);
        outline: none;
      }
      .vt-slate-btn {
        height: 32px;
        padding: 0 9px;
        border-radius: 9999px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(255, 255, 255, 0.72);
        color: inherit;
        font-size: 12px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        cursor: pointer;
        white-space: nowrap;
        transition: border-color 150ms ease, background-color 150ms ease;
      }
      html[data-theme="dark"] .vt-slate-btn {
        border-color: rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.65);
      }
      .vt-slate-btn.icon-only {
        width: 32px;
        padding: 0;
      }
      .vt-slate-btn:hover:not(:disabled) {
        border-color: #2563EB;
        background: rgba(37, 99, 235, 0.10);
      }
      .vt-slate-btn.active {
        background: linear-gradient(135deg, #1D4ED8, #2563EB);
        color: #FFFFFF;
        border-color: transparent;
      }
      .vt-slate-btn.primary {
        background: linear-gradient(135deg, #1D4ED8, #4F46E5);
        color: #FFFFFF;
        border-color: transparent;
        padding: 0 12px;
      }
      .vt-slate-btn:disabled { opacity: 0.40; cursor: not-allowed; }
      .vt-slate-pill-group {
        display: inline-flex;
        align-items: center;
        border-radius: 9999px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(255, 255, 255, 0.72);
        padding: 2px;
        gap: 1px;
      }
      html[data-theme="dark"] .vt-slate-pill-group {
        border-color: rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.65);
      }
      .vt-slate-pill-group .vt-slate-btn {
        height: 26px;
        border: none;
        background: transparent;
        padding: 0 7px;
      }
      .vt-slate-pill-group .vt-slate-btn.icon-only { width: 26px; padding: 0; }
      .vt-slate-zoom-val {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 11.5px;
        font-weight: 700;
        min-width: 40px;
        text-align: center;
        cursor: pointer;
      }
      .vt-slate-save-pill {
        font-size: 11px;
        font-weight: 700;
        color: #059669;
        white-space: nowrap;
        padding: 0 4px;
      }
      html[data-theme="dark"] .vt-slate-save-pill { color: #6EE7B7; }

      /* Body & Bounded Desk Stage */
      .vt-slate-body {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        overflow: hidden;
      }
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
        content: 'Thả tệp PDF hoặc Ảnh đề bài vào đây để đặt lên tờ giấy';
        position: absolute;
        inset: 14px;
        border-radius: 22px;
        border: 2.5px dashed #2563EB;
        background: rgba(37, 99, 235, 0.12);
        color: var(--text);
        font-size: 15px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 45;
        pointer-events: none;
      }
      .vt-slate-layer { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      #vtSlateActiveLayer { pointer-events: none; }

      /* Compact Floating Left Ink Dock */
      .vt-slate-dock {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        width: 52px;
        max-height: calc(100% - 16px);
        overflow-y: auto;
        scrollbar-width: none;
        padding: 7px 5px;
        border-radius: 24px;
        background: rgba(255, 253, 248, 0.94);
        border: 1px solid rgba(15, 23, 42, 0.12);
        box-shadow: 0 14px 36px rgba(15, 23, 42, 0.14);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        z-index: 25;
        transition: opacity 150ms ease;
      }
      .vt-slate-dock::-webkit-scrollbar { display: none; }
      html[data-theme="dark"] .vt-slate-dock {
        background: rgba(10, 17, 38, 0.92);
        border-color: rgba(148, 163, 184, 0.24);
      }
      .vt-slate-dock.is-dimmed { opacity: 0.22; pointer-events: none; }
      .vt-slate-tool-btn {
        width: 38px;
        height: 33px;
        border-radius: 13px;
        border: 1px solid transparent;
        background: transparent;
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: background-color 140ms ease, border-color 140ms ease;
      }
      .vt-slate-tool-btn:hover { background: rgba(37, 99, 235, 0.12); }
      .vt-slate-tool-btn.active {
        background: linear-gradient(135deg, #1D4ED8, #4F46E5);
        color: #FFFFFF;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.42), 0 6px 14px rgba(37, 99, 235, 0.36);
      }
      .vt-slate-tool-btn.smart-on {
        background: rgba(124, 58, 237, 0.14);
        border-color: rgba(124, 58, 237, 0.42);
        color: #7C3AED;
      }
      .vt-slate-tool-btn.palm-on {
        background: rgba(245, 158, 11, 0.16);
        border-color: rgba(217, 119, 6, 0.48);
        color: #D97706;
      }
      .vt-slate-sep { width: 26px; height: 1px; background: rgba(148, 163, 184, 0.32); margin: 2px 0; flex-shrink: 0; }
      .vt-slate-swatch-grid { display: grid; grid-template-columns: repeat(2, 17px); gap: 5px; }
      .vt-slate-swatch {
        width: 17px;
        height: 17px;
        border-radius: 9999px;
        border: 1.5px solid rgba(148, 163, 184, 0.55);
        cursor: pointer;
        padding: 0;
      }
      .vt-slate-swatch.active { transform: scale(1.18); box-shadow: 0 0 0 2px #2563EB; }
      .vt-slate-color-inp { width: 32px; height: 20px; border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 7px; padding: 0; cursor: pointer; background: transparent; }
      .vt-slate-size-dot { border-radius: 9999px; }

      /* Smart-Positioned Floating Selection Action Bar */
      .vt-slate-selbar {
        position: absolute;
        padding: 5px 8px;
        border-radius: 9999px;
        background: rgba(255, 253, 248, 0.96);
        border: 1px solid rgba(15, 23, 42, 0.14);
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: none;
        align-items: center;
        gap: 5px;
        z-index: 34;
        transform: translateX(-50%);
      }
      html[data-theme="dark"] .vt-slate-selbar {
        background: rgba(10, 17, 38, 0.96);
        border-color: rgba(148, 163, 184, 0.28);
      }
      .vt-slate-selbar.open { display: flex; }

      /* Dropdown Menus & Popovers */
      .vt-slate-menu, .vt-slate-popover {
        position: absolute;
        top: 52px;
        right: 12px;
        min-width: 230px;
        padding: 8px;
        border-radius: 18px;
        background: rgba(255, 253, 248, 0.98);
        border: 1px solid rgba(15, 23, 42, 0.12);
        box-shadow: 0 18px 46px rgba(15, 23, 42, 0.18);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 46;
        display: none;
        flex-direction: column;
        gap: 4px;
      }
      .vt-slate-popover {
        width: min(336px, 92vw);
        padding: 15px;
        gap: 11px;
      }
      html[data-theme="dark"] .vt-slate-menu,
      html[data-theme="dark"] .vt-slate-popover {
        background: rgba(10, 17, 38, 0.97);
        border-color: rgba(148, 163, 184, 0.26);
        box-shadow: 0 20px 52px rgba(2, 6, 23, 0.62);
      }
      .vt-slate-menu.open, .vt-slate-popover.open { display: flex; }
      .vt-slate-menu-item {
        width: 100%;
        padding: 9px 12px;
        border-radius: 12px;
        border: none;
        background: transparent;
        color: inherit;
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 9px;
        cursor: pointer;
        text-align: left;
      }
      .vt-slate-menu-item:hover { background: rgba(37, 99, 235, 0.10); }
      .vt-slate-menu-item.danger { color: #DC2626; }
      .vt-slate-preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      .vt-slate-format-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      .vt-slate-preset-btn {
        padding: 8px 9px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.30);
        background: transparent;
        color: inherit;
        font-size: 11.5px;
        font-weight: 700;
        text-align: center;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .vt-slate-preset-btn.active { border-color: #2563EB; background: rgba(37, 99, 235, 0.12); color: #2563EB; }
      html[data-theme="dark"] .vt-slate-preset-btn.active { color: #60A5FA; }

      /* Folder & Files Drawer (0ms Instant Local + Background Cloud) */
      .vt-slate-drawer {
        position: absolute;
        top: 48px;
        left: 0;
        bottom: 0;
        width: min(340px, 90vw);
        background: rgba(255, 253, 248, 0.98);
        border-right: 1px solid rgba(15, 23, 42, 0.12);
        box-shadow: 16px 0 42px rgba(15, 23, 42, 0.16);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 14px;
        display: none;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        z-index: 44;
      }
      html[data-theme="dark"] .vt-slate-drawer {
        background: rgba(10, 17, 38, 0.97);
        border-right-color: rgba(148, 163, 184, 0.24);
      }
      .vt-slate-drawer.open { display: flex; }
      .vt-slate-folder-group {
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 14px;
        overflow: hidden;
      }
      .vt-slate-folder-head {
        padding: 8px 11px;
        background: rgba(148, 163, 184, 0.10);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        cursor: pointer;
        font-size: 12.5px;
        font-weight: 800;
      }
      .vt-slate-folder-body {
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .vt-slate-folder-body.collapsed { display: none; }
      .vt-slate-file-card {
        padding: 9px 10px;
        border-radius: 11px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        display: flex;
        flex-direction: column;
        gap: 3px;
        cursor: pointer;
        transition: border-color 140ms ease;
      }
      .vt-slate-file-card:hover { border-color: #2563EB; }

      /* Reference Document Split Panel */
      .vt-slate-refdoc {
        width: 36%;
        min-width: 280px;
        max-width: 460px;
        border-right: 1px solid rgba(148, 163, 184, 0.24);
        background: var(--surface);
        display: none;
        flex-direction: column;
        z-index: 20;
      }
      .vt-slate-refdoc.open { display: flex; }
      .vt-slate-refdoc-head {
        padding: 8px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.20);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12.5px;
        font-weight: 700;
      }
      .vt-slate-refdoc iframe { flex: 1; width: 100%; border: 0; }

      /* Floating Exit Fullscreen Pill (only visible in Fullscreen) */
      .vt-slate-exit-fs {
        position: absolute;
        bottom: 16px;
        right: 16px;
        z-index: 40;
        display: none;
        box-shadow: 0 12px 30px rgba(2, 6, 23, 0.28);
      }
      .vt-slate-root.is-fullscreen .vt-slate-exit-fs { display: inline-flex; }

      /* Modals */
      .vt-slate-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(3, 6, 19, 0.52);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        z-index: 60;
      }
      .vt-slate-modal-backdrop.open { display: flex; }
      .vt-slate-modal {
        width: min(480px, 95vw);
        max-height: 88vh;
        overflow-y: auto;
        border-radius: 26px;
        background: rgba(255, 253, 248, 0.98);
        border: 1px solid rgba(15, 23, 42, 0.14);
        box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 13px;
      }
      html[data-theme="dark"] .vt-slate-modal {
        background: rgba(10, 17, 38, 0.98);
        border-color: rgba(148, 163, 184, 0.28);
      }
      .vt-slate-field { display: flex; flex-direction: column; gap: 5px; }
      .vt-slate-field label { font-size: 12px; font-weight: 700; opacity: 0.78; }
      .vt-slate-input, .vt-slate-select, .vt-slate-textarea {
        width: 100%;
        padding: 9px 12px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.36);
        background: var(--bg);
        color: inherit;
        font-size: 13.5px;
        font-family: inherit;
        box-sizing: border-box;
      }
      .vt-slate-dropzone {
        border: 2px dashed rgba(148, 163, 184, 0.45);
        border-radius: 18px;
        padding: 22px 16px;
        text-align: center;
        cursor: pointer;
        transition: border-color 150ms ease, background-color 150ms ease;
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
      }
      .vt-slate-class-chip {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 7px 10px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.30);
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .vt-slate-progress-bar { height: 7px; border-radius: 9999px; background: rgba(148, 163, 184, 0.25); overflow: hidden; }
      .vt-slate-progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #2563EB, #7C3AED); transition: width 160ms ease; }

      /* Responsive Topbar Compression (Zero Right-Edge Overflow on 1366px, iPad, Mobile) */
      @media (max-width: 1240px) {
        .vt-slate-btn-lbl-lg { display: none; }
      }
      @media (max-width: 960px) {
        .vt-slate-btn-lbl-md { display: none; }
        .vt-slate-save-pill { display: none; }
      }
      @media (max-width: 767px) {
        .vt-slate-topbar { padding: 0 6px; gap: 4px; overflow-x: auto; }
        .vt-slate-dock { left: 6px; width: 46px; padding: 5px 4px; }
        .vt-slate-tool-btn { width: 34px; height: 30px; }
        .vt-slate-refdoc { position: absolute; inset: 0; width: 100%; max-width: 100%; z-index: 38; }
        .vt-slate-class-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ==========================================================================
   * 4. DOM MOUNTING (7-CLUSTER TOPBAR, SVG-ONLY ICONS, CLEAN MENUS)
   * ========================================================================== */

  function mountSlateUI() {
    const host = document.getElementById('vtSlateMount');
    if (!host || state.mounted) return;
    injectStyles();

    const swatchesHtml = INK_COLORS.map(function (c) {
      return '<button type="button" class="vt-slate-swatch' + (c.hex === state.color ? ' active' : '') + '" data-sl-color="' + c.hex + '" title="' + c.label + '" style="background:' + c.hex + ';"></button>';
    }).join('');

    const formatsHtml = Object.keys(PAGE_FORMATS).map(function (k) {
      const f = PAGE_FORMATS[k];
      return '<button type="button" class="vt-slate-preset-btn" data-sl-format="' + f.id + '">' + escapeHtml(f.label.split(' (')[0]) + '</button>';
    }).join('');

    const presetsHtml = PAPER_PRESETS.map(function (p) {
      return '<button type="button" class="vt-slate-preset-btn" data-sl-preset="' + p.id + '">' + escapeHtml(p.label) + '</button>';
    }).join('');

    const rulingColsHtml = RULING_COLORS.map(function (c) {
      return '<button type="button" class="vt-slate-swatch" data-sl-rcolor="' + c.hex + '" title="' + c.label + '" style="background:' + c.hex + ';"></button>';
    }).join('');

    const gradeOptsHtml = GRADE_BLOCKS.map(function (g) {
      return '<option value="' + escapeAttr(g) + '">' + escapeHtml(g) + '</option>';
    }).join('');

    host.innerHTML = `
      <div class="vt-slate-root" id="vtSlateRoot">
        <!-- 7-Cluster Compact Overflow-Proof Topbar -->
        <div class="vt-slate-topbar">
          <!-- 1. Thư mục & Tệp -->
          <div class="vt-slate-cluster">
            <button type="button" class="vt-slate-btn" id="vtSlateDriveBtn" title="Mở quản lý Thư mục & Tệp bảng giảng">
              ${ICONS.folder}<span class="vt-slate-btn-lbl-md">Thư mục & Tệp</span>
            </button>
          </div>

          <!-- 2. Tên bảng viết -->
          <div class="vt-slate-cluster is-title">
            <input type="text" class="vt-slate-title-inp" id="vtSlateTitleInp" value="${escapeAttr(state.title)}" title="Bấm để sửa tên bảng giảng" aria-label="Tiêu đề bảng giảng">
            <span class="vt-slate-save-pill" id="vtSlateSaveStatus">${escapeHtml(state.saveStatus)}</span>
          </div>

          <!-- 3. Cụm Trang (‹ | Trang 1/1 ▾ | ›) -->
          <div class="vt-slate-cluster">
            <div class="vt-slate-pill-group">
              <button type="button" class="vt-slate-btn icon-only" id="vtSlatePrevPage" title="Trang trước">${ICONS.chevLeft}</button>
              <button type="button" class="vt-slate-btn" id="vtSlatePageMenuBtn" title="Tùy chọn thêm, nhân bản hoặc xóa trang">
                <span id="vtSlatePageLabel">Trang 1 / 1</span>${ICONS.chevDown}
              </button>
              <button type="button" class="vt-slate-btn icon-only" id="vtSlateNextPage" title="Trang sau">${ICONS.chevRight}</button>
            </div>
          </div>

          <!-- 4. Chèn PDF/Ảnh · Dụng cụ · Mặt giấy -->
          <div class="vt-slate-cluster">
            <button type="button" class="vt-slate-btn" id="vtSlateInsertDocBtn" title="Chèn đề PDF hoặc Ảnh từ máy tính hay Kho Chòm sao">
              ${ICONS.filePlus}<span class="vt-slate-btn-lbl-lg">Chèn PDF / Ảnh</span>
            </button>
            <button type="button" class="vt-slate-btn" id="vtSlateToolsBtn" title="Thước thẳng, Compa, Thước đo độ và Ê-ke">
              ${ICONS.compass}<span class="vt-slate-btn-lbl-lg">Dụng cụ</span>${ICONS.chevDown}
            </button>
            <button type="button" class="vt-slate-btn" id="vtSlatePaperBtn" title="Chọn khổ giấy, 6 mẫu giấy và dòng kẻ">
              ${ICONS.grid}<span class="vt-slate-btn-lbl-lg">Mặt giấy</span>${ICONS.chevDown}
            </button>
          </div>

          <!-- 5. Undo/Redo · Zoom [- 100% +] & Vừa khung -->
          <div class="vt-slate-cluster">
            <button type="button" class="vt-slate-btn icon-only" id="vtSlateUndoBtn" title="Hoàn tác (Ctrl+Z)" disabled>${ICONS.undo}</button>
            <button type="button" class="vt-slate-btn icon-only" id="vtSlateRedoBtn" title="Làm lại (Ctrl+Y)" disabled>${ICONS.redo}</button>
            <div class="vt-slate-pill-group">
              <button type="button" class="vt-slate-btn icon-only" id="vtSlateZoomOutBtn" title="Thu nhỏ">${ICONS.minus}</button>
              <span class="vt-slate-zoom-val" id="vtSlateZoomBtn" title="Bấm để đặt về 100%">100%</span>
              <button type="button" class="vt-slate-btn icon-only" id="vtSlateZoomInBtn" title="Phóng to">${ICONS.plus}</button>
            </div>
            <button type="button" class="vt-slate-btn" id="vtSlateFitBtn" title="Căn tờ giấy vừa khít màn hình">
              ${ICONS.fit}<span class="vt-slate-btn-lbl-lg">Vừa khung</span>
            </button>
          </div>

          <!-- 6. Toàn màn hình tương tác -->
          <div class="vt-slate-cluster">
            <button type="button" class="vt-slate-btn icon-only" id="vtSlateFsBtn" title="Chế độ Toàn màn hình tương tác">
              ${ICONS.fullscreen}
            </button>
          </div>

          <!-- 7. Nút Lưu & Xuất duy nhất -->
          <div class="vt-slate-cluster">
            <button type="button" class="vt-slate-btn primary" id="vtSlateSaveMenuBtn" title="Lưu lên Thư mục Đám mây, xuất PDF hoặc giao bài">
              ${ICONS.save}<span class="vt-slate-btn-lbl-md">Lưu & Xuất</span>${ICONS.chevDown}
            </button>
          </div>
        </div>

        <div class="vt-slate-body">
          <div class="vt-slate-refdoc" id="vtSlateRefDoc">
            <div class="vt-slate-refdoc-head">
              <span id="vtSlateRefDocTitle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Tài liệu đối chiếu</span>
              <button type="button" class="vt-slate-btn icon-only" id="vtSlateRefDocClose" title="Đóng tài liệu đối chiếu" style="height:26px;width:26px;">${ICONS.close}</button>
            </div>
            <iframe id="vtSlateRefDocFrame" title="Tài liệu học tập"></iframe>
          </div>

          <div class="vt-slate-stage" id="vtSlateStage">
            <canvas class="vt-slate-layer" id="vtSlateCommittedLayer"></canvas>
            <canvas class="vt-slate-layer" id="vtSlateActiveLayer"></canvas>

            <!-- Left Compact Ink Dock (100% Thin-Stroke SVG Icons) -->
            <div class="vt-slate-dock" id="vtSlateDock">
              <button type="button" class="vt-slate-tool-btn active" data-sl-tool="fountain" title="Bút máy thanh-đậm">${ICONS.fountain}</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="ballpoint" title="Bút bi kỹ thuật">${ICONS.ballpoint}</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="highlighter" title="Bút dạ quang nằm dưới nét mực">${ICONS.highlighter}</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="dashed" title="Bút nét đứt hình học">${ICONS.dashed}</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="laser" title="Bút Laser thuyết trình tự tan">${ICONS.laser}</button>
              <div class="vt-slate-sep"></div>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="select" title="Chọn, di chuyển & phóng to ảnh / hình">${ICONS.select}</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="eraser_stroke" title="Tẩy cả nét">${ICONS.eraser}</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="eraser_region" title="Tẩy từng đoạn nét">${ICONS.eraserPart}</button>
              <button type="button" class="vt-slate-tool-btn" data-sl-tool="pan" title="Di chuyển bàn làm việc (hoặc giữ Space)">${ICONS.hand}</button>
              <div class="vt-slate-sep"></div>
              <button type="button" class="vt-slate-tool-btn smart-on" id="vtSlateSmartShapeBtn" title="Giữ yên bút cuối nét để tự nắn hình học">${ICONS.spark}</button>
              <button type="button" class="vt-slate-tool-btn" id="vtSlatePalmBtn" title="Khóa chống chạm lòng bàn tay">${ICONS.palm}</button>
              <div class="vt-slate-sep"></div>
              <div class="vt-slate-swatch-grid">${swatchesHtml}</div>
              <input type="color" class="vt-slate-color-inp" id="vtSlateCustomColor" value="${state.color}" title="Chọn màu mực tùy ý">
              <div class="vt-slate-sep"></div>
              <div class="vt-slate-size-dot" id="vtSlateSizeDot" style="width:8px;height:8px;background:${state.color};"></div>
              <input type="range" id="vtSlateSizeSlider" min="1" max="24" value="${state.width}" style="width:38px;accent-color:#2563EB;" title="Điều chỉnh cỡ nét mực">
            </div>

            <!-- Smart-Positioned Floating Selection Bar -->
            <div class="vt-slate-selbar" id="vtSlateSelBar">
              <button type="button" class="vt-slate-btn" id="vtSlateSelLockBtn" title="Khóa hoặc mở khóa cố định trên nền">${ICONS.unlock}<span>Khóa nền</span></button>
              <button type="button" class="vt-slate-btn" id="vtSlateSelDupBtn" title="Nhân bản đối tượng đang chọn">${ICONS.copy}<span>Nhân bản</span></button>
              <button type="button" class="vt-slate-btn" id="vtSlateSelDelBtn" style="color:#DC2626;" title="Xóa đối tượng đang chọn">${ICONS.trash}<span>Xóa</span></button>
            </div>

            <!-- Floating Exit Fullscreen Button -->
            <button type="button" class="vt-slate-btn primary vt-slate-exit-fs" id="vtSlateExitFsBtn" title="Thoát chế độ Toàn màn hình (Esc)">
              ${ICONS.exitFullscreen}<span>Thoát toàn màn hình</span>
            </button>
          </div>
        </div>

        <!-- Menu Quản Lý Trang -->
        <div class="vt-slate-menu" id="vtSlatePageMenu" style="right:auto;left:34%;">
          <button type="button" class="vt-slate-menu-item" id="vtSlateAddPage">${ICONS.plus}<span>Thêm trang mới</span></button>
          <button type="button" class="vt-slate-menu-item" id="vtSlateDupPage">${ICONS.copy}<span>Nhân bản trang này</span></button>
          <button type="button" class="vt-slate-menu-item danger" id="vtSlateDelPage">${ICONS.trash}<span>Xóa trang hiện tại</span></button>
        </div>

        <!-- Menu Lưu & Xuất -->
        <div class="vt-slate-menu" id="vtSlateSaveMenu">
          <button type="button" class="vt-slate-menu-item" id="vtSlateSaveCloudMenuBtn">${ICONS.cloudUp}<span>Lưu vào Thư mục trên Đám mây...</span></button>
          <button type="button" class="vt-slate-menu-item" id="vtSlateExportPdfBtn">${ICONS.download}<span>Tải tệp PDF nhiều trang về máy</span></button>
          <button type="button" class="vt-slate-menu-item" id="vtSlatePublishBtn" style="display:none;color:#2563EB;">${ICONS.send}<span>Giao lên Kho Chòm sao cho Lớp</span></button>
        </div>

        <!-- Popover Mặt Giấy & Khổ Giấy -->
        <div class="vt-slate-popover" id="vtSlatePaperPopover">
          <div style="font-size:13px;font-weight:800;">Khổ trang giấy</div>
          <div class="vt-slate-format-grid">${formatsHtml}</div>
          <div style="font-size:13px;font-weight:800;margin-top:2px;">Mẫu mặt giấy & Dòng kẻ</div>
          <div class="vt-slate-preset-grid">${presetsHtml}</div>
          <div id="vtSlateChalkRow" style="display:none;gap:6px;align-items:center;">
            <span style="font-size:12px;font-weight:700;opacity:0.75;">Tông bảng tối:</span>
            <button type="button" class="vt-slate-btn" data-sl-chalk="slate" style="height:26px;font-size:11px;">Xanh đen</button>
            <button type="button" class="vt-slate-btn" data-sl-chalk="green" style="height:26px;font-size:11px;">Xanh lục</button>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px;">
              <span>Khoảng cách ô ly / dòng kẻ</span><span id="vtSlateSpacingVal">28px</span>
            </div>
            <input type="range" id="vtSlateSpacingSlider" min="16" max="48" value="28" style="width:100%;accent-color:#2563EB;">
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px;">
              <span>Độ đậm đường kẻ</span><span id="vtSlateOpacityVal">22%</span>
            </div>
            <input type="range" id="vtSlateOpacitySlider" min="10" max="60" value="22" style="width:100%;accent-color:#2563EB;">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:12px;font-weight:700;">Màu đường kẻ</span>
            <div style="display:flex;gap:7px;">${rulingColsHtml}</div>
          </div>
          <button type="button" class="vt-slate-btn active" id="vtSlateApplyAllPages" style="width:100%;justify-content:center;">Áp dụng cho toàn bộ các trang</button>
        </div>

        <!-- Popover Bộ Dụng Cụ Toán Học -->
        <div class="vt-slate-popover" id="vtSlateToolsPopover" style="width:min(300px,90vw);">
          <div style="font-size:13px;font-weight:800;">Dụng cụ dựng hình toán học</div>
          <div style="font-size:11.5px;opacity:0.74;line-height:1.45;">
            Kéo thân thước để di chuyển, kéo chấm tròn xanh để xoay góc. Đưa bút lại gần mép thước hoặc ê-ke để tự kẻ thẳng.
          </div>
          <div class="vt-slate-preset-grid">
            <button type="button" class="vt-slate-preset-btn" data-sl-inst="ruler">${ICONS.ruler}<span>Thước thẳng</span></button>
            <button type="button" class="vt-slate-preset-btn" data-sl-inst="compass">${ICONS.compass}<span>Compa</span></button>
            <button type="button" class="vt-slate-preset-btn" data-sl-inst="protractor">${ICONS.protractor}<span>Thước đo độ</span></button>
            <button type="button" class="vt-slate-preset-btn" data-sl-inst="setsquare">${ICONS.setsquare}<span>Ê-ke vuông</span></button>
          </div>
          <button type="button" class="vt-slate-btn" id="vtSlateHideAllInst" style="width:100%;justify-content:center;">Ẩn toàn bộ dụng cụ</button>
        </div>

        <!-- Ngăn kéo Thư mục & Tệp (0ms Local + Cloud Grouped by Folder) -->
        <div class="vt-slate-drawer" id="vtSlateCloudDrawer">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:14.5px;font-weight:800;display:flex;align-items:center;gap:7px;">${ICONS.folder}<span>Thư mục & Tệp bảng giảng</span></div>
            <button type="button" class="vt-slate-btn icon-only" id="vtSlateCloudClose" title="Đóng ngăn kéo" style="height:26px;width:26px;">${ICONS.close}</button>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="vt-slate-btn active" id="vtSlateNewBtn" style="flex:1;">${ICONS.plus}<span>Tạo bảng mới</span></button>
            <button type="button" class="vt-slate-btn" id="vtSlateRefreshCloudBtn" title="Làm mới danh sách Đám mây">${ICONS.refresh}<span>Làm mới</span></button>
          </div>
          <div id="vtSlateCloudStatusBar" style="font-size:11.5px;opacity:0.75;display:flex;align-items:center;justify-content:space-between;"></div>
          <div id="vtSlateCloudList" style="display:flex;flex-direction:column;gap:9px;"></div>
        </div>

        <!-- Modal Lưu vào Thư mục trên Đám mây -->
        <div class="vt-slate-modal-backdrop" id="vtSlateSaveFolderBackdrop">
          <div class="vt-slate-modal">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px;">${ICONS.cloudUp}<span>Lưu vào Thư mục trên Đám mây</span></div>
              <button type="button" class="vt-slate-btn icon-only" id="vtSlateSaveFolderClose" style="height:28px;width:28px;">${ICONS.close}</button>
            </div>
            <div class="vt-slate-field">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <label for="vtSlateFolderSelect">Chọn thư mục lưu trữ</label>
                <button type="button" class="vt-slate-btn" id="vtSlateToggleNewFolderBtn" style="height:25px;font-size:11.5px;">${ICONS.plus}<span>Tạo thư mục mới</span></button>
              </div>
              <select class="vt-slate-select" id="vtSlateFolderSelect"></select>
              <input type="text" class="vt-slate-input" id="vtSlateNewFolderInp" placeholder="Nhập tên thư mục mới (VD: Toán 12 - Hàm số)..." style="display:none;margin-top:6px;">
            </div>
            <div class="vt-slate-field">
              <label for="vtSlateSaveFileNameInp">Tên tệp bảng giảng (bắt buộc)</label>
              <input type="text" class="vt-slate-input" id="vtSlateSaveFileNameInp" placeholder="Ví dụ: Bài giảng Cực trị Hàm số - Tiết 2">
            </div>
            <div id="vtSlateSaveProgressWrap" style="display:none;flex-direction:column;gap:6px;">
              <div id="vtSlateSaveProgressText" style="font-size:12.5px;font-weight:700;color:#2563EB;">Đang đồng bộ lên Đám mây...</div>
              <div class="vt-slate-progress-bar"><div class="vt-slate-progress-fill" id="vtSlateSaveProgressFill"></div></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" class="vt-slate-btn" id="vtSlateSaveFolderCancel">Hủy bỏ</button>
              <button type="button" class="vt-slate-btn primary" id="vtSlateSaveFolderSubmit">${ICONS.save}<span>Xác nhận Lưu</span></button>
            </div>
          </div>
        </div>

        <!-- Modal Chèn Đề PDF / Ảnh -->
        <div class="vt-slate-modal-backdrop" id="vtSlateInsertBackdrop">
          <div class="vt-slate-modal">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px;">${ICONS.filePlus}<span>Chèn Đề PDF hoặc Ảnh lên trang</span></div>
              <button type="button" class="vt-slate-btn icon-only" id="vtSlateInsertClose" style="height:28px;width:28px;">${ICONS.close}</button>
            </div>
            <div class="vt-slate-dropzone" id="vtSlateDropzone">
              <div style="margin-bottom:6px;display:flex;justify-content:center;">${ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', 28)}</div>
              <div style="font-size:14px;font-weight:800;margin-bottom:4px;">Kéo thả tệp PDF hoặc Ảnh (.png, .jpg) vào đây</div>
              <div style="font-size:12px;opacity:0.72;">Hoặc bấm để chọn từ máy tính / iPad. Mỗi trang PDF sẽ tự dàn thành một trang bảng kèm vùng trống viết lời giải.</div>
              <input type="file" id="vtSlateFileInput" accept=".pdf,image/png,image/jpeg,image/webp" style="display:none;">
            </div>
            <div id="vtSlateInsertProgressWrap" style="display:none;flex-direction:column;gap:6px;">
              <div id="vtSlateInsertProgressText" style="font-size:12.5px;font-weight:700;color:#2563EB;">Đang xử lý tài liệu...</div>
              <div class="vt-slate-progress-bar"><div class="vt-slate-progress-fill" id="vtSlateInsertProgressFill"></div></div>
            </div>
            <div style="border-top:1px solid rgba(148,163,184,0.25);padding-top:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:12.5px;font-weight:700;">Hoặc dán liên kết tệp Google Drive</div>
              <div style="display:flex;gap:8px;">
                <input type="text" class="vt-slate-input" id="vtSlateDriveLinkInp" placeholder="Dán liên kết chia sẻ tệp PDF hoặc ảnh...">
                <button type="button" class="vt-slate-btn active" id="vtSlateDriveImportBtn" style="height:38px;padding:0 14px;">Chèn ngay</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Giao Bài Giải lên Kho Chòm sao (Chỉ Admin & GVBM) -->
        <div class="vt-slate-modal-backdrop" id="vtSlatePublishBackdrop">
          <div class="vt-slate-modal">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px;">${ICONS.send}<span>Giao Bài Giải lên Kho Chòm sao</span></div>
              <button type="button" class="vt-slate-btn icon-only" id="vtSlatePublishClose" style="height:28px;width:28px;">${ICONS.close}</button>
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
                <button type="button" class="vt-slate-btn" id="vtSlateSelectAllClassesBtn" style="height:26px;font-size:11.5px;">Chọn tất cả lớp của tôi</button>
              </div>
              <div class="vt-slate-class-grid" id="vtSlatePubClassGrid"></div>
            </div>
            <div id="vtSlatePubProgressWrap" style="display:none;flex-direction:column;gap:6px;">
              <div id="vtSlatePubProgressText" style="font-size:12.5px;font-weight:700;color:#2563EB;">Đang đóng gói bản giải...</div>
              <div class="vt-slate-progress-bar"><div class="vt-slate-progress-fill" id="vtSlatePubProgressFill"></div></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
              <button type="button" class="vt-slate-btn" id="vtSlatePubCancelBtn">Hủy bỏ</button>
              <button type="button" class="vt-slate-btn primary" id="vtSlatePubSubmitBtn">${ICONS.send}<span>Xác nhận Lưu & Giao bài</span></button>
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

  function closeAllMenus() {
    ['vtSlatePageMenu', 'vtSlateSaveMenu', 'vtSlatePaperPopover', 'vtSlateToolsPopover'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });
  }

  function syncRolePermissionsUI() {
    const pubBtn = document.getElementById('vtSlatePublishBtn');
    if (pubBtn) pubBtn.style.display = canPublishToConstellation() ? 'flex' : 'none';
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

  /* ==========================================================================
   * 5. ZOOM, FIT-TO-VIEWPORT & INTERACTIVE FULLSCREEN
   * ========================================================================== */

  function fitPageToViewport() {
    if (!state.stageWidth || !state.stageHeight) return;
    const dims = getPageDims(getCurrentPage());
    const padX = 84;
    const padY = 44;
    const availW = Math.max(200, state.stageWidth - padX);
    const availH = Math.max(200, state.stageHeight - padY);
    const fitZoom = Math.max(0.4, Math.min(2.2, Math.min(availW / dims.w, availH / dims.h)));
    state.zoom = Math.round(fitZoom * 100) / 100;
    state.panX = Math.round((state.stageWidth - dims.w * state.zoom) / 2);
    state.panY = Math.round((state.stageHeight - dims.h * state.zoom) / 2);
    syncZoomBtn();
    renderCommittedLayer();
    scheduleActiveRender();
    positionSelectionBar();
  }

  function zoomAroundCenter(targetZoom, clientX, clientY) {
    const clamped = Math.max(0.4, Math.min(3.0, Math.round(targetZoom * 100) / 100));
    if (!committedCanvas) return;
    const rect = committedCanvas.getBoundingClientRect();
    const mx = clientX != null ? (clientX - rect.left) : state.stageWidth / 2;
    const my = clientY != null ? (clientY - rect.top) : state.stageHeight / 2;
    const wx = (mx - state.panX) / state.zoom;
    const wy = (my - state.panY) / state.zoom;
    state.zoom = clamped;
    state.panX = mx - wx * state.zoom;
    state.panY = my - wy * state.zoom;
    syncZoomBtn();
    renderCommittedLayer();
    scheduleActiveRender();
    positionSelectionBar();
  }

  function setFullscreenMode(enable) {
    const root = document.getElementById('vtSlateRoot');
    if (!root) return;
    state.isFullscreen = Boolean(enable);
    root.classList.toggle('is-fullscreen', state.isFullscreen);

    const fsBtn = document.getElementById('vtSlateFsBtn');
    if (fsBtn) {
      fsBtn.innerHTML = state.isFullscreen ? ICONS.exitFullscreen : ICONS.fullscreen;
      fsBtn.title = state.isFullscreen ? 'Thoát chế độ Toàn màn hình (Esc)' : 'Chế độ Toàn màn hình tương tác';
    }

    if (state.isFullscreen) {
      if (root.requestFullscreen && !document.fullscreenElement) {
        root.requestFullscreen().catch(function () {});
      }
    } else if (document.fullscreenElement === root && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }

    setTimeout(function () {
      resizeSlateLayers();
      fitPageToViewport();
    }, 60);
  }

  /* ==========================================================================
   * 6. UI EVENTS WIRING
   * ========================================================================== */

  function wireUiEvents() {
    document.getElementById('vtSlateTitleInp').addEventListener('input', function (e) {
      state.title = e.target.value.trim() || 'Bảng Giảng Thiên Văn';
      renderCommittedLayer();
      scheduleLocalAutoSave();
    });

    // Menus
    document.getElementById('vtSlatePageMenuBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      const menu = document.getElementById('vtSlatePageMenu');
      const willOpen = !menu.classList.contains('open');
      closeAllMenus();
      if (willOpen) menu.classList.add('open');
    });
    document.getElementById('vtSlateSaveMenuBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      const menu = document.getElementById('vtSlateSaveMenu');
      const willOpen = !menu.classList.contains('open');
      closeAllMenus();
      syncRolePermissionsUI();
      if (willOpen) menu.classList.add('open');
    });
    document.getElementById('vtSlatePaperBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      const pop = document.getElementById('vtSlatePaperPopover');
      const willOpen = !pop.classList.contains('open');
      closeAllMenus();
      if (willOpen) { pop.classList.add('open'); syncPaperControlsUI(); }
    });
    document.getElementById('vtSlateToolsBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      const pop = document.getElementById('vtSlateToolsPopover');
      const willOpen = !pop.classList.contains('open');
      closeAllMenus();
      if (willOpen) { pop.classList.add('open'); syncInstrumentsPopoverUI(); }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.vt-slate-menu') && !e.target.closest('.vt-slate-popover') && !e.target.closest('.vt-slate-topbar')) {
        closeAllMenus();
      }
    });

    // Page navigation & actions
    document.getElementById('vtSlatePrevPage').addEventListener('click', function () {
      if (state.activePageIndex > 0) switchToPage(state.activePageIndex - 1);
    });
    document.getElementById('vtSlateNextPage').addEventListener('click', function () {
      if (state.activePageIndex < state.pages.length - 1) switchToPage(state.activePageIndex + 1);
    });
    document.getElementById('vtSlateAddPage').addEventListener('click', function () {
      closeAllMenus();
      const cur = getCurrentPage();
      state.pages.splice(state.activePageIndex + 1, 0, createBlankPage(cur.paperConfig));
      switchToPage(state.activePageIndex + 1);
      scheduleLocalAutoSave();
      notify('Đã thêm trang mới.', 'success');
    });
    document.getElementById('vtSlateDupPage').addEventListener('click', function () {
      closeAllMenus();
      const cur = getCurrentPage();
      const copy = JSON.parse(JSON.stringify(cur));
      copy.id = makeId('pg');
      state.pages.splice(state.activePageIndex + 1, 0, copy);
      switchToPage(state.activePageIndex + 1);
      scheduleLocalAutoSave();
      notify('Đã nhân bản trang hiện tại.', 'success');
    });
    document.getElementById('vtSlateDelPage').addEventListener('click', async function () {
      closeAllMenus();
      if (state.pages.length <= 1) { notify('Bảng giảng cần giữ tối thiểu 1 trang.', 'warning'); return; }
      const C = getCore();
      const ok = C && C.ui ? await C.ui.confirm({ title: 'Xóa trang bảng giảng', message: 'Bạn có chắc chắn muốn xóa trang hiện tại không?', confirmText: 'Xóa trang', danger: true }) : true;
      if (!ok) return;
      state.pages.splice(state.activePageIndex, 1);
      if (state.activePageIndex >= state.pages.length) state.activePageIndex = state.pages.length - 1;
      switchToPage(state.activePageIndex);
      scheduleLocalAutoSave();
      notify('Đã xóa trang.', 'success');
    });

    // Paper formats & presets
    const paperPop = document.getElementById('vtSlatePaperPopover');
    paperPop.querySelectorAll('[data-sl-format]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pushUndo();
        getCurrentPage().paperConfig.format = btn.getAttribute('data-sl-format');
        syncPaperControlsUI();
        fitPageToViewport();
        scheduleLocalAutoSave();
      });
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
            notify('Đã tự động chuyển màu mực sáng cho nền bảng tối.', 'info');
          }
          page.paperConfig.lineColor = '#E2E8F0';
        } else if (state.color === '#F8FAFC') {
          setInkColor('#0F172A');
        }
        syncPaperControlsUI();
        renderCommittedLayer();
        scheduleLocalAutoSave();
      });
    });
    paperPop.querySelectorAll('[data-sl-chalk]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pushUndo();
        getCurrentPage().paperConfig.chalkVariant = btn.getAttribute('data-sl-chalk');
        syncPaperControlsUI();
        renderCommittedLayer();
        scheduleLocalAutoSave();
      });
    });
    document.getElementById('vtSlateSpacingSlider').addEventListener('input', function (e) {
      const val = Number(e.target.value);
      getCurrentPage().paperConfig.spacing = val;
      document.getElementById('vtSlateSpacingVal').textContent = val + 'px';
      renderCommittedLayer();
      scheduleLocalAutoSave();
    });
    document.getElementById('vtSlateOpacitySlider').addEventListener('input', function (e) {
      const val = Number(e.target.value);
      getCurrentPage().paperConfig.lineOpacity = val / 100;
      document.getElementById('vtSlateOpacityVal').textContent = val + '%';
      renderCommittedLayer();
      scheduleLocalAutoSave();
    });
    paperPop.querySelectorAll('[data-sl-rcolor]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        getCurrentPage().paperConfig.lineColor = btn.getAttribute('data-sl-rcolor');
        syncPaperControlsUI();
        renderCommittedLayer();
        scheduleLocalAutoSave();
      });
    });
    document.getElementById('vtSlateApplyAllPages').addEventListener('click', function () {
      const curCfg = JSON.parse(JSON.stringify(getCurrentPage().paperConfig));
      state.pages.forEach(function (p) { p.paperConfig = JSON.parse(JSON.stringify(curCfg)); });
      renderCommittedLayer();
      scheduleLocalAutoSave();
      closeAllMenus();
      notify('Đã áp dụng khổ giấy và dòng kẻ cho toàn bộ ' + state.pages.length + ' trang.', 'success');
    });

    // Instruments
    const toolsPop = document.getElementById('vtSlateToolsPopover');
    toolsPop.querySelectorAll('[data-sl-inst]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-sl-inst');
        const inst = state.instruments[key];
        if (!inst) return;
        inst.visible = !inst.visible;
        if (inst.visible) {
          const dims = getPageDims(getCurrentPage());
          const cx = dims.w / 2, cy = dims.h / 2;
          if (key === 'ruler') { inst.x = cx; inst.y = cy; }
          else if (key === 'compass' || key === 'protractor') { inst.cx = cx; inst.cy = cy; }
          else if (key === 'setsquare') { inst.x = cx - 100; inst.y = cy + 60; }
        }
        syncInstrumentsPopoverUI();
        scheduleActiveRender();
      });
    });
    document.getElementById('vtSlateHideAllInst').addEventListener('click', function () {
      Object.keys(state.instruments).forEach(function (k) { state.instruments[k].visible = false; });
      syncInstrumentsPopoverUI();
      scheduleActiveRender();
      closeAllMenus();
    });

    // Undo / Redo / Zoom / Fit / Fullscreen
    document.getElementById('vtSlateUndoBtn').addEventListener('click', performUndo);
    document.getElementById('vtSlateRedoBtn').addEventListener('click', performRedo);
    document.getElementById('vtSlateZoomOutBtn').addEventListener('click', function () { zoomAroundCenter(state.zoom - 0.15); });
    document.getElementById('vtSlateZoomInBtn').addEventListener('click', function () { zoomAroundCenter(state.zoom + 0.15); });
    document.getElementById('vtSlateZoomBtn').addEventListener('click', function () { zoomAroundCenter(1.0); });
    document.getElementById('vtSlateFitBtn').addEventListener('click', fitPageToViewport);
    document.getElementById('vtSlateFsBtn').addEventListener('click', function () { setFullscreenMode(!state.isFullscreen); });
    document.getElementById('vtSlateExitFsBtn').addEventListener('click', function () { setFullscreenMode(false); });
    document.addEventListener('fullscreenchange', function () {
      const root = document.getElementById('vtSlateRoot');
      if (!document.fullscreenElement && state.isFullscreen && root && !root.classList.contains('is-fullscreen')) {
        setFullscreenMode(false);
      }
    });

    // Folder & Files Drawer (0ms local + background cloud)
    document.getElementById('vtSlateDriveBtn').addEventListener('click', toggleCloudDrawer);
    document.getElementById('vtSlateCloudClose').addEventListener('click', function () {
      state.cloudDrawerOpen = false;
      document.getElementById('vtSlateCloudDrawer').classList.remove('open');
    });
    document.getElementById('vtSlateRefreshCloudBtn').addEventListener('click', fetchCloudBoardsBackground);
    document.getElementById('vtSlateNewBtn').addEventListener('click', function () {
      state.boardId = 'slate_' + Date.now().toString(36);
      state.driveFileId = '';
      state.pdfDriveFileId = '';
      state.title = 'Bảng Giảng Thiên Văn';
      state.folderName = DEFAULT_FOLDER;
      state.pages = [createBlankPage()];
      state.activePageIndex = 0;
      state.selectedItem = null;
      syncSelectionBar();
      syncPageHeaderUI();
      syncPaperControlsUI();
      fitPageToViewport();
      saveLocalDraftNow();
      state.cloudDrawerOpen = false;
      document.getElementById('vtSlateCloudDrawer').classList.remove('open');
      notify('Đã mở phiên bảng giảng mới.', 'success');
    });

    // Save-to-Folder Modal
    document.getElementById('vtSlateSaveCloudMenuBtn').addEventListener('click', function () {
      closeAllMenus();
      openSaveFolderModal();
    });
    document.getElementById('vtSlateSaveFolderClose').addEventListener('click', closeSaveFolderModal);
    document.getElementById('vtSlateSaveFolderCancel').addEventListener('click', closeSaveFolderModal);
    document.getElementById('vtSlateSaveFolderBackdrop').addEventListener('click', function (e) {
      if (e.target.id === 'vtSlateSaveFolderBackdrop') closeSaveFolderModal();
    });
    document.getElementById('vtSlateToggleNewFolderBtn').addEventListener('click', function () {
      const inp = document.getElementById('vtSlateNewFolderInp');
      const showing = inp.style.display !== 'none';
      inp.style.display = showing ? 'none' : 'block';
      if (!showing) inp.focus();
    });
    document.getElementById('vtSlateSaveFolderSubmit').addEventListener('click', submitSaveToCloudFolder);

    // Dock tools
    document.querySelectorAll('#vtSlateDock [data-sl-tool]').forEach(function (btn) {
      btn.addEventListener('click', function () { setActiveTool(btn.getAttribute('data-sl-tool')); });
    });
    document.querySelectorAll('#vtSlateDock [data-sl-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setInkColor(btn.getAttribute('data-sl-color'));
        if (state.tool === 'eraser_stroke' || state.tool === 'eraser_region' || state.tool === 'pan' || state.tool === 'select') {
          setActiveTool('fountain');
        }
      });
    });
    document.getElementById('vtSlateCustomColor').addEventListener('input', function (e) { setInkColor(e.target.value); });
    document.getElementById('vtSlateSizeSlider').addEventListener('input', function (e) { state.width = Number(e.target.value); syncSizeDot(); });
    document.getElementById('vtSlateSmartShapeBtn').addEventListener('click', function () {
      state.smartShapeEnabled = !state.smartShapeEnabled;
      document.getElementById('vtSlateSmartShapeBtn').classList.toggle('smart-on', state.smartShapeEnabled);
      notify(state.smartShapeEnabled ? 'Đã bật Tự nắn hình học khi giữ yên đầu bút.' : 'Đã tắt Tự nắn hình học.', 'info');
    });
    document.getElementById('vtSlatePalmBtn').addEventListener('click', function () {
      state.palmRejection = !state.palmRejection;
      document.getElementById('vtSlatePalmBtn').classList.toggle('palm-on', state.palmRejection);
      notify(state.palmRejection ? 'Đã bật Khóa chạm lòng bàn tay.' : 'Đã tắt Khóa chạm lòng bàn tay.', 'info');
    });

    // Selection bar
    document.getElementById('vtSlateSelLockBtn').addEventListener('click', function () {
      const obj = getSelectedObject();
      if (!obj) return;
      pushUndo();
      obj.locked = !obj.locked;
      syncSelectionBar();
      renderCommittedLayer();
      scheduleActiveRender();
      scheduleLocalAutoSave();
      notify(obj.locked ? 'Đã khóa cố định đối tượng trên nền.' : 'Đã mở khóa di chuyển đối tượng.', 'info');
    });
    document.getElementById('vtSlateSelDupBtn').addEventListener('click', function () {
      const obj = getSelectedObject();
      if (!obj || !state.selectedItem) return;
      pushUndo();
      const page = getCurrentPage();
      const copy = JSON.parse(JSON.stringify(obj));
      const newId = makeId(state.selectedItem.kind === 'image' ? 'img' : 'shp');
      if (state.selectedItem.kind === 'image' && imageBinaryStore.has(obj.id)) {
        imageBinaryStore.set(newId, imageBinaryStore.get(obj.id));
        persistImageBinaryAsync(newId, imageBinaryStore.get(obj.id));
      }
      copy.id = newId;
      copy.locked = false;
      offsetObject(copy, state.selectedItem.kind, 24, 24);
      if (state.selectedItem.kind === 'image') page.images.push(copy);
      else page.shapes.push(copy);
      state.selectedItem = { kind: state.selectedItem.kind, id: newId };
      syncSelectionBar();
      renderCommittedLayer();
      scheduleActiveRender();
      scheduleLocalAutoSave();
    });
    document.getElementById('vtSlateSelDelBtn').addEventListener('click', deleteSelectedObject);

    // Reference Doc close
    document.getElementById('vtSlateRefDocClose').addEventListener('click', function () {
      state.refDoc = null;
      document.getElementById('vtSlateRefDoc').classList.remove('open');
      setTimeout(resizeSlateLayers, 40);
    });

    // Insert PDF / Image Modal & Drag-Drop
    const insertBackdrop = document.getElementById('vtSlateInsertBackdrop');
    const dropzone = document.getElementById('vtSlateDropzone');
    const fileInput = document.getElementById('vtSlateFileInput');
    const stageEl = document.getElementById('vtSlateStage');

    document.getElementById('vtSlateInsertDocBtn').addEventListener('click', function () {
      closeAllMenus();
      insertBackdrop.classList.add('open');
    });
    document.getElementById('vtSlateInsertClose').addEventListener('click', function () { insertBackdrop.classList.remove('open'); });
    insertBackdrop.addEventListener('click', function (e) { if (e.target === insertBackdrop) insertBackdrop.classList.remove('open'); });
    dropzone.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) handleLocalFileImport(f);
    });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('over'); });
    dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('over'); });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleLocalFileImport(f);
    });
    stageEl.addEventListener('dragover', function (e) {
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') >= 0) {
        e.preventDefault();
        stageEl.classList.add('is-dragover');
      }
    });
    stageEl.addEventListener('dragleave', function () { stageEl.classList.remove('is-dragover'); });
    stageEl.addEventListener('drop', function (e) {
      stageEl.classList.remove('is-dragover');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { e.preventDefault(); handleLocalFileImport(f); }
    });
    document.getElementById('vtSlateDriveImportBtn').addEventListener('click', function () {
      const raw = document.getElementById('vtSlateDriveLinkInp').value.trim();
      if (!raw) { notify('Vui lòng dán liên kết tệp Google Drive.', 'warning'); return; }
      const C = getCore();
      const fid = C && C.drive ? C.drive.parseDriveLink(raw) : '';
      if (!fid) { notify('Liên kết Google Drive chưa hợp lệ.', 'warning'); return; }
      insertBackdrop.classList.remove('open');
      openDocumentOnBoard({ fileId: fid, title: 'Đề bài từ Google Drive', previewUrl: 'https://drive.google.com/file/d/' + fid + '/preview' });
    });

    // Export PDF & Publish to Constellation
    document.getElementById('vtSlateExportPdfBtn').addEventListener('click', function () {
      closeAllMenus();
      downloadBoardAsPdf();
    });
    document.getElementById('vtSlatePublishBtn').addEventListener('click', function () {
      closeAllMenus();
      openPublishModal();
    });
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
      if (e.key === 'Escape' && state.isFullscreen) {
        setFullscreenMode(false);
        return;
      }
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault(); performUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault(); performRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedItem) {
        e.preventDefault(); deleteSelectedObject();
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
      scheduleActiveRender();
    }
    document.querySelectorAll('#vtSlateDock [data-sl-tool]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-sl-tool') === toolId);
    });
    const stg = document.getElementById('vtSlateStage');
    if (stg) {
      stg.style.cursor = '';
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
    const d = Math.max(4, Math.min(18, state.width + 2));
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
    pop.querySelectorAll('[data-sl-format]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-sl-format') === (cfg.format || 'A4_LANDSCAPE'));
    });
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
    const pct = Math.round((cfg.lineOpacity || 0.22) * 100);
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

  function positionSelectionBar() {
    const bar = document.getElementById('vtSlateSelBar');
    if (!bar || !state.selectedItem) return;
    const obj = getSelectedObject();
    if (!obj || !committedCanvas) { bar.classList.remove('open'); return; }
    const b = getObjectBounds(obj, state.selectedItem.kind);
    if (!b) return;
    const rect = committedCanvas.getBoundingClientRect();
    const topLeft = worldToScreen(b.x, b.y);
    const botRight = worldToScreen(b.x + b.w, b.y + b.h);
    const localCenterX = ((topLeft.x + botRight.x) / 2) - rect.left;
    const localTop = topLeft.y - rect.top;
    const localBottom = botRight.y - rect.top;

    // Flip automatically ABOVE the object if near the bottom edge so it is never clipped
    const clampedX = Math.max(135, Math.min(state.stageWidth - 135, localCenterX));
    let topPos = localBottom + 12;
    if (topPos > state.stageHeight - 54) {
      topPos = Math.max(10, localTop - 46);
    }
    bar.style.left = clampedX + 'px';
    bar.style.top = topPos + 'px';
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
    const lockBtn = document.getElementById('vtSlateSelLockBtn');
    if (lockBtn) {
      lockBtn.innerHTML = (obj.locked ? ICONS.lock : ICONS.unlock) + '<span>' + (obj.locked ? 'Mở khóa' : 'Khóa nền') + '</span>';
    }
    positionSelectionBar();
  }

  function switchToPage(idx) {
    state.activePageIndex = Math.max(0, Math.min(state.pages.length - 1, idx));
    state.selectedItem = null;
    syncSelectionBar();
    syncPageHeaderUI();
    syncPaperControlsUI();
    syncUndoRedoBtns();
    fitPageToViewport();
  }

  /* ==========================================================================
   * 7. BOUNDED PAPER SHEET RENDERER & DIRTY-FLAG 60FPS ENGINE
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

    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w === state.stageWidth && h === state.stageHeight && dpr === state.dpr) return;

    const wasEmpty = state.stageWidth === 0;
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

    if (wasEmpty) {
      fitPageToViewport();
    } else {
      renderCommittedLayer();
      scheduleActiveRender();
      positionSelectionBar();
    }
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#0F172A').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(function (c) { return c + c; }).join('') : clean;
    const n = parseInt(full, 16);
    if (isNaN(n)) return 'rgba(15,23,42,' + alpha + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function drawBoundedPaperSheet(ctx, page, pageIndex, totalPages, isExport) {
    const cfg = page.paperConfig || createDefaultPaperConfig();
    const dims = getPageDims(page);
    const W = dims.w;
    const H = dims.h;
    const isChalk = cfg.preset === 'CHALKBOARD';

    ctx.save();
    // Sheet shadow on desk (screen only)
    if (!isExport) {
      ctx.shadowColor = document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'rgba(2, 6, 23, 0.65)'
        : 'rgba(15, 23, 42, 0.16)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
    }

    let bg = '#FFFFFF';
    if (isChalk) {
      bg = cfg.chalkVariant === 'green' ? '#123326' : '#0A1122';
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Clip ruling strictly inside page sheet
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    const sp = Math.max(14, Number(cfg.spacing) || 28);
    const alpha = Math.max(0.08, Math.min(0.65, Number(cfg.lineOpacity) || 0.22));
    const strokeStyle = hexToRgba(cfg.lineColor || '#94A3B8', alpha);
    const padTop = 38;
    const padBot = 34;

    if (cfg.preset !== 'BLANK') {
      ctx.strokeStyle = strokeStyle;
      ctx.fillStyle = strokeStyle;
      ctx.lineWidth = 1;

      if (cfg.preset === 'LINED') {
        ctx.beginPath();
        for (let y = padTop; y <= H - padBot; y += sp) {
          ctx.moveTo(20, y);
          ctx.lineTo(W - 20, y);
        }
        ctx.stroke();
        ctx.strokeStyle = hexToRgba('#EF4444', Math.min(0.42, alpha + 0.12));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(76, padTop - 6);
        ctx.lineTo(76, H - padBot + 4);
        ctx.stroke();
      } else if (cfg.preset === 'GRID' || cfg.preset === 'COORD' || cfg.preset === 'CHALKBOARD') {
        ctx.beginPath();
        for (let x = sp; x < W; x += sp) {
          ctx.moveTo(x, padTop - 8);
          ctx.lineTo(x, H - padBot + 4);
        }
        for (let y = padTop; y <= H - padBot; y += sp) {
          ctx.moveTo(16, y);
          ctx.lineTo(W - 16, y);
        }
        ctx.stroke();

        if (cfg.preset === 'COORD') {
          const ox = Math.round((W / 2) / sp) * sp;
          const oy = Math.round((H / 2) / sp) * sp;
          ctx.strokeStyle = 'rgba(15,23,42,0.58)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(24, oy); ctx.lineTo(W - 24, oy);
          ctx.moveTo(ox, padTop); ctx.lineTo(ox, H - padBot);
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = '700 12px system-ui, sans-serif';
          ctx.fillText('O', ox + 6, oy + 15);
          ctx.fillText('x', W - 34, oy - 8);
          ctx.fillText('y', ox + 8, padTop + 14);
        }
      } else if (cfg.preset === 'DOT') {
        for (let x = sp; x < W; x += sp) {
          for (let y = padTop; y <= H - padBot; y += sp) {
            ctx.beginPath();
            ctx.arc(x, y, 1.35, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Crisp Page Border + Header Title (top-left) + Page Number (bottom-right)
    const metaColor = isChalk ? 'rgba(226, 232, 240, 0.56)' : 'rgba(71, 85, 105, 0.62)';
    ctx.strokeStyle = isChalk ? 'rgba(148, 163, 184, 0.28)' : 'rgba(15, 23, 42, 0.14)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(0.6, 0.6, W - 1.2, H - 1.2);

    ctx.fillStyle = metaColor;
    ctx.font = '600 11.5px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    const headerTitle = String(state.title || 'Bảng Giảng Thiên Văn').slice(0, 62);
    ctx.fillText(headerTitle, 22, 22);

    ctx.textAlign = 'right';
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    ctx.fillText('Trang ' + (pageIndex + 1) + ' / ' + totalPages, W - 22, H - 14);
    ctx.textAlign = 'left';

    ctx.restore();
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
        const p0 = pts[i - 1], p1 = pts[i];
        const midX = (p0.x + p1.x) / 2, midY = (p0.y + p1.y) / 2;
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
    if (shp.kind === 'line') { ctx.moveTo(shp.x1, shp.y1); ctx.lineTo(shp.x2, shp.y2); }
    else if (shp.kind === 'circle') { ctx.arc(shp.cx, shp.cy, Math.max(2, shp.r), 0, Math.PI * 2); }
    else if (shp.kind === 'arc') { ctx.arc(shp.cx, shp.cy, Math.max(2, shp.r), shp.startAngle, shp.endAngle, Boolean(shp.ccw)); }
    else if (shp.kind === 'ellipse') { ctx.ellipse(shp.cx, shp.cy, Math.max(2, shp.rx), Math.max(2, shp.ry), 0, 0, Math.PI * 2); }
    else if (shp.kind === 'rect') { ctx.rect(shp.x, shp.y, shp.w, shp.h); }
    else if (shp.kind === 'triangle' && Array.isArray(shp.vertices) && shp.vertices.length === 3) {
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
      const dataUrl = imageBinaryStore.get(imgRec.id) || imgRec.dataUrl;
      if (!dataUrl) return;
      let imgEl = imageElementCache.get(imgRec.id);
      if (!imgEl || imgEl.src !== dataUrl) {
        imgEl = new Image();
        imgEl.onload = function () { if (onLoadRepaint) onLoadRepaint(); };
        imgEl.src = dataUrl;
        imageElementCache.set(imgRec.id, imgEl);
      }
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        ctx.drawImage(imgEl, imgRec.x, imgRec.y, imgRec.w, imgRec.h);
        ctx.save();
        ctx.strokeStyle = imgRec.locked ? 'rgba(148,163,184,0.35)' : 'rgba(37,99,235,0.42)';
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

    drawBoundedPaperSheet(committedCtx, page, state.activePageIndex, state.pages.length, false);
    drawAttachedImages(committedCtx, page, renderCommittedLayer);

    for (let i = 0; i < page.strokes.length; i++) {
      if (page.strokes[i].tool === 'highlighter') drawStroke(committedCtx, page.strokes[i]);
    }
    for (let i = 0; i < page.shapes.length; i++) {
      drawVectorShape(committedCtx, page.shapes[i]);
    }
    for (let i = 0; i < page.strokes.length; i++) {
      if (page.strokes[i].tool !== 'highlighter') drawStroke(committedCtx, page.strokes[i]);
    }
    committedCtx.restore();
  }

  function scheduleActiveRender() {
    if (activeDirtyRaf) return;
    activeDirtyRaf = requestAnimationFrame(function () {
      activeDirtyRaf = 0;
      renderActiveLayerNow();
    });
  }

  function renderActiveLayerNow() {
    if (!activeCtx || !state.stageWidth) return;
    activeCtx.save();
    activeCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    activeCtx.clearRect(0, 0, state.stageWidth, state.stageHeight);
    activeCtx.translate(state.panX, state.panY);
    activeCtx.scale(state.zoom, state.zoom);

    if (state.activeSnappedShape) drawVectorShape(activeCtx, state.activeSnappedShape);
    else if (state.activeStroke && state.tool !== 'laser') drawStroke(activeCtx, state.activeStroke);

    // Laser trails (1.5s fade-out — RAF stops automatically when trails empty)
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
        activeCtx.strokeStyle = 'rgba(239,68,68,' + (life * 0.36) + ')';
        activeCtx.lineWidth = 10 / state.zoom;
        activeCtx.beginPath();
        activeCtx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) activeCtx.lineTo(pts[k].x, pts[k].y);
        activeCtx.stroke();
        activeCtx.strokeStyle = 'rgba(255,255,255,' + (life * 0.92) + ')';
        activeCtx.lineWidth = 3 / state.zoom;
        activeCtx.stroke();
        activeCtx.restore();
      }
    }

    drawSelectionOverlay(activeCtx);
    drawAllInstruments(activeCtx);
    activeCtx.restore();

    if (state.laserTrails.length) {
      if (!state.laserRafId) {
        state.laserRafId = requestAnimationFrame(function () {
          state.laserRafId = 0;
          renderActiveLayerNow();
        });
      }
    }
  }

  /* ==========================================================================
   * 8. SMART SHAPE (DRAW & HOLD) + PRIORITY 8-HANDLE SELECTION / RESIZE
   * ========================================================================== */

  function distPts(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function recognizeSmartShape(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 6) return null;
    const pts = stroke.points;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, pathLen = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      if (i > 0) pathLen += distPts(pts[i - 1], p);
    }
    const bw = maxX - minX, bh = maxY - minY, diag = Math.hypot(bw, bh);
    if (diag < 22) return null;

    const pStart = pts[0], pEnd = pts[pts.length - 1], chord = distPts(pStart, pEnd);
    const dashed = stroke.tool === 'dashed';

    if (chord > 20 && pathLen / chord < 1.14) {
      let x2 = pEnd.x, y2 = pEnd.y;
      const deg = (Math.atan2(y2 - pStart.y, x2 - pStart.x) * 180 / Math.PI + 360) % 360;
      const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      for (let s = 0; s < snapAngles.length; s++) {
        if (Math.abs(deg - snapAngles[s]) < 6.5) {
          const rad = snapAngles[s] * Math.PI / 180;
          x2 = pStart.x + chord * Math.cos(rad);
          y2 = pStart.y + chord * Math.sin(rad);
          break;
        }
      }
      return { id: makeId('shp'), kind: 'line', x1: pStart.x, y1: pStart.y, x2: x2, y2: y2, color: stroke.color, width: stroke.width, dashed: dashed };
    }

    if (chord < Math.max(42, diag * 0.34) && bw > 20 && bh > 20) {
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = bw / 2, ry = bh / 2;
      let ellErr = 0, rectErr = 0;
      for (let i = 0; i < pts.length; i++) {
        ellErr += Math.abs(Math.hypot((pts[i].x - cx) / rx, (pts[i].y - cy) / ry) - 1);
        rectErr += Math.min(Math.abs(pts[i].x - minX), Math.abs(pts[i].x - maxX), Math.abs(pts[i].y - minY), Math.abs(pts[i].y - maxY));
      }
      ellErr /= pts.length;
      rectErr /= (pts.length * Math.min(rx, ry));
      if (ellErr < 0.16 && ellErr <= rectErr * 1.15) {
        if (Math.max(rx, ry) / Math.min(rx, ry) < 1.18) {
          return { id: makeId('shp'), kind: 'circle', cx: cx, cy: cy, r: (rx + ry) / 2, color: stroke.color, width: stroke.width, dashed: dashed };
        }
        return { id: makeId('shp'), kind: 'ellipse', cx: cx, cy: cy, rx: rx, ry: ry, color: stroke.color, width: stroke.width, dashed: dashed };
      }
      return { id: makeId('shp'), kind: 'rect', x: minX, y: minY, w: bw, h: bh, color: stroke.color, width: stroke.width, dashed: dashed };
    }
    return null;
  }

  function getObjectBounds(obj, kind) {
    if (!obj) return null;
    if (kind === 'image' || obj.kind === 'rect') return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    if (obj.kind === 'circle' || obj.kind === 'arc') return { x: obj.cx - obj.r, y: obj.cy - obj.r, w: obj.r * 2, h: obj.r * 2 };
    if (obj.kind === 'ellipse') return { x: obj.cx - obj.rx, y: obj.cy - obj.ry, w: obj.rx * 2, h: obj.ry * 2 };
    if (obj.kind === 'line') {
      return { x: Math.min(obj.x1, obj.x2), y: Math.min(obj.y1, obj.y2), w: Math.max(10, Math.abs(obj.x2 - obj.x1)), h: Math.max(10, Math.abs(obj.y2 - obj.y1)) };
    }
    if (obj.kind === 'triangle' && obj.vertices) {
      const xs = obj.vertices.map(function (v) { return v.x; });
      const ys = obj.vertices.map(function (v) { return v.y; });
      const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      return { x: minX, y: minY, w: Math.max(10, maxX - minX), h: Math.max(10, maxY - minY) };
    }
    return null;
  }

  function offsetObject(obj, kind, dx, dy) {
    if (kind === 'image' || obj.kind === 'rect') { obj.x += dx; obj.y += dy; }
    else if (obj.kind === 'circle' || obj.kind === 'arc' || obj.kind === 'ellipse') { obj.cx += dx; obj.cy += dy; }
    else if (obj.kind === 'line') { obj.x1 += dx; obj.y1 += dy; obj.x2 += dx; obj.y2 += dy; }
    else if (obj.kind === 'triangle' && obj.vertices) { obj.vertices.forEach(function (v) { v.x += dx; v.y += dy; }); }
  }

  function getSelectedObject() {
    if (!state.selectedItem) return null;
    const page = getCurrentPage();
    const list = state.selectedItem.kind === 'image' ? page.images : page.shapes;
    return (list || []).find(function (x) { return x.id === state.selectedItem.id; }) || null;
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
    scheduleActiveRender();
    scheduleLocalAutoSave();
  }

  /* 8 Resize Handles (4 corners + 4 edges) with generous 22px screen-space hit radius */
  function get8Handles(b) {
    return [
      { id: 'nw', x: b.x, y: b.y, cursor: 'nwse-resize' },
      { id: 'n',  x: b.x + b.w / 2, y: b.y, cursor: 'ns-resize' },
      { id: 'ne', x: b.x + b.w, y: b.y, cursor: 'nesw-resize' },
      { id: 'e',  x: b.x + b.w, y: b.y + b.h / 2, cursor: 'ew-resize' },
      { id: 'se', x: b.x + b.w, y: b.y + b.h, cursor: 'nwse-resize' },
      { id: 's',  x: b.x + b.w / 2, y: b.y + b.h, cursor: 'ns-resize' },
      { id: 'sw', x: b.x, y: b.y + b.h, cursor: 'nesw-resize' },
      { id: 'w',  x: b.x, y: b.y + b.h / 2, cursor: 'ew-resize' }
    ];
  }

  function hitTestSelectedHandleScreen(clientX, clientY) {
    const obj = getSelectedObject();
    if (!obj || obj.locked) return null;
    const b = getObjectBounds(obj, state.selectedItem.kind);
    if (!b) return null;
    const handles = get8Handles(b);
    for (let i = 0; i < handles.length; i++) {
      const sp = worldToScreen(handles[i].x, handles[i].y);
      if (Math.hypot(clientX - sp.x, clientY - sp.y) <= 22) {
        return { handle: handles[i], obj: obj, bounds: b };
      }
    }
    return null;
  }

  function hitTestSelectable(wp) {
    const page = getCurrentPage();
    const tol = 10 / state.zoom;
    for (let i = page.shapes.length - 1; i >= 0; i--) {
      const s = page.shapes[i];
      const b = getObjectBounds(s, 'shape');
      if (b && wp.x >= b.x - tol && wp.x <= b.x + b.w + tol && wp.y >= b.y - tol && wp.y <= b.y + b.h + tol) {
        return { kind: 'shape', id: s.id, obj: s };
      }
    }
    for (let i = page.images.length - 1; i >= 0; i--) {
      const im = page.images[i];
      if (wp.x >= im.x && wp.x <= im.x + im.w && wp.y >= im.y && wp.y <= im.y + im.h) {
        return { kind: 'image', id: im.id, obj: im };
      }
    }
    return null;
  }

  function drawSelectionOverlay(ctx) {
    const obj = getSelectedObject();
    if (!obj || !state.selectedItem) return;
    const b = getObjectBounds(obj, state.selectedItem.kind);
    if (!b) return;
    const z = state.zoom || 1;
    ctx.save();
    ctx.strokeStyle = obj.locked ? '#94A3B8' : '#2563EB';
    ctx.lineWidth = 1.8 / z;
    ctx.setLineDash([6 / z, 4 / z]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);

    if (!obj.locked) {
      const handles = get8Handles(b);
      const r = 6 / z;
      handles.forEach(function (h) {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2.2 / z;
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function applyObjectResize(obj, kind, snap, origB, handleId, dx, dy) {
    let x = origB.x, y = origB.y, w = origB.w, h = origB.h;
    const aspect = (origB.w || 1) / (origB.h || 1);
    const isCorner = handleId.length === 2;

    if (handleId.indexOf('e') >= 0) w = Math.max(36, origB.w + dx);
    if (handleId.indexOf('s') >= 0) h = Math.max(36, origB.h + dy);
    if (handleId.indexOf('w') >= 0) { x = origB.x + Math.min(dx, origB.w - 36); w = origB.w - (x - origB.x); }
    if (handleId.indexOf('n') >= 0) { y = origB.y + Math.min(dy, origB.h - 36); h = origB.h - (y - origB.y); }

    if (kind === 'image' && isCorner) {
      h = w / aspect;
      if (handleId.indexOf('n') >= 0) y = origB.y + origB.h - h;
    }

    if (kind === 'image' || obj.kind === 'rect') {
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
    }
  }

  /* ==========================================================================
   * 9. OPTICAL BRASS/GLASS MATH INSTRUMENTS
   * ========================================================================== */

  function drawAllInstruments(ctx) {
    const z = state.zoom || 1;
    const inst = state.instruments;

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

      ctx.strokeStyle = '#334155';
      ctx.fillStyle = '#1E293B';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      for (let x = -r.length / 2 + 10, cm = 0; x <= r.length / 2 - 10; x += 10, cm++) {
        const major = cm % 2 === 0;
        ctx.beginPath();
        ctx.moveTo(x, -r.height / 2);
        ctx.lineTo(x, -r.height / 2 + (major ? 13 : 7));
        ctx.stroke();
        if (major && cm % 4 === 0) ctx.fillText(String(cm / 2), x - 3, -r.height / 2 + 24);
      }
      const deg = ((r.angle * 180 / Math.PI) % 360 + 360) % 360;
      ctx.fillStyle = '#B45309';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillText(deg.toFixed(1) + '°', -18, 12);

      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(r.length / 2 - 16, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

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

      ctx.strokeStyle = '#334155';
      ctx.fillStyle = '#1E293B';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      for (let d = 0; d <= 180; d += 5) {
        const rad = -d * Math.PI / 180;
        const len = d % 10 === 0 ? 12 : 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * p.radius, Math.sin(rad) * p.radius);
        ctx.lineTo(Math.cos(rad) * (p.radius - len), Math.sin(rad) * (p.radius - len));
        ctx.stroke();
        if (d % 30 === 0) ctx.fillText(d + '°', Math.cos(rad) * (p.radius - 26) - 8, Math.sin(rad) * (p.radius - 26) + 3);
      }
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(p.radius - 16, -12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (inst.setsquare.visible) {
      const s = inst.setsquare;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = 'rgba(236, 253, 245, 0.80)';
      ctx.strokeStyle = 'rgba(5, 150, 105, 0.78)';
      ctx.lineWidth = 1.6 / z;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(s.legA, 0); ctx.lineTo(0, -s.legB);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeRect(0, -14, 14, 14);
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(s.legA - 36, -14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (inst.compass.visible) {
      const c = inst.compass;
      const tipX = c.cx + Math.cos(c.angle) * c.radius;
      const tipY = c.cy + Math.sin(c.angle) * c.radius;
      ctx.save();
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.35)';
      ctx.lineWidth = 1.2 / z;
      ctx.setLineDash([5 / z, 4 / z]);
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, c.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 3 / z;
      ctx.beginPath();
      ctx.moveTo(c.cx, c.cy); ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, 7 / z, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 9.5 / z, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#B45309';
      ctx.font = '800 ' + (11 / z) + 'px "JetBrains Mono", monospace';
      ctx.fillText('R = ' + (c.radius / 20).toFixed(1) + ' cm', (c.cx + tipX) / 2 + 8 / z, (c.cy + tipY) / 2 - 8 / z);

      if (state.instrumentDrag && state.instrumentDrag.key === 'compass' && state.instrumentDrag.mode === 'sweep') {
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.width;
        ctx.beginPath();
        ctx.arc(c.cx, c.cy, c.radius, state.instrumentDrag.sweepStartAngle, state.instrumentDrag.sweepCurrentAngle, false);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function hitTestInstruments(wp) {
    const inst = state.instruments;
    const handleR = 18 / (state.zoom || 1);
    if (inst.compass.visible) {
      const c = inst.compass;
      const tipX = c.cx + Math.cos(c.angle) * c.radius;
      const tipY = c.cy + Math.sin(c.angle) * c.radius;
      if (distPts(wp, { x: tipX, y: tipY }) < handleR) return { key: 'compass', mode: 'sweep', sweepStartAngle: c.angle, sweepCurrentAngle: c.angle };
      if (distPts(wp, { x: c.cx, y: c.cy }) < handleR) return { key: 'compass', mode: 'move' };
    }
    if (inst.ruler.visible) {
      const r = inst.ruler;
      const dx = wp.x - r.x, dy = wp.y - r.y;
      const cos = Math.cos(-r.angle), sin = Math.sin(-r.angle);
      const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
      if (Math.hypot(lx - (r.length / 2 - 16), ly) < handleR) return { key: 'ruler', mode: 'rotate' };
      if (lx >= -r.length / 2 && lx <= r.length / 2 && ly >= -r.height / 2 && ly <= r.height / 2) return { key: 'ruler', mode: 'move' };
    }
    if (inst.protractor.visible) {
      const p = inst.protractor;
      const dx = wp.x - p.cx, dy = wp.y - p.cy;
      const cos = Math.cos(-p.angle), sin = Math.sin(-p.angle);
      const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
      if (Math.hypot(lx - (p.radius - 16), ly + 12) < handleR) return { key: 'protractor', mode: 'rotate' };
      if (ly <= 4 && Math.hypot(lx, ly) <= p.radius) return { key: 'protractor', mode: 'move' };
    }
    if (inst.setsquare.visible) {
      const s = inst.setsquare;
      const dx = wp.x - s.x, dy = wp.y - s.y;
      const cos = Math.cos(-s.angle), sin = Math.sin(-s.angle);
      const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
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
      const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
      if (lx >= -r.length / 2 - 10 && lx <= r.length / 2 + 10) {
        if (Math.abs(ly - (-r.height / 2)) < tol) {
          const sy = -r.height / 2;
          return { x: r.x + lx * Math.cos(r.angle) - sy * Math.sin(r.angle), y: r.y + lx * Math.sin(r.angle) + sy * Math.cos(r.angle) };
        }
        if (Math.abs(ly - (r.height / 2)) < tol) {
          const sy = r.height / 2;
          return { x: r.x + lx * Math.cos(r.angle) - sy * Math.sin(r.angle), y: r.y + lx * Math.sin(r.angle) + sy * Math.cos(r.angle) };
        }
      }
    }
    if (inst.setsquare.visible) {
      const s = inst.setsquare;
      const dx = wp.x - s.x, dy = wp.y - s.y;
      const cos = Math.cos(-s.angle), sin = Math.sin(-s.angle);
      const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
      if (lx >= -6 && lx <= s.legA + 6 && Math.abs(ly) < tol) return { x: s.x + lx * Math.cos(s.angle), y: s.y + lx * Math.sin(s.angle) };
      if (ly <= 6 && ly >= -s.legB - 6 && Math.abs(lx) < tol) return { x: s.x - ly * Math.sin(s.angle), y: s.y + ly * Math.cos(s.angle) };
    }
    return wp;
  }

  /* ==========================================================================
   * 10. POINTER EVENTS (HANDLE PRIORITY FIRST, DYNAMIC CURSOR, 2-FINGER PINCH)
   * ========================================================================== */

  function computeFountainWidth(baseW, prevPt, x, y, t, pressure, pointerType) {
    if (pointerType === 'pen' && pressure > 0 && pressure !== 0.5) {
      return Math.max(0.8, baseW * (0.45 + pressure * 1.35));
    }
    if (!prevPt) return baseW;
    const dist = Math.hypot(x - prevPt.x, y - prevPt.y);
    const dt = Math.max(1, t - (prevPt.t || t));
    const factor = Math.max(0.45, Math.min(1.42, 1.32 - (dist / dt) * 0.42));
    return baseW * factor;
  }

  function eraseAtPoint(wp) {
    const page = getCurrentPage();
    const radius = Math.max(10, state.width * 3.5) / state.zoom;
    let changed = false;

    if (state.tool === 'eraser_stroke') {
      const bS = page.strokes.length, bSh = page.shapes.length;
      page.strokes = page.strokes.filter(function (st) {
        for (let i = 0; i < st.points.length; i++) {
          if (Math.hypot(st.points[i].x - wp.x, st.points[i].y - wp.y) <= radius) return false;
        }
        return true;
      });
      page.shapes = page.shapes.filter(function (sh) {
        const b = getObjectBounds(sh, 'shape');
        if (!b) return true;
        return !(wp.x >= b.x - radius && wp.x <= b.x + b.w + radius && wp.y >= b.y - radius && wp.y <= b.y + b.h + radius);
      });
      changed = page.strokes.length !== bS || page.shapes.length !== bSh;
    } else if (state.tool === 'eraser_region') {
      const nextStrokes = [];
      for (let s = 0; s < page.strokes.length; s++) {
        const st = page.strokes[s];
        let seg = [];
        for (let i = 0; i < st.points.length; i++) {
          const p = st.points[i];
          if (Math.hypot(p.x - wp.x, p.y - wp.y) <= radius) {
            changed = true;
            if (seg.length > 1) nextStrokes.push(Object.assign({}, st, { id: makeId('st'), points: seg }));
            seg = [];
          } else seg.push(p);
        }
        if (seg.length > 0) nextStrokes.push(seg.length === st.points.length ? st : Object.assign({}, st, { id: makeId('st'), points: seg }));
      }
      if (changed) page.strokes = nextStrokes;
    }
    if (changed) {
      renderCommittedLayer();
      scheduleLocalAutoSave();
    }
  }

  function clearHoldTimer() {
    if (state.holdTimer) { clearTimeout(state.holdTimer); state.holdTimer = null; }
  }

  function scheduleHoldRecognition(wp) {
    clearHoldTimer();
    if (!state.smartShapeEnabled || !state.activeStroke) return;
    if (state.activeStroke.tool !== 'fountain' && state.activeStroke.tool !== 'ballpoint' && state.activeStroke.tool !== 'dashed') return;
    state.holdAnchor = { x: wp.x, y: wp.y };
    state.holdTimer = setTimeout(function () {
      if (!state.activeStroke || state.activeSnappedShape) return;
      const snapped = recognizeSmartShape(state.activeStroke);
      if (snapped) { state.activeSnappedShape = snapped; scheduleActiveRender(); }
    }, 480);
  }

  function wirePointerEvents() {
    const stage = document.getElementById('vtSlateStage');
    const dock = document.getElementById('vtSlateDock');
    if (!stage) return;

    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('#vtSlateDock') || e.target.closest('#vtSlateSelBar') || e.target.closest('#vtSlateExitFsBtn')) return;
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
        state.pinchState = {
          dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1,
          midX: (pts[0].x + pts[1].x) / 2,
          midY: (pts[0].y + pts[1].y) / 2,
          zoom: state.zoom, panX: state.panX, panY: state.panY
        };
        return;
      }

      const wp = screenToWorld(e.clientX, e.clientY);

      // PRIORITY 1: Hit-test 8 Resize Handles of currently selected object (22px screen radius) BEFORE draw/erase/pan!
      const hitHandle = hitTestSelectedHandleScreen(e.clientX, e.clientY);
      if (hitHandle) {
        state.drawingPointerId = e.pointerId;
        pushUndo();
        state.dragTransform = {
          mode: 'resize',
          handle: hitHandle.handle.id,
          startWorld: wp,
          origBounds: hitHandle.bounds,
          snapshot: JSON.parse(JSON.stringify(hitHandle.obj))
        };
        return;
      }

      // PRIORITY 2: Math Instruments
      const hitInst = hitTestInstruments(wp);
      if (hitInst) {
        state.drawingPointerId = e.pointerId;
        state.instrumentDrag = Object.assign({ startWorld: wp, orig: JSON.parse(JSON.stringify(state.instruments[hitInst.key])) }, hitInst);
        return;
      }

      // PRIORITY 3: Pan mode
      if (state.tool === 'pan' || state.spacePressed || e.button === 1) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
        return;
      }

      // PRIORITY 4: Select / Move / Resize mode
      if (state.tool === 'select') {
        state.drawingPointerId = e.pointerId;
        const hit = hitTestSelectable(wp);
        if (hit) {
          state.selectedItem = { kind: hit.kind, id: hit.id };
          syncSelectionBar();
          if (!hit.obj.locked) {
            pushUndo();
            state.dragTransform = { mode: 'move', startWorld: wp, snapshot: JSON.parse(JSON.stringify(hit.obj)) };
          }
        } else {
          state.selectedItem = null;
          syncSelectionBar();
        }
        scheduleActiveRender();
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
      const firstPt = { x: snappedPt.x, y: snappedPt.y, t: t, w: computeFountainWidth(state.width, null, snappedPt.x, snappedPt.y, t, e.pressure, e.pointerType) };

      if (state.tool === 'laser') {
        const trail = { points: [firstPt], createdAt: performance.now() };
        state.laserTrails.push(trail);
        state.activeStroke = trail;
        scheduleActiveRender();
        return;
      }

      state.activeSnappedShape = null;
      state.activeStroke = { id: makeId('st'), tool: state.tool, color: state.color, width: state.width, points: [firstPt] };
      scheduleHoldRecognition(snappedPt);
      scheduleActiveRender();
    });

    stage.addEventListener('pointermove', function (e) {
      if (state.activePointers.has(e.pointerId)) {
        state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      }

      // Hover cursor feedback for selected object handles & body
      if (state.drawingPointerId === null && !state.isPanning && state.selectedItem) {
        const hh = hitTestSelectedHandleScreen(e.clientX, e.clientY);
        if (hh) {
          stage.style.cursor = hh.handle.cursor;
        } else if (state.tool === 'select') {
          const wpHover = screenToWorld(e.clientX, e.clientY);
          const sel = getSelectedObject();
          const b = sel && !sel.locked ? getObjectBounds(sel, state.selectedItem.kind) : null;
          stage.style.cursor = (b && wpHover.x >= b.x && wpHover.x <= b.x + b.w && wpHover.y >= b.y && wpHover.y <= b.y + b.h) ? 'move' : 'default';
        } else {
          stage.style.cursor = '';
        }
      }

      // 2-finger pinch zoom & pan (40% - 300%)
      if (state.pinchState && state.activePointers.size === 2) {
        const pts = Array.from(state.activePointers.values());
        const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const rect = committedCanvas.getBoundingClientRect();
        const nextZoom = Math.max(0.4, Math.min(3.0, state.pinchState.zoom * (newDist / state.pinchState.dist)));
        const worldMidX = (state.pinchState.midX - rect.left - state.pinchState.panX) / state.pinchState.zoom;
        const worldMidY = (state.pinchState.midY - rect.top - state.pinchState.panY) / state.pinchState.zoom;
        state.zoom = nextZoom;
        state.panX = (midX - rect.left) - worldMidX * nextZoom;
        state.panY = (midY - rect.top) - worldMidY * nextZoom;
        syncZoomBtn();
        renderCommittedLayer();
        scheduleActiveRender();
        positionSelectionBar();
        return;
      }

      const wp = screenToWorld(e.clientX, e.clientY);

      if (state.instrumentDrag && state.drawingPointerId === e.pointerId) {
        const d = state.instrumentDrag;
        const target = state.instruments[d.key];
        const dx = wp.x - d.startWorld.x, dy = wp.y - d.startWorld.y;
        if (d.mode === 'move') {
          if (d.key === 'ruler' || d.key === 'setsquare') { target.x = d.orig.x + dx; target.y = d.orig.y + dy; }
          else { target.cx = d.orig.cx + dx; target.cy = d.orig.cy + dy; }
        } else if (d.mode === 'rotate') {
          const cx = (d.key === 'ruler' || d.key === 'setsquare') ? target.x : target.cx;
          const cy = (d.key === 'ruler' || d.key === 'setsquare') ? target.y : target.cy;
          let nextA = d.orig.angle + (Math.atan2(wp.y - cy, wp.x - cx) - Math.atan2(d.startWorld.y - cy, d.startWorld.x - cx));
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
        scheduleActiveRender();
        return;
      }

      if (state.isPanning && state.panStart) {
        state.panX = state.panStart.panX + (e.clientX - state.panStart.x);
        state.panY = state.panStart.panY + (e.clientY - state.panStart.y);
        renderCommittedLayer();
        scheduleActiveRender();
        positionSelectionBar();
        return;
      }

      if (state.dragTransform && state.drawingPointerId === e.pointerId) {
        const obj = getSelectedObject();
        if (!obj) return;
        const dt = state.dragTransform;
        const dx = wp.x - dt.startWorld.x, dy = wp.y - dt.startWorld.y;
        if (dt.mode === 'move') {
          Object.assign(obj, JSON.parse(JSON.stringify(dt.snapshot)));
          offsetObject(obj, state.selectedItem.kind, dx, dy);
        } else if (dt.mode === 'resize') {
          applyObjectResize(obj, state.selectedItem.kind, dt.snapshot, dt.origBounds, dt.handle, dx, dy);
        }
        renderCommittedLayer();
        scheduleActiveRender();
        positionSelectionBar();
        return;
      }

      if (state.drawingPointerId !== e.pointerId) return;

      if (state.tool === 'eraser_stroke' || state.tool === 'eraser_region') {
        eraseAtPoint(wp);
        return;
      }

      if (state.activeSnappedShape) {
        const shp = state.activeSnappedShape;
        if (shp.kind === 'line') { shp.x2 = wp.x; shp.y2 = wp.y; }
        else if (shp.kind === 'circle') { shp.r = Math.max(10, distPts(wp, { x: shp.cx, y: shp.cy })); }
        scheduleActiveRender();
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
        pts.push({ x: pW.x, y: pW.y, t: t, w: computeFountainWidth(state.width, prev, pW.x, pW.y, t, ev.pressure, ev.pointerType) });
        if (state.holdAnchor && distPts(pW, state.holdAnchor) > 6 / state.zoom) scheduleHoldRecognition(pW);
      }
      if (state.tool === 'laser') state.activeStroke.createdAt = performance.now();
      scheduleActiveRender();
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
            getCurrentPage().shapes.push(delta > Math.PI * 1.85 ? {
              id: makeId('shp'), kind: 'circle', cx: c.cx, cy: c.cy, r: c.radius, color: state.color, width: state.width, dashed: state.tool === 'dashed'
            } : {
              id: makeId('shp'), kind: 'arc', cx: c.cx, cy: c.cy, r: c.radius, startAngle: d.sweepStartAngle, endAngle: d.sweepCurrentAngle, ccw: false, color: state.color, width: state.width, dashed: state.tool === 'dashed'
            });
            renderCommittedLayer();
            scheduleLocalAutoSave();
          }
        }
        state.instrumentDrag = null;
        state.drawingPointerId = null;
        scheduleActiveRender();
        return;
      }

      if (state.dragTransform && state.drawingPointerId === e.pointerId) {
        state.dragTransform = null;
        state.drawingPointerId = null;
        scheduleLocalAutoSave();
        scheduleActiveRender();
        positionSelectionBar();
        return;
      }

      if (state.isPanning) { state.isPanning = false; state.panStart = null; }
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
        scheduleActiveRender();
        scheduleLocalAutoSave();
        return;
      }

      if (state.activeStroke && state.tool !== 'laser') {
        const st = state.activeStroke;
        state.activeStroke = null;
        if (st.tool === 'highlighter' && st.points.length >= 2) {
          const a = st.points[0], b = st.points[st.points.length - 1];
          if (Math.hypot(b.x - a.x, b.y - a.y) > 24 && Math.abs(b.y - a.y) < Math.abs(b.x - a.x) * 0.24) {
            st.points = [{ x: a.x, y: a.y }, { x: b.x, y: a.y }];
          }
        }
        pushUndo();
        getCurrentPage().strokes.push(st);
        renderCommittedLayer();
        scheduleActiveRender();
        scheduleLocalAutoSave();
      } else if (state.tool === 'laser') {
        state.activeStroke = null;
        scheduleActiveRender();
      }
    }

    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.10 : 0.90;
        zoomAroundCenter(state.zoom * factor, e.clientX, e.clientY);
      } else {
        state.panX -= e.deltaX;
        state.panY -= e.deltaY;
        renderCommittedLayer();
        scheduleActiveRender();
        positionSelectionBar();
      }
    }, { passive: false });
  }

  /* ==========================================================================
   * 11. FOLDER-BASED CLOUD SAVE & 0MS INSTANT FOLDER/FILE DRAWER
   * ========================================================================== */

  function openSaveFolderModal() {
    const bd = document.getElementById('vtSlateSaveFolderBackdrop');
    if (!bd) return;
    const sel = document.getElementById('vtSlateFolderSelect');
    const folders = Array.from(new Set([DEFAULT_FOLDER, state.folderName || DEFAULT_FOLDER].concat(state.cloudFolders || [])));
    sel.innerHTML = folders.map(function (f) {
      return '<option value="' + escapeAttr(f) + '"' + (f === (state.folderName || DEFAULT_FOLDER) ? ' selected' : '') + '>' + escapeHtml(f) + '</option>';
    }).join('');
    const newInp = document.getElementById('vtSlateNewFolderInp');
    newInp.value = '';
    newInp.style.display = 'none';
    document.getElementById('vtSlateSaveFileNameInp').value = state.title || 'Bảng Giảng Thiên Văn';
    document.getElementById('vtSlateSaveProgressWrap').style.display = 'none';
    bd.classList.add('open');
  }

  function closeSaveFolderModal() {
    if (state.driveSyncing) return;
    const bd = document.getElementById('vtSlateSaveFolderBackdrop');
    if (bd) bd.classList.remove('open');
  }

  async function submitSaveToCloudFolder() {
    if (state.driveSyncing) return;
    const C = getCore();
    if (!C || !C.auth || !C.auth.isSignedIn() || !C.auth.getAccessToken()) {
      notify('Vui lòng đăng nhập tài khoản để lưu lên Đám mây.', 'warning');
      return;
    }

    const newFolderVal = document.getElementById('vtSlateNewFolderInp').value.trim();
    const selectedFolder = document.getElementById('vtSlateFolderSelect').value || DEFAULT_FOLDER;
    const targetFolder = newFolderVal || selectedFolder || DEFAULT_FOLDER;
    const targetTitle = document.getElementById('vtSlateSaveFileNameInp').value.trim();

    if (!targetTitle) {
      notify('Vui lòng nhập tên tệp bảng giảng trước khi lưu.', 'warning');
      return;
    }

    state.driveSyncing = true;
    const submitBtn = document.getElementById('vtSlateSaveFolderSubmit');
    if (submitBtn) submitBtn.disabled = true;
    const progWrap = document.getElementById('vtSlateSaveProgressWrap');
    const progTxt = document.getElementById('vtSlateSaveProgressText');
    const progFill = document.getElementById('vtSlateSaveProgressFill');
    if (progWrap) progWrap.style.display = 'flex';
    if (progTxt) progTxt.textContent = 'Đang chuẩn bị thư mục "' + targetFolder + '"...';
    if (progFill) progFill.style.width = '20%';

    try {
      state.title = targetTitle;
      state.folderName = targetFolder;
      syncPageHeaderUI();
      renderCommittedLayer();

      const packedPayload = {
        format: 'VANTHESIS_ASTRAL_SLATE_V2',
        boardId: state.boardId,
        title: state.title,
        folderName: state.folderName,
        activePageIndex: state.activePageIndex,
        pages: packPagesWithImages(state.pages),
        updatedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(packedPayload)], { type: 'application/octet-stream' });
      const fileName = sanitizeFilename(state.title, '.vtslate');

      if (progTxt) progTxt.textContent = 'Đang tải bản viết lên thư mục "' + targetFolder + '"...';
      if (progFill) progFill.style.width = '45%';

      const uploaded = await C.drive.uploadFile({
        folderName: DRIVE_FOLDER_NAME,
        subFolderName: targetFolder,
        fileName: fileName,
        mimeType: 'application/octet-stream',
        fileOrBlob: blob,
        existingFileId: state.driveFileId || undefined,
        onProgress: function (pct) {
          if (progFill) progFill.style.width = Math.round(45 + pct * 0.40) + '%';
        }
      });

      if (!uploaded || !uploaded.fileId) throw new Error('Chưa thể lưu tệp lên Đám mây.');
      state.driveFileId = uploaded.fileId;

      if (progTxt) progTxt.textContent = 'Đang cập nhật chỉ mục thư mục...';
      if (progFill) progFill.style.width = '90%';

      await C.api.post('whiteboard_upsert', {
        boardId: state.boardId,
        title: state.title,
        folderName: state.folderName,
        driveFileId: state.driveFileId,
        pdfDriveFileId: state.pdfDriveFileId || '',
        pageCount: state.pages.length,
        paperPreset: (getCurrentPage().paperConfig && getCurrentPage().paperConfig.preset) || 'GRID'
      });

      if (state.cloudFolders.indexOf(targetFolder) === -1) state.cloudFolders.push(targetFolder);
      await saveLocalDraftNow();
      setSaveStatus('Đã lưu vào "' + targetFolder + '"');
      if (progFill) progFill.style.width = '100%';
      state.driveSyncing = false;
      if (submitBtn) submitBtn.disabled = false;
      closeSaveFolderModal();
      notify('Đã lưu "' + state.title + '" vào thư mục "' + targetFolder + '" trên Đám mây.', 'success');
    } catch (err) {
      state.driveSyncing = false;
      if (submitBtn) submitBtn.disabled = false;
      if (progWrap) progWrap.style.display = 'none';
      notify((err && err.message) || 'Chưa thể lưu lên Đám mây lúc này, bản viết vẫn an toàn tại máy.', 'error');
    }
  }

  function toggleCloudDrawer() {
    const drawer = document.getElementById('vtSlateCloudDrawer');
    if (!drawer) return;
    closeAllMenus();
    state.cloudDrawerOpen = !state.cloudDrawerOpen;
    drawer.classList.toggle('open', state.cloudDrawerOpen);
    if (!state.cloudDrawerOpen) return;

    // 0ms Instant Render from Local Cache (ZERO hanging grey skeletons!)
    renderGroupedBoardsDrawer();
    fetchCloudBoardsBackground();
  }

  async function fetchCloudBoardsBackground() {
    const C = getCore();
    const statusEl = document.getElementById('vtSlateCloudStatusBar');
    if (!C || !C.auth || !C.auth.isSignedIn()) return;
    if (statusEl) statusEl.innerHTML = '<span>Đang cập nhật danh sách từ Đám mây...</span>';
    state.cloudLoadError = '';
    const res = await C.api.post('whiteboard_list', {}, { timeoutMs: 15000, silent: true });
    if (!res || !res.ok) {
      state.cloudLoadError = (res && res.error) || 'Không thể kết nối Đám mây lúc này.';
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#D97706;">' + escapeHtml(state.cloudLoadError) + '</span>' +
          '<button type="button" class="vt-slate-btn" id="vtSlateRetryCloudBtn" style="height:24px;font-size:11px;">Thử lại</button>';
        const retryBtn = document.getElementById('vtSlateRetryCloudBtn');
        if (retryBtn) retryBtn.addEventListener('click', fetchCloudBoardsBackground);
      }
      return;
    }
    state.cloudBoards = Array.isArray(res.boards) ? res.boards : [];
    state.cloudFolders = Array.isArray(res.folders) && res.folders.length ? res.folders : [DEFAULT_FOLDER];
    if (statusEl) statusEl.innerHTML = '<span>Đã đồng bộ ' + state.cloudBoards.length + ' bản viết trên Đám mây</span>';
    renderGroupedBoardsDrawer();
  }

  function renderGroupedBoardsDrawer() {
    const listEl = document.getElementById('vtSlateCloudList');
    if (!listEl) return;

    // Merge local index + cloud boards cleanly (cloud wins on same boardId)
    const mergedMap = {};
    readLocalBoardIndex().forEach(function (b) { if (b && b.boardId) mergedMap[b.boardId] = Object.assign({ source: 'local' }, b); });
    (state.cloudBoards || []).forEach(function (b) { if (b && b.boardId) mergedMap[b.boardId] = Object.assign({ source: 'cloud' }, b); });
    const allBoards = Object.keys(mergedMap).map(function (k) { return mergedMap[k]; });
    allBoards.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });

    if (!allBoards.length) {
      listEl.innerHTML = '<div style="font-size:12.5px;opacity:0.7;padding:16px;text-align:center;">Chưa có bảng giảng nào được lưu. Hãy viết bài rồi chọn "Lưu & Xuất".</div>';
      return;
    }

    const groups = {};
    allBoards.forEach(function (b) {
      const fname = b.folderName || DEFAULT_FOLDER;
      if (!groups[fname]) groups[fname] = [];
      groups[fname].push(b);
    });
    const folderNames = Object.keys(groups).sort(function (a, b) {
      if (a === DEFAULT_FOLDER) return -1;
      if (b === DEFAULT_FOLDER) return 1;
      return a.localeCompare(b, 'vi');
    });

    listEl.innerHTML = folderNames.map(function (fname) {
      const collapsed = Boolean(state.collapsedFolders[fname]);
      const itemsHtml = groups[fname].map(function (b) {
        const badge = b.source === 'cloud' ? 'Đám mây' : 'Tại máy';
        return '<div class="vt-slate-file-card" data-sl-open="' + escapeAttr(b.boardId) + '" data-sl-src="' + b.source + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
            '<strong style="font-size:12.8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(b.title || 'Bảng Giảng') + '</strong>' +
            '<button type="button" class="vt-slate-btn icon-only" data-sl-del="' + escapeAttr(b.boardId) + '" data-sl-src="' + b.source + '" title="Xóa bản viết" style="height:24px;width:24px;color:#DC2626;">' + ICONS.trash + '</button>' +
          '</div>' +
          '<div style="font-size:11px;opacity:0.72;display:flex;justify-content:space-between;">' +
            '<span>' + (b.pageCount || 1) + ' trang • ' + badge + '</span>' +
            '<span>' + escapeHtml((b.updatedAt || '').slice(0, 10)) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');

      const renameBtn = fname !== DEFAULT_FOLDER
        ? '<button type="button" class="vt-slate-btn icon-only" data-sl-rename-folder="' + escapeAttr(fname) + '" title="Đổi tên thư mục" style="height:22px;width:22px;">' + ICONS.edit + '</button>'
        : '';

      return '<div class="vt-slate-folder-group">' +
        '<div class="vt-slate-folder-head" data-sl-toggle-folder="' + escapeAttr(fname) + '">' +
          '<span style="display:flex;align-items:center;gap:6px;">' + ICONS.folder + '<span>' + escapeHtml(fname) + ' (' + groups[fname].length + ')</span></span>' +
          '<span style="display:flex;align-items:center;gap:4px;">' + renameBtn + ICONS.chevDown + '</span>' +
        '</div>' +
        '<div class="vt-slate-folder-body' + (collapsed ? ' collapsed' : '') + '">' + itemsHtml + '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('[data-sl-toggle-folder]').forEach(function (head) {
      head.addEventListener('click', function (e) {
        if (e.target.closest('[data-sl-rename-folder]')) return;
        const fn = head.getAttribute('data-sl-toggle-folder');
        state.collapsedFolders[fn] = !state.collapsedFolders[fn];
        renderGroupedBoardsDrawer();
      });
    });

    listEl.querySelectorAll('[data-sl-rename-folder]').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const oldName = btn.getAttribute('data-sl-rename-folder');
        const C = getCore();
        if (!C) return;
        const nextName = await promptSimpleFolderName(oldName);
        if (!nextName || nextName === oldName) return;
        const res = await C.api.post('whiteboard_rename_folder', { oldFolderName: oldName, newFolderName: nextName });
        if (res && res.ok) {
          if (state.folderName === oldName) state.folderName = nextName;
          notify('Đã đổi tên thư mục thành "' + nextName + '".', 'success');
          fetchCloudBoardsBackground();
        }
      });
    });

    listEl.querySelectorAll('[data-sl-open]').forEach(function (card) {
      card.addEventListener('click', async function (e) {
        if (e.target.closest('[data-sl-del]')) return;
        const bid = card.getAttribute('data-sl-open');
        const src = card.getAttribute('data-sl-src');
        if (src === 'cloud') {
          const found = state.cloudBoards.find(function (x) { return x.boardId === bid; });
          if (found) await loadSlateFromDrive(found);
        } else {
          const ok = await restoreLocalDraft(bid);
          if (ok) {
            state.selectedItem = null;
            syncSelectionBar();
            syncPageHeaderUI();
            syncPaperControlsUI();
            fitPageToViewport();
            state.cloudDrawerOpen = false;
            document.getElementById('vtSlateCloudDrawer').classList.remove('open');
            notify('Đã mở bản viết "' + state.title + '".', 'success');
          }
        }
      });
    });

    listEl.querySelectorAll('[data-sl-del]').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const bid = btn.getAttribute('data-sl-del');
        const src = btn.getAttribute('data-sl-src');
        const C = getCore();
        const ok = C && C.ui ? await C.ui.confirm({ title: 'Xóa bản viết', message: 'Bạn có chắc chắn muốn xóa bản viết này khỏi danh sách không?', confirmText: 'Xóa bản viết', danger: true }) : true;
        if (!ok) return;
        if (src === 'cloud' && C) {
          await C.api.post('whiteboard_delete', { boardId: bid });
          state.cloudBoards = state.cloudBoards.filter(function (x) { return x.boardId !== bid; });
        }
        removeLocalBoardIndex(bid);
        renderGroupedBoardsDrawer();
        notify('Đã xóa bản viết.', 'success');
      });
    });
  }

  function promptSimpleFolderName(currentName) {
    return new Promise(function (resolve) {
      const bd = document.createElement('div');
      bd.className = 'vt-slate-modal-backdrop open';
      bd.style.position = 'fixed';
      bd.innerHTML =
        '<div class="vt-slate-modal" style="width:min(380px,92vw);">' +
          '<div style="font-size:15px;font-weight:800;">Đổi tên thư mục</div>' +
          '<input type="text" class="vt-slate-input" id="vtRenameFldInp" value="' + escapeAttr(currentName) + '">' +
          '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
            '<button type="button" class="vt-slate-btn" data-cancel>Hủy</button>' +
            '<button type="button" class="vt-slate-btn primary" data-ok>Lưu tên mới</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(bd);
      const inp = bd.querySelector('#vtRenameFldInp');
      inp.focus();
      function done(v) { if (bd.parentNode) bd.parentNode.removeChild(bd); resolve(v); }
      bd.querySelector('[data-cancel]').addEventListener('click', function () { done(''); });
      bd.querySelector('[data-ok]').addEventListener('click', function () { done(inp.value.trim()); });
      inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') done(inp.value.trim()); if (ev.key === 'Escape') done(''); });
    });
  }

  async function loadSlateFromDrive(meta) {
    const C = getCore();
    if (!C || !C.drive || !meta || !meta.driveFileId) return;
    notify('Đang mở bản viết từ Đám mây...', 'info');
    try {
      const txt = await C.drive.downloadText(meta.driveFileId);
      const parsed = JSON.parse(txt);
      if (!parsed || !Array.isArray(parsed.pages) || !parsed.pages.length) throw new Error('Nội dung bản viết không hợp lệ.');
      state.boardId = parsed.boardId || meta.boardId;
      state.title = parsed.title || meta.title || 'Bảng Giảng Thiên Văn';
      state.folderName = parsed.folderName || meta.folderName || DEFAULT_FOLDER;
      state.driveFileId = meta.driveFileId;
      state.pdfDriveFileId = meta.pdfDriveFileId || '';
      state.pages = hydratePagesFromPayload(parsed.pages);
      state.activePageIndex = Math.max(0, Math.min(state.pages.length - 1, Number(parsed.activePageIndex) || 0));
      state.selectedItem = null;
      syncSelectionBar();
      syncPageHeaderUI();
      syncPaperControlsUI();
      fitPageToViewport();
      await saveLocalDraftNow();
      setSaveStatus('Đã đồng bộ Đám mây');
      state.cloudDrawerOpen = false;
      document.getElementById('vtSlateCloudDrawer').classList.remove('open');
      notify('Đã mở bản viết "' + state.title + '".', 'success');
    } catch (err) {
      notify((err && err.message) || 'Không thể mở bản viết từ Đám mây.', 'error');
    }
  }

  /* ==========================================================================
   * 12. INSERT IMAGES/PDF/LAB CAPTURES (AUTO-FIT 65% + AUTO-SELECT TOOL)
   * ========================================================================== */

  function compressImageToDataUrl(imgOrCanvas, maxDim) {
    const limit = maxDim || 1500;
    const natW = imgOrCanvas.naturalWidth || imgOrCanvas.width || 800;
    const natH = imgOrCanvas.naturalHeight || imgOrCanvas.height || 600;
    const scale = Math.min(1, limit / Math.max(natW, natH));
    const w = Math.max(1, Math.round(natW * scale));
    const h = Math.max(1, Math.round(natH * scale));
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = '#FFFFFF';
    tctx.fillRect(0, 0, w, h);
    tctx.drawImage(imgOrCanvas, 0, 0, w, h);
    return { dataUrl: tmp.toDataURL('image/jpeg', 0.88), natW: w, natH: h };
  }

  function placeImageInsidePage(page, dataUrl, natW, natH, opts) {
    const o = opts || {};
    const dims = getPageDims(page);
    const aspect = (natW || 4) / (natH || 3);

    // Cap initial width to max 65% of page width and 78% of page height
    let targetW = Math.min(dims.w * (o.alignLeft ? 0.46 : 0.65), natW);
    let targetH = targetW / aspect;
    if (targetH > dims.h * 0.78) {
      targetH = dims.h * 0.78;
      targetW = targetH * aspect;
    }

    const x = o.alignLeft ? 28 : Math.round((dims.w - targetW) / 2);
    const y = o.alignLeft ? 48 : Math.round((dims.h - targetH) / 2);
    const id = makeId('img');
    imageBinaryStore.set(id, dataUrl);
    persistImageBinaryAsync(id, dataUrl);

    const rec = { id: id, x: x, y: y, w: targetW, h: targetH, caption: o.caption || 'Hình đính kèm', locked: false };
    page.images.push(rec);
    return rec;
  }

  function insertLabCapture(capture) {
    if (!capture || !capture.dataUrl) return;
    const img = new Image();
    img.onload = function () {
      pushUndo();
      const page = getCurrentPage();
      const rec = placeImageInsidePage(page, capture.dataUrl, img.naturalWidth, img.naturalHeight, {
        caption: capture.caption || 'Đồ thị Phòng Thí nghiệm 2D/3D'
      });
      setActiveTool('select');
      state.selectedItem = { kind: 'image', id: rec.id };
      syncSelectionBar();
      renderCommittedLayer();
      scheduleActiveRender();
      scheduleLocalAutoSave();
      notify('Đã dán đồ thị vào giữa trang. Kéo 4 góc để phóng to/thu nhỏ hoặc kéo thân ảnh để di chuyển.', 'success');
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
    if (!isPdf && !isImage) { notify('Chỉ hỗ trợ chèn tệp PDF hoặc ảnh (.png, .jpg, .webp).', 'warning'); return; }

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
        const compressed = compressImageToDataUrl(img, 1500);
        pushUndo();
        const page = getCurrentPage();
        const rec = placeImageInsidePage(page, compressed.dataUrl, compressed.natW, compressed.natH, { caption: caption || 'Ảnh đề bài' });
        setActiveTool('select');
        state.selectedItem = { kind: 'image', id: rec.id };
        syncSelectionBar();
        renderCommittedLayer();
        scheduleActiveRender();
        scheduleLocalAutoSave();
        notify('Đã đặt ảnh lên trang. Bạn có thể kéo góc để chỉnh kích thước ngay.', 'success');
        resolve();
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Không thể đọc tệp ảnh đã chọn.')); };
      img.src = url;
    });
  }

  async function importPdfArrayBufferToPages(arrayBuffer, docTitle) {
    setInsertProgress(true, 'Đang chuẩn bị trình đọc tài liệu...', 10);
    const pdfLib = await ensurePdfReader();
    const pdfDoc = await pdfLib.getDocument({ data: arrayBuffer }).promise;
    const total = Math.min(pdfDoc.numPages || 0, 30);
    if (!total) throw new Error('Tệp PDF không có trang nội dung nào.');

    const basePaper = JSON.parse(JSON.stringify(getCurrentPage().paperConfig));
    const curPage = getCurrentPage();
    const curIsEmpty = !curPage.strokes.length && !curPage.shapes.length && !curPage.images.length;
    const firstIdx = curIsEmpty ? state.activePageIndex : state.activePageIndex + 1;
    let firstImgId = '';

    for (let pNum = 1; pNum <= total; pNum++) {
      setInsertProgress(true, 'Đang dàn trang đề bài ' + pNum + ' / ' + total + '...', Math.round(15 + (pNum / total) * 80));
      const pdfPage = await pdfDoc.getPage(pNum);
      const viewport = pdfPage.getViewport({ scale: 1.65 });
      const off = document.createElement('canvas');
      off.width = Math.round(viewport.width);
      off.height = Math.round(viewport.height);
      const octx = off.getContext('2d');
      octx.fillStyle = '#FFFFFF';
      octx.fillRect(0, 0, off.width, off.height);
      await pdfPage.render({ canvasContext: octx, viewport: viewport }).promise;

      const compressed = compressImageToDataUrl(off, 1500);
      const targetPage = (pNum === 1 && curIsEmpty) ? curPage : createBlankPage(basePaper);
      if (!(pNum === 1 && curIsEmpty)) state.pages.splice(firstIdx + pNum - 1, 0, targetPage);

      const placed = placeImageInsidePage(targetPage, compressed.dataUrl, compressed.natW, compressed.natH, {
        alignLeft: true,
        caption: (docTitle || 'Đề bài PDF') + ' — Trang ' + pNum
      });
      if (pNum === 1) firstImgId = placed.id;
    }

    if (docTitle && state.title === 'Bảng Giảng Thiên Văn') {
      state.title = String(docTitle).replace(/\.pdf$/i, '').slice(0, 80);
    }

    switchToPage(firstIdx);
    if (firstImgId) {
      setActiveTool('select');
      state.selectedItem = { kind: 'image', id: firstImgId };
      syncSelectionBar();
      scheduleActiveRender();
    }
    scheduleLocalAutoSave();
    notify('Đã chèn ' + total + ' trang đề bài PDF lên bảng.', 'success');
  }

  async function openDocumentOnBoard(doc) {
    if (!doc) return;
    const C = getCore();
    const fid = doc.fileId || (C && C.drive && doc.previewUrl ? C.drive.parseDriveLink(doc.previewUrl) : '');
    const title = doc.title || doc.name || 'Tài liệu đề bài';
    const mime = String(doc.mimeType || '').toLowerCase();

    if (fid && C && C.drive && typeof C.drive.downloadBlob === 'function' && C.auth && C.auth.getAccessToken()) {
      try {
        notify('Đang tải tài liệu "' + title + '" lên Bảng Giảng...', 'info');
        const blob = await C.drive.downloadBlob(fid);
        if (blob && blob.size > 0) {
          const bType = String(blob.type || mime).toLowerCase();
          if (bType.indexOf('pdf') >= 0 || /\.pdf$/i.test(title)) {
            await importPdfArrayBufferToPages(await blob.arrayBuffer(), title);
            return;
          }
          if (bType.indexOf('image/') === 0 || /\.(png|jpe?g|webp)$/i.test(title)) {
            await insertImageBlobToCurrentPage(blob, title);
            return;
          }
        }
      } catch (e) {}
    }

    if (doc.previewUrl || fid) {
      state.refDoc = doc;
      const panel = document.getElementById('vtSlateRefDoc');
      const titleEl = document.getElementById('vtSlateRefDocTitle');
      const frame = document.getElementById('vtSlateRefDocFrame');
      if (titleEl) titleEl.textContent = title;
      if (frame) frame.src = doc.previewUrl || ('https://drive.google.com/file/d/' + fid + '/preview');
      if (panel) panel.classList.add('open');
      setTimeout(resizeSlateLayers, 50);
      notify('Đã mở tài liệu đối chiếu bên cạnh Bảng Giảng.', 'success');
    }
  }

  /* ==========================================================================
   * 13. MULTI-PAGE PDF EXPORT (EXACT PAGE BOUNDS) & CONSTELLATION PUBLISH
   * ========================================================================== */

  function loadImageByIdPromise(imgId, fallbackDataUrl) {
    return new Promise(function (resolve) {
      const src = imageBinaryStore.get(imgId) || fallbackDataUrl;
      if (!src) { resolve(null); return; }
      const cached = imageElementCache.get(imgId);
      if (cached && cached.complete && cached.naturalWidth > 0 && cached.src === src) { resolve(cached); return; }
      const img = new Image();
      img.onload = function () { imageElementCache.set(imgId, img); resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  async function renderPageToExportImage(page, pageIndex, totalPages) {
    const imgs = page.images || [];
    for (let i = 0; i < imgs.length; i++) {
      await loadImageByIdPromise(imgs[i].id, imgs[i].dataUrl);
    }
    const dims = getPageDims(page);
    const scale = 1.8;
    const off = document.createElement('canvas');
    off.width = Math.round(dims.w * scale);
    off.height = Math.round(dims.h * scale);
    const ctx = off.getContext('2d');
    ctx.save();
    ctx.scale(scale, scale);

    drawBoundedPaperSheet(ctx, page, pageIndex, totalPages, true);
    imgs.forEach(function (im) {
      const el = imageElementCache.get(im.id);
      if (el && el.complete && el.naturalWidth > 0) ctx.drawImage(el, im.x, im.y, im.w, im.h);
    });
    (page.strokes || []).forEach(function (st) { if (st.tool === 'highlighter') drawStroke(ctx, st); });
    (page.shapes || []).forEach(function (sh) { drawVectorShape(ctx, sh); });
    (page.strokes || []).forEach(function (st) { if (st.tool !== 'highlighter') drawStroke(ctx, st); });
    ctx.restore();

    return { dataUrl: off.toDataURL('image/jpeg', 0.92), dims: dims };
  }

  async function buildMultiPagePdfBlob(onProgress) {
    const JsPDFCtor = await ensurePdfExporter();
    const firstDims = getPageDims(state.pages[0]);
    const doc = new JsPDFCtor({ orientation: firstDims.pdfOrient, unit: 'mm', format: 'a4', compress: true });

    for (let i = 0; i < state.pages.length; i++) {
      if (onProgress) onProgress(i + 1, state.pages.length);
      const dims = getPageDims(state.pages[i]);
      if (i > 0) doc.addPage('a4', dims.pdfOrient);
      const rendered = await renderPageToExportImage(state.pages[i], i, state.pages.length);
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 4;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const imgAspect = dims.w / dims.h;
      let drawW = availW, drawH = drawW / imgAspect;
      if (drawH > availH) { drawH = availH; drawW = drawH * imgAspect; }
      doc.addImage(rendered.dataUrl, 'JPEG', margin + (availW - drawW) / 2, margin + (availH - drawH) / 2, drawW, drawH, undefined, 'FAST');
    }
    return doc.output('blob');
  }

  async function downloadBoardAsPdf() {
    if (state.exportingPdf) return;
    state.exportingPdf = true;
    notify('Đang đóng gói tệp PDF nhiều trang...', 'info');
    try {
      const blob = await buildMultiPagePdfBlob();
      const fileName = sanitizeFilename(state.title, '.pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      notify('Đã tải xuống tệp "' + fileName + '" (' + state.pages.length + ' trang).', 'success');
    } catch (err) {
      notify((err && err.message) || 'Chưa thể xuất tệp PDF lúc này.', 'error');
    } finally {
      state.exportingPdf = false;
    }
  }

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
      notify('Tính năng giao bài lên Kho Chòm sao chỉ dành cho Giáo viên Bộ môn và Quản trị viên.', 'warning');
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
    grid.innerHTML = '<div style="font-size:12px;opacity:0.7;grid-column:1/-1;">Đang tải danh sách lớp giảng dạy...</div>';

    try {
      const hub = await C.api.post('resources_get_hub', {});
      const allClasses = hub && Array.isArray(hub.classes) ? hub.classes : [];
      const resources = hub && Array.isArray(hub.resources) ? hub.resources : [];
      state.hubClasses = allClasses.filter(function (cls) {
        return !(C.policy && typeof C.policy.canTeachClass === 'function') || C.policy.canTeachClass(cls.classId);
      });
      if (!state.hubClasses.length && allClasses.length) state.hubClasses = allClasses;

      const chapSet = new Set();
      resources.forEach(function (r) { if (r && r.chapterConstellation) chapSet.add(r.chapterConstellation); });
      state.hubChapters = Array.from(chapSet);
      const hintList = document.getElementById('vtSlateChapterHints');
      if (hintList) hintList.innerHTML = state.hubChapters.map(function (ch) { return '<option value="' + escapeAttr(ch) + '"></option>'; }).join('');
      const chapInp = document.getElementById('vtSlatePubChapter');
      if (chapInp && !chapInp.value && state.hubChapters.length) chapInp.value = state.hubChapters[0];

      grid.innerHTML = state.hubClasses.length
        ? state.hubClasses.map(function (c) {
            return '<label class="vt-slate-class-chip"><input type="checkbox" value="' + escapeAttr(c.classId) + '" checked> <span>Lớp ' + escapeHtml(c.className) + ' (' + escapeHtml(c.gradeBlock || '') + ')</span></label>';
          }).join('')
        : '<div style="font-size:12px;opacity:0.72;grid-column:1/-1;">Chưa có lớp học được phân công. Bài giải sẽ lưu ở phạm vi riêng tư.</div>';
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
    const summary = document.getElementById('vtSlatePubSummary').value.trim() || ('Bài giải viết tay gồm ' + state.pages.length + ' trang.');
    if (!title) { notify('Vui lòng nhập tiêu đề bài giảng.', 'warning'); return; }

    const assignedClassIds = [];
    document.querySelectorAll('#vtSlatePubClassGrid input[type="checkbox"]:checked').forEach(function (cb) { assignedClassIds.push(cb.value); });

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
        onProgress: function (pct) { setPublishProgress(true, 'Đang tải lên (' + pct + '%)...', Math.round(55 + pct * 0.30)); }
      });
      if (!uploaded || !uploaded.fileId) throw new Error('Không thể tải tệp PDF lên thư mục học liệu.');
      state.pdfDriveFileId = uploaded.fileId;

      setPublishProgress(true, 'Đang gắn bài giải lên Kho Chòm sao...', 90);
      const res = await C.api.post('resources_upsert', {
        payload: {
          title: title, subject: 'Toán học', gradeBlock: gradeBlock, chapterConstellation: chapterConstellation,
          topicPattern: 'Bài giải viết tay', cognitiveLevel: 'THONG_HIEU', resourceType: 'PDF_HANDOUT',
          publishScope: assignedClassIds.length ? 'CLASS_ASSIGNED' : 'PRIVATE',
          starOrder: 1, summary: summary,
          files: [{ fileId: uploaded.fileId, name: uploaded.name || fileName, mimeType: 'application/pdf', previewUrl: uploaded.previewUrl, downloadUrl: uploaded.downloadUrl }],
          blocks: [], assignedClassIds: assignedClassIds
        }
      });
      if (!res || !res.ok) throw new Error((res && res.error) || 'Chưa thể lưu bài giảng lên Kho Chòm sao.');

      setPublishProgress(true, 'Hoàn tất xuất bản!', 100);
      state.title = title;
      syncPageHeaderUI();
      if (C.bus && typeof C.bus.emit === 'function') C.bus.emit('resources-updated', { source: 'astral-slate' });
      state.publishing = false;
      if (submitBtn) submitBtn.disabled = false;
      closePublishModal();
      notify('Đã lưu và giao bài giải "' + title + '" lên Kho Chòm sao thành công.', 'success');
    } catch (err) {
      notify((err && err.message) || 'Chưa thể giao bài giải lên Kho Chòm sao.', 'error');
      state.publishing = false;
      if (submitBtn) submitBtn.disabled = false;
      setPublishProgress(false);
    }
  }

  /* ==========================================================================
   * 14. LIFECYCLE API & STICKY BUS SUBSCRIPTIONS
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
      scheduleActiveRender();
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
    if (state.isFullscreen) setFullscreenMode(false);
    clearHoldTimer();
    if (activeDirtyRaf) { cancelAnimationFrame(activeDirtyRaf); activeDirtyRaf = 0; }
    if (state.laserRafId) { cancelAnimationFrame(state.laserRafId); state.laserRafId = 0; }
    state.laserTrails = [];
    saveLocalDraftNow();
  }

  const C0 = getCore();
  if (C0 && typeof C0.registerSector === 'function') {
    C0.registerSector('slate', {
      containerId: 'sectorSlate',
      mount: async function () {
        if (C0.auth && !C0.auth.isSignedIn()) return;
        const host = document.getElementById('vtSlateMount');
        if (host && !state.mounted) host.innerHTML = '';
        await onActivate();
        requestAnimationFrame(function () {
          resizeSlateLayers();
          fitPageToViewport();
        });
      },
      refresh: async function () {
        if (C0.auth && !C0.auth.isSignedIn()) return;
        await onActivate();
        requestAnimationFrame(function () {
          resizeSlateLayers();
          fitPageToViewport();
        });
      },
      unmount: function () {
        onDeactivate();
      }
    });
  }
  if (C0 && C0.bus) {
    C0.bus.on('session-changed', function () {
      syncRolePermissionsUI();
      if (state.mounted) { renderCommittedLayer(); scheduleActiveRender(); }
    });
    C0.bus.on('slate-insert-lab', function (payload) {
      if (!payload) return;
      if (!state.mounted) { window.__VT_PENDING_LAB_CAPTURE__ = payload; return; }
      insertLabCapture(payload);
    });
    C0.bus.on('slate-open-document', function (payload) {
      if (!payload) return;
      if (!state.mounted) { window.__VT_PENDING_SLATE_DOC__ = payload; return; }
      openDocumentOnBoard(payload);
    });
  }

  window.VANTHESIS_SLATE = Object.freeze({
    version: '2.0',
    onActivate: onActivate,
    onDeactivate: onDeactivate,
    insertLabCapture: insertLabCapture,
    openDocumentOnBoard: openDocumentOnBoard,
    downloadBoardAsPdf: downloadBoardAsPdf,
    fitPageToViewport: fitPageToViewport,
    setFullscreenMode: setFullscreenMode,
    screenToWorld: screenToWorld,
    worldToScreen: worldToScreen,
    getState: function () {
      return {
        boardId: state.boardId,
        title: state.title,
        folderName: state.folderName,
        activePageIndex: state.activePageIndex,
        pages: state.pages
      };
    }
  });
})();
