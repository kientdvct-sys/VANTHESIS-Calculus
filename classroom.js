/**
 * VANTHESIS Calculus — Cosmic Liquid Glass Classroom & Dual Gradebook Hub v4.0
 * File: classroom.js (placed alongside index.html)
 * Namespace: window.VANTHESIS_CLASSROOM
 * Design Language: Apple Concentric Squircle + Liquid Glass + Mobile/iPad Responsive + Self-Healing Client
 *
 * Depends on window.VANTHESIS_SESSION_CONTEXT:
 *   { bridgeUrl, accessToken, email, role, fullName, avatar, status }
 */
(function () {
  'use strict';

  const STYLE_ID = 'vanthesis-classroom-styles';
  const MODAL_ID = 'vtClassroomModal';
  const EXPECTED_BACKEND_VERSION = '6.0';
  const MAX_BULK_IMPORT = 60;
  const HEARTBEAT_MS = 8000;
  const PERM_META = [
    { key: 'manageRoster', label: 'Quản lý danh sách lớp' },
    { key: 'editStandardGrades', label: 'Sửa điểm Phổ thông' },
    { key: 'editTrackingGrades', label: 'Sửa điểm Theo dõi' },
    { key: 'logAttendanceAndBehavior', label: 'Điểm danh & Điểm hành vi' },
    { key: 'addGrowthNotes', label: 'Ghi nhận xét kèm cặp' },
    { key: 'viewClassSummary', label: 'Xem tổng hợp & cảnh báo' },
    { key: 'exportReports', label: 'Xuất báo cáo CSV' }
  ];

  const state = {
    isOpen: false,
    cosmicDark: false,
    drawerOpen: false,
    backendVersion: '',
    backendWarning: '',
    localSyncRev: 0,
    syncStatus: 'live',      // 'live' | 'syncing' | 'pending_merge' | 'offline'
    effectivePermissions: {},
    linkFilter: 'all',       // 'all' | 'linked' | 'unlinked'
    transferringStudent: null,

    // v5.0 Unified RBAC, Faculty & Master Student Directory
    rbacData: null,
    loadingRbac: false,
    rbacSearch: '',
    rbacStatusFilter: 'ALL',
    facultySearch: '',
    facultyRoleFilter: 'ALL',
    masterSearch: '',
    masterBlockFilter: 'ALL',
    masterClassFilter: 'ALL',
    masterWarningFilter: 'ALL',
    masterLinkFilter: 'ALL',

    // v5.0 Student 360° Drawer, Seewo Quick Behavior, Attendance & DingTalk Tracking
    trackingIncompleteOnly: false,
    profile360: null,
    loading360: false,
    profile360Tab: 'grades', // 'grades' | 'timeline' | 'notes'
    quickBehStudent: null,
    attendanceDate: new Date().toISOString().slice(0, 10),
    attendanceDraft: {},
    loadingBootstrap: false,
    loadingRoster: false,
    loadingMatrix: false,
    loadingGrades: false,
    loadingStudentPortal: false,
    bootstrap: null,
    role: '',
    sidebarMode: 'classes',  // 'classes' | 'faculty' (for SUPER_ADMIN Faculty Orbit)
    selectedClassId: '',
    selectedSubject: '',
    selectedSemester: 'HK1',
    activeTab: 'roster',     // 'roster' | 'gradebook' | 'summary' | 'tracking_view' | 'mygrades'
    gradeSubTab: 'standard', // 'standard' | 'tracking'
    roster: [],
    activeClassInfo: null,
    canEditRoster: false,
    searchQuery: '',
    summaryMatrix: null,

    // Dual Gradebook state
    gradeCanEdit: false,
    standardRows: {},        // map[studentId] = { tx1, tx2, tx3, midterm, final, average }
    standardDirty: {},       // map['studentId:field'] = true
    trackingColumns: [],     // [{ id, name, type: 'score10'|'passfail', date }]
    trackingRows: {},        // map[studentId] = { [colId]: val }
    trackingDirty: {},       // map['studentId:colId'] = true

    // Student personal multi-subject detailed bundles
    studentSubjectBundles: [],

    // Sub-modal working refs
    editingClass: null,
    editingStudent: null,
    editingTrackColId: null,
    bulkParsedRows: [],
    confirmCallback: null
  };

  /* ==========================================================================
   * 1. STYLESHEET INJECTION — APPLE CONCENTRIC SQUIRCLE & COSMIC LIQUID GLASS
   * ========================================================================== */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID} {
        /* Concentric Squircle Radii (R_inner = R_outer - padding) */
        --vt-r-shell: 30px;
        --vt-r-banner: 22px;
        --vt-r-card: 18px;
        --vt-r-row: 14px;
        --vt-r-input: 13px;
        --vt-r-pill: 9999px;

        /* iOS Spring Motion Physics */
        --vt-spring-smooth: cubic-bezier(0.22, 1, 0.36, 1);
        --vt-spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

        /* Daylight Observatory Liquid Glass Palette */
        --cr-bg: rgba(250, 249, 246, 0.85);
        --cr-surface: rgba(255, 255, 255, 0.78);
        --cr-surface-solid: #FFFFFF;
        --cr-subtle: rgba(15, 23, 42, 0.045);
        --cr-ink: #0F172A;
        --cr-muted: #475569;
        --cr-soft: #64748B;
        --cr-border: rgba(15, 23, 42, 0.09);
        --cr-border-strong: rgba(15, 23, 42, 0.16);
        --cr-cobalt: #1D4ED8;
        --cr-cobalt-soft: rgba(29, 78, 216, 0.10);
        --cr-amber: #B45309;
        --cr-amber-soft: rgba(180, 83, 9, 0.12);
        --cr-emerald: #047857;
        --cr-emerald-soft: rgba(4, 120, 87, 0.12);
        --cr-indigo: #4338CA;
        --cr-indigo-soft: rgba(67, 56, 202, 0.12);
        --cr-danger: #DC2626;
        --cr-danger-soft: rgba(220, 38, 38, 0.10);
        --cr-serif: 'Newsreader', 'STIX Two Text', Georgia, serif;
        --cr-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        --cr-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;

        position: fixed;
        inset: 0;
        z-index: 9500;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 14px;
        background: rgba(9, 15, 36, 0.32);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: var(--cr-ink);
        font-family: var(--cr-sans);
        font-size: 13.5px;
      }
      #${MODAL_ID}.open { display: flex; }

      /* Cosmic Night Mode (.vt-cosmic-dark) */
      #${MODAL_ID}.vt-cosmic-dark {
        --cr-bg: rgba(6, 11, 25, 0.88);
        --cr-surface: rgba(15, 23, 42, 0.72);
        --cr-surface-solid: #0F172A;
        --cr-subtle: rgba(148, 163, 184, 0.10);
        --cr-ink: #F8FAFC;
        --cr-muted: #CBD5E1;
        --cr-soft: #94A3B8;
        --cr-border: rgba(148, 163, 184, 0.18);
        --cr-border-strong: rgba(148, 163, 184, 0.28);
        --cr-cobalt: #38BDF8;
        --cr-cobalt-soft: rgba(56, 189, 248, 0.14);
        --cr-amber: #FBBF24;
        --cr-amber-soft: rgba(251, 191, 36, 0.16);
        --cr-emerald: #34D399;
        --cr-emerald-soft: rgba(52, 211, 153, 0.14);
        --cr-indigo: #A5B4FC;
        --cr-indigo-soft: rgba(129, 140, 248, 0.16);
        background: rgba(2, 6, 23, 0.68);
      }

      /* Animated Astrolabe Backdrop SVG (auto-paused when closed) */
      @keyframes vtAstrolabeCW { to { transform: rotate(360deg); } }
      @keyframes vtAstrolabeCCW { to { transform: rotate(-360deg); } }
      .vt-cosmic-astrolabe-bg {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        opacity: 0.95;
      }
      .vt-astro-cw {
        transform-origin: 720px 360px;
        animation: vtAstrolabeCW 140s linear infinite;
        animation-play-state: paused;
      }
      .vt-astro-ccw {
        transform-origin: 720px 360px;
        animation: vtAstrolabeCCW 190s linear infinite;
        animation-play-state: paused;
      }
      #${MODAL_ID}.open .vt-astro-cw,
      #${MODAL_ID}.open .vt-astro-ccw {
        animation-play-state: running;
      }

      /* Main Liquid Glass Shell (30px Squircle + Soft Spring Entrance) */
      @keyframes vtShellSpringIn {
        0% { opacity: 0; transform: scale(0.95) translateY(14px); filter: blur(4px); }
        100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
      }
      .vt-cr-shell {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
        max-width: 1460px;
        display: flex;
        flex-direction: column;
        border-radius: var(--vt-r-shell);
        background: rgba(250, 249, 246, 0.85);
        backdrop-filter: blur(24px) saturate(165%);
        -webkit-backdrop-filter: blur(24px) saturate(165%);
        border: 1px solid rgba(255, 255, 255, 0.88);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.96),
          0 30px 75px -16px rgba(15, 23, 42, 0.24),
          0 8px 24px -6px rgba(29, 78, 216, 0.08);
        overflow: hidden;
        transition: background 0.35s var(--vt-spring-smooth), border-color 0.35s ease, box-shadow 0.35s ease;
      }
      #${MODAL_ID}.open .vt-cr-shell {
        animation: vtShellSpringIn 0.38s var(--vt-spring-smooth) both;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-shell {
        background: rgba(6, 11, 25, 0.88);
        border: 1px solid rgba(56, 189, 248, 0.24);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.14),
          0 34px 80px -16px rgba(0, 0, 0, 0.65),
          0 0 36px -10px rgba(56, 189, 248, 0.18);
      }

      /* Topbar Header */
      .vt-cr-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 13px 22px;
        background: rgba(255, 255, 255, 0.68);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border-bottom: 1px solid var(--cr-border);
        flex-shrink: 0;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-topbar {
        background: rgba(11, 18, 38, 0.72);
      }
      .vt-cr-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .vt-cr-brand-title { font-family: var(--cr-serif); font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--cr-ink); line-height: 1.15; }
      .vt-cr-brand-sub { font-size: 11.4px; color: var(--cr-soft); margin-top: 1px; }
      .vt-cr-top-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

      .vt-cr-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }

      /* Left Constellation Sidebar (284px) */
      .vt-cr-sidebar {
        width: 284px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        background: rgba(255, 255, 255, 0.46);
        border-right: 1px solid var(--cr-border);
        overflow-y: auto;
        padding: 16px 14px;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-sidebar {
        background: rgba(9, 15, 34, 0.54);
      }
      .vt-cr-side-section { margin-bottom: 16px; }
      .vt-cr-grade-header {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 4px 6px;
        margin-bottom: 8px;
      }
      .vt-cr-grade-star { color: var(--cr-amber); font-size: 12px; }
      .vt-cr-grade-name {
        font-family: var(--cr-mono);
        font-size: 10.8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--cr-muted);
        white-space: nowrap;
      }
      .vt-cr-grade-line { flex: 1; height: 1px; background: var(--cr-border); }
      .vt-cr-orbit-list {
        margin-left: 11px;
        padding-left: 12px;
        border-left: 1.5px dashed rgba(29, 78, 216, 0.25);
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-orbit-list {
        border-left-color: rgba(56, 189, 248, 0.28);
      }
      .vt-cr-nav-item {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 13px;
        border-radius: var(--vt-r-card);
        border: 1px solid var(--cr-border);
        background: var(--cr-surface);
        color: var(--cr-ink);
        font-family: var(--cr-sans);
        font-size: 13px;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
        box-shadow: 0 4px 14px -6px rgba(15, 23, 42, 0.06);
        transition: transform 0.2s var(--vt-spring-smooth), border-color 0.18s ease, background 0.18s ease, box-shadow 0.2s ease;
      }
      .vt-cr-nav-item::before {
        content: "";
        position: absolute;
        left: -17px;
        top: 50%;
        width: 8px;
        height: 8px;
        margin-top: -4px;
        border-radius: 50%;
        background: #CBD5E1;
        border: 2px solid var(--cr-surface-solid);
        transition: background 0.2s ease, box-shadow 0.2s ease;
      }
      .vt-cr-nav-item:hover {
        border-color: rgba(29, 78, 216, 0.34);
        transform: translateX(2px);
        box-shadow: 0 10px 22px -10px rgba(29, 78, 216, 0.20);
      }
      .vt-cr-nav-item:active { transform: scale(0.97); }
      .vt-cr-nav-item.active {
        background: var(--cr-surface-solid);
        border-color: var(--cr-cobalt);
        color: var(--cr-cobalt);
        box-shadow: 0 10px 26px -10px rgba(29, 78, 216, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-nav-item.active {
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 10px 26px -10px rgba(56, 189, 248, 0.30), inset 0 1px 0 rgba(255, 255, 255, 0.14);
      }
      @keyframes vtOrbitPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
        50% { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0); }
      }
      .vt-cr-nav-item.active::before {
        background: #F59E0B;
        animation: vtOrbitPulse 2s ease-in-out infinite;
      }
      .vt-cr-nav-sub {
        display: block;
        font-size: 11px;
        font-weight: 500;
        color: var(--cr-soft);
        margin-top: 2px;
        max-width: 155px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .vt-cr-count-pill {
        font-family: var(--cr-mono);
        font-size: 10.6px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: var(--vt-r-pill);
        background: var(--cr-subtle);
        color: var(--cr-muted);
        flex-shrink: 0;
      }
      .vt-cr-nav-item.active .vt-cr-count-pill {
        background: var(--cr-cobalt-soft);
        color: var(--cr-cobalt);
      }

      /* Right Workspace */
      .vt-cr-main { flex: 1; min-width: 0; overflow-y: auto; padding: 20px 24px 32px; }

      /* Cosmic Class Command Banner (22px Concentric Radius) */
      .vt-cr-banner {
        position: relative;
        overflow: hidden;
        border-radius: var(--vt-r-banner);
        padding: 22px 24px;
        background: linear-gradient(135deg, #090F24 0%, #172554 55%, #1E1B4B 100%);
        border: 1px solid rgba(255, 255, 255, 0.16);
        box-shadow: 0 22px 48px -16px rgba(9, 15, 36, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.18);
        color: #F8FAFC;
        margin-bottom: 18px;
      }
      .vt-cr-banner-svg {
        position: absolute;
        right: -18px;
        top: -18px;
        width: 280px;
        height: 200px;
        pointer-events: none;
        opacity: 0.72;
      }
      .vt-cr-banner-top {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .vt-cr-banner-eyebrow {
        font-family: var(--cr-mono);
        font-size: 10.8px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #FCD34D;
        margin-bottom: 5px;
      }
      .vt-cr-banner-title {
        font-family: var(--cr-serif);
        font-size: 29px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #FFFFFF;
        margin: 0 0 8px;
        line-height: 1.1;
      }
      .vt-cr-banner-gvcn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 11px;
        border-radius: var(--vt-r-pill);
        background: rgba(251, 191, 36, 0.16);
        border: 1px solid rgba(251, 191, 36, 0.36);
        color: #FDE68A;
        font-size: 11.8px;
        font-weight: 600;
      }
      .vt-cr-banner-kpis {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .vt-cr-banner-kpi {
        padding: 11px 14px;
        border-radius: var(--vt-r-row);
        background: rgba(255, 255, 255, 0.09);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.14);
      }
      .vt-cr-banner-kpi span { font-size: 11px; color: #CBD5E1; display: block; margin-bottom: 2px; }
      .vt-cr-banner-kpi b { font-family: var(--cr-mono); font-size: 15.5px; font-weight: 700; color: #FFFFFF; }

      /* Main Content Panel */
      .vt-cr-card {
        background: var(--cr-surface);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--cr-border);
        border-radius: var(--vt-r-banner);
        padding: 18px 20px;
        box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.65);
        margin-bottom: 16px;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-card {
        box-shadow: 0 14px 36px -12px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.10);
      }

      /* iOS Segmented Control Tabs (Pill Glass Tray) */
      .vt-cr-tabs {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border-radius: var(--vt-r-pill);
        background: rgba(15, 23, 42, 0.055);
        border: 1px solid var(--cr-border);
        margin-bottom: 16px;
        max-width: 100%;
        overflow-x: auto;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-tabs {
        background: rgba(15, 23, 42, 0.72);
      }
      .vt-cr-tab {
        appearance: none;
        border: none;
        background: transparent;
        color: var(--cr-muted);
        font-family: var(--cr-sans);
        font-size: 12.6px;
        font-weight: 600;
        padding: 8px 15px;
        border-radius: var(--vt-r-pill);
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.24s var(--vt-spring-smooth);
      }
      .vt-cr-tab:hover { color: var(--cr-ink); }
      .vt-cr-tab:active { transform: scale(0.97); }
      .vt-cr-tab.active {
        background: var(--cr-surface-solid);
        color: var(--cr-cobalt);
        box-shadow: 0 4px 14px -3px rgba(15, 23, 42, 0.14);
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-tab.active {
        background: rgba(56, 189, 248, 0.18);
        color: #E0F2FE;
        box-shadow: 0 4px 14px -3px rgba(0, 0, 0, 0.45);
      }

      .vt-cr-subtabs {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border-radius: var(--vt-r-pill);
        background: rgba(15, 23, 42, 0.055);
        border: 1px solid var(--cr-border);
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-subtabs { background: rgba(15, 23, 42, 0.75); }
      .vt-cr-subtab {
        appearance: none; border: none; background: transparent; color: var(--cr-muted);
        font-family: var(--cr-sans); font-size: 12.2px; font-weight: 600;
        padding: 6px 14px; border-radius: var(--vt-r-pill); cursor: pointer;
        transition: all 0.22s var(--vt-spring-smooth);
      }
      .vt-cr-subtab.active {
        background: var(--cr-surface-solid); color: var(--cr-cobalt);
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.10);
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-subtab.active {
        background: rgba(56, 189, 248, 0.20); color: #E0F2FE;
      }

      /* Badges & Pills */
      .vt-cr-badge {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 4px 10px; border-radius: var(--vt-r-pill); font-size: 11px; font-weight: 700; white-space: nowrap;
      }
      .vt-cr-badge.admin { background: var(--cr-amber-soft); color: var(--cr-amber); border: 1px solid rgba(180, 83, 9, 0.26); }
      .vt-cr-badge.homeroom { background: var(--cr-cobalt-soft); color: var(--cr-cobalt); border: 1px solid rgba(29, 78, 216, 0.26); }
      .vt-cr-badge.subject { background: var(--cr-indigo-soft); color: var(--cr-indigo); border: 1px solid rgba(67, 56, 202, 0.26); }
      .vt-cr-badge.student { background: var(--cr-emerald-soft); color: var(--cr-emerald); border: 1px solid rgba(4, 120, 87, 0.26); }
      .vt-cr-badge.linked { background: var(--cr-emerald-soft); color: var(--cr-emerald); border: 1px solid rgba(4, 120, 87, 0.28); }
      .vt-cr-badge.unlinked { background: transparent; color: var(--cr-soft); border: 1px dashed var(--cr-border-strong); }
      .vt-cr-badge.dirty { background: #FEF3C7; color: #92400E; border: 1px solid #F59E0B; }

      .vt-cr-id-pill {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 9px; border-radius: var(--vt-r-pill);
        background: var(--cr-cobalt-soft); border: 1px solid rgba(29, 78, 216, 0.22);
        color: var(--cr-cobalt); font-family: var(--cr-mono); font-size: 11.4px; font-weight: 700;
      }
      .vt-cr-avatar {
        width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        color: #FFFFFF; font-size: 11.5px; font-weight: 800; letter-spacing: 0.02em;
        box-shadow: 0 4px 10px -3px rgba(15, 23, 42, 0.22);
      }
      .vt-cr-avatar.male { background: linear-gradient(135deg, #1D4ED8 0%, #0EA5E9 100%); }
      .vt-cr-avatar.female { background: linear-gradient(135deg, #4338CA 0%, #D97706 100%); }
      .vt-cr-avatar.other { background: linear-gradient(135deg, #0F766E 0%, #2563EB 100%); }

      @keyframes vtDotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.25); }
      }
      .vt-live-dot {
        width: 7px; height: 7px; border-radius: 50%; background: #10B981;
        display: inline-block; animation: vtDotPulse 2s ease-in-out infinite;
      }

      /* Toolbar, Pill Buttons & Shimmer CTA */
      .vt-cr-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
      .vt-cr-search, .vt-cr-select {
        height: 36px; padding: 0 13px; border-radius: var(--vt-r-input);
        border: 1px solid var(--cr-border-strong); background: var(--cr-surface-solid);
        color: var(--cr-ink); font-family: var(--cr-sans); font-size: 12.8px; outline: none;
        transition: border-color 0.16s ease, box-shadow 0.16s ease;
      }
      .vt-cr-search { flex: 1; min-width: 200px; max-width: 340px; }
      .vt-cr-search:focus, .vt-cr-select:focus { border-color: var(--cr-cobalt); box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.14); }

      .vt-cr-btn {
        position: relative; overflow: hidden;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        height: 36px; padding: 0 15px; border-radius: var(--vt-r-pill);
        border: 1px solid var(--cr-border-strong); background: var(--cr-surface-solid);
        color: var(--cr-ink); font-family: var(--cr-sans); font-size: 12.4px; font-weight: 600;
        cursor: pointer; white-space: nowrap;
        transition: transform 0.16s var(--vt-spring-bounce), border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
      }
      .vt-cr-btn:hover { border-color: var(--cr-cobalt); color: var(--cr-cobalt); }
      .vt-cr-btn:active { transform: scale(0.97); }
      .vt-cr-btn:disabled { opacity: 0.52; cursor: not-allowed; }
      .vt-cr-btn-primary {
        background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%);
        border-color: transparent; color: #FFFFFF;
        box-shadow: 0 8px 20px -6px rgba(29, 78, 216, 0.48);
      }
      .vt-cr-btn-primary:hover { filter: brightness(1.06); color: #FFFFFF; }
      .vt-cr-btn-shimmer::after {
        content: ""; position: absolute; top: -20%; left: -120%; width: 55%; height: 140%;
        background: linear-gradient(105deg, transparent, rgba(255,255,255,0.34), transparent);
        transform: skewX(-18deg); transition: left 0.6s var(--vt-spring-smooth); pointer-events: none;
      }
      .vt-cr-btn-shimmer:hover::after { left: 150%; }
      .vt-cr-btn-emerald {
        background: linear-gradient(135deg, #047857 0%, #059669 100%);
        border-color: transparent; color: #FFFFFF;
      }
      .vt-cr-btn-emerald:hover { filter: brightness(1.06); color: #FFFFFF; }
      .vt-cr-btn-glass-dark {
        background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.22); color: #F8FAFC;
      }
      .vt-cr-btn-glass-dark:hover { background: rgba(255, 255, 255, 0.22); color: #FFFFFF; border-color: rgba(255, 255, 255, 0.42); }
      .vt-cr-btn-danger { background: var(--cr-danger-soft); border-color: rgba(220, 38, 38, 0.28); color: var(--cr-danger); }
      .vt-cr-btn-danger:hover { background: rgba(220, 38, 38, 0.16); color: var(--cr-danger); border-color: var(--cr-danger); }
      .vt-cr-btn-sm { height: 31px; padding: 0 12px; font-size: 11.8px; }

      .vt-cr-readonly-bar {
        display: flex; align-items: center; gap: 8px; padding: 10px 15px;
        border-radius: var(--vt-r-row); background: var(--cr-indigo-soft);
        border: 1px solid rgba(67, 56, 202, 0.22); color: var(--cr-indigo);
        font-size: 12.4px; font-weight: 600; margin-bottom: 14px;
      }

      /* Concentric Table Wrapper (18px) & Floating Student Rows (14px) */
      .vt-cr-table-wrap {
        width: 100%; overflow-x: auto;
        border: 1px solid var(--cr-border);
        border-radius: var(--vt-r-card);
        background: var(--cr-surface-solid);
        box-shadow: 0 8px 24px -12px rgba(15, 23, 42, 0.08);
      }
      .vt-cr-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12.8px; }
      .vt-cr-table th {
        text-align: left; padding: 11px 12px; background: var(--cr-subtle); color: var(--cr-soft);
        font-size: 10.8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        border-bottom: 1px solid var(--cr-border); white-space: nowrap;
      }
      .vt-cr-table td {
        padding: 9px 12px; border-bottom: 1px solid var(--cr-border);
        color: var(--cr-ink); vertical-align: middle;
        transition: background 0.18s ease, transform 0.2s var(--vt-spring-smooth);
      }
      .vt-cr-table tr:last-child td { border-bottom: none; }
      .vt-cr-table tbody tr {
        transition: transform 0.2s var(--vt-spring-smooth), background 0.18s ease;
      }
      .vt-cr-table tbody tr:hover td { background: var(--cr-cobalt-soft); }
      .vt-cr-table tbody tr:hover td:first-child { border-top-left-radius: var(--vt-r-row); border-bottom-left-radius: var(--vt-r-row); }
      .vt-cr-table tbody tr:hover td:last-child { border-top-right-radius: var(--vt-r-row); border-bottom-right-radius: var(--vt-r-row); }
      .vt-cr-table tbody tr.vt-roster-row:hover { transform: translateX(2px); }
      .vt-cr-mono { font-family: var(--cr-mono); font-size: 12px; }

      /* Score Inputs (13px Squircle + Cream Dirty Highlight) */
      .vt-score-input {
        width: 72px; height: 34px; padding: 0 8px;
        border-radius: var(--vt-r-input);
        border: 1px solid var(--cr-border-strong);
        background: var(--cr-surface-solid); color: var(--cr-ink);
        font-family: var(--cr-mono); font-size: 12.6px; font-weight: 600;
        text-align: center; outline: none;
        transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
      }
      .vt-score-input.wide-txt { width: 118px; text-align: left; font-family: var(--cr-sans); font-size: 12px; font-weight: 500; }
      .vt-score-input:focus { border-color: var(--cr-cobalt); box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.16); }
      .vt-score-input.is-dirty { background: #FEF3C7; border-color: #D97706; color: #78350F; }
      .vt-score-input.is-invalid { background: #FEE2E2; border-color: #DC2626; color: #B91C1C; }
      .vt-score-input:disabled { background: var(--cr-subtle); color: var(--cr-muted); border-color: transparent; cursor: default; }

      .vt-avg-cell { font-family: var(--cr-mono); font-size: 13px; font-weight: 800; text-align: center; }
      .vt-avg-high { color: var(--cr-cobalt); }
      .vt-avg-low { color: var(--cr-danger); }
      .vt-avg-mid { color: var(--cr-ink); }

      .vt-th-editable { cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
      .vt-th-editable:hover { background: var(--cr-cobalt-soft); color: var(--cr-cobalt); }
      .vt-th-sub { display: block; font-size: 9.8px; font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--cr-soft); margin-top: 2px; }

      /* Faculty Orbit Cards (Super Admin) */
      .vt-faculty-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .vt-faculty-card {
        padding: 16px 18px;
        border-radius: var(--vt-r-card);
        background: var(--cr-surface-solid);
        border: 1px solid var(--cr-border);
        border-left: 4px solid var(--cr-cobalt);
        box-shadow: 0 8px 24px -10px rgba(15, 23, 42, 0.08);
      }
      .vt-faculty-card.is-homeroom { border-left-color: #D97706; }
      .vt-faculty-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }

      /* Student Achievement KPI Cards */
      .vt-stu-kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
      .vt-stu-kpi { padding: 14px 16px; border-radius: var(--vt-r-row); background: var(--cr-surface-solid); border: 1px solid var(--cr-border); box-shadow: 0 4px 14px -6px rgba(15, 23, 42, 0.08); }
      .vt-stu-kpi span { font-size: 11.4px; color: var(--cr-soft); display: block; margin-bottom: 4px; }
      .vt-stu-kpi b { font-family: var(--cr-mono); font-size: 22px; font-weight: 800; color: var(--cr-ink); }
      .vt-stu-track-card { padding: 14px 16px; border-radius: var(--vt-r-card); background: var(--cr-surface-solid); border: 1px solid var(--cr-border); margin-bottom: 10px; }
      .vt-stu-track-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .vt-stu-track-pill { padding: 8px 12px; border-radius: var(--vt-r-row); background: var(--cr-subtle); border: 1px solid var(--cr-border); font-size: 12px; }

      /* Skeleton Loader */
      @keyframes vtCrShimmer { 0% { background-position: -240px 0; } 100% { background-position: 240px 0; } }
      .vt-cr-skeleton {
        height: 16px; border-radius: 8px;
        background: linear-gradient(90deg, rgba(148,163,184,0.18) 25%, rgba(148,163,184,0.32) 50%, rgba(148,163,184,0.18) 75%);
        background-size: 480px 100%; animation: vtCrShimmer 1.3s ease-in-out infinite; margin-bottom: 10px;
      }

      /* Sub-Modals (18px Squircle) */
      .vt-cr-submodal-backdrop {
        position: fixed; inset: 0; z-index: 9600; display: none;
        align-items: center; justify-content: center; padding: 16px;
        background: rgba(9, 15, 36, 0.56); backdrop-filter: blur(10px);
      }
      .vt-cr-submodal-backdrop.open { display: flex; }
      .vt-cr-submodal {
        width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto;
        background: var(--cr-surface-solid); color: var(--cr-ink);
        border: 1px solid var(--cr-border-strong); border-radius: var(--vt-r-card);
        padding: 20px 22px; box-shadow: 0 28px 64px rgba(2, 6, 23, 0.34);
        animation: vtShellSpringIn 0.28s var(--vt-spring-smooth) both;
      }
      .vt-cr-submodal.wide { max-width: 760px; }
      .vt-cr-submodal-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--cr-border); }
      .vt-cr-submodal-title { font-family: var(--cr-serif); font-size: 19px; font-weight: 700; color: var(--cr-ink); }
      .vt-cr-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .vt-cr-field { display: flex; flex-direction: column; gap: 5px; }
      .vt-cr-field.full { grid-column: 1 / -1; }
      .vt-cr-field label { font-size: 11.8px; font-weight: 600; color: var(--cr-muted); }
      .vt-cr-field input, .vt-cr-field select, .vt-cr-field textarea {
        padding: 9px 11px; border-radius: var(--vt-r-input); border: 1px solid var(--cr-border-strong);
        background: var(--cr-surface-solid); color: var(--cr-ink); font-family: var(--cr-sans); font-size: 13px; outline: none;
      }
      .vt-cr-field input:focus, .vt-cr-field select:focus, .vt-cr-field textarea:focus {
        border-color: var(--cr-cobalt); box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.14);
      }
      .vt-cr-modal-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--cr-border); }

      /* Dynamic Island Top-Center Toast */
      #vtCrToast {
        position: fixed;
        top: 18px;
        left: 50%;
        z-index: 9700;
        padding: 10px 20px;
        border-radius: var(--vt-r-pill);
        background: #0B1120;
        color: #F8FAFC;
        font-size: 12.8px;
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 18px 40px -8px rgba(2, 6, 23, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.18);
        opacity: 0;
        transform: translate(-50%, -18px) scale(0.86);
        pointer-events: none;
        transition: opacity 0.24s ease, transform 0.42s var(--vt-spring-bounce);
        white-space: nowrap;
        max-width: 92vw;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #vtCrToast.visible {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }

      /* ===== v5.0 WEBKIT / SAMSUNG INTERNET COLOR-SCHEME LOCK ===== */
      #${MODAL_ID} {
        color-scheme: only light !important;
      }

      /* Celestial Gold Rim Glow for Active Cards & Tabs ("Tri thức bừng sáng") */
      .vt-cr-nav-item.active,
      .vt-cr-tab.active,
      .vt-admin-nav-stack .vt-cr-btn-primary,
      .vt-admin-nav-stack .vt-cr-btn-emerald {
        border-color: rgba(217, 119, 6, 0.54) !important;
        box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.26), 0 8px 22px -6px rgba(217, 119, 6, 0.22), inset 0 1px 0 rgba(254, 243, 199, 0.45) !important;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-nav-item.active,
      #${MODAL_ID}.vt-cosmic-dark .vt-cr-tab.active,
      #${MODAL_ID}.vt-cosmic-dark .vt-admin-nav-stack .vt-cr-btn-primary,
      #${MODAL_ID}.vt-cosmic-dark .vt-admin-nav-stack .vt-cr-btn-emerald {
        border-color: rgba(251, 191, 36, 0.65) !important;
        box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.32), 0 10px 26px -6px rgba(251, 191, 36, 0.24), inset 0 1px 0 rgba(254, 243, 199, 0.22) !important;
      }
      .vt-cr-readonly-bar {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: var(--vt-r-pill);
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 10px;
      }

      /* Live Sync Badge */
      .vt-sync-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 11px;
        border-radius: var(--vt-r-pill);
        font-size: 11.5px;
        font-weight: 700;
        background: rgba(16, 185, 129, 0.12);
        color: #047857;
        border: 1px solid rgba(16, 185, 129, 0.28);
        white-space: nowrap;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-sync-badge {
        background: rgba(16, 185, 129, 0.16);
        color: #34D399;
      }
      .vt-sync-badge.syncing {
        background: rgba(29, 78, 216, 0.12);
        color: var(--cr-cobalt);
        border-color: rgba(29, 78, 216, 0.28);
      }
      .vt-sync-badge.pending-merge {
        background: rgba(245, 158, 11, 0.16);
        color: #B45309;
        border-color: rgba(245, 158, 11, 0.42);
        cursor: pointer;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-sync-badge.pending-merge {
        color: #FCD34D;
      }

      /* Warning Lamps (Zhixue Early Warning) */
      .vt-warn-lamp {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        border-radius: var(--vt-r-pill);
        font-size: 11.5px;
        font-weight: 700;
        white-space: nowrap;
      }
      .vt-warn-lamp.GREEN { background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.28); }
      .vt-warn-lamp.YELLOW { background: rgba(245, 158, 11, 0.15); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.36); }
      .vt-warn-lamp.RED { background: rgba(239, 68, 68, 0.14); color: #DC2626; border: 1px solid rgba(239, 68, 68, 0.36); }
      #${MODAL_ID}.vt-cosmic-dark .vt-warn-lamp.GREEN { color: #34D399; }
      #${MODAL_ID}.vt-cosmic-dark .vt-warn-lamp.YELLOW { color: #FCD34D; }
      #${MODAL_ID}.vt-cosmic-dark .vt-warn-lamp.RED { color: #FCA5A5; }

      .vt-trend-up { color: #059669; font-weight: 700; font-family: var(--cr-mono); font-size: 11.5px; }
      .vt-trend-down { color: #DC2626; font-weight: 700; font-family: var(--cr-mono); font-size: 11.5px; }
      .vt-trend-flat { color: var(--cr-soft); font-family: var(--cr-mono); font-size: 11.5px; }
      .vt-seewo-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        border-radius: var(--vt-r-pill);
        font-family: var(--cr-mono);
        font-size: 11.8px;
        font-weight: 700;
        background: rgba(245, 158, 11, 0.14);
        color: #B45309;
        border: 1px solid rgba(245, 158, 11, 0.32);
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-seewo-pill { color: #FCD34D; }
      .vt-seewo-pill.neg { background: rgba(239, 68, 68, 0.12); color: #DC2626; border-color: rgba(239, 68, 68, 0.30); }

      /* Super Admin Sidebar Command Pills */
      .vt-admin-nav-stack {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-bottom: 14px;
        padding-bottom: 14px;
        border-bottom: 1px dashed var(--cr-border);
      }

      /* Permission Matrix Switches */
      .vt-switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 22px;
      }
      .vt-switch input { opacity: 0; width: 0; height: 0; }
      .vt-switch-slider {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.35);
        transition: 0.2s var(--vt-spring-smooth);
        cursor: pointer;
      }
      .vt-switch-slider::before {
        content: '';
        position: absolute;
        width: 16px; height: 16px;
        left: 3px; top: 3px;
        border-radius: 50%;
        background: #FFFFFF;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.22);
        transition: 0.2s var(--vt-spring-bounce);
      }
      .vt-switch input:checked + .vt-switch-slider {
        background: var(--cr-cobalt);
      }
      .vt-switch input:checked + .vt-switch-slider::before {
        transform: translateX(18px);
      }

      /* RBAC Unified User Access Card */
      .vt-rbac-user-card {
        background: var(--cr-surface-soft);
        border: 1px solid var(--cr-border);
        border-radius: var(--vt-r-card);
        padding: 14px 16px;
        margin-bottom: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .vt-rbac-user-card.is-pending {
        border-color: rgba(245, 158, 11, 0.50);
        background: rgba(254, 243, 199, 0.28);
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-rbac-user-card.is-pending {
        background: rgba(120, 53, 15, 0.20);
      }
      .vt-rbac-edit-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      /* DingTalk Tracking Progress Bar */
      .vt-dingtalk-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding: 10px 14px;
        border-radius: var(--vt-r-row);
        background: var(--cr-surface-soft);
        border: 1px solid var(--cr-border);
        margin-bottom: 12px;
      }
      .vt-progress-track {
        flex: 1;
        min-width: 140px;
        height: 8px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.24);
        overflow: hidden;
      }
      .vt-progress-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #1D4ED8, #10B981);
        transition: width 0.35s var(--vt-spring-smooth);
      }

      /* Student 360° Slide-Over Portrait Drawer (Desktop/iPad Right Drawer -> Mobile Bottom Sheet) */
      .vt-360-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 90;
        background: rgba(6, 11, 25, 0.48);
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        justify-content: flex-end;
      }
      .vt-360-backdrop.open { display: flex; }
      .vt-360-drawer {
        width: min(560px, 94vw);
        height: 100dvh;
        background: var(--cr-surface);
        border-left: 1px solid var(--cr-border);
        box-shadow: -20px 0 60px rgba(6, 11, 25, 0.28);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: vtSlideInRight 0.32s var(--vt-spring-smooth);
      }
      @keyframes vtSlideInRight {
        from { transform: translateX(100%); opacity: 0.6; }
        to { transform: translateX(0); opacity: 1; }
      }
      .vt-360-head {
        padding: 16px 20px;
        border-bottom: 1px solid var(--cr-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .vt-360-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px 28px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .vt-360-kpi-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .vt-360-kpi {
        background: var(--cr-surface-soft);
        border: 1px solid var(--cr-border);
        border-radius: var(--vt-r-row);
        padding: 10px 13px;
      }
      .vt-360-kpi span { font-size: 11px; color: var(--cr-soft); font-weight: 600; display: block; }
      .vt-360-kpi b { font-family: var(--cr-mono); font-size: 18px; color: var(--cr-ink); }

      /* Seewo 1-Tap Quick Chips */
      .vt-seewo-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .vt-seewo-chip {
        padding: 8px 12px;
        border-radius: var(--vt-r-pill);
        border: 1px solid var(--cr-border);
        background: var(--cr-surface-soft);
        color: var(--cr-ink);
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .vt-seewo-chip:hover { border-color: var(--cr-cobalt); transform: translateY(-1px); }
      .vt-seewo-chip.merit { border-color: rgba(16, 185, 129, 0.36); color: #047857; background: rgba(16, 185, 129, 0.10); }
      .vt-seewo-chip.demerit { border-color: rgba(239, 68, 68, 0.36); color: #DC2626; background: rgba(239, 68, 68, 0.10); }
      #${MODAL_ID}.vt-cosmic-dark .vt-seewo-chip.merit { color: #34D399; }
      #${MODAL_ID}.vt-cosmic-dark .vt-seewo-chip.demerit { color: #FCA5A5; }

      /* Attendance 1-Tap Row */
      .vt-att-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 9px 12px;
        border-radius: var(--vt-r-row);
        background: var(--cr-surface-soft);
        border: 1px solid var(--cr-border);
        flex-wrap: wrap;
      }
      .vt-att-pills { display: flex; gap: 5px; flex-wrap: wrap; }
      .vt-att-pill {
        padding: 5px 10px;
        border-radius: var(--vt-r-pill);
        border: 1px solid var(--cr-border);
        background: var(--cr-surface);
        color: var(--cr-muted);
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .vt-att-pill.active.PRESENT { background: #10B981; color: #fff; border-color: #10B981; }
      .vt-att-pill.active.LATE { background: #F59E0B; color: #fff; border-color: #F59E0B; }
      .vt-att-pill.active.ABSENT_EXCUSED { background: #3B82F6; color: #fff; border-color: #3B82F6; }
      .vt-att-pill.active.ABSENT_UNEXCUSED { background: #EF4444; color: #fff; border-color: #EF4444; }
      #${MODAL_ID}:not(.vt-cosmic-dark) .vt-cr-shell {
        background: rgba(250, 249, 246, 0.90);
        -webkit-backdrop-filter: blur(24px) saturate(165%);
        backdrop-filter: blur(24px) saturate(165%);
      }
      #${MODAL_ID}:not(.vt-cosmic-dark) .vt-cr-card,
      #${MODAL_ID}:not(.vt-cosmic-dark) .vt-cr-submodal {
        background: rgba(255, 255, 255, 0.92);
        -webkit-backdrop-filter: blur(18px);
        backdrop-filter: blur(18px);
      }
      #${MODAL_ID}.vt-cosmic-dark {
        color-scheme: dark !important;
      }

      /* ===== v4.0 SUPER_ADMIN COSMIC OVERVIEW KPI CARDS & AUDIT TIMELINE ===== */
      .vt-sys-kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .vt-sys-kpi-card {
        position: relative;
        background: var(--cr-surface);
        border: 1px solid var(--cr-border);
        border-radius: var(--vt-r-card);
        padding: 14px 16px;
        box-shadow: var(--cr-shadow-sm);
        transition: transform 0.2s var(--vt-spring-smooth), border-color 0.2s ease, box-shadow 0.2s ease;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .vt-sys-kpi-card.clickable {
        cursor: pointer;
        border-color: rgba(29, 78, 216, 0.24);
      }
      .vt-sys-kpi-card.clickable:hover {
        transform: translateY(-2px);
        border-color: var(--cr-cobalt);
        box-shadow: 0 10px 24px -8px rgba(29, 78, 216, 0.22);
      }
      .vt-sys-kpi-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--cr-soft);
      }
      .vt-sys-kpi-val {
        font-family: var(--cr-mono);
        font-size: 22px;
        font-weight: 700;
        color: var(--cr-ink);
        line-height: 1.2;
      }
      .vt-sys-kpi-sub {
        font-size: 11.5px;
        color: var(--cr-muted);
      }

      /* Audit Log Timeline List */
      .vt-audit-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 56dvh;
        overflow-y: auto;
        padding-right: 4px;
      }
      .vt-audit-item {
        background: var(--cr-surface-soft);
        border: 1px solid var(--cr-border);
        border-radius: var(--vt-r-row);
        padding: 10px 13px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .vt-audit-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 11px;
        color: var(--cr-soft);
        font-family: var(--cr-mono);
      }
      .vt-audit-action-pill {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: var(--vt-r-pill);
        background: var(--cr-cobalt-soft);
        color: var(--cr-cobalt);
        font-weight: 700;
        font-size: 10.5px;
      }
      .vt-audit-summary {
        font-size: 12.8px;
        color: var(--cr-ink);
        font-weight: 500;
      }

      /* Version Diagnostic Banner / Card */
      .vt-diag-card {
        background: rgba(254, 243, 199, 0.90);
        border: 1px solid rgba(217, 119, 6, 0.42);
        border-radius: var(--vt-r-card);
        padding: 16px 18px;
        margin-bottom: 16px;
        color: #78350F;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
      }
      #${MODAL_ID}.vt-cosmic-dark .vt-diag-card {
        background: rgba(120, 53, 15, 0.28);
        border-color: rgba(251, 191, 36, 0.42);
        color: #FDE68A;
      }

      /* Mobile/iPad Constellation Drawer Trigger & Backdrop */
      .vt-cr-drawer-toggle {
        display: none;
      }
      .vt-cr-drawer-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(6, 11, 25, 0.50);
        -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px);
        z-index: 55;
      }
      .vt-cr-drawer-backdrop.open {
        display: block;
      }

      /* Roster Filter Select */
      .vt-cr-filter-select {
        height: 40px;
        padding: 0 12px;
        border-radius: var(--vt-r-input);
        border: 1px solid var(--cr-border);
        background: var(--cr-surface);
        color: var(--cr-ink);
        font-family: var(--cr-sans);
        font-size: 12.8px;
        font-weight: 600;
        cursor: pointer;
      }

      /* Horizontally scrollable Segmented Control Tabs */
      .vt-cr-tabs {
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        max-width: 100%;
      }
      .vt-cr-tabs::-webkit-scrollbar {
        display: none;
      }
      .vt-cr-tab {
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ===== IPAD & TABLET (<= 1180px) ===== */
      @media (max-width: 1180px) {
        .vt-sys-kpi-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      /* ===== IPAD PORTRAIT & MOBILE (<= 1024px): SLIDE-OVER CONSTELLATION DRAWER + STICKY GRADEBOOK ===== */
      @media (max-width: 1024px) {
        #${MODAL_ID} {
          padding: 0;
        }
        .vt-cr-shell {
          border-radius: 0;
          height: 100dvh;
          max-height: 100dvh;
        }
        .vt-cr-topbar {
          padding: max(10px, env(safe-area-inset-top, 10px)) 14px 10px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .vt-cr-drawer-toggle {
          display: inline-flex !important;
        }
        .vt-cr-layout {
          position: relative;
        }
        .vt-cr-sidebar {
          position: fixed !important;
          top: 0;
          bottom: 0;
          left: 0;
          width: min(320px, 86vw) !important;
          max-width: 86vw !important;
          max-height: 100dvh !important;
          z-index: 60;
          transform: translateX(-105%);
          transition: transform 0.34s var(--vt-spring-smooth);
          box-shadow: 0 24px 56px rgba(6, 11, 25, 0.35);
          padding-top: max(16px, env(safe-area-inset-top, 16px));
          padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
        }
        .vt-cr-sidebar.drawer-open {
          transform: translateX(0);
        }
        .vt-cr-main {
          width: 100%;
          padding: 14px 14px calc(24px + env(safe-area-inset-bottom, 0px));
        }

        /* Touch-Optimized Sticky First 2 Columns (STT + Họ và tên) on Gradebook Tables */
        .vt-grade-table .vt-col-id {
          display: none;
        }
        .vt-grade-table th:nth-child(1),
        .vt-grade-table td:nth-child(1) {
          position: sticky;
          left: 0;
          z-index: 3;
          width: 42px;
          min-width: 42px;
          background: var(--cr-surface);
        }
        .vt-grade-table th.vt-col-name,
        .vt-grade-table td.vt-col-name {
          position: sticky;
          left: 42px;
          z-index: 3;
          min-width: 148px;
          max-width: 180px;
          background: var(--cr-surface);
          box-shadow: 4px 0 10px -4px rgba(15, 23, 42, 0.14);
        }
        .vt-grade-table thead th:nth-child(1),
        .vt-grade-table thead th.vt-col-name {
          z-index: 5;
          background: var(--cr-surface-soft);
        }
      }

      /* ===== MOBILE (< 768px): ANTI-ZOOM 16px INPUTS + SINGLE COLUMN CARDS ===== */
      @media (max-width: 767px) {
        #${MODAL_ID} input,
        #${MODAL_ID} select,
        #${MODAL_ID} textarea {
          font-size: 16px !important;
        }
        .vt-cr-brand-sub {
          display: none;
        }
        .vt-cr-top-actions {
          width: 100%;
          justify-content: flex-end;
        }
        .vt-sys-kpi-grid,
        .vt-cr-banner-kpis,
        .vt-cr-form-grid,
        .vt-stu-kpi-grid,
        .vt-faculty-grid {
          grid-template-columns: 1fr;
        }
        .vt-cr-toolbar {
          flex-direction: column;
          align-items: stretch;
        }
        .vt-cr-search,
        .vt-cr-filter-select {
          width: 100%;
        }
        .vt-cr-submodal-backdrop {
          align-items: flex-end;
          padding: 0;
        }
        .vt-cr-submodal {
          width: 100% !important;
          max-width: 100% !important;
          border-radius: 24px 24px 0 0 !important;
          max-height: 92dvh !important;
          overflow-y: auto;
          padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
        }
        .vt-rbac-edit-grid { grid-template-columns: 1fr; }
        /* Mobile 360° Bottom Sheet */
        .vt-360-backdrop { align-items: flex-end; justify-content: center; }
        .vt-360-drawer {
          width: 100% !important;
          height: 90dvh !important;
          border-left: none;
          border-radius: 24px 24px 0 0;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        /* Mobile Card Stack for Roster & Master Student Tables */
        .vt-mobile-cards thead { display: none; }
        .vt-mobile-cards, .vt-mobile-cards tbody, .vt-mobile-cards tr, .vt-mobile-cards td {
          display: block;
          width: 100%;
        }
        .vt-mobile-cards tr {
          background: var(--cr-surface);
          border: 1px solid var(--cr-border);
          border-radius: var(--vt-r-card);
          padding: 12px 14px;
          margin-bottom: 10px;
          box-shadow: var(--cr-shadow-sm);
        }
        .vt-mobile-cards td {
          border: none !important;
          padding: 4px 0 !important;
          text-align: left !important;
          white-space: normal !important;
        }
        .vt-mobile-cards td .vt-cr-btn {
          min-height: 44px;
          margin-top: 4px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ==========================================================================
   * 2. UTILITIES, MATH HELPERS, CSV EXPORT & BRIDGE API CLIENT (100% PRESERVED)
   * ========================================================================== */

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, '&#96;');
  }

  function esc(str) {
    return escapeHtml(str);
  }

  function formatFriendlyError(rawErr) {
    const codeStr = String(rawErr || '').trim();
    if (!codeStr) return 'Đã xảy ra sự cố kết nối. Vui lòng thử lại sau giây lát.';
    const dict = {
      UNKNOWN_ACTION: 'Máy chủ dữ liệu cần được cập nhật phiên bản mới nhất để sử dụng tính năng này.',
      UNAUTHORIZED_TOKEN: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
      SERVER_BUSY: 'Hệ thống đang xử lý nhiều yêu cầu cùng lúc. Vui lòng thử lại sau vài giây.',
      FORBIDDEN_ADMIN_ONLY: 'Tính năng này chỉ dành cho Quản trị viên hệ thống.',
      FORBIDDEN_NOT_APPROVED: 'Tài khoản của bạn đang chờ Quản trị viên phê duyệt quyền truy cập.',
      FORBIDDEN_CLASS_ACCESS: 'Bạn không có quyền truy cập lớp học này.',
      FORBIDDEN_READ_ONLY_ROSTER: 'Bạn chỉ có quyền xem danh sách lớp này.',
      FORBIDDEN_TRANSFER_PERMISSION: 'Chỉ Quản trị viên hoặc Giáo viên chủ nhiệm mới có quyền chuyển lớp.',
      FORBIDDEN_BEHAVIOR_LOG_ACCESS: 'Bạn không có quyền ghi nhận chuyên cần hoặc rèn luyện cho lớp này.',
      FORBIDDEN_STUDENT_360_ACCESS: 'Bạn không có quyền xem hồ sơ chi tiết của học sinh này.',
      FORBIDDEN_ADD_GROWTH_NOTES: 'Vai trò của bạn hiện chưa được bật quyền ghi nhận xét kèm cặp.',
      FORBIDDEN_LOG_ATTENDANCE_BEHAVIOR: 'Vai trò của bạn hiện chưa được bật quyền điểm danh và chấm điểm rèn luyện.',
      CLASS_NOT_FOUND: 'Không tìm thấy lớp học được yêu cầu.',
      FROM_CLASS_NOT_FOUND: 'Không tìm thấy lớp hiện tại của học sinh.',
      TO_CLASS_NOT_FOUND: 'Không tìm thấy lớp đích cần chuyển tới.',
      STUDENT_NOT_FOUND: 'Không tìm thấy hồ sơ học sinh trong lớp này.',
      STUDENT_NOT_FOUND_IN_SOURCE_CLASS: 'Không tìm thấy học sinh trong lớp nguồn.',
      CLASS_HAS_ACTIVE_STUDENTS: 'Lớp hiện vẫn còn học sinh đang học.',
      DUPLICATE_LINKED_EMAIL_IN_CLASS: 'Địa chỉ Gmail này đã được liên kết với một học sinh khác trong lớp.',
      DUPLICATE_LINKED_EMAIL_IN_TARGET_CLASS: 'Địa chỉ Gmail này đã tồn tại trong lớp đích.',
      SAME_SOURCE_AND_TARGET_CLASS: 'Lớp đích cần khác với lớp hiện tại của học sinh.',
      MAX_BULK_LIMIT_EXCEEDED_60: 'Mỗi lần nhập nhanh hỗ trợ tối đa 60 học sinh.',
      EMPTY_STUDENT_LIST: 'Vui lòng nhập ít nhất một học sinh hợp lệ.',
      NO_VALID_STUDENTS_TO_ADD: 'Không có dòng thông tin học sinh hợp lệ để thêm.',
      ALL_STUDENTS_DUPLICATE_EMAIL: 'Tất cả Gmail trong danh sách đều đã tồn tại trong lớp.',
      CONNECTION_ERROR: 'Không thể kết nối tới máy chủ dữ liệu. Vui lòng kiểm tra mạng và thử lại.'
    };
    if (dict[codeStr]) return dict[codeStr];
    if (codeStr.indexOf('FORBIDDEN_') === 0) return 'Bạn chưa được cấp quyền thực hiện thao tác này.';
    if (codeStr.indexOf('MISSING_') === 0) return 'Vui lòng điền đầy đủ các thông tin bắt buộc.';
    if (codeStr.indexOf('INVALID_') === 0) return 'Dữ liệu nhập vào chưa đúng định dạng. Vui lòng kiểm tra lại.';
    return codeStr;
  }

  function formatStatusLabel(st) {
    return {
      APPROVED: 'Đã duyệt',
      PENDING: 'Chờ duyệt',
      REJECTED: 'Từ chối'
    }[st] || st;
  }

  function formatRoleLabel(role) {
    return {
      SUPER_ADMIN: 'Quản trị viên Hệ thống',
      HOMEROOM_TEACHER: 'Giáo viên Chủ nhiệm',
      SUBJECT_TEACHER: 'Giáo viên Bộ môn',
      STUDENT: 'Học sinh'
    }[role] || 'Thành viên';
  }

  function getInitials(name) {
    const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function genderAvatarClass(gender) {
    const g = String(gender || '').toLowerCase();
    if (g.indexOf('nữ') !== -1 || g.indexOf('nu') !== -1) return 'female';
    if (g.indexOf('nam') !== -1) return 'male';
    return 'other';
  }

  function formatDobVn(dobStr) {
    if (!dobStr) return '—';
    const m = String(dobStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return esc(dobStr);
    return m[3] + '/' + m[2] + '/' + m[1];
  }

  function normalizeDateInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return dmy[3] + '-' + ('0' + dmy[2]).slice(-2) + '-' + ('0' + dmy[1]).slice(-2);
    return '';
  }

  function parseScoreVal(raw) {
    const s = String(raw == null ? '' : raw).trim().replace(',', '.');
    if (s === '') return { valid: true, value: '' };
    const n = Number(s);
    if (!isFinite(n) || n < 0 || n > 10) return { valid: false, value: raw };
    return { valid: true, value: Math.round(n * 100) / 100 };
  }

  function computeStandardAverage(row) {
    if (!row) return '';
    let sum = 0; let weight = 0;
    ['tx1', 'tx2', 'tx3'].forEach(function (k) {
      const p = parseScoreVal(row[k]);
      if (p.valid && p.value !== '') { sum += p.value * 1; weight += 1; }
    });
    const pMid = parseScoreVal(row.midterm);
    if (pMid.valid && pMid.value !== '') { sum += pMid.value * 2; weight += 2; }
    const pFin = parseScoreVal(row.final);
    if (pFin.valid && pFin.value !== '') { sum += pFin.value * 3; weight += 3; }
    if (weight === 0) return '';
    return Math.round((sum / weight) * 10) / 10;
  }

  function computeTrackingAverage(columns, scoresObj) {
    if (!Array.isArray(columns) || !columns.length || !scoresObj) return '';
    let sum = 0; let cnt = 0;
    columns.forEach(function (col) {
      if (col.type !== 'score10') return;
      const p = parseScoreVal(scoresObj[col.id]);
      if (p.valid && p.value !== '') { sum += p.value; cnt += 1; }
    });
    if (cnt === 0) return '';
    return Math.round((sum / cnt) * 10) / 10;
  }

  function avgColorClass(val) {
    if (val === '' || val === null || val === undefined || isNaN(Number(val))) return 'vt-avg-mid';
    const n = Number(val);
    if (n >= 8.0) return 'vt-avg-high';
    if (n < 5.0) return 'vt-avg-low';
    return 'vt-avg-mid';
  }

  function downloadUtf8Csv(filename, rows) {
    const csvContent = '\uFEFF' + rows.map(function (r) {
      return r.map(function (cell) {
        return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  let toastTimer = null;
  function showToast(msg, isError) {
    const el = document.getElementById('vtCrToast');
    if (!el) return;
    el.textContent = msg;
    el.style.borderColor = isError ? 'rgba(248, 113, 113, 0.65)' : 'rgba(56, 189, 248, 0.40)';
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('visible'); }, 3400);
  }

  function getSessionContext() {
    const ctx = window.VANTHESIS_SESSION_CONTEXT;
    if (!ctx || !ctx.bridgeUrl || !ctx.accessToken) return null;
    return ctx;
  }

  async function callBridge(action, extraBody, _isRetry) {
    let ctx = getSessionContext();
    if (!ctx && !_isRetry && typeof window.VANTHESIS_REFRESH_TOKEN === 'function') {
      try { await window.VANTHESIS_REFRESH_TOKEN(); } catch (e) {}
      ctx = getSessionContext();
    }
    if (!ctx) return { ok: false, error: 'Chưa có phiên đăng nhập Google hợp lệ.' };
    try {
      const payload = Object.assign({ action: action, accessToken: ctx.accessToken }, extraBody || {});
      const res = await fetch(ctx.bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        return { ok: false, error: 'Phản hồi từ máy chủ không hợp lệ.' };
      }

      // Auto-Retry Silent Token Refresh on UNAUTHORIZED_TOKEN (max 1 retry)
      if (parsed && !parsed.ok && parsed.error === 'UNAUTHORIZED_TOKEN' && !_isRetry && typeof window.VANTHESIS_REFRESH_TOKEN === 'function') {
        try {
          await window.VANTHESIS_REFRESH_TOKEN();
          return await callBridge(action, extraBody, true);
        } catch (refreshErr) {
          return parsed;
        }
      }

      if (parsed && parsed.version) {
        state.backendVersion = String(parsed.version);
      }
      if (parsed && typeof parsed.syncRev === 'number' && parsed.syncRev > state.localSyncRev) {
        state.localSyncRev = parsed.syncRev;
      }
      const isWriteAction = [
        'admin_upsert_class', 'admin_delete_class', 'class_upsert_student', 'class_bulk_add_students',
        'class_delete_student', 'class_transfer_student', 'grades_save_standard_batch',
        'grades_save_tracking_schema', 'grades_save_tracking_batch', 'admin_update_role_permissions',
        'admin_update_user_access', 'student_log_behavior_batch'
      ].indexOf(action) !== -1;
      if (parsed && parsed.ok && isWriteAction) {
        broadcastLocalSync(state.localSyncRev);
      }
      return parsed;
    } catch (err) {
      return { ok: false, error: 'CONNECTION_ERROR' };
    }
  }

  /* ==========================================================================
   * 2B. LIVE MULTI-DEVICE SYNC ENGINE (sync_heartbeat + BroadcastChannel)
   * ========================================================================== */

  let heartbeatTimer = null;
  let syncChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      syncChannel = new BroadcastChannel('vanthesis_sync_v5');
      syncChannel.onmessage = function (ev) {
        if (!state.isOpen || !ev || !ev.data) return;
        if (ev.data.type === 'sync_bump' && Number(ev.data.rev) > state.localSyncRev) {
          handleIncomingServerRev(Number(ev.data.rev));
        }
      };
    }
  } catch (e) {}

  function broadcastLocalSync(rev) {
    try {
      if (syncChannel) syncChannel.postMessage({ type: 'sync_bump', rev: rev });
    } catch (e) {}
  }

  function hasUnsavedGradeChanges() {
    return Object.keys(state.standardDirty).length > 0 || Object.keys(state.trackingDirty).length > 0;
  }

  function updateSyncBadgeUI() {
    const badge = document.getElementById('vtCrSyncBadge');
    if (!badge) return;
    badge.classList.remove('syncing', 'pending-merge');
    if (state.syncStatus === 'syncing') {
      badge.classList.add('syncing');
      badge.textContent = '↻ Đang cập nhật...';
    } else if (state.syncStatus === 'pending_merge') {
      badge.classList.add('pending-merge');
      badge.textContent = '⚡ Có dữ liệu mới — Bấm để hợp nhất';
    } else if (state.syncStatus === 'offline') {
      badge.textContent = '◌ Ngoại tuyến';
    } else {
      badge.innerHTML = '<span class="vt-live-dot"></span>Đồng bộ trực tiếp';
    }
  }

  async function handleIncomingServerRev(serverRev) {
    if (!state.isOpen) return;
    if (hasUnsavedGradeChanges()) {
      state.syncStatus = 'pending_merge';
      updateSyncBadgeUI();
      showToast('⚡ Có dữ liệu mới từ thiết bị khác — Bấm huy hiệu trên thanh tiêu đề để hợp nhất.');
      return;
    }
    state.localSyncRev = serverRev;
    state.syncStatus = 'syncing';
    updateSyncBadgeUI();
    try {
      if (state.role === 'SUPER_ADMIN' && (state.sidebarMode === 'rbac' || state.sidebarMode === 'faculty' || state.sidebarMode === 'students')) {
        await loadRbacCenter(true);
      } else if (state.selectedClassId) {
        await loadActiveClassData();
      } else {
        await loadBootstrap();
      }
    } finally {
      state.syncStatus = 'live';
      updateSyncBadgeUI();
    }
  }

  async function runSyncHeartbeat() {
    if (!state.isOpen || document.visibilityState !== 'visible' || navigator.onLine === false) return;
    if (!getSessionContext()) return;
    const res = await callBridge('sync_heartbeat');
    if (res && res.ok && typeof res.syncRev === 'number') {
      if (state.localSyncRev === 0) {
        state.localSyncRev = res.syncRev;
      } else if (res.syncRev > state.localSyncRev) {
        await handleIncomingServerRev(res.syncRev);
      }
    }
  }

  function startSyncLoop() {
    stopSyncLoop();
    heartbeatTimer = setInterval(runSyncHeartbeat, HEARTBEAT_MS);
    updateSyncBadgeUI();
  }

  function stopSyncLoop() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state.isOpen) runSyncHeartbeat();
  });
  window.addEventListener('focus', function () { if (state.isOpen) runSyncHeartbeat(); });
  window.addEventListener('online', function () {
    state.syncStatus = 'live';
    updateSyncBadgeUI();
    if (state.isOpen) runSyncHeartbeat();
  });
  window.addEventListener('offline', function () {
    state.syncStatus = 'offline';
    updateSyncBadgeUI();
  });

  /* ==========================================================================
   * 3. DOM SCAFFOLDING (ASTROLABE SVG BACKDROP + LIQUID GLASS SHELL)
   * ========================================================================== */

  function ensureModalDOM() {
    if (document.getElementById(MODAL_ID)) return;
    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Trung tâm Lớp học và Sổ điểm VANTHESIS Calculus');

    root.innerHTML = `
      <!-- Rotating Celestial Astrolabe Backdrop -->
      <svg class="vt-cosmic-astrolabe-bg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g class="vt-astro-cw">
          <circle cx="720" cy="360" r="320" fill="none" stroke="rgba(29, 78, 216, 0.14)" stroke-width="1.2"/>
          <circle cx="720" cy="360" r="460" fill="none" stroke="rgba(217, 119, 6, 0.16)" stroke-width="1.1" stroke-dasharray="6 10"/>
          <ellipse cx="720" cy="360" rx="520" ry="200" transform="rotate(-18 720 360)" fill="none" stroke="rgba(29, 78, 216, 0.14)" stroke-width="1.1"/>
        </g>
        <g class="vt-astro-ccw">
          <circle cx="720" cy="360" r="220" fill="none" stroke="rgba(217, 119, 6, 0.15)" stroke-width="1.1" stroke-dasharray="3 8"/>
          <ellipse cx="720" cy="360" rx="440" ry="170" transform="rotate(24 720 360)" fill="none" stroke="rgba(217, 119, 6, 0.15)" stroke-width="1.1"/>
        </g>
      </svg>

      <!-- Main Concentric Liquid Glass Shell -->
      <div class="vt-cr-shell">
        <header class="vt-cr-topbar">
          <div class="vt-cr-brand">
            <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex-shrink:0;">
              <defs>
                <linearGradient id="vtCrGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#1D4ED8"/>
                  <stop offset="100%" stop-color="#2563EB"/>
                </linearGradient>
              </defs>
              <rect width="34" height="34" rx="10" fill="url(#vtCrGrad)"/>
              <path d="M8.5 11.5 L15.2 24.2 C16.3 26.1 18.2 25.8 19.2 23.6 C20.8 20.1 21.8 14.2 25.5 11.2" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="25.5" cy="11.2" r="2.3" fill="#FFFFFF"/>
            </svg>
            <div>
              <div class="vt-cr-brand-title">Lớp học &amp; Sổ điểm • VANTHESIS</div>
              <div class="vt-cr-brand-sub" id="vtCrTopUserLine">Đang kết nối không gian lớp học...</div>
            </div>
          </div>
          <div class="vt-cr-top-actions">
            <button id="vtCrDrawerToggle" class="vt-cr-btn vt-cr-btn-sm vt-cr-drawer-toggle" type="button" aria-label="Mở danh mục Khối và Lớp">☰ Danh mục</button>
            <span id="vtCrSyncBadge" class="vt-sync-badge" title="Trạng thái đồng bộ thời gian thực đa thiết bị"><span class="vt-live-dot"></span>Đồng bộ trực tiếp</span>
            <button id="vtCrThemeToggle" class="vt-cr-btn vt-cr-btn-sm" type="button" title="Chuyển chế độ Sáng Học thuật / Đêm Vũ trụ">🌙 Đêm Vũ trụ</button>
            <button id="vtCrBtnRefresh" class="vt-cr-btn vt-cr-btn-sm" type="button">↻ Làm mới</button>
            <button id="vtCrBtnClose" class="vt-cr-btn vt-cr-btn-sm" type="button">✕ Đóng về Xưởng</button>
          </div>
        </header>

        <div class="vt-cr-layout">
          <div class="vt-cr-drawer-backdrop" id="vtCrDrawerBackdrop"></div>
          <aside class="vt-cr-sidebar" id="vtCrSidebar" aria-label="Bản đồ Chòm sao Khối và Lớp"></aside>
          <main class="vt-cr-main" id="vtCrMain"></main>
        </div>
      </div>

      <!-- Sub-Modal 1: Admin Create / Edit Class -->
      <div class="vt-cr-submodal-backdrop" id="vtCrClassModal">
        <div class="vt-cr-submodal">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title" id="vtCrClassModalTitle">Tạo Khối / Lớp mới</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrClassModal">×</button>
          </div>
          <form id="vtCrClassForm" class="vt-cr-form-grid" novalidate>
            <div class="vt-cr-field">
              <label for="vtClsGradeSelect">Khối học *</label>
              <select id="vtClsGradeSelect">
                <option value="Khối 10">Khối 10</option>
                <option value="Khối 11">Khối 11</option>
                <option value="Khối 12">Khối 12</option>
                <option value="__custom__">+ Nhập tên khối khác...</option>
              </select>
            </div>
            <div class="vt-cr-field" id="vtClsGradeCustomWrap" style="display:none;">
              <label for="vtClsGradeCustom">Tên khối tùy chỉnh *</label>
              <input id="vtClsGradeCustom" type="text" placeholder="VD: Khối 9 hoặc Đại học K68">
            </div>
            <div class="vt-cr-field">
              <label for="vtClsName">Tên lớp *</label>
              <input id="vtClsName" type="text" placeholder="VD: 12A1" required>
            </div>
            <div class="vt-cr-field">
              <label for="vtClsYear">Năm học</label>
              <input id="vtClsYear" type="text" value="2026-2027" placeholder="VD: 2026-2027">
            </div>
            <div class="vt-cr-field full">
              <label for="vtClsHomeroomEmail">Email Giáo viên chủ nhiệm (gợi ý từ GV đã duyệt)</label>
              <input id="vtClsHomeroomEmail" type="email" list="vtCrTeacherDatalist" placeholder="VD: giaovien@gmail.com">
              <datalist id="vtCrTeacherDatalist"></datalist>
            </div>
            <div class="vt-cr-field full">
              <label for="vtClsNotes">Ghi chú lớp học</label>
              <input id="vtClsNotes" type="text" placeholder="VD: Lớp chuyên Toán - Tin">
            </div>
            <div class="vt-cr-field full vt-cr-modal-foot">
              <button class="vt-cr-btn" type="button" data-close-sub="vtCrClassModal">Hủy</button>
              <button id="vtClsSubmitBtn" class="vt-cr-btn vt-cr-btn-primary" type="submit">Lưu lớp học</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Sub-Modal 2: Add / Edit Student -->
      <div class="vt-cr-submodal-backdrop" id="vtCrStudentModal">
        <div class="vt-cr-submodal">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title" id="vtCrStudentModalTitle">Thêm học sinh mới</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrStudentModal">×</button>
          </div>
          <form id="vtCrStudentForm" class="vt-cr-form-grid" novalidate>
            <div class="vt-cr-field full">
              <label for="vtStuFullName">Họ và tên học sinh *</label>
              <input id="vtStuFullName" type="text" placeholder="VD: Trần Minh Quân" required>
            </div>
            <div class="vt-cr-field">
              <label for="vtStuDob">Ngày tháng năm sinh</label>
              <input id="vtStuDob" type="date">
            </div>
            <div class="vt-cr-field">
              <label for="vtStuGender">Giới tính</label>
              <select id="vtStuGender">
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div class="vt-cr-field full">
              <label for="vtStuEmail">Email Gmail liên kết (tùy chọn)</label>
              <input id="vtStuEmail" type="email" placeholder="VD: hocsinh@gmail.com">
            </div>
            <div class="vt-cr-field full vt-cr-modal-foot">
              <button class="vt-cr-btn" type="button" data-close-sub="vtCrStudentModal">Hủy</button>
              <button id="vtStuSubmitBtn" class="vt-cr-btn vt-cr-btn-primary" type="submit">Lưu học sinh</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Sub-Modal 3: Bulk Import Students -->
      <div class="vt-cr-submodal-backdrop" id="vtCrBulkModal">
        <div class="vt-cr-submodal wide">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title">Nhập nhanh Học sinh từ Excel / Danh sách</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrBulkModal">×</button>
          </div>
          <div style="font-size:12.2px;color:var(--cr-muted);margin-bottom:10px;line-height:1.55;">
            Dán trực tiếp từ Excel (các cột cách nhau bằng Tab) hoặc gõ mỗi dòng dạng:
            <code style="font-family:var(--cr-mono);background:var(--cr-subtle);padding:2px 6px;border-radius:6px;color:var(--cr-cobalt);">Họ và tên | Ngày sinh (YYYY-MM-DD hoặc DD/MM/YYYY) | Giới tính | Email (nếu có)</code>
            (tối đa ${MAX_BULK_IMPORT} học sinh/lần).
          </div>
          <div class="vt-cr-field full" style="margin-bottom:12px;">
            <textarea id="vtBulkTextarea" rows="6" placeholder="Nguyễn Minh Anh | 15/05/2009 | Nữ | minhanh@gmail.com&#10;Lê Hoàng Nam | 2009-08-22 | Nam"></textarea>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span id="vtBulkPreviewSummary" style="font-size:12.2px;font-weight:600;color:var(--cr-muted);">Chưa có dữ liệu xem trước.</span>
            <button id="vtBulkParseBtn" class="vt-cr-btn vt-cr-btn-sm" type="button">Kiểm tra &amp; Xem trước</button>
          </div>
          <div id="vtBulkPreviewWrap" class="vt-cr-table-wrap" style="max-height:220px;overflow-y:auto;display:none;"></div>
          <div class="vt-cr-modal-foot">
            <button class="vt-cr-btn" type="button" data-close-sub="vtCrBulkModal">Hủy</button>
            <button id="vtBulkSaveBtn" class="vt-cr-btn vt-cr-btn-primary" type="button" disabled>Lưu danh sách vào lớp</button>
          </div>
        </div>
      </div>

      <!-- Sub-Modal 4: Add / Edit Dynamic Tracking Column -->
      <div class="vt-cr-submodal-backdrop" id="vtCrTrackColModal">
        <div class="vt-cr-submodal" style="max-width:480px;">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title" id="vtCrTrackColTitle">+ Thêm cột theo dõi quá trình</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrTrackColModal">×</button>
          </div>
          <form id="vtCrTrackColForm" class="vt-cr-form-grid" novalidate>
            <div class="vt-cr-field full">
              <label for="vtTrackColName">Tên cột kiểm tra *</label>
              <input id="vtTrackColName" type="text" placeholder="VD: KT Đạo hàm 15p, Bài tập Khảo sát, Thực hành 3D" required>
            </div>
            <div class="vt-cr-field">
              <label for="vtTrackColType">Loại đánh giá</label>
              <select id="vtTrackColType">
                <option value="score10">Thang điểm 10</option>
                <option value="passfail">Nhận xét / Đạt - Chưa đạt</option>
              </select>
            </div>
            <div class="vt-cr-field">
              <label for="vtTrackColDate">Ngày kiểm tra</label>
              <input id="vtTrackColDate" type="date">
            </div>
            <div class="vt-cr-field full vt-cr-modal-foot" style="justify-content:space-between;">
              <button id="vtTrackColDeleteBtn" class="vt-cr-btn vt-cr-btn-danger" type="button" style="display:none;">🗑 Xóa cột này</button>
              <div style="display:flex;gap:8px;margin-left:auto;">
                <button class="vt-cr-btn" type="button" data-close-sub="vtCrTrackColModal">Hủy</button>
                <button id="vtTrackColSubmitBtn" class="vt-cr-btn vt-cr-btn-primary" type="submit">Lưu cấu trúc cột</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Sub-Modal 5: In-page Confirmation Dialog -->
      <div class="vt-cr-submodal-backdrop" id="vtCrConfirmModal">
        <div class="vt-cr-submodal" style="max-width:440px;">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title" id="vtCrConfirmTitle">Xác nhận thao tác</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrConfirmModal">×</button>
          </div>
          <p id="vtCrConfirmMessage" style="font-size:13px;color:var(--cr-muted);line-height:1.6;margin:0;"></p>
          <div class="vt-cr-modal-foot">
            <button class="vt-cr-btn" type="button" data-close-sub="vtCrConfirmModal">Hủy</button>
            <button id="vtCrConfirmOkBtn" class="vt-cr-btn vt-cr-btn-danger" type="button">Xác nhận</button>
          </div>
        </div>
      </div>

      <!-- Sub-Modal 6: Transfer Student to Another Class (v4.0) -->
      <div class="vt-cr-submodal-backdrop" id="vtCrTransferModal">
        <div class="vt-cr-submodal" style="max-width:460px;">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title">⇄ Chuyển lớp Học sinh</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrTransferModal">×</button>
          </div>
          <p id="vtCrTransferStudentInfo" style="font-size:13px;color:var(--cr-muted);margin:0 0 12px;"></p>
          <form id="vtCrTransferForm" novalidate>
            <div class="vt-cr-field" style="margin-bottom:14px;">
              <label for="vtCrTransferTarget">Chọn Lớp đích *</label>
              <select id="vtCrTransferTarget" required></select>
            </div>
            <div style="font-size:11.8px;color:var(--cr-soft);margin-bottom:14px;">
              Mã học sinh và liên kết Gmail sẽ được giữ nguyên; hệ thống tự động đồng bộ tên lớp mới trên hồ sơ tài khoản.
            </div>
            <div class="vt-cr-submodal-foot">
              <button class="vt-cr-btn" type="button" data-close-sub="vtCrTransferModal">Hủy</button>
              <button class="vt-cr-btn vt-cr-btn-primary" type="submit">Xác nhận Chuyển lớp</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Sub-Modal 7: System Audit Logs Viewer (SUPER_ADMIN v4.0) -->
      <div class="vt-cr-submodal-backdrop" id="vtCrAuditModal">
        <div class="vt-cr-submodal" style="max-width:680px;">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title">✦ Nhật ký Hoạt động Hệ thống (30 gần nhất)</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrAuditModal">×</button>
          </div>
          <div id="vtCrAuditList" class="vt-audit-list"></div>
          <div class="vt-cr-submodal-foot" style="margin-top:12px;">
            <button class="vt-cr-btn vt-cr-btn-primary" type="button" data-close-sub="vtCrAuditModal">Đóng</button>
          </div>
        </div>
      </div>

      <!-- Dynamic Island Floating Toast -->
      <!-- Sub-Modal 8: Seewo 1-Tap Quick Behavior Modal (v5.0) -->
      <div class="vt-cr-submodal-backdrop" id="vtCrQuickBehModal">
        <div class="vt-cr-submodal" style="max-width:480px;">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title">⚡ Điểm rèn luyện nhanh</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrQuickBehModal">×</button>
          </div>
          <p id="vtCrQuickBehStudentName" style="font-size:13px;color:var(--cr-muted);margin:0 0 10px;"></p>
          <div class="vt-seewo-chips" id="vtCrSeewoPresets">
            <button type="button" class="vt-seewo-chip merit" data-cat="MERIT" data-pts="2" data-lbl="Phát biểu xây dựng bài">+2 Phát biểu</button>
            <button type="button" class="vt-seewo-chip merit" data-cat="MERIT" data-pts="1" data-lbl="Nộp bài sớm">+1 Nộp bài sớm</button>
            <button type="button" class="vt-seewo-chip merit" data-cat="MERIT" data-pts="3" data-lbl="Giải bài nâng cao">+3 Giải bài nâng cao</button>
            <button type="button" class="vt-seewo-chip demerit" data-cat="DEMERIT" data-pts="-1" data-lbl="Quên bài tập">-1 Quên bài tập</button>
            <button type="button" class="vt-seewo-chip demerit" data-cat="DEMERIT" data-pts="-1" data-lbl="Mất tập trung">-1 Mất tập trung</button>
          </div>
          <form id="vtCrQuickBehForm" novalidate>
            <div class="vt-cr-form-grid" style="margin-bottom:10px;">
              <div class="vt-cr-field">
                <label for="vtCrQbPoints">Điểm cộng / trừ</label>
                <input id="vtCrQbPoints" type="number" step="1" value="1">
              </div>
              <div class="vt-cr-field">
                <label for="vtCrQbLabel">Nội dung ghi nhận *</label>
                <input id="vtCrQbLabel" type="text" placeholder="VD: Hỗ trợ bạn cùng bàn" required>
              </div>
            </div>
            <div class="vt-cr-field" style="margin-bottom:12px;">
              <label for="vtCrQbNote">Ghi chú thêm (tùy chọn)</label>
              <input id="vtCrQbNote" type="text" placeholder="Nhập nhận xét ngắn gọn...">
            </div>
            <div class="vt-cr-submodal-foot">
              <button class="vt-cr-btn" type="button" data-close-sub="vtCrQuickBehModal">Đóng</button>
              <button class="vt-cr-btn vt-cr-btn-primary" type="submit">✓ Lưu ghi nhận</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Sub-Modal 9: 1-Tap Class Attendance Today (v5.0) -->
      <div class="vt-cr-submodal-backdrop" id="vtCrAttendanceModal">
        <div class="vt-cr-submodal" style="max-width:640px;">
          <div class="vt-cr-submodal-head">
            <div class="vt-cr-submodal-title" id="vtCrAttTitle">✓ Điểm danh cả lớp hôm nay</div>
            <button class="vt-cr-btn vt-cr-btn-sm" type="button" data-close-sub="vtCrAttendanceModal">×</button>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <label for="vtCrAttDate" style="font-size:12.5px;font-weight:700;">Ngày điểm danh:</label>
              <input id="vtCrAttDate" type="date" style="height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cr-border);background:var(--cr-surface);color:var(--cr-ink);">
            </div>
            <span style="font-size:11.8px;color:var(--cr-soft);">Mặc định toàn lớp <b>Có mặt</b> — chỉ chạm đổi cho HS đi muộn/vắng</span>
          </div>
          <div id="vtCrAttList" style="display:flex;flex-direction:column;gap:8px;max-height:52dvh;overflow-y:auto;margin-bottom:14px;"></div>
          <div class="vt-cr-submodal-foot">
            <button class="vt-cr-btn" type="button" data-close-sub="vtCrAttendanceModal">Hủy</button>
            <button id="vtCrAttSaveBtn" class="vt-cr-btn vt-cr-btn-primary" type="button">💾 Lưu điểm danh cả lớp</button>
          </div>
        </div>
      </div>

      <!-- Slide-Over Student 360° Portrait Drawer (v5.0) -->
      <div class="vt-360-backdrop" id="vtCrProfile360Backdrop" role="dialog" aria-modal="true" aria-label="Hồ sơ Học sinh 360 độ">
        <div class="vt-360-drawer">
          <div class="vt-360-head">
            <div style="font-family:var(--cr-serif);font-size:19px;font-weight:700;">📊 Hồ sơ Học sinh 360°</div>
            <button id="vtCrClose360Btn" class="vt-cr-btn vt-cr-btn-sm" type="button">✕ Đóng</button>
          </div>
          <div class="vt-360-body" id="vtCrProfile360Body"></div>
        </div>
      </div>

      <div id="vtCrToast" role="status" aria-live="polite"></div>
    `;

    document.body.appendChild(root);
    wireStaticEvents(root);
  }

  function openSubModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); }
  function closeSubModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }
  function askConfirm(title, message, onConfirm) {
    document.getElementById('vtCrConfirmTitle').textContent = title;
    document.getElementById('vtCrConfirmMessage').textContent = message;
    state.confirmCallback = onConfirm;
    openSubModal('vtCrConfirmModal');
  }

  /* ==========================================================================
   * 4. BULK EXCEL / TEXT PARSER & CSV EXPORTERS (UTF-8 BOM)
   * ========================================================================== */

  function parseBulkStudentLines(rawText) {
    const lines = String(rawText || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    const parsed = [];
    for (let i = 0; i < lines.length && parsed.length < MAX_BULK_IMPORT; i++) {
      const sep = lines[i].indexOf('\t') !== -1 ? '\t' : '|';
      const cols = lines[i].split(sep).map(function (c) { return c.trim(); });
      const fullName = cols[0] || '';
      const rawDob = cols[1] || '';
      const dob = normalizeDateInput(rawDob);
      const rawGender = cols[2] || 'Nam';
      const gender = (/nữ|nu|female/i.test(rawGender)) ? 'Nữ' : ((/khác|khac|other/i.test(rawGender)) ? 'Khác' : 'Nam');
      const linkedEmail = (cols[3] || '').toLowerCase();

      const errors = [];
      if (fullName.length < 2) errors.push('Thiếu họ tên');
      if (rawDob && !dob) errors.push('Ngày sinh sai định dạng');
      if (linkedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkedEmail)) errors.push('Email không hợp lệ');

      parsed.push({
        lineNo: i + 1, fullName: fullName, dob: dob, gender: gender, linkedEmail: linkedEmail,
        valid: errors.length === 0, errorText: errors.join(', ')
      });
    }
    return parsed;
  }

  function exportRosterCsv(classInfo, students) {
    const rows = [['STT', 'Mã HS', 'Họ và tên', 'Ngày sinh', 'Giới tính', 'Email liên kết']];
    students.forEach(function (st, idx) {
      rows.push([idx + 1, st.studentId || '', st.fullName || '', st.dob || '', st.gender || '', st.linkedEmail || '']);
    });
    downloadUtf8Csv('DanhSach_' + String((classInfo && classInfo.className) || 'Lop').replace(/\s+/g, '_') + '.csv', rows);
    showToast('✓ Đã xuất danh sách lớp ra tệp CSV.');
  }

  function exportStandardGradesCsv() {
    const clsName = (state.activeClassInfo && state.activeClassInfo.className) || 'Lop';
    const subj = state.selectedSubject || 'MonHoc';
    const rows = [['STT', 'Mã HS', 'Họ và tên', 'ĐGTX 1 (HS1)', 'ĐGTX 2 (HS1)', 'ĐGTX 3 (HS1)', 'Giữa kỳ (HS2)', 'Cuối kỳ (HS3)', 'ĐTB Môn']];
    state.roster.forEach(function (st, idx) {
      const r = state.standardRows[st.studentId] || {};
      rows.push([idx + 1, st.studentId, st.fullName, r.tx1 ?? '', r.tx2 ?? '', r.tx3 ?? '', r.midterm ?? '', r.final ?? '', computeStandardAverage(r)]);
    });
    downloadUtf8Csv(`BangDiemPhoThong_${clsName}_${subj}_${state.selectedSemester}.csv`.replace(/\s+/g, '_'), rows);
    showToast('✓ Đã xuất Bảng điểm Phổ thông (UTF-8 BOM cho Excel).');
  }

  function exportTrackingGradesCsv() {
    const clsName = (state.activeClassInfo && state.activeClassInfo.className) || 'Lop';
    const subj = state.selectedSubject || 'MonHoc';
    const header = ['STT', 'Mã HS', 'Họ và tên'];
    state.trackingColumns.forEach(function (c) { header.push(c.name + (c.date ? ' (' + c.date + ')' : '')); });
    header.push('Trung bình Theo dõi');
    const rows = [header];
    state.roster.forEach(function (st, idx) {
      const sc = state.trackingRows[st.studentId] || {};
      const line = [idx + 1, st.studentId, st.fullName];
      state.trackingColumns.forEach(function (c) { line.push(sc[c.id] ?? ''); });
      line.push(computeTrackingAverage(state.trackingColumns, sc));
      rows.push(line);
    });
    downloadUtf8Csv(`BangDiemTheoDoi_${clsName}_${subj}.csv`.replace(/\s+/g, '_'), rows);
    showToast('✓ Đã xuất Bảng điểm Theo dõi Quá trình (UTF-8 BOM cho Excel).');
  }

  function exportSummaryMatrixCsv() {
    const m = state.summaryMatrix;
    if (!m || !m.subjects || !m.matrix) return;
    const clsName = (state.activeClassInfo && state.activeClassInfo.className) || 'Lop';
    const header = ['STT', 'Mã HS', 'Họ và tên'].concat(m.subjects).concat(['ĐTB Chung Các Môn']);
    const rows = [header];
    m.matrix.forEach(function (r, idx) {
      const line = [idx + 1, r.studentId, r.fullName];
      m.subjects.forEach(function (s) { line.push((r.subjectAverages && r.subjectAverages[s] !== '') ? r.subjectAverages[s] : ''); });
      line.push(r.overallAverage !== '' ? r.overallAverage : '');
      rows.push(line);
    });
    downloadUtf8Csv(`TongHopDiemLop_${clsName}_${state.selectedSemester}.csv`.replace(/\s+/g, '_'), rows);
    showToast('✓ Đã xuất Bảng điểm Tổng hợp Toàn lớp (UTF-8 BOM cho Excel).');
  }

  /* ==========================================================================
   * 5. DATA LOADING (100% PRESERVED API CALLS)
   * ========================================================================== */

  async function loadBootstrap() {
    state.loadingBootstrap = true;
    renderSidebar();
    renderMainSkeleton();

    const res = await callBridge('classroom_get_bootstrap');
    state.loadingBootstrap = false;

    if (!res || !res.ok) {
      const errCode = (res && res.error) ? String(res.error) : 'CONNECTION_ERROR';
      const friendlyMsg = formatFriendlyError(errCode);
      const isVersionOrUnknown = errCode === 'UNKNOWN_ACTION' || (res && res.version && String(res.version) !== EXPECTED_BACKEND_VERSION);
      showToast('⚠ ' + friendlyMsg, true);
      document.getElementById('vtCrMain').innerHTML = `
        <div class="vt-cr-card" style="max-width:600px;margin:18px auto;padding:28px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <span style="font-size:26px;">${isVersionOrUnknown ? '✨' : '⚠️'}</span>
            <div style="font-weight:700;font-size:16px;">${isVersionOrUnknown ? 'Cần cập nhật máy chủ dữ liệu' : 'Chưa thể kết nối Không gian Lớp học'}</div>
          </div>
          <div style="font-size:13.2px;color:var(--cr-muted);line-height:1.65;margin-bottom:16px;">
            ${isVersionOrUnknown
              ? 'Hệ thống lớp học đã có bản nâng cấp mới. Quản trị viên vui lòng xuất bản lại phiên bản mới nhất trên máy chủ dữ liệu rồi bấm thử lại.'
              : escapeHtml(friendlyMsg)}
          </div>
          <button id="vtCrBtnRetryDiag" class="vt-cr-btn vt-cr-btn-primary" type="button">↻ Thử kết nối lại</button>
        </div>`;
      const retryBtn = document.getElementById('vtCrBtnRetryDiag');
      if (retryBtn) retryBtn.addEventListener('click', loadBootstrap);
      return;
    }

    state.backendVersion = String(res.version || '');
    state.backendWarning = (state.backendVersion !== EXPECTED_BACKEND_VERSION)
      ? 'Máy chủ dữ liệu đang chạy bản cũ. Quản trị viên nên xuất bản phiên bản mới nhất để đồng bộ trọn vẹn mọi tính năng.'
      : '';
    state.bootstrap = res;
    state.role = res.role || '';
    state.effectivePermissions = res.effectivePermissions || {};
    updateTopUserLine();

    if (state.role === 'SUPER_ADMIN') {
      const all = res.classes || [];
      if (!state.selectedClassId || !all.some(function (c) { return c.classId === state.selectedClassId; })) {
        state.selectedClassId = all.length ? all[0].classId : '';
      }
      if (!state.selectedSubject) state.selectedSubject = 'Toán học';
    } else if (state.role === 'HOMEROOM_TEACHER') {
      const hrList = res.classes || [];
      const teachList = res.teachingAssignments || [];
      if (!state.selectedClassId) {
        if (hrList.length) {
          state.selectedClassId = hrList[0].classId;
          state.selectedSubject = teachList.length ? teachList[0].subject : '';
        } else if (teachList.length) {
          state.selectedClassId = teachList[0].classId;
          state.selectedSubject = teachList[0].subject || '';
        }
      }
    } else if (state.role === 'SUBJECT_TEACHER') {
      const pairs = res.classes || [];
      if (pairs.length && !state.selectedClassId) {
        state.selectedClassId = pairs[0].classId;
        state.selectedSubject = pairs[0].subject || '';
      }
    } else if (state.role === 'STUDENT') {
      state.selectedClassId = res.classInfo ? res.classInfo.classId : '';
      state.selectedSubject = '';
      if (state.activeTab !== 'roster' && state.activeTab !== 'mygrades') state.activeTab = 'roster';
    }

    renderSidebar();
    if (state.role === 'SUPER_ADMIN' && (state.sidebarMode === 'rbac' || state.sidebarMode === 'faculty' || state.sidebarMode === 'students')) {
      await loadRbacCenter(false);
    } else if (state.selectedClassId) {
      await loadActiveClassData();
    } else {
      renderMain();
    }
  }

  async function loadRbacCenter(silent) {
    if (state.role !== 'SUPER_ADMIN') return;
    if (!silent) {
      state.loadingRbac = true;
      renderMainSkeleton();
    }
    const res = await callBridge('admin_get_rbac_center');
    state.loadingRbac = false;
    if (res && res.ok) {
      state.rbacData = res;
    } else if (!silent) {
      showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể tải Trung tâm Nhân sự & Phân quyền.'), true);
    }
    renderSidebar();
    renderMain();
  }

  async function openStudent360Drawer(classId, studentId) {
    const backdrop = document.getElementById('vtCrProfile360Backdrop');
    const bodyEl = document.getElementById('vtCrProfile360Body');
    if (!backdrop || !bodyEl) return;
    state.loading360 = true;
    state.profile360 = null;
    state.profile360Tab = 'grades';
    backdrop.classList.add('open');
    bodyEl.innerHTML = '<div class="vt-cr-skeleton" style="height:80px;"></div><div class="vt-cr-skeleton" style="height:120px;"></div>';

    const res = await callBridge('student_get_360_profile', { classId: classId, studentId: studentId });
    state.loading360 = false;
    if (!res || !res.ok) {
      bodyEl.innerHTML = '<div style="text-align:center;padding:28px;color:var(--cr-danger);">⚠ ' + escapeHtml((res && res.error) || 'Không thể tải Hồ sơ 360°.') + '</div>';
      return;
    }
    state.profile360 = res;
    renderStudent360DrawerBody();
  }

  async function loadActiveClassData() {
    if (!state.selectedClassId) { renderMain(); return; }
    state.loadingRoster = true;
    renderMainSkeleton();

    const rosterRes = await callBridge('class_get_roster', { classId: state.selectedClassId });
    state.loadingRoster = false;

    if (rosterRes && rosterRes.ok) {
      state.roster = rosterRes.students || [];
      state.canEditRoster = Boolean(rosterRes.canEditRoster);
      state.activeClassInfo = rosterRes.classInfo || null;
    } else {
      state.roster = [];
      state.canEditRoster = false;
      showToast('⚠ ' + ((rosterRes && rosterRes.error) || 'Không thể tải danh sách lớp.'), true);
    }

    if (state.activeTab === 'gradebook' || state.activeTab === 'tracking_view') await loadGradebookBundle();
    else if (state.activeTab === 'summary') await loadSummaryMatrix();
    else if (state.activeTab === 'mygrades') await loadStudentPersonalGrades();
    else renderMain();
  }

  async function loadGradebookBundle() {
    if (!state.selectedClassId) return;
    if (!state.selectedSubject) {
      const mRes = await callBridge('homeroom_get_summary_matrix', { classId: state.selectedClassId, semester: state.selectedSemester });
      if (mRes && mRes.ok) {
        state.summaryMatrix = mRes;
        if (mRes.subjects && mRes.subjects.length) state.selectedSubject = mRes.subjects[0];
      }
      if (!state.selectedSubject) state.selectedSubject = 'Toán học';
    }

    state.loadingGrades = true;
    state.standardDirty = {};
    state.trackingDirty = {};
    renderMain();

    const res = await callBridge('grades_get_bundle', {
      classId: state.selectedClassId,
      subject: state.selectedSubject,
      semester: state.selectedSemester
    });
    state.loadingGrades = false;

    if (!res || !res.ok) {
      state.gradeCanEdit = false;
      state.standardRows = {};
      state.trackingColumns = [];
      state.trackingRows = {};
      showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể tải Sổ điểm Bộ môn.'), true);
      renderMain();
      return;
    }

    state.gradeCanEdit = Boolean(res.canEdit);
    const stdMap = {};
    (res.standardGrades || []).forEach(function (g) {
      stdMap[g.studentId] = {
        tx1: g.tx1 === '' || g.tx1 == null ? '' : g.tx1,
        tx2: g.tx2 === '' || g.tx2 == null ? '' : g.tx2,
        tx3: g.tx3 === '' || g.tx3 == null ? '' : g.tx3,
        midterm: g.midterm === '' || g.midterm == null ? '' : g.midterm,
        final: g.final === '' || g.final == null ? '' : g.final,
        average: g.average === '' || g.average == null ? '' : g.average
      };
    });
    state.standardRows = stdMap;
    state.trackingColumns = (res.trackingSchema && Array.isArray(res.trackingSchema.columns)) ? res.trackingSchema.columns : [];
    const trkMap = {};
    (res.trackingGrades || []).forEach(function (t) { trkMap[t.studentId] = Object.assign({}, t.scores || {}); });
    state.trackingRows = trkMap;
    renderMain();
  }

  async function loadSummaryMatrix() {
    if (!state.selectedClassId) return;
    state.loadingMatrix = true;
    renderMain();
    const res = await callBridge('homeroom_get_summary_matrix', { classId: state.selectedClassId, semester: state.selectedSemester });
    state.loadingMatrix = false;
    state.summaryMatrix = (res && res.ok) ? res : null;
    renderMain();
  }

  async function loadStudentPersonalGrades() {
    if (!state.selectedClassId) return;
    state.loadingStudentPortal = true;
    renderMain();

    const mRes = await callBridge('homeroom_get_summary_matrix', { classId: state.selectedClassId, semester: state.selectedSemester });
    state.summaryMatrix = (mRes && mRes.ok) ? mRes : null;
    const subjects = (state.summaryMatrix && state.summaryMatrix.subjects) || [];

    const bundles = await Promise.all(subjects.map(async function (subj) {
      const bRes = await callBridge('grades_get_bundle', {
        classId: state.selectedClassId, subject: subj, semester: state.selectedSemester
      });
      if (!bRes || !bRes.ok) return { subject: subj, stdRow: null, trackingCols: [], trackingScores: {} };
      return {
        subject: subj,
        stdRow: (bRes.standardGrades && bRes.standardGrades[0]) || null,
        trackingCols: (bRes.trackingSchema && Array.isArray(bRes.trackingSchema.columns)) ? bRes.trackingSchema.columns : [],
        trackingScores: (bRes.trackingGrades && bRes.trackingGrades[0] && bRes.trackingGrades[0].scores) || {}
      };
    }));

    state.studentSubjectBundles = bundles;
    state.loadingStudentPortal = false;
    renderMain();
  }

  /* ==========================================================================
   * 6. RENDERING — CONSTELLATION SIDEBAR, COSMIC BANNER & LIQUID GLASS GRIDS
   * ========================================================================== */

  function updateTopUserLine() {
    const el = document.getElementById('vtCrTopUserLine');
    if (!el) return;
    const ctx = getSessionContext();
    el.textContent = (ctx ? (ctx.fullName || ctx.email) + ' • ' : '') + formatRoleLabel(state.role);
  }

  function renderMainSkeleton() {
    const main = document.getElementById('vtCrMain');
    if (!main) return;
    main.innerHTML = `
      <div class="vt-cr-card"><div class="vt-cr-skeleton" style="width:45%;height:28px;"></div><div class="vt-cr-skeleton" style="width:65%;height:14px;"></div></div>
      <div class="vt-cr-card"><div class="vt-cr-skeleton" style="width:100%;height:34px;"></div><div class="vt-cr-skeleton" style="width:100%;height:24px;"></div><div class="vt-cr-skeleton" style="width:88%;height:24px;"></div></div>
    `;
  }

  function renderSidebar() {
    const side = document.getElementById('vtCrSidebar');
    if (!side) return;
    if (state.loadingBootstrap) {
      side.innerHTML = `<div class="vt-cr-skeleton" style="height:38px;border-radius:999px;"></div><div class="vt-cr-skeleton" style="height:44px;border-radius:16px;"></div>`;
      return;
    }
    const b = state.bootstrap;
    if (!b) { side.innerHTML = ''; return; }

    let html = '';
    if (state.role === 'SUPER_ADMIN') {
      const facultyCount = (b.approvedTeachers || []).length;
      const pendingCount = (b.systemStats && b.systemStats.pendingUsersCount) || 0;
      const totalStuCount = (b.systemStats && b.systemStats.totalActiveStudents) || 0;
      html += `
        <button id="vtCrBtnNewClass" class="vt-cr-btn vt-cr-btn-primary vt-cr-btn-shimmer" type="button" style="width:100%;margin-bottom:10px;">+ Tạo Khối / Lớp mới</button>
        <div class="vt-admin-nav-stack">
          <button id="vtCrNavRbac" class="vt-cr-btn ${state.sidebarMode === 'rbac' ? 'vt-cr-btn-primary' : ''}" type="button" style="width:100%;justify-content:space-between;">
            <span>🛡️ Nhân sự &amp; Phân quyền</span>
            <span class="vt-cr-count-pill" style="${state.sidebarMode === 'rbac' ? 'background:rgba(255,255,255,0.22);color:#fff;' : ''}">${pendingCount > 0 ? pendingCount + ' chờ' : 'Quản lý'}</span>
          </button>
          <button id="vtCrBtnFacultyOrbit" class="vt-cr-btn ${state.sidebarMode === 'faculty' ? 'vt-cr-btn-emerald' : ''}" type="button" style="width:100%;justify-content:space-between;">
            <span>✦ Danh sách Giáo viên</span>
            <span class="vt-cr-count-pill" style="${state.sidebarMode === 'faculty' ? 'background:rgba(255,255,255,0.22);color:#fff;' : ''}">${facultyCount} GV</span>
          </button>
          <button id="vtCrNavMasterStudents" class="vt-cr-btn ${state.sidebarMode === 'students' ? 'vt-cr-btn-primary' : ''}" type="button" style="width:100%;justify-content:space-between;">
            <span>🎓 Học sinh Toàn trường</span>
            <span class="vt-cr-count-pill" style="${state.sidebarMode === 'students' ? 'background:rgba(255,255,255,0.22);color:#fff;' : ''}">${totalStuCount} HS</span>
          </button>
        </div>
      `;

      const groups = b.gradeBlocks || {};
      const keys = Object.keys(groups).sort(function (a, c) { return a.localeCompare(c, 'vi'); });
      if (!keys.length) {
        html += `<div style="font-size:12px;color:var(--cr-soft);padding:10px 6px;">Chưa có lớp nào. Hãy bấm "+ Tạo Khối / Lớp mới".</div>`;
      } else {
        keys.forEach(function (gb) {
          const list = groups[gb] || [];
          html += `
            <div class="vt-cr-side-section">
              <div class="vt-cr-grade-header">
                <span class="vt-cr-grade-star">✦</span>
                <span class="vt-cr-grade-name">${esc(gb)}</span>
                <span class="vt-cr-grade-line"></span>
                <span class="vt-cr-count-pill">${list.length} lớp</span>
              </div>
              <div class="vt-cr-orbit-list">`;
          list.forEach(function (cls) {
            const act = state.sidebarMode === 'classes' && cls.classId === state.selectedClassId;
            const gvcnShort = cls.homeroomTeacherEmail ? cls.homeroomTeacherEmail.split('@')[0] : (cls.schoolYear || '2026-2027');
            html += `
              <button type="button" class="vt-cr-nav-item ${act ? 'active' : ''}" data-select-class="${esc(cls.classId)}" data-select-subject="${esc(state.selectedSubject || 'Toán học')}">
                <span style="min-width:0;">Lớp ${esc(cls.className)}<span class="vt-cr-nav-sub">${esc(gvcnShort)}</span></span>
                <span class="vt-cr-count-pill">${cls.studentCount || 0} HS</span>
              </button>`;
          });
          html += `</div></div>`;
        });
      }
    } else if (state.role === 'HOMEROOM_TEACHER') {
      const hrList = b.classes || [];
      html += `
        <div class="vt-cr-side-section">
          <div class="vt-cr-grade-header"><span class="vt-cr-grade-star">✦</span><span class="vt-cr-grade-name">Lớp Chủ nhiệm</span><span class="vt-cr-grade-line"></span></div>
          <div class="vt-cr-orbit-list">`;
      if (!hrList.length) {
        html += `<div style="font-size:12px;color:var(--cr-soft);padding:6px;">Chưa được gán lớp chủ nhiệm.</div>`;
      } else {
        hrList.forEach(function (cls) {
          const act = cls.classId === state.selectedClassId;
          html += `
            <button type="button" class="vt-cr-nav-item ${act ? 'active' : ''}" data-select-class="${esc(cls.classId)}" data-select-subject="">
              <span>Lớp ${esc(cls.className)}<span class="vt-cr-nav-sub">${esc(cls.gradeBlock || '')} • Chủ nhiệm</span></span>
              <span class="vt-cr-count-pill">${cls.studentCount || 0} HS</span>
            </button>`;
        });
      }
      html += `</div></div>`;

      const teaches = b.teachingAssignments || [];
      if (teaches.length) {
        html += `
          <div class="vt-cr-side-section">
            <div class="vt-cr-grade-header"><span class="vt-cr-grade-star">✦</span><span class="vt-cr-grade-name">Kiêm giảng Bộ môn</span><span class="vt-cr-grade-line"></span></div>
            <div class="vt-cr-orbit-list">`;
        teaches.forEach(function (t) {
          const act = t.classId === state.selectedClassId && state.selectedSubject === t.subject;
          html += `
            <button type="button" class="vt-cr-nav-item ${act ? 'active' : ''}" data-select-class="${esc(t.classId)}" data-select-subject="${esc(t.subject)}">
              <span>Lớp ${esc(t.className)}<span class="vt-cr-nav-sub"><span class="vt-cr-badge subject" style="padding:1px 7px;font-size:10px;">${esc(t.subject)}</span></span></span>
              <span class="vt-cr-count-pill">${t.studentCount || 0} HS</span>
            </button>`;
        });
        html += `</div></div>`;
      }
    } else if (state.role === 'SUBJECT_TEACHER') {
      const pairs = b.classes || [];
      html += `
        <div class="vt-cr-side-section">
          <div class="vt-cr-grade-header"><span class="vt-cr-grade-star">✦</span><span class="vt-cr-grade-name">Phân công Giảng dạy</span><span class="vt-cr-grade-line"></span><span class="vt-cr-count-pill">${pairs.length}</span></div>
          <div class="vt-cr-orbit-list">`;
      if (!pairs.length) {
        html += `<div style="font-size:12px;color:var(--cr-soft);padding:6px;">Chưa có lớp nào khớp phân công giảng dạy của bạn.</div>`;
      } else {
        pairs.forEach(function (t) {
          const act = t.classId === state.selectedClassId && state.selectedSubject === t.subject;
          html += `
            <button type="button" class="vt-cr-nav-item ${act ? 'active' : ''}" data-select-class="${esc(t.classId)}" data-select-subject="${esc(t.subject)}">
              <span style="min-width:0;">Lớp ${esc(t.className)}<span class="vt-cr-nav-sub"><span class="vt-cr-badge subject" style="padding:1px 7px;font-size:10px;">${esc(t.subject)}</span></span></span>
              <span class="vt-cr-count-pill">${t.studentCount || 0} HS</span>
            </button>`;
        });
      }
      html += `</div></div>`;
    } else if (state.role === 'STUDENT') {
      const cls = b.classInfo;
      html += `
        <div class="vt-cr-side-section">
          <div class="vt-cr-grade-header"><span class="vt-cr-grade-star">✦</span><span class="vt-cr-grade-name">Lớp học của tôi</span><span class="vt-cr-grade-line"></span></div>
          <div class="vt-cr-orbit-list">`;
      if (cls) {
        html += `
          <button type="button" class="vt-cr-nav-item active" data-select-class="${esc(cls.classId)}" data-select-subject="">
            <span>Lớp ${esc(cls.className)}<span class="vt-cr-nav-sub">${esc(cls.gradeBlock || '')} • ${esc(cls.schoolYear || '')}</span></span>
            <span class="vt-cr-count-pill">Học sinh</span>
          </button>`;
      } else {
        html += `<div style="font-size:12px;color:var(--cr-soft);padding:6px;">Tài khoản của bạn chưa được xếp vào lớp.</div>`;
      }
      html += `</div></div>`;
    }

    side.innerHTML = html;

    const btnNew = document.getElementById('vtCrBtnNewClass');
    if (btnNew) btnNew.addEventListener('click', function () { openClassFormModal(null); });

    const btnRbac = document.getElementById('vtCrNavRbac');
    if (btnRbac) {
      btnRbac.addEventListener('click', function () {
        toggleDrawer(false);
        state.sidebarMode = 'rbac';
        loadRbacCenter(false);
      });
    }
    const btnFac = document.getElementById('vtCrBtnFacultyOrbit');
    if (btnFac) {
      btnFac.addEventListener('click', function () {
        toggleDrawer(false);
        state.sidebarMode = 'faculty';
        loadRbacCenter(false);
      });
    }
    const btnMasterStu = document.getElementById('vtCrNavMasterStudents');
    if (btnMasterStu) {
      btnMasterStu.addEventListener('click', function () {
        toggleDrawer(false);
        state.sidebarMode = 'students';
        loadRbacCenter(false);
      });
    }

    side.querySelectorAll('[data-select-class]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleDrawer(false);
        state.sidebarMode = 'classes';
        state.selectedClassId = btn.getAttribute('data-select-class') || '';
        state.selectedSubject = btn.getAttribute('data-select-subject') || '';
        if (state.role === 'SUBJECT_TEACHER' && state.activeTab === 'summary') state.activeTab = 'roster';
        renderSidebar();
        loadActiveClassData();
      });
    });
  }

  function renderFacultyOrbitHtml() {
    const teachers = (state.bootstrap && state.bootstrap.approvedTeachers) || [];
    const homeroomCount = teachers.filter(function (t) { return t.assignedRole === 'HOMEROOM_TEACHER'; }).length;
    const subjectCount = teachers.filter(function (t) { return t.assignedRole === 'SUBJECT_TEACHER'; }).length;

    let cardsHtml = '';
    if (!teachers.length) {
      cardsHtml = `<div style="padding:32px;text-align:center;color:var(--cr-soft);grid-column:1/-1;">Chưa có tài khoản giáo viên nào được phê duyệt.</div>`;
    } else {
      teachers.forEach(function (t) {
        const isHr = t.assignedRole === 'HOMEROOM_TEACHER';
        let tagsHtml = '';
        if (isHr && t.homeroomClass) {
          tagsHtml += `<span class="vt-cr-badge admin">★ Chủ nhiệm Lớp ${esc(t.homeroomClass)}</span>`;
        }
        (t.teachingAssignments || []).forEach(function (a) {
          tagsHtml += `<span class="vt-cr-badge homeroom">${esc(a.subject)} — ${esc(a.classes)}</span>`;
        });
        if (!tagsHtml) tagsHtml = `<span class="vt-cr-badge unlinked">Chưa khai báo phân công</span>`;

        cardsHtml += `
          <div class="vt-faculty-card ${isHr ? 'is-homeroom' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                <span class="vt-cr-avatar ${isHr ? 'female' : 'male'}">${esc(getInitials(t.fullName))}</span>
                <div style="min-width:0;">
                  <div style="font-weight:700;font-size:14px;color:var(--cr-ink);">${esc(t.fullName)}</div>
                  <div class="vt-cr-mono" style="font-size:11.4px;color:var(--cr-soft);overflow:hidden;text-overflow:ellipsis;">${esc(t.email)}</div>
                </div>
              </div>
              <span class="vt-cr-badge ${isHr ? 'admin' : 'homeroom'}">${isHr ? 'Giáo viên Chủ nhiệm' : 'Giáo viên Bộ môn'}</span>
            </div>
            <div class="vt-faculty-tags">${tagsHtml}</div>
          </div>`;
      });
    }

    return `
      <div class="vt-cr-banner">
        <svg class="vt-cr-banner-svg" viewBox="0 0 280 200" fill="none"><ellipse cx="200" cy="90" rx="120" ry="52" transform="rotate(-16 200 90)" stroke="rgba(251,191,36,0.34)" stroke-width="1.2"/><circle cx="200" cy="90" r="64" stroke="rgba(56,189,248,0.28)" stroke-width="1" stroke-dasharray="4 6"/><circle cx="152" cy="48" r="2.2" fill="#FDE68A"/><circle cx="238" cy="126" r="2" fill="#38BDF8"/></svg>
        <div class="vt-cr-banner-top">
          <div>
            <div class="vt-cr-banner-eyebrow">✦ FACULTY ORBIT • SUPER ADMIN DIRECTORY</div>
            <h1 class="vt-cr-banner-title">Đội ngũ Giáo viên Hệ thống</h1>
          </div>
          <button id="vtCrBackToClasses" class="vt-cr-btn vt-cr-btn-sm vt-cr-btn-glass-dark" type="button">← Quay lại Danh sách Lớp</button>
        </div>
        <div class="vt-cr-banner-kpis">
          <div class="vt-cr-banner-kpi"><span>Tổng số Giáo viên</span><b>${teachers.length} giáo viên</b></div>
          <div class="vt-cr-banner-kpi"><span>Giáo viên Chủ nhiệm</span><b style="color:#FCD34D;">${homeroomCount} GVCN</b></div>
          <div class="vt-cr-banner-kpi"><span>Giáo viên Bộ môn</span><b style="color:#38BDF8;">${subjectCount} GVBM</b></div>
        </div>
      </div>
      <div class="vt-cr-card">
        <div class="vt-faculty-grid">${cardsHtml}</div>
      </div>
    `;
  }


  /* ==========================================================================
   * 6B. v5.0 UNIFIED RBAC CENTER, FACULTY DIRECTORY, MASTER STUDENTS & 360°
   * ========================================================================== */

  function renderWarningLampHtml(level, reasons) {
    const lv = level || 'GREEN';
    const meta = {
      GREEN: { icon: '🟢', text: 'Ổn định' },
      YELLOW: { icon: '🟡', text: 'Cần chú ý' },
      RED: { icon: '🔴', text: 'Cảnh báo' }
    }[lv] || { icon: '🟢', text: 'Ổn định' };
    const tip = Array.isArray(reasons) && reasons.length ? reasons.join(' • ') : 'Học tập & chuyên cần ổn định';
    return '<span class="vt-warn-lamp ' + escapeAttr(lv) + '" title="' + escapeAttr(tip) + '">' + meta.icon + ' ' + meta.text + '</span>';
  }

  function renderTrendDeltaHtml(delta) {
    const n = Number(delta);
    if (!isFinite(n) || n === 0) return '<span class="vt-trend-flat">• 0.0</span>';
    if (n > 0) return '<span class="vt-trend-up">▲ +' + n.toFixed(1) + '</span>';
    return '<span class="vt-trend-down">▼ ' + n.toFixed(1) + '</span>';
  }

  function renderRbacCenterHtml() {
    const d = state.rbacData;
    if (state.loadingRbac || !d) {
      return '<div class="vt-cr-card"><div class="vt-cr-skeleton" style="height:36px;"></div><div class="vt-cr-skeleton" style="height:180px;"></div></div>';
    }
    const rp = d.rolePermissions || {};
    const roles = [
      { key: 'HOMEROOM_TEACHER', label: 'Giáo viên Chủ nhiệm' },
      { key: 'SUBJECT_TEACHER', label: 'Giáo viên Bộ môn' },
      { key: 'STUDENT', label: 'Học sinh' }
    ];

    let matrixRows = '';
    PERM_META.forEach(function (pm) {
      let cells = '';
      roles.forEach(function (r) {
        const checked = Boolean(rp[r.key] && rp[r.key][pm.key]);
        cells += '<td style="text-align:center;"><label class="vt-switch"><input type="checkbox" data-perm-role="' + escapeAttr(r.key) + '" data-perm-key="' + escapeAttr(pm.key) + '" ' + (checked ? 'checked' : '') + '><span class="vt-switch-slider"></span></label></td>';
      });
      matrixRows += '<tr><td style="font-weight:600;">' + escapeHtml(pm.label) + '</td>' + cells + '</tr>';
    });

    const allClasses = d.classes || [];
    const q = state.rbacSearch.trim().toLowerCase();
    const sf = state.rbacStatusFilter || 'ALL';
    const filteredUsers = (d.users || []).filter(function (u) {
      if (sf !== 'ALL' && u.status !== sf) return false;
      if (!q) return true;
      return String(u.email || '').toLowerCase().indexOf(q) !== -1 ||
        String((u.profile && u.profile.fullName) || u.googleName || '').toLowerCase().indexOf(q) !== -1;
    });

    let userCardsHtml = '';
    if (!filteredUsers.length) {
      userCardsHtml = '<div style="text-align:center;padding:24px;color:var(--cr-soft);">Không có tài khoản nào khớp bộ lọc.</div>';
    } else {
      filteredUsers.forEach(function (u, idx) {
        const prof = u.profile || {};
        const curRole = u.assignedRole || u.declaredRole || 'STUDENT';
        const isPending = u.status === 'PENDING';
        const classOpts = '<option value="">— Không chủ nhiệm —</option>' + allClasses.map(function (c) {
          const sel = String(prof.homeroomClass || '').toUpperCase() === String(c.className || '').toUpperCase() ? 'selected' : '';
          return '<option value="' + escapeAttr(c.className) + '" ' + sel + '>Lớp ' + escapeHtml(c.className) + ' (' + escapeHtml(c.gradeBlock) + ')</option>';
        }).join('');
        const teachStr = (prof.teachingAssignments || []).map(function (a) { return a.subject + ': ' + a.classes; }).join('; ');

        userCardsHtml += `
          <div class="vt-rbac-user-card ${isPending ? 'is-pending' : ''}" data-rbac-email="${escapeAttr(u.email)}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="vt-cr-avatar male">${escapeHtml(getInitials(prof.fullName || u.googleName || u.email))}</span>
                <div>
                  <div style="font-weight:700;font-size:14px;">${escapeHtml(prof.fullName || u.googleName || u.email)}</div>
                  <div class="vt-cr-mono" style="font-size:11.5px;color:var(--cr-soft);">${escapeHtml(u.email)} • Đăng ký: ${escapeHtml(formatRoleLabel(u.declaredRole))}</div>
                </div>
              </div>
              <span class="vt-cr-badge ${u.status === 'APPROVED' ? 'linked' : 'unlinked'}">${escapeHtml(formatStatusLabel(u.status))}</span>
            </div>
            <div class="vt-rbac-edit-grid">
              <div class="vt-cr-field">
                <label>Trạng thái</label>
                <select class="vt-rbac-status">
                  <option value="APPROVED" ${u.status === 'APPROVED' ? 'selected' : ''}>✓ Đã duyệt</option>
                  <option value="PENDING" ${u.status === 'PENDING' ? 'selected' : ''}>⏳ Chờ duyệt</option>
                  <option value="REJECTED" ${u.status === 'REJECTED' ? 'selected' : ''}>✕ Từ chối</option>
                </select>
              </div>
              <div class="vt-cr-field">
                <label>Vai trò cấp quyền</label>
                <select class="vt-rbac-role">
                  <option value="HOMEROOM_TEACHER" ${curRole === 'HOMEROOM_TEACHER' ? 'selected' : ''}>GV Chủ nhiệm</option>
                  <option value="SUBJECT_TEACHER" ${curRole === 'SUBJECT_TEACHER' ? 'selected' : ''}>GV Bộ môn</option>
                  <option value="STUDENT" ${curRole === 'STUDENT' ? 'selected' : ''}>Học sinh</option>
                </select>
              </div>
              <div class="vt-cr-field">
                <label>Lớp Chủ nhiệm (từ DS Lớp)</label>
                <select class="vt-rbac-hr">${classOpts}</select>
              </div>
            </div>
            <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">
              <div class="vt-cr-field" style="flex:1;min-width:220px;">
                <label>Phân công Giảng dạy (Môn: Lớp1, Lớp2; ...)</label>
                <input type="text" class="vt-rbac-teach" value="${escapeAttr(teachStr)}" placeholder="VD: Toán học: 12A1, 12A2; Vật lý: 11A1">
              </div>
              <button type="button" class="vt-cr-btn vt-cr-btn-primary vt-rbac-save-user">✓ Lưu phân quyền</button>
            </div>
          </div>`;
      });
    }

    return `
      <section class="vt-cr-card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <h2 style="font-family:var(--cr-serif);font-size:22px;margin:0;">🛡️ Phân quyền theo Vai trò</h2>
          <button id="vtCrSavePermMatrix" class="vt-cr-btn vt-cr-btn-primary vt-cr-btn-shimmer" type="button">💾 Lưu Phân quyền</button>
        </div>
        <div class="vt-cr-table-wrap">
          <table class="vt-cr-table">
            <thead>
              <tr>
                <th>Tính năng / Quyền hạn</th>
                <th style="text-align:center;">GV Chủ nhiệm</th>
                <th style="text-align:center;">GV Bộ môn</th>
                <th style="text-align:center;">Học sinh</th>
              </tr>
            </thead>
            <tbody>${matrixRows}</tbody>
          </table>
        </div>
      </section>

      <section class="vt-cr-card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <h2 style="font-family:var(--cr-serif);font-size:22px;margin:0;">👥 Nhân sự &amp; Duyệt Tài khoản</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input id="vtCrRbacSearch" class="vt-cr-search" style="min-width:200px;" type="text" value="${escapeAttr(state.rbacSearch)}" placeholder="🔍 Tìm tên hoặc Gmail...">
            <select id="vtCrRbacStatusFilter" class="vt-cr-filter-select">
              <option value="ALL" ${sf === 'ALL' ? 'selected' : ''}>Tất cả trạng thái</option>
              <option value="PENDING" ${sf === 'PENDING' ? 'selected' : ''}>⏳ Chờ duyệt</option>
              <option value="APPROVED" ${sf === 'APPROVED' ? 'selected' : ''}>✓ Đã duyệt</option>
              <option value="REJECTED" ${sf === 'REJECTED' ? 'selected' : ''}>✕ Từ chối</option>
            </select>
          </div>
        </div>
        <div>${userCardsHtml}</div>
      </section>
    `;
  }

  function wireRbacCenterEvents() {
    const saveMatBtn = document.getElementById('vtCrSavePermMatrix');
    if (saveMatBtn) {
      saveMatBtn.addEventListener('click', async function () {
        const payload = { HOMEROOM_TEACHER: {}, SUBJECT_TEACHER: {}, STUDENT: {} };
        document.querySelectorAll('#vtClassroomModal [data-perm-role]').forEach(function (cb) {
          const r = cb.getAttribute('data-perm-role');
          const k = cb.getAttribute('data-perm-key');
          if (payload[r]) payload[r][k] = cb.checked;
        });
        saveMatBtn.disabled = true;
        const res = await callBridge('admin_update_role_permissions', { rolePermissions: payload });
        saveMatBtn.disabled = false;
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu Ma trận Quyền.'), true); return; }
        if (state.rbacData) state.rbacData.rolePermissions = res.rolePermissions;
        showToast('✓ Đã lưu Ma trận Quyền và đồng bộ toàn hệ thống.');
      });
    }

    const searchEl = document.getElementById('vtCrRbacSearch');
    if (searchEl) {
      searchEl.addEventListener('input', function (e) {
        state.rbacSearch = e.target.value;
        renderMain();
        const nxt = document.getElementById('vtCrRbacSearch');
        if (nxt) { nxt.focus(); nxt.setSelectionRange(nxt.value.length, nxt.value.length); }
      });
    }
    const filterEl = document.getElementById('vtCrRbacStatusFilter');
    if (filterEl) {
      filterEl.addEventListener('change', function (e) {
        state.rbacStatusFilter = e.target.value;
        renderMain();
      });
    }

    document.querySelectorAll('#vtClassroomModal .vt-rbac-save-user').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const card = btn.closest('.vt-rbac-user-card');
        if (!card) return;
        const email = card.getAttribute('data-rbac-email');
        const status = card.querySelector('.vt-rbac-status').value;
        const assignedRole = card.querySelector('.vt-rbac-role').value;
        const homeroomClass = card.querySelector('.vt-rbac-hr').value;
        const teachRaw = card.querySelector('.vt-rbac-teach').value.trim();
        const teachingAssignments = [];
        if (teachRaw) {
          teachRaw.split(';').forEach(function (chunk) {
            const parts = chunk.split(':');
            if (parts.length >= 2) {
              const subj = parts[0].trim();
              const clsList = parts.slice(1).join(':').trim();
              if (subj && clsList) teachingAssignments.push({ subject: subj, classes: clsList });
            }
          });
        }
        btn.disabled = true;
        const res = await callBridge('admin_update_user_access', {
          targetEmail: email,
          status: status,
          assignedRole: assignedRole,
          homeroomClass: homeroomClass,
          teachingAssignments: teachingAssignments
        });
        btn.disabled = false;
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu phân quyền.'), true); return; }
        showToast('✓ Đã cập nhật phân quyền cho ' + email + '.');
        await loadRbacCenter(true);
      });
    });
  }

  function renderFacultyDirectoryV5Html() {
    const d = state.rbacData;
    const list = (d && d.teachersDirectory) || (state.bootstrap && state.bootstrap.approvedTeachers) || [];
    const q = state.facultySearch.trim().toLowerCase();
    const rf = state.facultyRoleFilter || 'ALL';
    const filtered = list.filter(function (t) {
      if (rf !== 'ALL' && t.assignedRole !== rf) return false;
      if (!q) return true;
      return String(t.fullName || '').toLowerCase().indexOf(q) !== -1 ||
        String(t.email || '').toLowerCase().indexOf(q) !== -1 ||
        String(t.homeroomClass || '').toLowerCase().indexOf(q) !== -1;
    });

    let cards = '';
    if (!filtered.length) {
      cards = '<div style="text-align:center;padding:30px;color:var(--cr-soft);">Chưa có giáo viên nào khớp bộ lọc.</div>';
    } else {
      filtered.forEach(function (t) {
        const isHr = t.assignedRole === 'HOMEROOM_TEACHER';
        const pills = (t.teachingAssignments || []).map(function (a) {
          return '<span class="vt-cr-id-pill" style="font-size:11px;">' + escapeHtml(a.subject) + ' — ' + escapeHtml(a.classes) + '</span>';
        }).join(' ');
        cards += `
          <div class="vt-faculty-card ${isHr ? 'homeroom' : 'subject'}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="vt-cr-avatar ${isHr ? 'female' : 'male'}">${escapeHtml(getInitials(t.fullName || t.email))}</span>
                <div>
                  <div style="font-weight:700;font-size:14.5px;">${escapeHtml(t.fullName || t.email)}</div>
                  <div class="vt-cr-mono" style="font-size:11.5px;color:var(--cr-soft);">${escapeHtml(t.email)}</div>
                </div>
              </div>
              <span class="vt-cr-badge ${isHr ? 'dirty' : 'linked'}">${isHr ? '★ GV Chủ nhiệm' : '✦ GV Bộ môn'}</span>
            </div>
            <div style="font-size:12.5px;color:var(--cr-muted);display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
              <span>Lớp CN: <b>${escapeHtml(t.homeroomClass || '—')}</b></span>
              <span>Phụ trách: <b>${escapeHtml(t.totalStudentsSupervised || 0)} HS</b> (${escapeHtml(t.teachingClassCount || 0)} lớp)</span>
            </div>
            ${pills ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">' + pills + '</div>' : ''}
            <div style="margin-top:10px;display:flex;justify-content:flex-end;">
              <button type="button" class="vt-cr-btn vt-cr-btn-sm vt-fac-edit-btn" data-fac-email="${escapeAttr(t.email)}">✎ Sửa phân công</button>
            </div>
          </div>`;
      });
    }

    return `
      <section class="vt-cr-card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <h2 style="font-family:var(--cr-serif);font-size:22px;margin:0;">✦ Đội ngũ Giáo viên (${filtered.length})</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input id="vtCrFacSearch" class="vt-cr-search" style="min-width:190px;" type="text" value="${escapeAttr(state.facultySearch)}" placeholder="🔍 Tìm giáo viên...">
            <select id="vtCrFacRoleFilter" class="vt-cr-filter-select">
              <option value="ALL" ${rf === 'ALL' ? 'selected' : ''}>Tất cả vai trò</option>
              <option value="HOMEROOM_TEACHER" ${rf === 'HOMEROOM_TEACHER' ? 'selected' : ''}>★ GV Chủ nhiệm</option>
              <option value="SUBJECT_TEACHER" ${rf === 'SUBJECT_TEACHER' ? 'selected' : ''}>✦ GV Bộ môn</option>
            </select>
          </div>
        </div>
        <div class="vt-faculty-grid">${cards}</div>
      </section>
    `;
  }

  function wireFacultyDirectoryV5Events() {
    const s = document.getElementById('vtCrFacSearch');
    if (s) s.addEventListener('input', function (e) {
      state.facultySearch = e.target.value;
      renderMain();
      const nxt = document.getElementById('vtCrFacSearch');
      if (nxt) { nxt.focus(); nxt.setSelectionRange(nxt.value.length, nxt.value.length); }
    });
    const rf = document.getElementById('vtCrFacRoleFilter');
    if (rf) rf.addEventListener('change', function (e) { state.facultyRoleFilter = e.target.value; renderMain(); });
    document.querySelectorAll('#vtClassroomModal .vt-fac-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.rbacSearch = btn.getAttribute('data-fac-email') || '';
        state.rbacStatusFilter = 'ALL';
        state.sidebarMode = 'rbac';
        renderSidebar();
        renderMain();
      });
    });
  }

  function renderMasterStudentsHtml() {
    const d = state.rbacData;
    const all = (d && d.allStudentsDirectory) || [];
    const classes = (d && d.classes) || [];
    const blocks = [];
    classes.forEach(function (c) { if (c.gradeBlock && blocks.indexOf(c.gradeBlock) === -1) blocks.push(c.gradeBlock); });
    blocks.sort();

    const q = state.masterSearch.trim().toLowerCase();
    const filtered = all.filter(function (st) {
      if (state.masterBlockFilter !== 'ALL' && st.gradeBlock !== state.masterBlockFilter) return false;
      if (state.masterClassFilter !== 'ALL' && st.classId !== state.masterClassFilter) return false;
      if (state.masterWarningFilter !== 'ALL' && (st.warningLevel || 'GREEN') !== state.masterWarningFilter) return false;
      if (state.masterLinkFilter === 'linked' && !st.linkedEmail) return false;
      if (state.masterLinkFilter === 'unlinked' && st.linkedEmail) return false;
      if (!q) return true;
      return String(st.fullName || '').toLowerCase().indexOf(q) !== -1 ||
        String(st.studentId || '').toLowerCase().indexOf(q) !== -1 ||
        String(st.className || '').toLowerCase().indexOf(q) !== -1;
    });

    let rowsHtml = '';
    if (!filtered.length) {
      rowsHtml = '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--cr-soft);">Không tìm thấy học sinh phù hợp.</td></tr>';
    } else {
      filtered.forEach(function (st) {
        const pts = Number(st.behaviorPoints) || 0;
        const avgTxt = (st.latestAvg !== null && st.latestAvg !== undefined) ? Number(st.latestAvg).toFixed(1) : '—';
        rowsHtml += `
          <tr class="vt-roster-row" style="cursor:pointer;" data-master-360-cid="${escapeAttr(st.classId)}" data-master-360-sid="${escapeAttr(st.studentId)}">
            <td><span class="vt-cr-id-pill">◉ ${escapeHtml(st.studentId)}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="vt-cr-avatar ${genderAvatarClass(st.gender)}">${escapeHtml(getInitials(st.fullName))}</span>
                <div>
                  <div style="font-weight:700;">${escapeHtml(st.fullName)}</div>
                  <div style="font-size:11.5px;color:var(--cr-soft);">Lớp ${escapeHtml(st.className)} • ${escapeHtml(st.gradeBlock)}</div>
                </div>
              </div>
            </td>
            <td>${renderWarningLampHtml(st.warningLevel, st.warningReasons)}</td>
            <td><span class="vt-cr-mono" style="font-weight:700;">${avgTxt}</span> ${renderTrendDeltaHtml(st.trendDelta)}</td>
            <td><span class="vt-seewo-pill ${pts < 0 ? 'neg' : ''}">${pts >= 0 ? '+' + pts : pts}★</span></td>
            <td>${st.linkedEmail ? '<span class="vt-cr-badge linked">Đã liên kết</span>' : '<span class="vt-cr-badge unlinked">Chưa liên kết</span>'}</td>
            <td style="text-align:right;"><button type="button" class="vt-cr-btn vt-cr-btn-sm vt-cr-btn-primary">📊 Hồ sơ 360°</button></td>
          </tr>`;
      });
    }

    return `
      <section class="vt-cr-card">
        <div style="margin-bottom:14px;">
          <h2 style="font-family:var(--cr-serif);font-size:22px;margin:0;">🎓 Học sinh Toàn trường (${filtered.length})</h2>
        </div>
        <div class="vt-cr-toolbar" style="margin-bottom:12px;">
          <input id="vtCrMasterSearch" class="vt-cr-search" type="text" value="${escapeAttr(state.masterSearch)}" placeholder="🔍 Tìm họ tên, mã HS, lớp...">
          <select id="vtCrMasterBlock" class="vt-cr-filter-select">
            <option value="ALL">Tất cả Khối</option>
            ${blocks.map(function (b) { return '<option value="' + escapeAttr(b) + '" ' + (state.masterBlockFilter === b ? 'selected' : '') + '>' + escapeHtml(b) + '</option>'; }).join('')}
          </select>
          <select id="vtCrMasterClass" class="vt-cr-filter-select">
            <option value="ALL">Tất cả Lớp</option>
            ${classes.map(function (c) { return '<option value="' + escapeAttr(c.classId) + '" ' + (state.masterClassFilter === c.classId ? 'selected' : '') + '>Lớp ' + escapeHtml(c.className) + '</option>'; }).join('')}
          </select>
          <select id="vtCrMasterWarn" class="vt-cr-filter-select">
            <option value="ALL" ${state.masterWarningFilter === 'ALL' ? 'selected' : ''}>Mọi cảnh báo</option>
            <option value="RED" ${state.masterWarningFilter === 'RED' ? 'selected' : ''}>🔴 Cảnh báo đỏ</option>
            <option value="YELLOW" ${state.masterWarningFilter === 'YELLOW' ? 'selected' : ''}>🟡 Cần chú ý</option>
            <option value="GREEN" ${state.masterWarningFilter === 'GREEN' ? 'selected' : ''}>🟢 Ổn định</option>
          </select>
          <select id="vtCrMasterLink" class="vt-cr-filter-select">
            <option value="ALL" ${state.masterLinkFilter === 'ALL' ? 'selected' : ''}>Mọi Gmail</option>
            <option value="linked" ${state.masterLinkFilter === 'linked' ? 'selected' : ''}>● Đã liên kết</option>
            <option value="unlinked" ${state.masterLinkFilter === 'unlinked' ? 'selected' : ''}>◌ Chưa liên kết</option>
          </select>
        </div>
        <div class="vt-cr-table-wrap">
          <table class="vt-cr-table vt-mobile-cards">
            <thead><tr><th>Mã HS</th><th>Học sinh</th><th>Cảnh báo</th><th>ĐTB / Xu hướng</th><th>Rèn luyện</th><th>Gmail</th><th style="text-align:right;">Hồ sơ</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function wireMasterStudentsEvents() {
    const s = document.getElementById('vtCrMasterSearch');
    if (s) s.addEventListener('input', function (e) {
      state.masterSearch = e.target.value;
      renderMain();
      const nxt = document.getElementById('vtCrMasterSearch');
      if (nxt) { nxt.focus(); nxt.setSelectionRange(nxt.value.length, nxt.value.length); }
    });
    const b = document.getElementById('vtCrMasterBlock');
    if (b) b.addEventListener('change', function (e) { state.masterBlockFilter = e.target.value; renderMain(); });
    const c = document.getElementById('vtCrMasterClass');
    if (c) c.addEventListener('change', function (e) { state.masterClassFilter = e.target.value; renderMain(); });
    const w = document.getElementById('vtCrMasterWarn');
    if (w) w.addEventListener('change', function (e) { state.masterWarningFilter = e.target.value; renderMain(); });
    const l = document.getElementById('vtCrMasterLink');
    if (l) l.addEventListener('change', function (e) { state.masterLinkFilter = e.target.value; renderMain(); });

    document.querySelectorAll('#vtClassroomModal [data-master-360-sid]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        openStudent360Drawer(tr.getAttribute('data-master-360-cid'), tr.getAttribute('data-master-360-sid'));
      });
    });
  }

  function renderTrendSparklineSvg(series) {
    if (!Array.isArray(series) || series.length === 0) {
      return '<div style="padding:18px;text-align:center;font-size:12px;color:var(--cr-soft);background:var(--cr-surface-soft);border-radius:14px;">Chưa có dữ liệu bài kiểm tra theo thời gian để vẽ biểu đồ xu hướng.</div>';
    }
    const W = 460, H = 128, padX = 28, padY = 18;
    const pts = series.map(function (item, idx) {
      const x = series.length === 1 ? W / 2 : padX + (idx / (series.length - 1)) * (W - padX * 2);
      const val = Math.max(0, Math.min(10, Number(item.score) || 0));
      const y = H - padY - (val / 10) * (H - padY * 2);
      return { x: x, y: y, val: val, label: item.label || '' };
    });
    const poly = pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    const area = poly + ' ' + pts[pts.length - 1].x.toFixed(1) + ',' + (H - padY) + ' ' + pts[0].x.toFixed(1) + ',' + (H - padY);
    const circles = pts.map(function (p) {
      return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="#1D4ED8" stroke="#FFFFFF" stroke-width="1.8"><title>' + escapeAttr(p.label + ': ' + p.val) + '</title></circle>';
    }).join('');
    return `
      <div style="background:var(--cr-surface-soft);border:1px solid var(--cr-border);border-radius:14px;padding:10px 12px;">
        <div style="font-size:11.5px;font-weight:700;color:var(--cr-muted);margin-bottom:6px;">📈 Biểu đồ Xu hướng Điểm (Thang 10)</div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
          <defs>
            <linearGradient id="vtSparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.32"/>
              <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.02"/>
            </linearGradient>
          </defs>
          <line x1="${padX}" y1="${H - padY - 0.5 * (H - padY * 2)}" x2="${W - padX}" y2="${H - padY - 0.5 * (H - padY * 2)}" stroke="rgba(239,68,68,0.28)" stroke-dasharray="4 4"/>
          <polygon points="${area}" fill="url(#vtSparkGrad)"/>
          <polyline points="${poly}" fill="none" stroke="#2563EB" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          ${circles}
        </svg>
      </div>`;
  }

  function renderStudent360DrawerBody() {
    const bodyEl = document.getElementById('vtCrProfile360Body');
    const p = state.profile360;
    if (!bodyEl || !p) return;
    const st = p.student || {};
    const cls = p.classInfo || {};
    const att = p.attendanceStats || { present: 0, late: 0, absentExcused: 0, absentUnexcused: 0 };
    const totalAtt = att.present + att.late + att.absentExcused + att.absentUnexcused;
    const attPct = totalAtt > 0 ? Math.round(((att.present + att.late) / totalAtt) * 100) : 100;

    let trkTotalCols = 0, trkDoneCols = 0;
    (p.trackingGrades || []).forEach(function (tg) {
      (tg.columns || []).forEach(function (col) {
        trkTotalCols++;
        if (tg.scores && tg.scores[col.id] !== undefined && String(tg.scores[col.id]).trim() !== '') trkDoneCols++;
      });
    });
    const trkPct = trkTotalCols > 0 ? Math.round((trkDoneCols / trkTotalCols) * 100) : 100;

    const reasonsHtml = (p.warningReasons && p.warningReasons.length)
      ? '<ul style="margin:6px 0 0 18px;font-size:12px;color:var(--cr-danger);">' + p.warningReasons.map(function (r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('') + '</ul>'
      : '<div style="font-size:12px;color:var(--cr-soft);margin-top:4px;">Học lực, chuyên cần và rèn luyện đều đang ở trạng thái tốt.</div>';

    let tabContentHtml = '';
    if (state.profile360Tab === 'grades') {
      const stdRows = (p.standardGrades || []).map(function (g) {
        return '<tr><td style="font-weight:700;">' + escapeHtml(g.subject) + ' (' + escapeHtml(g.semester) + ')</td><td class="vt-cr-mono">' + escapeHtml(g.tx1 || '—') + ' / ' + escapeHtml(g.tx2 || '—') + ' / ' + escapeHtml(g.tx3 || '—') + '</td><td class="vt-cr-mono">' + escapeHtml(g.midterm || '—') + '</td><td class="vt-cr-mono">' + escapeHtml(g.final || '—') + '</td><td class="vt-cr-mono" style="font-weight:700;">' + escapeHtml(g.average || '—') + '</td></tr>';
      }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--cr-soft);padding:16px;">Chưa có dữ liệu điểm Phổ thông.</td></tr>';
      tabContentHtml = `
        <div class="vt-cr-table-wrap">
          <table class="vt-cr-table">
            <thead><tr><th>Môn (HK)</th><th>ĐGTX</th><th>GK</th><th>CK</th><th>ĐTB</th></tr></thead>
            <tbody>${stdRows}</tbody>
          </table>
        </div>`;
    } else if (state.profile360Tab === 'timeline') {
      const logs = (p.behaviorLogs || []).filter(function (lg) { return lg.category !== 'NOTE'; });
      tabContentHtml = logs.length
        ? logs.map(function (lg) {
            return '<div class="vt-audit-item"><div class="vt-audit-meta"><span class="vt-audit-action-pill">' + escapeHtml(lg.category) + '</span><span>' + escapeHtml(lg.date) + ' • ' + escapeHtml(lg.actorEmail) + '</span></div><div class="vt-audit-summary">' + escapeHtml(lg.label) + (lg.points ? ' (' + (lg.points > 0 ? '+' : '') + lg.points + '★)' : '') + (lg.note ? ' — ' + escapeHtml(lg.note) : '') + '</div></div>';
          }).join('')
        : '<div style="text-align:center;padding:20px;color:var(--cr-soft);">Chưa có ghi nhận hành vi hoặc chuyên cần.</div>';
    } else {
      const notes = (p.behaviorLogs || []).filter(function (lg) { return lg.category === 'NOTE'; });
      const canAddNote = state.role !== 'STUDENT' && (state.role === 'SUPER_ADMIN' || state.effectivePermissions.addGrowthNotes !== false);
      const noteFormHtml = canAddNote ? `
        <form id="vtCr360NoteForm" style="background:var(--cr-surface-soft);border:1px solid var(--cr-border);border-radius:14px;padding:12px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px;">
          <textarea id="vtCr360NoteText" rows="2" placeholder="Nhập nhận xét kèm cặp / định hướng học tập..." style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--cr-border);background:var(--cr-surface);color:var(--cr-ink);font-family:inherit;"></textarea>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <select id="vtCr360NoteVis" class="vt-cr-filter-select" style="height:36px;">
              <option value="STUDENT">👁 Công khai cho học sinh</option>
              <option value="TEACHER_ONLY">🔒 Chỉ nội bộ giáo viên</option>
            </select>
            <button type="submit" class="vt-cr-btn vt-cr-btn-sm vt-cr-btn-primary">+ Lưu nhận xét</button>
          </div>
        </form>` : '';
      const notesHtml = notes.length
        ? notes.map(function (lg) {
            return '<div class="vt-audit-item"><div class="vt-audit-meta"><span class="vt-audit-action-pill">' + (lg.visibility === 'TEACHER_ONLY' ? '🔒 Nội bộ GV' : '👁 Công khai') + '</span><span>' + escapeHtml(lg.date) + ' • ' + escapeHtml(lg.actorEmail) + '</span></div><div class="vt-audit-summary">' + escapeHtml(lg.note || lg.label) + '</div></div>';
          }).join('')
        : '<div style="text-align:center;padding:18px;color:var(--cr-soft);">Chưa có nhật ký kèm cặp.</div>';
      tabContentHtml = noteFormHtml + notesHtml;
    }

    bodyEl.innerHTML = `
      <div style="background:var(--cr-surface-soft);border:1px solid var(--cr-border);border-radius:18px;padding:14px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="vt-cr-avatar ${genderAvatarClass(st.gender)}" style="width:44px;height:44px;font-size:15px;">${escapeHtml(getInitials(st.fullName))}</span>
            <div>
              <div style="font-weight:800;font-size:16px;">${escapeHtml(st.fullName)}</div>
              <div class="vt-cr-mono" style="font-size:12px;color:var(--cr-soft);">◉ ${escapeHtml(st.studentId)} • Lớp ${escapeHtml(cls.className)}</div>
            </div>
          </div>
          ${renderWarningLampHtml(p.warningLevel, p.warningReasons)}
        </div>
        ${reasonsHtml}
      </div>

      <div class="vt-360-kpi-grid">
        <div class="vt-360-kpi"><span>ĐTB Chung</span><b>${p.latestAvg !== null && p.latestAvg !== undefined ? Number(p.latestAvg).toFixed(1) : '—'}</b></div>
        <div class="vt-360-kpi"><span>Điểm Rèn luyện</span><b style="color:var(--cr-amber);">${p.behaviorPoints >= 0 ? '+' + p.behaviorPoints : p.behaviorPoints}★</b></div>
        <div class="vt-360-kpi"><span>Tỷ lệ Chuyên cần</span><b style="color:var(--cr-emerald);">${attPct}%</b></div>
        <div class="vt-360-kpi"><span>Hoàn thành Theo dõi</span><b style="color:var(--cr-cobalt);">${trkPct}%</b></div>
      </div>

      ${renderTrendSparklineSvg(p.trendSeries)}

      ${(function () {
        const lc = p.lcmsStats;
        if (!lc) return '';
        const mastPills = (lc.masteryByChapter || []).map(function (m) {
          return '<span class="vt-cr-id-pill" style="font-size:11px;">✦ ' + escapeHtml(m.chapter) + ': <b>' + escapeHtml(m.tier) + ' (' + m.masteryPct + '%)</b></span>';
        }).join(' ');
        const examRows = (lc.examSubmissions || []).slice(0, 5).map(function (ex) {
          return '<div class="vt-audit-item"><div class="vt-audit-meta"><span class="vt-audit-action-pill">' + escapeHtml(ex.score + '/' + ex.maxScore) + '</span><span>' + (ex.isRushedAttempt ? '⚠ Làm bài quá nhanh' : '✓ Hợp lệ') + ' • ' + escapeHtml(String(ex.submittedAt || '').replace('T', ' ').slice(0, 16)) + '</span></div><div class="vt-audit-summary">' + escapeHtml(ex.examTitle) + '</div></div>';
        }).join('') || '<div style="font-size:12px;color:var(--cr-soft);">Chưa có lượt làm bài trên Đấu trường Đề.</div>';

        return '<div style="background:var(--cr-surface-soft);border:1px solid var(--cr-border);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
            '<b style="font-size:13.5px;">✦ Tiến độ Chòm sao &amp; Đấu trường Đề</b>' +
            '<span class="vt-cr-mono" style="font-size:12px;color:var(--cr-cobalt);font-weight:700;">' + lc.completionPct + '% hoàn thành • ' + lc.totalStarDust + '★ Bụi Sao</span>' +
          '</div>' +
          (mastPills ? '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + mastPills + '</div>' : '') +
          examRows +
        '</div>';
      })()}

      <div class="vt-cr-tabs" role="tablist">
        <button type="button" class="vt-cr-tab ${state.profile360Tab === 'grades' ? 'active' : ''}" data-p360tab="grades">📊 Điểm số</button>
        <button type="button" class="vt-cr-tab ${state.profile360Tab === 'timeline' ? 'active' : ''}" data-p360tab="timeline">⚡ Hành vi &amp; Chuyên cần</button>
        <button type="button" class="vt-cr-tab ${state.profile360Tab === 'notes' ? 'active' : ''}" data-p360tab="notes">📝 Nhật ký Kèm cặp</button>
      </div>
      <div>${tabContentHtml}</div>
    `;

    bodyEl.querySelectorAll('[data-p360tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.profile360Tab = btn.getAttribute('data-p360tab');
        renderStudent360DrawerBody();
      });
    });

    const noteForm = document.getElementById('vtCr360NoteForm');
    if (noteForm) {
      noteForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const txt = document.getElementById('vtCr360NoteText').value.trim();
        const vis = document.getElementById('vtCr360NoteVis').value;
        if (!txt) { showToast('⚠ Vui lòng nhập nội dung nhận xét.', true); return; }
        const res = await callBridge('student_log_behavior_batch', {
          classId: cls.classId,
          entries: [{ studentId: st.studentId, category: 'NOTE', label: 'Nhận xét kèm cặp', note: txt, visibility: vis }]
        });
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu nhận xét.'), true); return; }
        showToast('✓ Đã lưu nhật ký kèm cặp.');
        await openStudent360Drawer(cls.classId, st.studentId);
      });
    }
  }

  function openQuickBehaviorModal(student) {
    state.quickBehStudent = student;
    const lbl = document.getElementById('vtCrQuickBehStudentName');
    if (lbl) lbl.innerHTML = 'Học sinh: <b>' + escapeHtml(student.fullName) + '</b> (<span class="vt-cr-mono">' + escapeHtml(student.studentId) + '</span>)';
    document.getElementById('vtCrQbPoints').value = '1';
    document.getElementById('vtCrQbLabel').value = '';
    document.getElementById('vtCrQbNote').value = '';
    openSubModal('vtCrQuickBehModal');
  }

  function openAttendanceModal(cls) {
    state.attendanceDate = new Date().toISOString().slice(0, 10);
    state.attendanceDraft = {};
    state.roster.forEach(function (st) { state.attendanceDraft[st.studentId] = 'PRESENT'; });
    const titleEl = document.getElementById('vtCrAttTitle');
    if (titleEl) titleEl.textContent = '✓ Điểm danh Lớp ' + cls.className + ' hôm nay';
    const dateEl = document.getElementById('vtCrAttDate');
    if (dateEl) dateEl.value = state.attendanceDate;
    renderAttendanceModalList();
    openSubModal('vtCrAttendanceModal');
  }

  function renderAttendanceModalList() {
    const listEl = document.getElementById('vtCrAttList');
    if (!listEl) return;
    const opts = [
      { key: 'PRESENT', label: 'Có mặt' },
      { key: 'LATE', label: 'Đi muộn' },
      { key: 'ABSENT_EXCUSED', label: 'Vắng CP' },
      { key: 'ABSENT_UNEXCUSED', label: 'Vắng KP' }
    ];
    listEl.innerHTML = state.roster.map(function (st) {
      const cur = state.attendanceDraft[st.studentId] || 'PRESENT';
      const pills = opts.map(function (o) {
        return '<button type="button" class="vt-att-pill ' + (cur === o.key ? 'active ' + o.key : '') + '" data-att-sid="' + escapeAttr(st.studentId) + '" data-att-val="' + o.key + '">' + o.label + '</button>';
      }).join('');
      return '<div class="vt-att-row"><div><b>' + escapeHtml(st.fullName) + '</b> <span class="vt-cr-mono" style="font-size:11px;color:var(--cr-soft);">' + escapeHtml(st.studentId) + '</span></div><div class="vt-att-pills">' + pills + '</div></div>';
    }).join('');

    listEl.querySelectorAll('[data-att-sid]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.attendanceDraft[btn.getAttribute('data-att-sid')] = btn.getAttribute('data-att-val');
        renderAttendanceModalList();
      });
    });
  }

  function renderMain() {
    const main = document.getElementById('vtCrMain');
    if (!main) return;

    if (state.role === 'SUPER_ADMIN' && state.sidebarMode === 'rbac') {
      main.innerHTML = renderRbacCenterHtml();
      wireRbacCenterEvents();
      return;
    }
    if (state.role === 'SUPER_ADMIN' && state.sidebarMode === 'faculty') {
      main.innerHTML = renderFacultyDirectoryV5Html();
      wireFacultyDirectoryV5Events();
      return;
    }
    if (state.role === 'SUPER_ADMIN' && state.sidebarMode === 'students') {
      main.innerHTML = renderMasterStudentsHtml();
      wireMasterStudentsEvents();
      return;
    }

    if (!state.selectedClassId || !state.activeClassInfo) {
      main.innerHTML = `
        <div class="vt-cr-card" style="text-align:center;padding:48px 24px;">
          <div style="font-size:40px;margin-bottom:10px;">✦</div>
          <h2 style="font-family:var(--cr-serif);font-size:24px;margin:0 0 8px;">Chưa có lớp học nào được chọn</h2>
          <p style="font-size:13px;color:var(--cr-muted);max-width:440px;margin:0 auto 18px;">
            ${state.role === 'SUPER_ADMIN'
              ? 'Hãy tạo Khối và Lớp đầu tiên ở thanh bên trái để khởi tạo Đài Chỉ huy Lớp học và Sổ điểm Kép.'
              : 'Vui lòng liên hệ Quản trị viên để được phân công lớp học tương ứng.'}
          </p>
          ${state.role === 'SUPER_ADMIN' ? '<button id="vtCrEmptyNewClass" class="vt-cr-btn vt-cr-btn-primary vt-cr-btn-shimmer" type="button">+ Tạo Khối / Lớp mới</button>' : ''}
        </div>`;
      const btnEmpty = document.getElementById('vtCrEmptyNewClass');
      if (btnEmpty) btnEmpty.addEventListener('click', function () { openClassFormModal(null); });
      return;
    }

    const cls = state.activeClassInfo;
    const linkedCount = state.roster.filter(function (s) { return Boolean(s.linkedEmail); }).length;
    const roleShortLabel = {
      SUPER_ADMIN: 'Toàn quyền Super Admin',
      HOMEROOM_TEACHER: 'Chủ nhiệm (Quản lý sĩ số)',
      SUBJECT_TEACHER: 'Bộ môn (' + (state.selectedSubject || 'Chấm điểm') + ')',
      STUDENT: 'Học sinh (Chỉ xem)'
    }[state.role] || 'Thành viên';

    const adminActionsHtml = state.role === 'SUPER_ADMIN'
      ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
           <button id="vtCrBtnEditClass" class="vt-cr-btn vt-cr-btn-sm vt-cr-btn-glass-dark" type="button">✎ Sửa lớp</button>
           <button id="vtCrBtnDeleteClass" class="vt-cr-btn vt-cr-btn-sm vt-cr-btn-danger" type="button">🗑 Xóa lớp</button>
         </div>`
      : '';

    let tabsHtml = '';
    if (state.role === 'STUDENT') {
      tabsHtml = `
        <button class="vt-cr-tab ${state.activeTab === 'roster' ? 'active' : ''}" data-crtab="roster" type="button">👥 Thành viên cùng lớp (${state.roster.length})</button>
        <button class="vt-cr-tab ${state.activeTab === 'mygrades' ? 'active' : ''}" data-crtab="mygrades" type="button">📊 Bảng điểm Cá nhân</button>
      `;
    } else if (state.role === 'SUBJECT_TEACHER') {
      tabsHtml = `
        <button class="vt-cr-tab ${state.activeTab === 'roster' ? 'active' : ''}" data-crtab="roster" type="button">👥 Danh sách Thành viên (${state.roster.length})</button>
        <button class="vt-cr-tab ${state.activeTab === 'gradebook' ? 'active' : ''}" data-crtab="gradebook" type="button">📊 Sổ điểm Bộ môn (${esc(state.selectedSubject)})</button>
      `;
    } else if (state.role === 'HOMEROOM_TEACHER') {
      tabsHtml = `
        <button class="vt-cr-tab ${state.activeTab === 'roster' ? 'active' : ''}" data-crtab="roster" type="button">👥 Thành viên Lớp (${state.roster.length})</button>
        <button class="vt-cr-tab ${state.activeTab === 'summary' ? 'active' : ''}" data-crtab="summary" type="button">🏆 Tổng hợp Toàn lớp</button>
        <button class="vt-cr-tab ${state.activeTab === 'tracking_view' ? 'active' : ''}" data-crtab="tracking_view" type="button">📋 Theo dõi Lớp</button>
      `;
    } else {
      tabsHtml = `
        <button class="vt-cr-tab ${state.activeTab === 'roster' ? 'active' : ''}" data-crtab="roster" type="button">👥 Thành viên Lớp (${state.roster.length})</button>
        <button class="vt-cr-tab ${state.activeTab === 'gradebook' ? 'active' : ''}" data-crtab="gradebook" type="button">📊 Sổ điểm Kép</button>
        <button class="vt-cr-tab ${state.activeTab === 'summary' ? 'active' : ''}" data-crtab="summary" type="button">🏆 Tổng hợp Toàn lớp</button>
      `;
    }

    let bodyHtml = '';
    if (state.activeTab === 'roster') bodyHtml = renderRosterTabHtml();
    else if (state.activeTab === 'gradebook' || state.activeTab === 'tracking_view') bodyHtml = renderDualGradebookTabHtml();
    else if (state.activeTab === 'summary') bodyHtml = renderSummaryMatrixHtml();
    else if (state.activeTab === 'mygrades') bodyHtml = renderStudentPersonalGradesHtml();

    let diagBannerHtml = '';
    if (state.backendWarning) {
      diagBannerHtml = `
        <div class="vt-diag-card">
          <div style="font-size:12.8px;line-height:1.55;">
            <b>✨ Thông báo cập nhật:</b> ${escapeHtml(state.backendWarning)}
          </div>
          <button id="vtCrBtnRetryBanner" class="vt-cr-btn vt-cr-btn-sm" type="button">↻ Thử kết nối lại</button>
        </div>`;
    }

    let adminKpiHtml = '';
    if (state.role === 'SUPER_ADMIN' && state.bootstrap && state.bootstrap.systemStats) {
      const st = state.bootstrap.systemStats;
      const linkPct = st.totalActiveStudents > 0 ? Math.round((st.linkedStudentsCount / st.totalActiveStudents) * 100) : 0;
      const logCount = Array.isArray(state.bootstrap.recentAuditLogs) ? state.bootstrap.recentAuditLogs.length : 0;
      adminKpiHtml = `
        <section class="vt-sys-kpi-grid" aria-label="Thống kê tổng quan toàn hệ thống">
          <div class="vt-sys-kpi-card">
            <span class="vt-sys-kpi-label">✦ Tổng số Khối / Lớp</span>
            <span class="vt-sys-kpi-val">${escapeHtml(st.totalClasses)}</span>
            <span class="vt-sys-kpi-sub">${Object.keys(state.bootstrap.gradeBlocks || {}).length} khối • ${escapeHtml(st.totalTeachers)} giáo viên</span>
          </div>
          <div class="vt-sys-kpi-card">
            <span class="vt-sys-kpi-label">👥 Tổng Học sinh</span>
            <span class="vt-sys-kpi-val">${escapeHtml(st.totalActiveStudents)}</span>
            <span class="vt-sys-kpi-sub">${escapeHtml(st.pendingUsersCount)} hồ sơ đang chờ duyệt</span>
          </div>
          <div class="vt-sys-kpi-card">
            <span class="vt-sys-kpi-label">🔗 Tỷ lệ Liên kết Gmail</span>
            <span class="vt-sys-kpi-val" style="color:var(--cr-emerald);">${linkPct}%</span>
            <span class="vt-sys-kpi-sub">${escapeHtml(st.linkedStudentsCount)} / ${escapeHtml(st.totalActiveStudents)} học sinh</span>
          </div>
          <div class="vt-sys-kpi-card clickable" id="vtCrOpenAuditCard" role="button" tabindex="0" title="Xem 30 nhật ký hoạt động gần nhất">
            <span class="vt-sys-kpi-label">📋 Nhật ký Hoạt động</span>
            <span class="vt-sys-kpi-val" style="color:var(--cr-cobalt);">${logCount}</span>
            <span class="vt-sys-kpi-sub">Xem lịch sử hoạt động →</span>
          </div>
        </section>`;
    }

    main.innerHTML = `
      ${diagBannerHtml}
      ${adminKpiHtml}
      <!-- Cosmic Class Command Banner (22px Concentric Squircle) -->
      <section class="vt-cr-banner">
        <svg class="vt-cr-banner-svg" viewBox="0 0 280 200" fill="none" aria-hidden="true">
          <ellipse cx="205" cy="86" rx="122" ry="48" transform="rotate(-18 205 86)" stroke="rgba(251, 191, 36, 0.38)" stroke-width="1.2"/>
          <ellipse cx="205" cy="86" rx="84" ry="34" transform="rotate(22 205 86)" stroke="rgba(56, 189, 248, 0.30)" stroke-width="1" stroke-dasharray="4 6"/>
          <circle cx="205" cy="86" r="4" fill="#FBBF24"/>
          <circle cx="118" cy="48" r="2" fill="#38BDF8"/>
          <circle cx="256" cy="54" r="1.8" fill="#FDE68A"/>
          <circle cx="164" cy="144" r="1.6" fill="#A5B4FC"/>
        </svg>
        <div class="vt-cr-banner-top">
          <div>
            <div class="vt-cr-banner-eyebrow">✦ ${esc(cls.gradeBlock || 'CHƯA PHÂN KHỐI')} • NĂM HỌC ${esc(cls.schoolYear || '2026-2027')}</div>
            <h1 class="vt-cr-banner-title">Lớp ${esc(cls.className)}</h1>
            <div class="vt-cr-banner-gvcn">
              <span>★</span>
              <span>GVCN: ${esc(cls.homeroomTeacherEmail || 'Chưa phân công')}</span>
            </div>
          </div>
          ${adminActionsHtml}
        </div>
        <div class="vt-cr-banner-kpis">
          <div class="vt-cr-banner-kpi"><span>Sĩ số hiện tại</span><b>${state.roster.length} học sinh</b></div>
          <div class="vt-cr-banner-kpi"><span>Đã liên kết Gmail</span><b style="color:#34D399;">${state.role === 'STUDENT' ? 'Bảo mật' : (linkedCount + ' / ' + state.roster.length + ' HS')}</b></div>
          <div class="vt-cr-banner-kpi"><span>Quyền hạn của bạn</span><b style="font-family:var(--cr-sans);font-size:13.5px;color:#FDE68A;">${esc(roleShortLabel)}</b></div>
        </div>
      </section>

      <!-- Workspace Card with iOS Segmented Control -->
      <section class="vt-cr-card">
        <div class="vt-cr-tabs" role="tablist">${tabsHtml}</div>
        <div id="vtCrTabContent">${bodyHtml}</div>
      </section>
    `;

    wireMainDynamicEvents(cls);
  }

  /* ---------- TAB: ROSTER (SOFT LIQUID GLASS ROWS + INITIALS AVATAR) ---------- */

  function renderRosterTabHtml() {
    const q = state.searchQuery.trim().toLowerCase();
    const linkFilter = state.linkFilter || 'all';
    const filtered = state.roster.filter(function (st) {
      if (linkFilter === 'linked' && !st.linkedEmail) return false;
      if (linkFilter === 'unlinked' && st.linkedEmail) return false;
      if (!q) return true;
      return (
        String(st.fullName || '').toLowerCase().indexOf(q) !== -1 ||
        String(st.studentId || '').toLowerCase().indexOf(q) !== -1 ||
        String(st.linkedEmail || '').toLowerCase().indexOf(q) !== -1
      );
    });

    const isStudent = state.role === 'STUDENT';
    const isReadOnlyTeacher = state.role === 'SUBJECT_TEACHER' && !state.canEditRoster;

    const topNotice = isReadOnlyTeacher
      ? `<div class="vt-cr-readonly-bar">🔒 Chỉ xem danh sách</div>`
      : '';

    const canLogBeh = !isStudent && (state.role === 'SUPER_ADMIN' || state.effectivePermissions.logAttendanceAndBehavior !== false);
    const editButtonsHtml = `<div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${canLogBeh ? '<button id="vtCrBtnAttendanceToday" class="vt-cr-btn vt-cr-btn-emerald" type="button">✓ Điểm danh cả lớp hôm nay</button>' : ''}
      ${state.canEditRoster ? '<button id="vtCrBtnAddStudent" class="vt-cr-btn vt-cr-btn-primary vt-cr-btn-shimmer" type="button">+ Thêm học sinh</button>' : ''}
      ${state.canEditRoster ? '<button id="vtCrBtnBulkImport" class="vt-cr-btn" type="button">📋 Nhập nhanh</button>' : ''}
      ${state.canEditRoster ? '<button id="vtCrBtnExportCsv" class="vt-cr-btn" type="button">⬇ Xuất CSV</button>' : ''}
    </div>`;

    let theadCols = `<th>STT</th><th>Mã HS</th><th>Họ và tên</th>`;
    if (!isStudent) theadCols += `<th>Cảnh báo</th><th>ĐTB / Xu hướng</th><th>Rèn luyện &amp; Chuyên cần</th><th>Gmail</th>`;
    else theadCols += `<th>Giới tính</th>`;
    theadCols += `<th style="text-align:right;">Thao tác</th>`;

    let tbodyRows = '';
    if (!filtered.length) {
      const colSpan = isStudent ? 4 : (state.canEditRoster ? 7 : 6);
      tbodyRows = `<tr><td colspan="${colSpan}" style="text-align:center;padding:30px;color:var(--cr-soft);">
        ${q ? 'Không tìm thấy học sinh phù hợp với từ khóa.' : 'Lớp chưa có học sinh nào.'}
      </td></tr>`;
    } else {
      filtered.forEach(function (st, idx) {
        const gmailCell = st.linkedEmail
          ? `<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;">
               <span class="vt-cr-badge linked"><span class="vt-live-dot"></span>Đã liên kết</span>
               <span class="vt-cr-mono" style="font-size:11px;color:var(--cr-soft);">${esc(st.linkedEmail)}</span>
             </div>`
          : `<span class="vt-cr-badge unlinked">◌ Chưa liên kết Gmail</span>`;

        const canTransfer = (state.role === 'SUPER_ADMIN' || state.role === 'HOMEROOM_TEACHER') && state.canEditRoster;
        const pts = Number(st.behaviorPoints) || 0;
        const att = st.attendanceStats || { present: 0, late: 0, absentExcused: 0, absentUnexcused: 0 };
        const avgStr = (st.latestAvg !== null && st.latestAvg !== undefined) ? Number(st.latestAvg).toFixed(1) : '—';
        const isSelfStu = isStudent && st.linkedEmail && getSessionContext() && st.linkedEmail === getSessionContext().email;

        const actionCell = `<td style="text-align:right;white-space:nowrap;">
          ${canLogBeh ? '<button type="button" class="vt-cr-btn vt-cr-btn-sm" data-quick-beh="' + escapeAttr(st.studentId) + '" title="Ghi nhận điểm rèn luyện nhanh">⚡ Điểm nhanh</button> ' : ''}
          ${(!isStudent || isSelfStu) ? '<button type="button" class="vt-cr-btn vt-cr-btn-sm vt-cr-btn-primary" data-open-360="' + escapeAttr(st.studentId) + '">📊 Hồ sơ 360°</button> ' : ''}
          ${canTransfer ? '<button type="button" class="vt-cr-btn vt-cr-btn-sm" data-transfer-stu="' + escapeAttr(st.studentId) + '">⇄ Chuyển lớp</button> ' : ''}
          ${state.canEditRoster ? '<button type="button" class="vt-cr-btn vt-cr-btn-sm" data-edit-stu="' + escapeAttr(st.studentId) + '">✎ Sửa</button> ' : ''}
          ${state.canEditRoster ? '<button type="button" class="vt-cr-btn vt-cr-btn-sm vt-cr-btn-danger" data-del-stu="' + escapeAttr(st.studentId) + '">✕ Xóa</button>' : ''}
        </td>`;

        tbodyRows += `
          <tr class="vt-roster-row">
            <td class="vt-cr-mono" style="color:var(--cr-soft);">${idx + 1}</td>
            <td><span class="vt-cr-id-pill">◉ ${escapeHtml(st.studentId)}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="vt-cr-avatar ${genderAvatarClass(st.gender)}">${escapeHtml(getInitials(st.fullName))}</span>
                <div>
                  <div style="font-weight:700;white-space:nowrap;">${escapeHtml(st.fullName)}</div>
                  ${!isStudent ? '<div style="font-size:11px;color:var(--cr-soft);">' + formatDobVn(st.dob) + ' • ' + escapeHtml(st.gender || '—') + '</div>' : ''}
                </div>
              </div>
            </td>
            ${!isStudent ? '<td>' + renderWarningLampHtml(st.warningLevel, st.warningReasons) + '</td>' : ''}
            ${!isStudent ? '<td><span class="vt-cr-mono" style="font-weight:700;">' + avgStr + '</span> ' + renderTrendDeltaHtml(st.trendDelta) + '</td>' : ''}
            ${!isStudent ? '<td><span class="vt-seewo-pill ' + (pts < 0 ? 'neg' : '') + '">' + (pts >= 0 ? '+' + pts : pts) + '★</span> <span style="font-size:11px;color:var(--cr-soft);margin-left:4px;">Muộn:' + att.late + ' KP:' + att.absentUnexcused + '</span></td>' : ''}
            ${!isStudent ? '<td>' + gmailCell + '</td>' : '<td>' + escapeHtml(st.gender || '—') + '</td>'}
            ${actionCell}
          </tr>`;
      });
    }

    return `
      ${topNotice}
      <div class="vt-cr-toolbar">
        <div style="display:flex;gap:8px;flex:1;min-width:220px;flex-wrap:wrap;">
          <input id="vtCrSearchInput" class="vt-cr-search" type="text" value="${escapeAttr(state.searchQuery)}" placeholder="🔍 Tìm theo họ tên hoặc mã học sinh...">
          ${!isStudent ? `
          <select id="vtCrLinkFilter" class="vt-cr-filter-select" aria-label="Lọc theo trạng thái liên kết Gmail">
            <option value="all" ${linkFilter === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
            <option value="linked" ${linkFilter === 'linked' ? 'selected' : ''}>● Đã liên kết Gmail</option>
            <option value="unlinked" ${linkFilter === 'unlinked' ? 'selected' : ''}>◌ Chưa liên kết Gmail</option>
          </select>` : ''}
        </div>
        ${editButtonsHtml}
      </div>
      <div class="vt-cr-table-wrap">
        <table class="vt-cr-table vt-mobile-cards"><thead><tr>${theadCols}</tr></thead><tbody>${tbodyRows}</tbody></table>
      </div>
    `;
  }

  /* ---------- TAB: DUAL GRADEBOOK (STANDARD 1-2-3 + DYNAMIC TRACKING) ---------- */

  function getAvailableSubjectsForPicker() {
    const set = {};
    if (state.selectedSubject) set[state.selectedSubject] = true;
    if (state.summaryMatrix && Array.isArray(state.summaryMatrix.subjects)) {
      state.summaryMatrix.subjects.forEach(function (s) { set[s] = true; });
    }
    if (state.bootstrap && Array.isArray(state.bootstrap.teachingAssignments)) {
      state.bootstrap.teachingAssignments.forEach(function (t) {
        if (t.classId === state.selectedClassId && t.subject) set[t.subject] = true;
      });
    }
    ['Toán học', 'Vật lý', 'Hóa học', 'Ngữ văn', 'Tiếng Anh', 'Tin học'].forEach(function (s) { set[s] = true; });
    return Object.keys(set);
  }

  function renderDualGradebookTabHtml() {
    if (state.loadingGrades) {
      return `<div class="vt-cr-skeleton" style="height:36px;"></div><div class="vt-cr-skeleton" style="height:28px;"></div>`;
    }

    const canPickSubject = state.role === 'SUPER_ADMIN' || state.role === 'HOMEROOM_TEACHER';
    const subjectsList = getAvailableSubjectsForPicker();

    const subjectPickerHtml = canPickSubject
      ? `<select id="vtGbSubjectSelect" class="vt-cr-select" title="Chọn môn học">
           ${subjectsList.map(function (s) { return `<option value="${esc(s)}" ${s === state.selectedSubject ? 'selected' : ''}>Môn: ${esc(s)}</option>`; }).join('')}
         </select>`
      : `<span class="vt-cr-badge subject">Môn: ${esc(state.selectedSubject)}</span>`;

    const readonlyNotice = !state.gradeCanEdit
      ? `<div class="vt-cr-readonly-bar">👁 Chế độ chỉ xem sổ điểm môn <b>${esc(state.selectedSubject)}</b> (Chỉ Giáo viên bộ môn được phân công hoặc Super Admin mới có quyền nhập điểm).</div>`
      : '';

    const activeSub = state.gradeSubTab;
    const stdDirtyCount = Object.keys(state.standardDirty).length;
    const trkDirtyCount = Object.keys(state.trackingDirty).length;

    const topSwitchBar = `
      <div class="vt-cr-toolbar" style="margin-bottom:12px;">
        <div class="vt-cr-subtabs" role="tablist">
          <button type="button" class="vt-cr-subtab ${activeSub === 'standard' ? 'active' : ''}" data-gbsub="standard">A. Bảng điểm Phổ thông (Hệ số 1–2–3)</button>
          <button type="button" class="vt-cr-subtab ${activeSub === 'tracking' ? 'active' : ''}" data-gbsub="tracking">B. Bảng điểm Theo dõi Quá trình (${state.trackingColumns.length} cột)</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${subjectPickerHtml}
          <select id="vtGbSemesterSelect" class="vt-cr-select" title="Chọn học kỳ">
            <option value="HK1" ${state.selectedSemester === 'HK1' ? 'selected' : ''}>Học kỳ 1</option>
            <option value="HK2" ${state.selectedSemester === 'HK2' ? 'selected' : ''}>Học kỳ 2</option>
          </select>
        </div>
      </div>
      ${readonlyNotice}
    `;

    return activeSub === 'standard'
      ? topSwitchBar + renderStandardGradeGridHtml(stdDirtyCount)
      : topSwitchBar + renderTrackingGradeGridHtml(trkDirtyCount);
  }

  function renderStandardGradeGridHtml(dirtyCount) {
    const disabledAttr = state.gradeCanEdit ? '' : 'disabled';
    const saveBar = `
      <div class="vt-cr-toolbar">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--cr-soft);">Phím tắt: <b>Enter / ↓</b> xuống dòng cùng cột, <b>Tab</b> sang cột kế tiếp.</span>
          <span id="vtStdDirtyBadge" class="vt-cr-badge dirty" style="${dirtyCount > 0 ? '' : 'display:none;'}">Có ${dirtyCount} thay đổi chưa lưu</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${state.gradeCanEdit ? `<button id="vtBtnSaveStandard" class="vt-cr-btn vt-cr-btn-primary" type="button" ${dirtyCount === 0 ? 'disabled' : ''}>💾 Lưu Bảng điểm Phổ thông</button>` : ''}
          <button id="vtBtnExportStdCsv" class="vt-cr-btn" type="button">⬇ Xuất Excel / CSV</button>
        </div>
      </div>
    `;

    if (!state.roster.length) {
      return saveBar + `<div style="padding:26px;text-align:center;color:var(--cr-soft);border:1px dashed var(--cr-border-strong);border-radius:var(--vt-r-card);">Lớp chưa có học sinh nào để nhập điểm.</div>`;
    }

    const fields = ['tx1', 'tx2', 'tx3', 'midterm', 'final'];
    let body = '';
    state.roster.forEach(function (st, rIdx) {
      const row = state.standardRows[st.studentId] || { tx1: '', tx2: '', tx3: '', midterm: '', final: '' };
      const avg = computeStandardAverage(row);
      let inputsHtml = '';
      fields.forEach(function (fld, cIdx) {
        const val = row[fld] === '' || row[fld] == null ? '' : row[fld];
        const isDirty = Boolean(state.standardDirty[st.studentId + ':' + fld]);
        inputsHtml += `
          <td>
            <input type="text" inputmode="decimal"
              class="vt-score-input ${isDirty ? 'is-dirty' : ''}"
              data-std-sid="${esc(st.studentId)}" data-std-field="${fld}"
              data-row-idx="${rIdx}" data-col-idx="${cIdx}"
              value="${esc(val)}" placeholder="—" ${disabledAttr}>
          </td>`;
      });
      body += `
        <tr>
          <td class="vt-cr-mono" style="color:var(--cr-soft);">${rIdx + 1}</td>
          <td class="vt-col-id"><span class="vt-cr-id-pill">◉ ${escapeHtml(st.studentId)}</span></td>
          <td class="vt-col-name" style="font-weight:700;white-space:nowrap;">${escapeHtml(st.fullName)}</td>
          ${inputsHtml}
          <td class="vt-avg-cell ${avgColorClass(avg)}" id="vtStdAvg_${esc(st.studentId)}">${avg !== '' ? Number(avg).toFixed(1) : '—'}</td>
        </tr>`;
    });

    return `
      ${saveBar}
      <div class="vt-cr-table-wrap">
        <table class="vt-cr-table vt-grade-table">
          <thead>
            <tr>
              <th>STT</th><th class="vt-col-id">Mã HS</th><th class="vt-col-name">Họ và tên</th>
              <th>ĐGTX 1 (HS1)</th><th>ĐGTX 2 (HS1)</th><th>ĐGTX 3 (HS1)</th>
              <th>Giữa kỳ (HS2)</th><th>Cuối kỳ (HS3)</th>
              <th style="text-align:center;">ĐTB Môn</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function renderTrackingGradeGridHtml(dirtyCount) {
    const disabledAttr = state.gradeCanEdit ? '' : 'disabled';
    const toolbar = `
      <div class="vt-cr-toolbar">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${state.gradeCanEdit ? `<button id="vtBtnAddTrackCol" class="vt-cr-btn vt-cr-btn-emerald" type="button">+ Thêm cột theo dõi</button>` : ''}
          <span id="vtTrkDirtyBadge" class="vt-cr-badge dirty" style="${dirtyCount > 0 ? '' : 'display:none;'}">Có ${dirtyCount} thay đổi chưa lưu</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${state.gradeCanEdit ? `<button id="vtBtnSaveTracking" class="vt-cr-btn vt-cr-btn-primary" type="button" ${dirtyCount === 0 ? 'disabled' : ''}>💾 Lưu Bảng điểm Theo dõi</button>` : ''}
          <button id="vtBtnExportTrkCsv" class="vt-cr-btn" type="button">⬇ Xuất Excel / CSV</button>
        </div>
      </div>
    `;

    if (!state.trackingColumns.length) {
      return toolbar + `
        <div style="padding:30px;text-align:center;color:var(--cr-soft);border:1px dashed var(--cr-border-strong);border-radius:var(--vt-r-card);">
          <div style="font-size:26px;margin-bottom:6px;">📋</div>
          Chưa có cột theo dõi quá trình nào cho môn <b>${esc(state.selectedSubject)}</b>.
          ${state.gradeCanEdit ? '<br>Hãy bấm <b>"+ Thêm cột theo dõi"</b> để tạo cột kiểm tra 15p, bài tập hoặc thực hành.' : ''}
        </div>`;
    }

    // DingTalk Check-in Progress Bar for latest tracking column
    const latestCol = state.trackingColumns[state.trackingColumns.length - 1];
    let doneCount = 0;
    state.roster.forEach(function (st) {
      const sObj = state.trackingRows[st.studentId] || {};
      if (latestCol && sObj[latestCol.id] !== undefined && String(sObj[latestCol.id]).trim() !== '') doneCount++;
    });
    const totalStu = state.roster.length;
    const donePct = totalStu > 0 ? Math.round((doneCount / totalStu) * 100) : 0;
    const dingtalkBar = `
      <div class="vt-dingtalk-bar">
        <div style="font-size:12.5px;font-weight:700;">
          📋 Tiến độ hoàn thành <b>${escapeHtml(latestCol.name)}</b>: <span class="vt-cr-mono" style="color:var(--cr-cobalt);">${doneCount}/${totalStu} HS (${donePct}%)</span>
        </div>
        <div class="vt-progress-track"><div class="vt-progress-fill" style="width:${donePct}%;"></div></div>
        <button id="vtBtnTrkIncomplete" class="vt-cr-btn vt-cr-btn-sm ${state.trackingIncompleteOnly ? 'vt-cr-btn-primary' : ''}" type="button">
          ${state.trackingIncompleteOnly ? '✓ Đang lọc: Chưa hoàn thành' : '🔍 Chỉ hiện HS chưa có điểm'}
        </button>
      </div>`;

    let dynHeaders = '';
    state.trackingColumns.forEach(function (col) {
      const subLbl = (col.type === 'score10' ? 'Thang 10' : 'Đạt/NX') + (col.date ? ' • ' + formatDobVn(col.date) : '');
      dynHeaders += `
        <th class="${state.gradeCanEdit ? 'vt-th-editable' : ''}" data-edit-trackcol="${esc(col.id)}" title="${state.gradeCanEdit ? 'Bấm để đổi tên hoặc xóa cột này' : ''}">
          ${esc(col.name)} ${state.gradeCanEdit ? '✎' : ''}
          <span class="vt-th-sub">${esc(subLbl)}</span>
        </th>`;
    });

    const displayRoster = state.trackingIncompleteOnly
      ? state.roster.filter(function (st) {
          const sObj = state.trackingRows[st.studentId] || {};
          return !latestCol || sObj[latestCol.id] === undefined || String(sObj[latestCol.id]).trim() === '';
        })
      : state.roster;

    let body = '';
    displayRoster.forEach(function (st, rIdx) {
      const sc = state.trackingRows[st.studentId] || {};
      const avg = computeTrackingAverage(state.trackingColumns, sc);
      let cells = '';
      state.trackingColumns.forEach(function (col, cIdx) {
        const val = sc[col.id] === undefined || sc[col.id] === null ? '' : sc[col.id];
        const isDirty = Boolean(state.trackingDirty[st.studentId + ':' + col.id]);
        const isScore = col.type === 'score10';
        cells += `
          <td>
            <input type="text" ${isScore ? 'inputmode="decimal"' : ''}
              class="vt-score-input ${isScore ? '' : 'wide-txt'} ${isDirty ? 'is-dirty' : ''}"
              data-trk-sid="${esc(st.studentId)}" data-trk-col="${esc(col.id)}" data-trk-type="${esc(col.type)}"
              data-row-idx="${rIdx}" data-col-idx="${cIdx}"
              value="${esc(val)}" placeholder="${isScore ? '0–10' : 'Đạt / NX'}" ${disabledAttr}>
          </td>`;
      });
      body += `
        <tr>
          <td class="vt-cr-mono" style="color:var(--cr-soft);">${rIdx + 1}</td>
          <td class="vt-col-id"><span class="vt-cr-id-pill">◉ ${escapeHtml(st.studentId)}</span></td>
          <td class="vt-col-name" style="font-weight:700;white-space:nowrap;">${escapeHtml(st.fullName)} ${st.warningLevel && st.warningLevel !== 'GREEN' ? renderWarningLampHtml(st.warningLevel, st.warningReasons) : ''}</td>
          ${cells}
          <td class="vt-avg-cell ${avgColorClass(avg)}" id="vtTrkAvg_${esc(st.studentId)}">${avg !== '' ? Number(avg).toFixed(1) : '—'}</td>
        </tr>`;
    });

    return `
      ${toolbar}
      ${dingtalkBar}
      <div class="vt-cr-table-wrap">
        <table class="vt-cr-table vt-grade-table">
          <thead><tr><th>STT</th><th class="vt-col-id">Mã HS</th><th class="vt-col-name">Họ và tên</th>${dynHeaders}<th style="text-align:center;">TB Theo dõi</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  /* ---------- TAB: HOMEROOM SUMMARY MATRIX ---------- */

  function renderSummaryMatrixHtml() {
    if (state.loadingMatrix) {
      return `<div class="vt-cr-skeleton" style="height:32px;"></div><div class="vt-cr-skeleton" style="height:26px;"></div>`;
    }
    const m = state.summaryMatrix;
    const subjects = (m && m.subjects) || [];
    const rows = (m && m.matrix) || [];

    const semBar = `
      <div class="vt-cr-toolbar">
        <div style="font-weight:700;color:var(--cr-ink);">Ma trận Điểm Trung bình Tổng hợp Toàn lớp</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="vtCrMatrixSemester" class="vt-cr-select">
            <option value="HK1" ${state.selectedSemester === 'HK1' ? 'selected' : ''}>Học kỳ 1 (HK1)</option>
            <option value="HK2" ${state.selectedSemester === 'HK2' ? 'selected' : ''}>Học kỳ 2 (HK2)</option>
          </select>
          ${subjects.length ? '<button id="vtBtnExportMatrixCsv" class="vt-cr-btn" type="button">⬇ Xuất CSV Tổng hợp</button>' : ''}
        </div>
      </div>
    `;

    if (!subjects.length || !rows.length) {
      return semBar + `<div style="padding:28px;text-align:center;color:var(--cr-soft);border:1px dashed var(--cr-border-strong);border-radius:var(--vt-r-card);">Chưa có dữ liệu điểm tổng kết môn nào cho ${esc(state.selectedSemester)}.</div>`;
    }

    let head = `<th>STT</th><th>Mã HS</th><th>Họ và tên</th>`;
    subjects.forEach(function (s) { head += `<th style="text-align:center;">${esc(s)}</th>`; });
    head += `<th style="text-align:center;">ĐTB Chung Các Môn</th>`;

    let body = '';
    rows.forEach(function (r, idx) {
      body += `<tr><td class="vt-cr-mono" style="color:var(--cr-soft);">${idx + 1}</td><td><span class="vt-cr-id-pill">◉ ${esc(r.studentId)}</span></td><td style="font-weight:700;white-space:nowrap;">${esc(r.fullName)}</td>`;
      subjects.forEach(function (s) {
        const val = r.subjectAverages && r.subjectAverages[s] !== '' ? r.subjectAverages[s] : '';
        body += `<td class="vt-avg-cell ${avgColorClass(val)}" style="font-weight:600;">${val !== '' ? Number(val).toFixed(1) : '—'}</td>`;
      });
      body += `<td class="vt-avg-cell ${avgColorClass(r.overallAverage)}">${r.overallAverage !== '' ? Number(r.overallAverage).toFixed(1) : '—'}</td></tr>`;
    });

    return `${semBar}<div class="vt-cr-table-wrap"><table class="vt-cr-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  /* ---------- TAB: STUDENT PERSONAL GRADEBOOK ---------- */

  function renderStudentPersonalGradesHtml() {
    const semBar = `
      <div class="vt-cr-toolbar">
        <div style="font-weight:700;font-family:var(--cr-serif);font-size:19px;">Hồ sơ Kết quả Học tập Cá nhân</div>
        <select id="vtStuPortalSemester" class="vt-cr-select">
          <option value="HK1" ${state.selectedSemester === 'HK1' ? 'selected' : ''}>Học kỳ 1 (HK1)</option>
          <option value="HK2" ${state.selectedSemester === 'HK2' ? 'selected' : ''}>Học kỳ 2 (HK2)</option>
        </select>
      </div>
    `;

    if (state.loadingStudentPortal) {
      return semBar + `<div class="vt-cr-skeleton" style="height:64px;"></div><div class="vt-cr-skeleton" style="height:36px;"></div>`;
    }

    const myRow = (state.summaryMatrix && state.summaryMatrix.matrix && state.summaryMatrix.matrix[0]) || null;
    const bundles = state.studentSubjectBundles || [];
    const overallAvg = myRow && myRow.overallAverage !== '' ? Number(myRow.overallAverage) : null;
    let rankLabel = 'Chưa xếp loại';
    if (overallAvg !== null) {
      if (overallAvg >= 8.0) rankLabel = 'Tốt / Giỏi';
      else if (overallAvg >= 6.5) rankLabel = 'Khá';
      else if (overallAvg >= 5.0) rankLabel = 'Đạt';
      else rankLabel = 'Cần cố gắng';
    }

    const kpiHtml = `
      <div class="vt-stu-kpi-grid">
        <div class="vt-stu-kpi"><span>Điểm Trung bình Chung (${esc(state.selectedSemester)})</span><b class="${avgColorClass(overallAvg)}">${overallAvg !== null ? overallAvg.toFixed(1) : '—'}</b></div>
        <div class="vt-stu-kpi"><span>Số môn đã cập nhật điểm</span><b style="color:var(--cr-cobalt);">${bundles.length} môn</b></div>
        <div class="vt-stu-kpi"><span>Đánh giá tham khảo</span><b style="font-size:17px;color:var(--cr-amber);">${esc(rankLabel)}</b></div>
      </div>
    `;

    let stdBody = '';
    if (!bundles.length) {
      stdBody = `<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--cr-soft);">Chưa có bảng điểm môn nào cho ${esc(state.selectedSemester)}.</td></tr>`;
    } else {
      bundles.forEach(function (b) {
        const g = b.stdRow || {};
        const avg = g.average !== undefined && g.average !== '' ? Number(g.average) : computeStandardAverage(g);
        stdBody += `
          <tr>
            <td style="font-weight:700;">${esc(b.subject)}</td>
            <td class="vt-cr-mono">${g.tx1 !== '' && g.tx1 != null ? esc(g.tx1) : '—'}</td>
            <td class="vt-cr-mono">${g.tx2 !== '' && g.tx2 != null ? esc(g.tx2) : '—'}</td>
            <td class="vt-cr-mono">${g.tx3 !== '' && g.tx3 != null ? esc(g.tx3) : '—'}</td>
            <td class="vt-cr-mono">${g.midterm !== '' && g.midterm != null ? esc(g.midterm) : '—'}</td>
            <td class="vt-cr-mono">${g.final !== '' && g.final != null ? esc(g.final) : '—'}</td>
            <td class="vt-avg-cell ${avgColorClass(avg)}">${avg !== '' ? Number(avg).toFixed(1) : '—'}</td>
          </tr>`;
      });
    }

    const block1 = `
      <div style="font-weight:700;font-size:13.5px;margin-bottom:8px;color:var(--cr-ink);">1. Bảng điểm Phổ thông các môn</div>
      <div class="vt-cr-table-wrap" style="margin-bottom:18px;">
        <table class="vt-cr-table">
          <thead><tr><th>Môn học</th><th>ĐGTX 1</th><th>ĐGTX 2</th><th>ĐGTX 3</th><th>Giữa kỳ</th><th>Cuối kỳ</th><th style="text-align:center;">ĐTB Môn</th></tr></thead>
          <tbody>${stdBody}</tbody>
        </table>
      </div>
    `;

    let trackCards = '';
    const withTracking = bundles.filter(function (b) { return b.trackingCols && b.trackingCols.length; });
    if (!withTracking.length) {
      trackCards = `<div style="padding:18px;text-align:center;color:var(--cr-soft);border:1px dashed var(--cr-border-strong);border-radius:var(--vt-r-card);">Chưa có cột điểm theo dõi quá trình nào được giáo viên công bố.</div>`;
    } else {
      withTracking.forEach(function (b) {
        const avgTrk = computeTrackingAverage(b.trackingCols, b.trackingScores);
        const pills = b.trackingCols.map(function (c) {
          const v = b.trackingScores && b.trackingScores[c.id] !== undefined && b.trackingScores[c.id] !== '' ? b.trackingScores[c.id] : '—';
          return `<div class="vt-stu-track-pill"><div style="font-size:11px;color:var(--cr-soft);">${esc(c.name)}${c.date ? ' • ' + formatDobVn(c.date) : ''}</div><div class="vt-cr-mono" style="font-weight:700;color:var(--cr-ink);margin-top:2px;">${esc(v)}</div></div>`;
        }).join('');
        trackCards += `
          <div class="vt-stu-track-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <b style="font-size:13.5px;color:var(--cr-cobalt);">${esc(b.subject)}</b>
              ${avgTrk !== '' ? `<span class="vt-cr-badge homeroom">TB Theo dõi: ${Number(avgTrk).toFixed(1)}</span>` : ''}
            </div>
            <div class="vt-stu-track-pills">${pills}</div>
          </div>`;
      });
    }

    return semBar + kpiHtml + block1 + `<div style="font-weight:700;font-size:13.5px;margin-bottom:8px;color:var(--cr-ink);">2. Bảng điểm Theo dõi Quá trình theo môn</div>` + trackCards;
  }

  /* ==========================================================================
   * 7. SUB-MODAL CONTROLLERS & KEYBOARD / DIRTY-TRACKING EVENTS
   * ========================================================================== */

  function openClassFormModal(existingClass) {
    state.editingClass = existingClass || null;
    document.getElementById('vtCrClassModalTitle').textContent = existingClass ? ('Chỉnh sửa Lớp ' + existingClass.className) : 'Tạo Khối / Lớp mới';
    const dl = document.getElementById('vtCrTeacherDatalist');
    const teachers = (state.bootstrap && state.bootstrap.approvedTeachers) || [];
    dl.innerHTML = teachers.map(function (t) { return `<option value="${esc(t.email)}">${esc(t.fullName)} (${esc(t.assignedRole)})</option>`; }).join('');

    const sel = document.getElementById('vtClsGradeSelect');
    const customWrap = document.getElementById('vtClsGradeCustomWrap');
    const customInput = document.getElementById('vtClsGradeCustom');
    const gb = existingClass ? existingClass.gradeBlock : 'Khối 10';
    if (['Khối 10', 'Khối 11', 'Khối 12'].indexOf(gb) !== -1) {
      sel.value = gb; customWrap.style.display = 'none'; customInput.value = '';
    } else {
      sel.value = '__custom__'; customWrap.style.display = 'flex'; customInput.value = gb;
    }

    document.getElementById('vtClsName').value = existingClass ? existingClass.className : '';
    document.getElementById('vtClsYear').value = existingClass ? (existingClass.schoolYear || '2026-2027') : '2026-2027';
    document.getElementById('vtClsHomeroomEmail').value = existingClass ? (existingClass.homeroomTeacherEmail || '') : '';
    document.getElementById('vtClsNotes').value = existingClass ? (existingClass.notes || '') : '';
    openSubModal('vtCrClassModal');
  }

  function openStudentFormModal(existingStudent) {
    state.editingStudent = existingStudent || null;
    document.getElementById('vtCrStudentModalTitle').textContent = existingStudent ? ('Chỉnh sửa học sinh ' + existingStudent.studentId) : 'Thêm học sinh mới';
    document.getElementById('vtStuFullName').value = existingStudent ? existingStudent.fullName : '';
    document.getElementById('vtStuDob').value = existingStudent ? (existingStudent.dob || '') : '';
    document.getElementById('vtStuGender').value = existingStudent ? (existingStudent.gender || 'Nam') : 'Nam';
    document.getElementById('vtStuEmail').value = existingStudent ? (existingStudent.linkedEmail || '') : '';
    openSubModal('vtCrStudentModal');
  }

  function openBulkImportModal() {
    state.bulkParsedRows = [];
    document.getElementById('vtBulkTextarea').value = '';
    document.getElementById('vtBulkPreviewWrap').style.display = 'none';
    document.getElementById('vtBulkPreviewSummary').textContent = 'Chưa có dữ liệu xem trước.';
    document.getElementById('vtBulkSaveBtn').disabled = true;
    openSubModal('vtCrBulkModal');
  }

  function toggleDrawer(forceOpen) {
    const sb = document.getElementById('vtCrSidebar');
    const bd = document.getElementById('vtCrDrawerBackdrop');
    if (!sb || !bd) return;
    const next = typeof forceOpen === 'boolean' ? forceOpen : !state.drawerOpen;
    state.drawerOpen = next;
    sb.classList.toggle('drawer-open', next);
    bd.classList.toggle('open', next);
  }

  function openTransferModal(student) {
    if (!student || !state.activeClassInfo) return;
    const allClasses = (state.bootstrap && Array.isArray(state.bootstrap.classes)) ? state.bootstrap.classes : [];
    const targetClasses = allClasses.filter(function (c) { return c.classId !== state.activeClassInfo.classId; });
    if (!targetClasses.length) {
      showToast('⚠ Chưa có lớp đích khác để chuyển học sinh.', true);
      return;
    }
    state.transferringStudent = student;
    const infoEl = document.getElementById('vtCrTransferStudentInfo');
    if (infoEl) {
      infoEl.innerHTML = 'Chuyển học sinh <b>' + escapeHtml(student.fullName) + '</b> (<span class="vt-cr-mono">' + escapeHtml(student.studentId) + '</span>) từ lớp <b>' + escapeHtml(state.activeClassInfo.className) + '</b> sang:';
    }
    const sel = document.getElementById('vtCrTransferTarget');
    if (sel) {
      sel.innerHTML = targetClasses.map(function (c) {
        return '<option value="' + escapeAttr(c.classId) + '">' + escapeHtml(c.className) + ' (' + escapeHtml(c.gradeBlock || '') + ')</option>';
      }).join('');
    }
    openSubModal('vtCrTransferModal');
  }

  function openAuditLogsModal() {
    const listEl = document.getElementById('vtCrAuditList');
    if (!listEl) return;
    const logs = (state.bootstrap && Array.isArray(state.bootstrap.recentAuditLogs)) ? state.bootstrap.recentAuditLogs : [];
    if (!logs.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--cr-soft);">Chưa có nhật ký hoạt động nào được ghi nhận.</div>';
    } else {
      listEl.innerHTML = logs.map(function (lg) {
        const ts = lg.timestamp ? String(lg.timestamp).replace('T', ' ').slice(0, 19) : '';
        return '<div class="vt-audit-item">' +
          '<div class="vt-audit-meta">' +
            '<span class="vt-audit-action-pill">' + escapeHtml(lg.action) + '</span>' +
            '<span>' + escapeHtml(lg.actorEmail) + ' • ' + escapeHtml(ts) + '</span>' +
          '</div>' +
          '<div class="vt-audit-summary">' + escapeHtml(lg.summary) + '</div>' +
        '</div>';
      }).join('');
    }
    openSubModal('vtCrAuditModal');
  }

  function openTrackColModal(colId) {
    const found = colId ? state.trackingColumns.find(function (c) { return c.id === colId; }) : null;
    state.editingTrackColId = found ? found.id : null;
    document.getElementById('vtCrTrackColTitle').textContent = found ? ('Chỉnh sửa cột: ' + found.name) : '+ Thêm cột theo dõi quá trình';
    document.getElementById('vtTrackColName').value = found ? found.name : '';
    document.getElementById('vtTrackColType').value = found ? (found.type || 'score10') : 'score10';
    document.getElementById('vtTrackColDate').value = found ? (found.date || '') : new Date().toISOString().slice(0, 10);
    document.getElementById('vtTrackColDeleteBtn').style.display = found ? 'inline-flex' : 'none';
    openSubModal('vtCrTrackColModal');
  }

  function renderBulkPreview() {
    const rows = parseBulkStudentLines(document.getElementById('vtBulkTextarea').value);
    state.bulkParsedRows = rows;
    const validRows = rows.filter(function (r) { return r.valid; });
    const errCount = rows.length - validRows.length;

    document.getElementById('vtBulkPreviewSummary').textContent =
      `Tìm thấy ${rows.length} dòng (${validRows.length} hợp lệ${errCount ? ', ' + errCount + ' dòng lỗi' : ''}).`;
    document.getElementById('vtBulkSaveBtn').disabled = validRows.length === 0;

    const wrap = document.getElementById('vtBulkPreviewWrap');
    if (!rows.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    let body = '';
    rows.forEach(function (r) {
      body += `
        <tr>
          <td class="vt-cr-mono">${r.lineNo}</td>
          <td style="font-weight:600;">${esc(r.fullName || '—')}</td>
          <td class="vt-cr-mono">${formatDobVn(r.dob)}</td>
          <td>${esc(r.gender)}</td>
          <td class="vt-cr-mono">${esc(r.linkedEmail || '—')}</td>
          <td>${r.valid ? '<span class="vt-cr-badge linked">Hợp lệ</span>' : '<span class="vt-cr-badge" style="background:var(--cr-danger-soft);color:var(--cr-danger);">' + esc(r.errorText) + '</span>'}</td>
        </tr>`;
    });
    wrap.innerHTML = `<table class="vt-cr-table"><thead><tr><th>#</th><th>Họ tên</th><th>Ngày sinh</th><th>Giới tính</th><th>Email</th><th>Kiểm tra</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  function handleGridVerticalKeydown(e, selector) {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const curRow = Number(e.target.getAttribute('data-row-idx'));
    const curCol = Number(e.target.getAttribute('data-col-idx'));
    const nextRow = e.key === 'ArrowUp' ? curRow - 1 : curRow + 1;
    const target = document.querySelector(`${selector}[data-row-idx="${nextRow}"][data-col-idx="${curCol}"]`);
    if (target) { target.focus(); target.select(); }
  }

  function refreshDirtyIndicators() {
    const stdCnt = Object.keys(state.standardDirty).length;
    const stdBadge = document.getElementById('vtStdDirtyBadge');
    const stdBtn = document.getElementById('vtBtnSaveStandard');
    if (stdBadge) { stdBadge.textContent = `Có ${stdCnt} thay đổi chưa lưu`; stdBadge.style.display = stdCnt > 0 ? 'inline-flex' : 'none'; }
    if (stdBtn) stdBtn.disabled = stdCnt === 0;

    const trkCnt = Object.keys(state.trackingDirty).length;
    const trkBadge = document.getElementById('vtTrkDirtyBadge');
    const trkBtn = document.getElementById('vtBtnSaveTracking');
    if (trkBadge) { trkBadge.textContent = `Có ${trkCnt} thay đổi chưa lưu`; trkBadge.style.display = trkCnt > 0 ? 'inline-flex' : 'none'; }
    if (trkBtn) trkBtn.disabled = trkCnt === 0;
  }

  function wireStaticEvents(root) {
    document.getElementById('vtCrBtnClose').addEventListener('click', close);
    document.getElementById('vtCrBtnRefresh').addEventListener('click', loadBootstrap);
    const drawerBtn = document.getElementById('vtCrDrawerToggle');
    if (drawerBtn) drawerBtn.addEventListener('click', function () { toggleDrawer(); });
    const drawerBd = document.getElementById('vtCrDrawerBackdrop');
    if (drawerBd) drawerBd.addEventListener('click', function () { toggleDrawer(false); });

    const syncBadge = document.getElementById('vtCrSyncBadge');
    if (syncBadge) {
      syncBadge.addEventListener('click', function () {
        if (state.syncStatus === 'pending_merge') {
          state.standardDirty = {};
          state.trackingDirty = {};
          handleIncomingServerRev(state.localSyncRev + 1);
        }
      });
    }

    const close360Btn = document.getElementById('vtCrClose360Btn');
    const bd360 = document.getElementById('vtCrProfile360Backdrop');
    if (close360Btn && bd360) {
      close360Btn.addEventListener('click', function () { bd360.classList.remove('open'); });
      bd360.addEventListener('click', function (e) { if (e.target === bd360) bd360.classList.remove('open'); });
    }

    const presetsEl = document.getElementById('vtCrSeewoPresets');
    if (presetsEl) {
      presetsEl.addEventListener('click', async function (e) {
        const chip = e.target.closest('.vt-seewo-chip');
        if (!chip || !state.quickBehStudent || !state.activeClassInfo) return;
        const cat = chip.getAttribute('data-cat');
        const pts = Number(chip.getAttribute('data-pts')) || 0;
        const lbl = chip.getAttribute('data-lbl') || '';
        const res = await callBridge('student_log_behavior_batch', {
          classId: state.activeClassInfo.classId,
          entries: [{ studentId: state.quickBehStudent.studentId, category: cat, label: lbl, points: pts, visibility: 'STUDENT' }]
        });
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu điểm nhanh.'), true); return; }
        closeSubModal('vtCrQuickBehModal');
        showToast('⚡ Đã ghi nhận ' + (pts > 0 ? '+' : '') + pts + '★ (' + lbl + ') cho ' + state.quickBehStudent.fullName);
        await loadActiveClassData();
      });
    }

    const qbForm = document.getElementById('vtCrQuickBehForm');
    if (qbForm) {
      qbForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!state.quickBehStudent || !state.activeClassInfo) return;
        const pts = Number(document.getElementById('vtCrQbPoints').value) || 0;
        const lbl = document.getElementById('vtCrQbLabel').value.trim();
        const note = document.getElementById('vtCrQbNote').value.trim();
        if (!lbl) { showToast('⚠ Vui lòng nhập nội dung ghi nhận.', true); return; }
        const cat = pts < 0 ? 'DEMERIT' : 'MERIT';
        const res = await callBridge('student_log_behavior_batch', {
          classId: state.activeClassInfo.classId,
          entries: [{ studentId: state.quickBehStudent.studentId, category: cat, label: lbl, points: pts, note: note, visibility: 'STUDENT' }]
        });
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu ghi nhận.'), true); return; }
        closeSubModal('vtCrQuickBehModal');
        showToast('✓ Đã ghi nhận ' + lbl + ' cho ' + state.quickBehStudent.fullName);
        await loadActiveClassData();
      });
    }

    const attSaveBtn = document.getElementById('vtCrAttSaveBtn');
    if (attSaveBtn) {
      attSaveBtn.addEventListener('click', async function () {
        if (!state.activeClassInfo) return;
        const dt = (document.getElementById('vtCrAttDate') && document.getElementById('vtCrAttDate').value) || state.attendanceDate;
        const entries = state.roster.map(function (st) {
          return {
            studentId: st.studentId,
            date: dt,
            category: 'ATTENDANCE',
            label: state.attendanceDraft[st.studentId] || 'PRESENT',
            points: 0,
            visibility: 'STUDENT'
          };
        });
        attSaveBtn.disabled = true;
        const res = await callBridge('student_log_behavior_batch', { classId: state.activeClassInfo.classId, entries: entries });
        attSaveBtn.disabled = false;
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu điểm danh.'), true); return; }
        closeSubModal('vtCrAttendanceModal');
        showToast('✓ Đã lưu điểm danh ' + entries.length + ' học sinh ngày ' + dt + '.');
        await loadActiveClassData();
      });
    }

    const transferForm = document.getElementById('vtCrTransferForm');
    if (transferForm) {
      transferForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!state.transferringStudent || !state.activeClassInfo) return;
        const toClassId = document.getElementById('vtCrTransferTarget').value;
        if (!toClassId) return;
        const res = await callBridge('class_transfer_student', {
          studentId: state.transferringStudent.studentId,
          fromClassId: state.activeClassInfo.classId,
          toClassId: toClassId
        });
        if (!res || !res.ok) {
          showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể chuyển lớp học sinh.'), true);
          return;
        }
        closeSubModal('vtCrTransferModal');
        showToast('✓ Đã chuyển ' + state.transferringStudent.fullName + ' sang lớp ' + (res.toClassName || '') + '.');
        state.transferringStudent = null;
        await loadBootstrap();
      });
    }

    // Quick Toggle: Daylight Observatory / Cosmic Night Mode
    document.getElementById('vtCrThemeToggle').addEventListener('click', function () {
      state.cosmicDark = !state.cosmicDark;
      root.classList.toggle('vt-cosmic-dark', state.cosmicDark);
      const btn = document.getElementById('vtCrThemeToggle');
      if (btn) btn.textContent = state.cosmicDark ? '☀️ Sáng Học thuật' : '🌙 Đêm Vũ trụ';
    });

    root.querySelectorAll('[data-close-sub]').forEach(function (btn) {
      btn.addEventListener('click', function () { closeSubModal(btn.getAttribute('data-close-sub')); });
    });

    document.getElementById('vtClsGradeSelect').addEventListener('change', function (e) {
      document.getElementById('vtClsGradeCustomWrap').style.display = e.target.value === '__custom__' ? 'flex' : 'none';
    });

    document.getElementById('vtCrClassForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const selVal = document.getElementById('vtClsGradeSelect').value;
      const gradeBlock = selVal === '__custom__' ? document.getElementById('vtClsGradeCustom').value.trim() : selVal;
      const className = document.getElementById('vtClsName').value.trim();
      if (!gradeBlock || !className) { showToast('⚠ Vui lòng nhập đầy đủ Khối và Tên lớp.', true); return; }
      const btn = document.getElementById('vtClsSubmitBtn');
      btn.disabled = true; btn.textContent = '⏳ Đang lưu...';
      try {
        const res = await callBridge('admin_upsert_class', {
          payload: {
            classId: state.editingClass ? state.editingClass.classId : '',
            gradeBlock: gradeBlock, className: className,
            schoolYear: document.getElementById('vtClsYear').value.trim(),
            homeroomTeacherEmail: document.getElementById('vtClsHomeroomEmail').value.trim().toLowerCase(),
            notes: document.getElementById('vtClsNotes').value.trim()
          }
        });
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu lớp học.'), true); return; }
        closeSubModal('vtCrClassModal');
        state.sidebarMode = 'classes';
        state.selectedClassId = res.classInfo.classId;
        showToast('✓ Đã lưu lớp ' + res.classInfo.className + ' thành công!');
        await loadBootstrap();
      } finally { btn.disabled = false; btn.textContent = 'Lưu lớp học'; }
    });

    document.getElementById('vtCrStudentForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fullName = document.getElementById('vtStuFullName').value.trim();
      if (fullName.length < 2) { showToast('⚠ Vui lòng nhập Họ và tên học sinh.', true); return; }
      const btn = document.getElementById('vtStuSubmitBtn');
      btn.disabled = true; btn.textContent = '⏳ Đang lưu...';
      try {
        const res = await callBridge('class_upsert_student', {
          payload: {
            classId: state.selectedClassId,
            studentId: state.editingStudent ? state.editingStudent.studentId : '',
            fullName: fullName,
            dob: document.getElementById('vtStuDob').value.trim(),
            gender: document.getElementById('vtStuGender').value,
            linkedEmail: document.getElementById('vtStuEmail').value.trim().toLowerCase()
          }
        });
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu học sinh.'), true); return; }
        closeSubModal('vtCrStudentModal');
        showToast('✓ Đã lưu học sinh ' + res.student.fullName + ' (' + res.student.studentId + ').');
        await loadActiveClassData();
      } finally { btn.disabled = false; btn.textContent = 'Lưu học sinh'; }
    });

    document.getElementById('vtBulkParseBtn').addEventListener('click', renderBulkPreview);
    document.getElementById('vtBulkSaveBtn').addEventListener('click', async function () {
      const valid = state.bulkParsedRows.filter(function (r) { return r.valid; }).map(function (r) {
        return { fullName: r.fullName, dob: r.dob, gender: r.gender, linkedEmail: r.linkedEmail };
      });
      if (!valid.length) return;
      const btn = document.getElementById('vtBulkSaveBtn');
      btn.disabled = true; btn.textContent = '⏳ Đang lưu ' + valid.length + ' học sinh...';
      try {
        const res = await callBridge('class_bulk_add_students', { classId: state.selectedClassId, students: valid });
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể nhập danh sách.'), true); return; }
        closeSubModal('vtCrBulkModal');
        showToast('✓ Đã thêm thành công ' + res.insertedCount + ' học sinh vào lớp!');
        await loadActiveClassData();
      } finally { btn.disabled = false; btn.textContent = 'Lưu danh sách vào lớp'; }
    });

    document.getElementById('vtCrTrackColForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = document.getElementById('vtTrackColName').value.trim();
      const type = document.getElementById('vtTrackColType').value;
      const date = document.getElementById('vtTrackColDate').value.trim();
      if (!name) { showToast('⚠ Vui lòng nhập tên cột kiểm tra.', true); return; }

      const nextCols = state.trackingColumns.slice();
      if (state.editingTrackColId) {
        const idx = nextCols.findIndex(function (c) { return c.id === state.editingTrackColId; });
        if (idx !== -1) nextCols[idx] = { id: state.editingTrackColId, name: name, type: type, date: date };
      } else {
        nextCols.push({ id: 'col_' + Date.now().toString(36), name: name, type: type, date: date });
      }

      const btn = document.getElementById('vtTrackColSubmitBtn');
      btn.disabled = true; btn.textContent = '⏳ Đang lưu...';
      try {
        const res = await callBridge('grades_save_tracking_schema', {
          classId: state.selectedClassId, subject: state.selectedSubject, columns: nextCols
        });
        if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu cấu trúc cột.'), true); return; }
        state.trackingColumns = nextCols;
        closeSubModal('vtCrTrackColModal');
        showToast('✓ Đã cập nhật cấu trúc cột theo dõi lên Google Sheets!');
        renderMain();
      } finally { btn.disabled = false; btn.textContent = 'Lưu cấu trúc cột'; }
    });

    document.getElementById('vtTrackColDeleteBtn').addEventListener('click', function () {
      const colId = state.editingTrackColId;
      if (!colId) return;
      const col = state.trackingColumns.find(function (c) { return c.id === colId; });
      closeSubModal('vtCrTrackColModal');
      askConfirm(
        'Xóa cột theo dõi "' + (col ? col.name : '') + '"',
        'Xác nhận xóa cột này khỏi Bảng điểm Theo dõi Quá trình của lớp?',
        async function () {
          const nextCols = state.trackingColumns.filter(function (c) { return c.id !== colId; });
          const res = await callBridge('grades_save_tracking_schema', {
            classId: state.selectedClassId, subject: state.selectedSubject, columns: nextCols
          });
          if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể xóa cột.'), true); return; }
          state.trackingColumns = nextCols;
          showToast('✓ Đã xóa cột theo dõi thành công.');
          renderMain();
        }
      );
    });

    document.getElementById('vtCrConfirmOkBtn').addEventListener('click', async function () {
      const cb = state.confirmCallback;
      state.confirmCallback = null;
      closeSubModal('vtCrConfirmModal');
      if (typeof cb === 'function') await cb();
    });
  }

  function wireMainDynamicEvents(cls) {
    const trkIncBtn = document.getElementById('vtBtnTrkIncomplete');
    if (trkIncBtn) {
      trkIncBtn.addEventListener('click', function () {
        state.trackingIncompleteOnly = !state.trackingIncompleteOnly;
        renderMain();
      });
    }
    const retryBanner = document.getElementById('vtCrBtnRetryBanner');
    if (retryBanner) retryBanner.addEventListener('click', loadBootstrap);
    const auditCard = document.getElementById('vtCrOpenAuditCard');
    if (auditCard) {
      auditCard.addEventListener('click', openAuditLogsModal);
      auditCard.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAuditLogsModal(); }
      });
    }
    document.querySelectorAll('#vtClassroomModal [data-crtab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const nextTab = tab.getAttribute('data-crtab') || 'roster';
        state.activeTab = nextTab;
        if (nextTab === 'tracking_view') state.gradeSubTab = 'tracking';
        if (nextTab === 'gradebook' || nextTab === 'tracking_view') loadGradebookBundle();
        else if (nextTab === 'summary') loadSummaryMatrix();
        else if (nextTab === 'mygrades') loadStudentPersonalGrades();
        else renderMain();
      });
    });

    document.querySelectorAll('#vtClassroomModal [data-gbsub]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.gradeSubTab = btn.getAttribute('data-gbsub') || 'standard';
        renderMain();
      });
    });

    const gbSubj = document.getElementById('vtGbSubjectSelect');
    if (gbSubj) gbSubj.addEventListener('change', function (e) { state.selectedSubject = e.target.value; loadGradebookBundle(); });

    const gbSem = document.getElementById('vtGbSemesterSelect');
    if (gbSem) gbSem.addEventListener('change', function (e) { state.selectedSemester = e.target.value; loadGradebookBundle(); });

    document.querySelectorAll('#vtClassroomModal [data-std-sid]').forEach(function (inp) {
      inp.addEventListener('keydown', function (e) { handleGridVerticalKeydown(e, '#vtClassroomModal [data-std-sid]'); });
      inp.addEventListener('input', function (e) {
        const sid = inp.getAttribute('data-std-sid');
        const field = inp.getAttribute('data-std-field');
        const parsed = parseScoreVal(e.target.value);
        if (!parsed.valid) {
          inp.classList.add('is-invalid');
          showToast('⚠ Điểm số phải là số từ 0 đến 10.', true);
          return;
        }
        inp.classList.remove('is-invalid');
        if (!state.standardRows[sid]) state.standardRows[sid] = { tx1: '', tx2: '', tx3: '', midterm: '', final: '' };
        state.standardRows[sid][field] = parsed.value;
        state.standardDirty[sid + ':' + field] = true;
        inp.classList.add('is-dirty');

        const avg = computeStandardAverage(state.standardRows[sid]);
        const avgCell = document.getElementById('vtStdAvg_' + sid);
        if (avgCell) {
          avgCell.textContent = avg !== '' ? Number(avg).toFixed(1) : '—';
          avgCell.className = 'vt-avg-cell ' + avgColorClass(avg);
        }
        refreshDirtyIndicators();
      });
    });

    const btnSaveStd = document.getElementById('vtBtnSaveStandard');
    if (btnSaveStd) {
      btnSaveStd.addEventListener('click', async function () {
        if (document.querySelector('#vtClassroomModal .vt-score-input.is-invalid')) {
          showToast('⚠ Vui lòng sửa các ô điểm không hợp lệ (0–10) trước khi lưu.', true);
          return;
        }
        const dirtySids = {};
        Object.keys(state.standardDirty).forEach(function (k) { dirtySids[k.split(':')[0]] = true; });
        const changedRows = Object.keys(dirtySids).map(function (sid) {
          const r = state.standardRows[sid] || {};
          return { studentId: sid, tx1: r.tx1 ?? '', tx2: r.tx2 ?? '', tx3: r.tx3 ?? '', midterm: r.midterm ?? '', final: r.final ?? '' };
        });
        if (!changedRows.length) return;

        btnSaveStd.disabled = true; btnSaveStd.textContent = '⏳ Đang lưu ' + changedRows.length + ' dòng...';
        try {
          const res = await callBridge('grades_save_standard_batch', {
            classId: state.selectedClassId, subject: state.selectedSubject, semester: state.selectedSemester, rows: changedRows
          });
          if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu bảng điểm.'), true); return; }
          state.standardDirty = {};
          showToast('✓ Đã lưu ' + res.updatedCount + ' dòng điểm Phổ thông lên Google Sheets!');
          renderMain();
        } finally { btnSaveStd.disabled = false; btnSaveStd.textContent = '💾 Lưu Bảng điểm Phổ thông'; }
      });
    }

    const btnExpStd = document.getElementById('vtBtnExportStdCsv');
    if (btnExpStd) btnExpStd.addEventListener('click', exportStandardGradesCsv);

    document.querySelectorAll('#vtClassroomModal [data-trk-sid]').forEach(function (inp) {
      inp.addEventListener('keydown', function (e) { handleGridVerticalKeydown(e, '#vtClassroomModal [data-trk-sid]'); });
      inp.addEventListener('input', function (e) {
        const sid = inp.getAttribute('data-trk-sid');
        const colId = inp.getAttribute('data-trk-col');
        const colType = inp.getAttribute('data-trk-type');
        let val = e.target.value;

        if (colType === 'score10') {
          const parsed = parseScoreVal(val);
          if (!parsed.valid) {
            inp.classList.add('is-invalid');
            showToast('⚠ Cột thang điểm 10 chỉ nhận giá trị từ 0 đến 10.', true);
            return;
          }
          inp.classList.remove('is-invalid');
          val = parsed.value;
        }

        if (!state.trackingRows[sid]) state.trackingRows[sid] = {};
        state.trackingRows[sid][colId] = val;
        state.trackingDirty[sid + ':' + colId] = true;
        inp.classList.add('is-dirty');

        const avg = computeTrackingAverage(state.trackingColumns, state.trackingRows[sid]);
        const avgCell = document.getElementById('vtTrkAvg_' + sid);
        if (avgCell) {
          avgCell.textContent = avg !== '' ? Number(avg).toFixed(1) : '—';
          avgCell.className = 'vt-avg-cell ' + avgColorClass(avg);
        }
        refreshDirtyIndicators();
      });
    });

    const btnAddCol = document.getElementById('vtBtnAddTrackCol');
    if (btnAddCol) btnAddCol.addEventListener('click', function () { openTrackColModal(null); });

    if (state.gradeCanEdit) {
      document.querySelectorAll('#vtClassroomModal [data-edit-trackcol]').forEach(function (th) {
        th.addEventListener('click', function () { openTrackColModal(th.getAttribute('data-edit-trackcol')); });
      });
    }

    const btnSaveTrk = document.getElementById('vtBtnSaveTracking');
    if (btnSaveTrk) {
      btnSaveTrk.addEventListener('click', async function () {
        if (document.querySelector('#vtClassroomModal .vt-score-input.is-invalid')) {
          showToast('⚠ Vui lòng sửa các ô điểm không hợp lệ trước khi lưu.', true);
          return;
        }
        const dirtySids = {};
        Object.keys(state.trackingDirty).forEach(function (k) { dirtySids[k.split(':')[0]] = true; });
        const changedRows = Object.keys(dirtySids).map(function (sid) {
          return { studentId: sid, scores: state.trackingRows[sid] || {} };
        });
        if (!changedRows.length) return;

        btnSaveTrk.disabled = true; btnSaveTrk.textContent = '⏳ Đang lưu ' + changedRows.length + ' dòng...';
        try {
          const res = await callBridge('grades_save_tracking_batch', {
            classId: state.selectedClassId, subject: state.selectedSubject, rows: changedRows
          });
          if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể lưu bảng điểm theo dõi.'), true); return; }
          state.trackingDirty = {};
          showToast('✓ Đã lưu ' + res.updatedCount + ' dòng điểm Theo dõi Quá trình!');
          renderMain();
        } finally { btnSaveTrk.disabled = false; btnSaveTrk.textContent = '💾 Lưu Bảng điểm Theo dõi'; }
      });
    }

    const btnExpTrk = document.getElementById('vtBtnExportTrkCsv');
    if (btnExpTrk) btnExpTrk.addEventListener('click', exportTrackingGradesCsv);

    const searchInput = document.getElementById('vtCrSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.searchQuery = e.target.value;
        const tabContent = document.getElementById('vtCrTabContent');
        if (tabContent) {
          tabContent.innerHTML = renderRosterTabHtml();
          wireRosterOnlyEvents(cls);
          const nextInput = document.getElementById('vtCrSearchInput');
          if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length); }
        }
      });
    }
    wireRosterOnlyEvents(cls);

    const btnEditClass = document.getElementById('vtCrBtnEditClass');
    if (btnEditClass) btnEditClass.addEventListener('click', function () { openClassFormModal(cls); });

    const btnDeleteClass = document.getElementById('vtCrBtnDeleteClass');
    if (btnDeleteClass) {
      btnDeleteClass.addEventListener('click', function () {
        askConfirm(
          'Xóa lớp ' + cls.className,
          'Bạn có chắc chắn muốn xóa lớp ' + cls.className + '? Lớp đang có học sinh hoạt động sẽ được bảo vệ trừ khi bạn xác nhận xóa cưỡng bức.',
          async function () {
            const res = await callBridge('admin_delete_class', { classId: cls.classId, force: state.roster.length > 0 });
            if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể xóa lớp.'), true); return; }
            showToast('✓ Đã xóa lớp ' + cls.className + '.');
            state.selectedClassId = '';
            await loadBootstrap();
          }
        );
      });
    }

    const semSelect = document.getElementById('vtCrMatrixSemester');
    if (semSelect) semSelect.addEventListener('change', function (e) { state.selectedSemester = e.target.value; loadSummaryMatrix(); });

    const btnExpMatrix = document.getElementById('vtBtnExportMatrixCsv');
    if (btnExpMatrix) btnExpMatrix.addEventListener('click', exportSummaryMatrixCsv);

    const stuSem = document.getElementById('vtStuPortalSemester');
    if (stuSem) stuSem.addEventListener('change', function (e) { state.selectedSemester = e.target.value; loadStudentPersonalGrades(); });
  }

  function wireRosterOnlyEvents(cls) {
    const linkFilterEl = document.getElementById('vtCrLinkFilter');
    if (linkFilterEl) {
      linkFilterEl.addEventListener('change', function (e) {
        state.linkFilter = e.target.value || 'all';
        const tabContent = document.getElementById('vtCrTabContent');
        if (tabContent) {
          tabContent.innerHTML = renderRosterTabHtml();
          const sInp = document.getElementById('vtCrSearchInput');
          if (sInp) {
            sInp.addEventListener('input', function (ev) {
              state.searchQuery = ev.target.value;
              tabContent.innerHTML = renderRosterTabHtml();
              wireRosterOnlyEvents(cls);
              const nextInp = document.getElementById('vtCrSearchInput');
              if (nextInp) { nextInp.focus(); nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length); }
            });
          }
          wireRosterOnlyEvents(cls);
        }
      });
    }

    document.querySelectorAll('#vtClassroomModal [data-transfer-stu]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const sid = btn.getAttribute('data-transfer-stu');
        const found = state.roster.find(function (s) { return s.studentId === sid; });
        if (found) openTransferModal(found);
      });
    });

    const btnAtt = document.getElementById('vtCrBtnAttendanceToday');
    if (btnAtt) btnAtt.addEventListener('click', function () { openAttendanceModal(cls); });

    document.querySelectorAll('#vtClassroomModal [data-quick-beh]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const sid = btn.getAttribute('data-quick-beh');
        const found = state.roster.find(function (s) { return s.studentId === sid; });
        if (found) openQuickBehaviorModal(found);
      });
    });

    document.querySelectorAll('#vtClassroomModal [data-open-360]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const sid = btn.getAttribute('data-open-360');
        openStudent360Drawer(cls.classId, sid);
      });
    });

    const btnAdd = document.getElementById('vtCrBtnAddStudent');
    if (btnAdd) btnAdd.addEventListener('click', function () { openStudentFormModal(null); });
    const btnBulk = document.getElementById('vtCrBtnBulkImport');
    if (btnBulk) btnBulk.addEventListener('click', openBulkImportModal);
    const btnCsv = document.getElementById('vtCrBtnExportCsv');
    if (btnCsv) btnCsv.addEventListener('click', function () { exportRosterCsv(cls, state.roster); });

    document.querySelectorAll('#vtClassroomModal [data-edit-stu]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const sid = btn.getAttribute('data-edit-stu');
        const found = state.roster.find(function (s) { return s.studentId === sid; });
        if (found) openStudentFormModal(found);
      });
    });

    document.querySelectorAll('#vtClassroomModal [data-del-stu]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const sid = btn.getAttribute('data-del-stu');
        const found = state.roster.find(function (s) { return s.studentId === sid; });
        if (!found) return;
        askConfirm(
          'Xóa học sinh khỏi lớp',
          'Xác nhận gỡ học sinh ' + found.fullName + ' (' + found.studentId + ') khỏi danh sách hoạt động của lớp ' + cls.className + '?',
          async function () {
            const res = await callBridge('class_delete_student', { classId: cls.classId, studentId: found.studentId });
            if (!res || !res.ok) { showToast('⚠ ' + formatFriendlyError((res && res.error) || 'Không thể xóa học sinh.'), true); return; }
            showToast('✓ Đã xóa học sinh ' + found.fullName + '.');
            await loadActiveClassData();
          }
        );
      });
    });
  }

  /* ==========================================================================
   * 8. PUBLIC MODULE API
   * ========================================================================== */

  function open(initialMode) {
    if (!getSessionContext()) {
      console.warn('[VANTHESIS_CLASSROOM] Thiếu window.VANTHESIS_SESSION_CONTEXT.');
      return;
    }
    if (initialMode && ['rbac', 'faculty', 'students', 'classes'].indexOf(initialMode) !== -1) {
      state.sidebarMode = initialMode;
    }
    injectStyles();
    ensureModalDOM();
    document.getElementById(MODAL_ID).classList.add('open');
    state.isOpen = true;
    startSyncLoop();
    loadBootstrap();
  }

  function openTab(tabName) {
    const mode = String(tabName || 'classes').toLowerCase();
    open(['rbac', 'faculty', 'students', 'classes'].indexOf(mode) !== -1 ? mode : 'classes');
  }

  function close() {
    stopSyncLoop();
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.remove('open');
    const bd360 = document.getElementById('vtCrProfile360Backdrop');
    if (bd360) bd360.classList.remove('open');
    state.isOpen = false;
  }

  // Global Ctrl+S / Cmd+S Quick Save Shortcut while Classroom Modal is open
  document.addEventListener('keydown', function (e) {
    if (!state.isOpen) return;
    if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 's') {
      e.preventDefault();
      if (state.activeTab === 'gradebook' || state.activeTab === 'tracking_view') {
        if (state.gradeSubTab === 'standard' && Object.keys(state.standardDirty).length > 0) {
          const btnSaveStd = document.getElementById('vtCrBtnSaveStd');
          if (btnSaveStd) { btnSaveStd.click(); return; }
        }
        if (state.gradeSubTab === 'tracking' && Object.keys(state.trackingDirty).length > 0) {
          const btnSaveTrk = document.getElementById('vtCrBtnSaveTrk');
          if (btnSaveTrk) { btnSaveTrk.click(); return; }
        }
        showToast('✓ Bảng điểm hiện tại không có thay đổi chưa lưu.');
      }
    }
  });

  // Auto-sync session context when index.html broadcasts session updates
  function handleSessionChanged() {
    updateTopUserLine();
    if (state.isOpen && !state.loadingBootstrap && !state.bootstrap && getSessionContext()) {
      loadBootstrap();
    }
  }
  window.addEventListener('vantesis:session-changed', handleSessionChanged);
  window.addEventListener('vanthesis:session-changed', handleSessionChanged);

  window.VANTHESIS_CLASSROOM = Object.freeze({
    version: EXPECTED_BACKEND_VERSION,
    open: open,
    openTab: openTab,
    close: close,
    refresh: loadBootstrap,
    getState: function () { return Object.assign({}, state); }
  });
})();
