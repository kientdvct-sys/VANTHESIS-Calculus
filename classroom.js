/**
 * VANTHESIS Calculus — Cosmic Liquid Glass Classroom & Dual Gradebook Hub
 * File: classroom.js (placed alongside index.html)
 * Namespace: window.VANTHESIS_CLASSROOM
 * Design Language: Apple Concentric Squircle + Liquid Glass + Cosmic Observatory
 *
 * Depends on window.VANTHESIS_SESSION_CONTEXT:
 *   { bridgeUrl, accessToken, email, role, fullName, avatar, status }
 */
(function () {
  'use strict';

  const STYLE_ID = 'vanthesis-classroom-styles';
  const MODAL_ID = 'vtClassroomModal';
  const MAX_BULK_IMPORT = 60;

  const state = {
    isOpen: false,
    cosmicDark: false,
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

      @media (max-width: 860px) {
        #${MODAL_ID} { padding: 0; }
        .vt-cr-shell { border-radius: 0; }
        .vt-cr-layout { flex-direction: column; }
        .vt-cr-sidebar { width: 100%; max-height: 200px; border-right: none; border-bottom: 1px solid var(--cr-border); }
        .vt-cr-main { padding: 14px; }
        .vt-cr-banner-kpis, .vt-cr-form-grid, .vt-stu-kpi-grid, .vt-faculty-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ==========================================================================
   * 2. UTILITIES, MATH HELPERS, CSV EXPORT & BRIDGE API CLIENT (100% PRESERVED)
   * ========================================================================== */

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  async function callBridge(action, extraBody) {
    const ctx = getSessionContext();
    if (!ctx) return { ok: false, error: 'Chưa có phiên đăng nhập Google hợp lệ.' };
    try {
      const payload = Object.assign({ action: action, accessToken: ctx.accessToken }, extraBody || {});
      const res = await fetch(ctx.bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      try { return JSON.parse(text); } catch (e) { return { ok: false, error: 'Phản hồi từ máy chủ không hợp lệ.' }; }
    } catch (err) {
      return { ok: false, error: 'Lỗi kết nối mạng tới Google Apps Script Bridge.' };
    }
  }

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
              <div class="vt-cr-brand-sub" id="vtCrTopUserLine">Đang tải ngữ cảnh tài khoản...</div>
            </div>
          </div>
          <div class="vt-cr-top-actions">
            <button id="vtCrThemeToggle" class="vt-cr-btn vt-cr-btn-sm" type="button" title="Chuyển chế độ Sáng Học thuật / Đêm Vũ trụ">🌙 Đêm Vũ trụ</button>
            <button id="vtCrBtnRefresh" class="vt-cr-btn vt-cr-btn-sm" type="button">↻ Làm mới</button>
            <button id="vtCrBtnClose" class="vt-cr-btn vt-cr-btn-sm" type="button">✕ Đóng về Xưởng</button>
          </div>
        </header>

        <div class="vt-cr-layout">
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
      showToast('⚠ ' + ((res && res.error) || 'Không thể tải dữ liệu lớp học.'), true);
      document.getElementById('vtCrMain').innerHTML = `
        <div class="vt-cr-card" style="text-align:center;padding:36px;">
          <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
          <div style="font-weight:700;margin-bottom:6px;">Không thể tải Trung tâm Lớp học</div>
          <div style="font-size:12.5px;color:var(--cr-muted);">${esc((res && res.error) || 'Vui lòng kiểm tra kết nối và thử lại.')}</div>
        </div>`;
      return;
    }

    state.bootstrap = res;
    state.role = res.role || '';
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
    if (state.sidebarMode === 'faculty' && state.role === 'SUPER_ADMIN') {
      renderMain();
    } else if (state.selectedClassId) {
      await loadActiveClassData();
    } else {
      renderMain();
    }
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
      showToast('⚠ ' + ((res && res.error) || 'Không thể tải Sổ điểm Bộ môn.'), true);
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
    const roleNames = {
      SUPER_ADMIN: 'Super Admin • Toàn quyền hệ thống',
      HOMEROOM_TEACHER: 'Giáo viên chủ nhiệm (HOMEROOM TEACHER)',
      SUBJECT_TEACHER: 'Giáo viên bộ môn (SUBJECT TEACHER)',
      STUDENT: 'Học sinh (STUDENT)'
    };
    el.textContent = (ctx ? (ctx.fullName || ctx.email) + ' • ' : '') + (roleNames[state.role] || 'Thành viên');
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
      html += `
        <button id="vtCrBtnNewClass" class="vt-cr-btn vt-cr-btn-primary vt-cr-btn-shimmer" type="button" style="width:100%;margin-bottom:10px;">+ Tạo Khối / Lớp mới</button>
        <button id="vtCrBtnFacultyOrbit" class="vt-cr-btn ${state.sidebarMode === 'faculty' ? 'vt-cr-btn-emerald' : ''}" type="button" style="width:100%;margin-bottom:16px;justify-content:space-between;">
          <span>✦ Đội ngũ Giáo viên</span>
          <span class="vt-cr-count-pill" style="${state.sidebarMode === 'faculty' ? 'background:rgba(255,255,255,0.22);color:#fff;' : ''}">${facultyCount} GV</span>
        </button>
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

    const btnFac = document.getElementById('vtCrBtnFacultyOrbit');
    if (btnFac) {
      btnFac.addEventListener('click', function () {
        state.sidebarMode = state.sidebarMode === 'faculty' ? 'classes' : 'faculty';
        renderSidebar();
        renderMain();
      });
    }

    side.querySelectorAll('[data-select-class]').forEach(function (btn) {
      btn.addEventListener('click', function () {
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
              <span class="vt-cr-badge ${isHr ? 'admin' : 'homeroom'}">${isHr ? 'HOMEROOM TEACHER' : 'SUBJECT TEACHER'}</span>
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

  function renderMain() {
    const main = document.getElementById('vtCrMain');
    if (!main) return;

    if (state.role === 'SUPER_ADMIN' && state.sidebarMode === 'faculty') {
      main.innerHTML = renderFacultyOrbitHtml();
      const backBtn = document.getElementById('vtCrBackToClasses');
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          state.sidebarMode = 'classes';
          renderSidebar();
          renderMain();
        });
      }
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

    main.innerHTML = `
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
    const filtered = state.roster.filter(function (st) {
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
      ? `<div class="vt-cr-readonly-bar">🔒 Chế độ chỉ xem danh sách lớp (Quyền chỉnh sửa thành viên thuộc Giáo viên chủ nhiệm)</div>`
      : '';

    const editButtonsHtml = state.canEditRoster
      ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
           <button id="vtCrBtnAddStudent" class="vt-cr-btn vt-cr-btn-primary vt-cr-btn-shimmer" type="button">+ Thêm học sinh</button>
           <button id="vtCrBtnBulkImport" class="vt-cr-btn" type="button">📋 Nhập nhanh (Excel/Text)</button>
           <button id="vtCrBtnExportCsv" class="vt-cr-btn" type="button">⬇ Xuất CSV</button>
         </div>`
      : '';

    let theadCols = `<th>STT</th><th>Mã HS</th><th>Họ và tên</th>`;
    if (!isStudent) theadCols += `<th>Ngày sinh</th>`;
    theadCols += `<th>Giới tính</th>`;
    if (!isStudent) theadCols += `<th>Trạng thái Gmail</th>`;
    if (state.canEditRoster) theadCols += `<th style="text-align:right;">Thao tác</th>`;

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

        const actionCell = state.canEditRoster
          ? `<td style="text-align:right;white-space:nowrap;">
               <button type="button" class="vt-cr-btn vt-cr-btn-sm" data-edit-stu="${esc(st.studentId)}">✎ Sửa</button>
               <button type="button" class="vt-cr-btn vt-cr-btn-sm vt-cr-btn-danger" data-del-stu="${esc(st.studentId)}">✕ Xóa</button>
             </td>`
          : '';

        tbodyRows += `
          <tr class="vt-roster-row">
            <td class="vt-cr-mono" style="color:var(--cr-soft);">${idx + 1}</td>
            <td><span class="vt-cr-id-pill">◉ ${esc(st.studentId)}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="vt-cr-avatar ${genderAvatarClass(st.gender)}">${esc(getInitials(st.fullName))}</span>
                <span style="font-weight:700;white-space:nowrap;">${esc(st.fullName)}</span>
              </div>
            </td>
            ${!isStudent ? '<td class="vt-cr-mono">' + formatDobVn(st.dob) + '</td>' : ''}
            <td>${esc(st.gender || '—')}</td>
            ${!isStudent ? '<td>' + gmailCell + '</td>' : ''}
            ${actionCell}
          </tr>`;
      });
    }

    return `
      ${topNotice}
      <div class="vt-cr-toolbar">
        <input id="vtCrSearchInput" class="vt-cr-search" type="text" value="${esc(state.searchQuery)}" placeholder="🔍 Tìm theo họ tên hoặc mã học sinh...">
        ${editButtonsHtml}
      </div>
      <div class="vt-cr-table-wrap">
        <table class="vt-cr-table"><thead><tr>${theadCols}</tr></thead><tbody>${tbodyRows}</tbody></table>
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
          <td><span class="vt-cr-id-pill">◉ ${esc(st.studentId)}</span></td>
          <td style="font-weight:700;white-space:nowrap;">${esc(st.fullName)}</td>
          ${inputsHtml}
          <td class="vt-avg-cell ${avgColorClass(avg)}" id="vtStdAvg_${esc(st.studentId)}">${avg !== '' ? Number(avg).toFixed(1) : '—'}</td>
        </tr>`;
    });

    return `
      ${saveBar}
      <div class="vt-cr-table-wrap">
        <table class="vt-cr-table">
          <thead>
            <tr>
              <th>STT</th><th>Mã HS</th><th>Họ và tên</th>
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

    let dynHeaders = '';
    state.trackingColumns.forEach(function (col) {
      const subLbl = (col.type === 'score10' ? 'Thang 10' : 'Đạt/NX') + (col.date ? ' • ' + formatDobVn(col.date) : '');
      dynHeaders += `
        <th class="${state.gradeCanEdit ? 'vt-th-editable' : ''}" data-edit-trackcol="${esc(col.id)}" title="${state.gradeCanEdit ? 'Bấm để đổi tên hoặc xóa cột này' : ''}">
          ${esc(col.name)} ${state.gradeCanEdit ? '✎' : ''}
          <span class="vt-th-sub">${esc(subLbl)}</span>
        </th>`;
    });

    let body = '';
    state.roster.forEach(function (st, rIdx) {
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
          <td><span class="vt-cr-id-pill">◉ ${esc(st.studentId)}</span></td>
          <td style="font-weight:700;white-space:nowrap;">${esc(st.fullName)}</td>
          ${cells}
          <td class="vt-avg-cell ${avgColorClass(avg)}" id="vtTrkAvg_${esc(st.studentId)}">${avg !== '' ? Number(avg).toFixed(1) : '—'}</td>
        </tr>`;
    });

    return `
      ${toolbar}
      <div class="vt-cr-table-wrap">
        <table class="vt-cr-table">
          <thead><tr><th>STT</th><th>Mã HS</th><th>Họ và tên</th>${dynHeaders}<th style="text-align:center;">TB Theo dõi</th></tr></thead>
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
        if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể lưu lớp học.'), true); return; }
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
        if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể lưu học sinh.'), true); return; }
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
        if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể nhập danh sách.'), true); return; }
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
        if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể lưu cấu trúc cột.'), true); return; }
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
          if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể xóa cột.'), true); return; }
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
          if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể lưu bảng điểm.'), true); return; }
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
          if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể lưu bảng điểm theo dõi.'), true); return; }
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
            if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể xóa lớp.'), true); return; }
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
            if (!res || !res.ok) { showToast('⚠ ' + ((res && res.error) || 'Không thể xóa học sinh.'), true); return; }
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

  function open() {
    if (!getSessionContext()) {
      console.warn('[VANTHESIS_CLASSROOM] Thiếu window.VANTHESIS_SESSION_CONTEXT.');
      return;
    }
    injectStyles();
    ensureModalDOM();
    document.getElementById(MODAL_ID).classList.add('open');
    state.isOpen = true;
    loadBootstrap();
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.remove('open');
    state.isOpen = false;
  }

  window.VANTHESIS_CLASSROOM = Object.freeze({
    open: open,
    close: close,
    refresh: loadBootstrap,
    getState: function () { return Object.assign({}, state); }
  });
})();