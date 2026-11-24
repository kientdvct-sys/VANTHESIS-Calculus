/**
 * VANTHESIS Constellation LCMS — Unified Core Kernel
 * File: vanthesis-core.js (sibling of index.html, loaded first before all sectors)
 * Namespace: window.VANTHESIS_CORE (also aliases window.VANTHESIS_POLICY)
 * Modules: Sticky Event Bus + BroadcastChannel, Single-Flight Auth & API Client,
 *          Dual-Axis 3-Tier Policy Engine, Unified IndexedDB v2 + In-Memory Fallback,
 *          Shared Google Drive Multipart Upload/Patch/Download Service, and Cosmic Liquid Glass UI Kit.
 */
(function () {
  'use strict';

  const CORE_STYLE_ID = 'vanthesis-core-ui-styles';
  const DB_NAME = 'vanthesis_constellation_cache';
  const DB_VERSION = 2;
  const SYNC_CHANNEL_NAME = 'vanthesis_constellation_sync';
  const HEARTBEAT_INTERVAL_MS = 90000;
  const HIDDEN_REVALIDATE_MS = 30000;
  const USER_IDLE_WINDOW_MS = 180000;
  const DEFAULT_API_TIMEOUT_MS = 15000;

  /* ==========================================================================
   * 0. FRIENDLY VIETNAMESE ERROR TRANSLATOR (ZERO TECHNICAL JARGON)
   * ========================================================================== */

  function translateFriendlyError(rawErr) {
    const code = String(rawErr || '').trim();
    const map = {
      UNAUTHORIZED_TOKEN: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
      FORBIDDEN_NOT_APPROVED: 'Tài khoản của bạn đang chờ Quản trị viên phê duyệt.',
      FORBIDDEN_ADMIN_ONLY: 'Thao tác này chỉ dành cho Quản trị viên hệ thống.',
      FORBIDDEN_NOT_SUBJECT_TEACHER: 'Chỉ Giáo viên Bộ môn được phân công giảng dạy hoặc Quản trị viên mới có quyền thực hiện.',
      FORBIDDEN_STUDENT_READ_ONLY: 'Tài khoản Học sinh chỉ có quyền xem và học tập tại mục này.',
      FORBIDDEN_NOT_RESOURCE_OWNER: 'Bạn chỉ có thể chỉnh sửa hoặc xóa nội dung do chính mình tạo.',
      FORBIDDEN_CLASS_OUT_OF_SCOPE: 'Bạn chỉ có thể thao tác trên các lớp thuộc phạm vi phân công.',
      FORBIDDEN_CLASS_ACCESS: 'Bạn không có quyền truy cập vào lớp học này.',
      FORBIDDEN_RESOURCE_ACCESS: 'Bạn không có quyền mở học liệu này.',
      FORBIDDEN_EXAM_ACCESS: 'Bạn không có quyền truy cập đề thi này.',
      FORBIDDEN_WHITEBOARD_OWNER: 'Bạn chỉ có thể chỉnh sửa hoặc xóa bảng viết của chính mình.',
      SERVER_BUSY: 'Hệ thống đang xử lý nhiều yêu cầu cùng lúc. Bạn vui lòng thử lại sau vài giây.',
      TIMEOUT_ERROR: 'Kết nối phản hồi chậm hơn dự kiến. Vui lòng kiểm tra đường truyền và thử lại.',
      NETWORK_ERROR: 'Không thể kết nối tới máy chủ học tập. Vui lòng kiểm tra kết nối mạng.',
      DRIVE_UPLOAD_FAILED: 'Không thể tải tệp lên Google Drive lúc này. Vui lòng thử lại sau giây lát.',
      DRIVE_DOWNLOAD_FAILED: 'Không thể tải tệp từ Google Drive. Vui lòng kiểm tra quyền truy cập tệp.',
      INVALID_COSMOS_SCOPE_KEY: 'Định danh cấp độ học liệu không hợp lệ.',
      MISSING_VAULT_ITEM_TITLE: 'Vui lòng nhập tiêu đề cho học liệu.',
      INVALID_LINK_URL: 'Liên kết cần bắt đầu bằng http:// hoặc https://.',
      VAULT_ITEM_NOT_FOUND: 'Không tìm thấy mục học liệu cần cập nhật.',
      VAULT_SCOPE_MISMATCH: 'Mục học liệu không thuộc cấp độ đang chọn.'
    };
    if (map[code]) return map[code];
    if (/^(401|403|404|500|502|503)$/.test(code)) {
      return code === '401'
        ? map.UNAUTHORIZED_TOKEN
        : (code === '403' ? 'Bạn không có quyền thực hiện thao tác này.' : 'Hệ thống tạm thời gián đoạn. Vui lòng thử lại.');
    }
    if (!code || /[A-Z0-9_]{6,}/.test(code) || /cors|fetch|json|schema|oauth|token|indexeddb|api/i.test(code)) {
      return 'Đã xảy ra sự cố kết nối tạm thời. Vui lòng thử lại sau giây lát.';
    }
    return code;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function decodeHtmlEntities(str) {
    return String(str || '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  }

  /* ==========================================================================
   * 0B. SAFE STORAGE LAYER (SafeStore) & VIETNAMESE NORMALIZATION (normVi)
   * ========================================================================== */

  const SafeStore = (function () {
    const _mem = new Map();
    const _sessionMem = new Map();
    function getLS() { try { return window.localStorage || null; } catch (e) { return null; } }
    function getSS() { try { return window.sessionStorage || null; } catch (e) { return null; } }
    return Object.freeze({
      getItem: function (key, fallback) {
        const fb = fallback === undefined ? null : fallback;
        try {
          const ls = getLS();
          if (ls) {
            const v = ls.getItem(key);
            if (v !== null && v !== undefined) return v;
          }
        } catch (e) {}
        return _mem.has(key) ? _mem.get(key) : fb;
      },
      setItem: function (key, value) {
        const s = String(value);
        _mem.set(key, s);
        try { const ls = getLS(); if (ls) ls.setItem(key, s); } catch (e) {}
      },
      removeItem: function (key) {
        _mem.delete(key);
        try { const ls = getLS(); if (ls) ls.removeItem(key); } catch (e) {}
      },
      getJSON: function (key, fallback) {
        const raw = this.getItem(key, null);
        if (!raw) return fallback === undefined ? null : fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback === undefined ? null : fallback; }
      },
      setJSON: function (key, value) {
        try { this.setItem(key, JSON.stringify(value)); } catch (e) {}
      },
      getSession: function (key, fallback) {
        const fb = fallback === undefined ? null : fallback;
        try {
          const ss = getSS();
          if (ss) {
            const v = ss.getItem(key);
            if (v !== null && v !== undefined) return v;
          }
        } catch (e) {}
        return _sessionMem.has(key) ? _sessionMem.get(key) : fb;
      },
      setSession: function (key, value) {
        const s = String(value);
        _sessionMem.set(key, s);
        try { const ss = getSS(); if (ss) ss.setItem(key, s); } catch (e) {}
      },
      clearAll: function () {
        _mem.clear();
        _sessionMem.clear();
        try { const ls = getLS(); if (ls) ls.clear(); } catch (e) {}
        try { const ss = getSS(); if (ss) ss.clear(); } catch (e) {}
      }
    });
  })();

  function normVi(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  /* ==========================================================================
   * 1. STICKY EVENT BUS & CROSS-TAB BROADCAST CHANNEL
   * ========================================================================== */

  const busListeners = Object.create(null);
  const busLastState = Object.create(null);
  let syncChannel = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      syncChannel.onmessage = function (ev) {
        const msg = ev && ev.data;
        if (!msg || !msg.event) return;
        bus.emit(msg.event, msg.detail, { broadcast: false });
      };
    }
  } catch (e) {
    syncChannel = null;
  }

  const bus = {
    on: function (eventName, callback, options) {
      if (!eventName || typeof callback !== 'function') return function () {};
      if (!busListeners[eventName]) busListeners[eventName] = [];
      busListeners[eventName].push(callback);
      const shouldReplay = !options || options.replay !== false;
      if (shouldReplay && Object.prototype.hasOwnProperty.call(busLastState, eventName)) {
        try {
          callback(busLastState[eventName]);
        } catch (err) {}
      }
      return function unsubscribe() {
        bus.off(eventName, callback);
      };
    },
    off: function (eventName, callback) {
      const list = busListeners[eventName];
      if (!list) return;
      const idx = list.indexOf(callback);
      if (idx !== -1) list.splice(idx, 1);
    },
    emit: function (eventName, detail, options) {
      if (!eventName) return;
      const opts = options || {};
      if (opts.sticky !== false) {
        busLastState[eventName] = detail;
      }
      const list = busListeners[eventName] ? busListeners[eventName].slice() : [];
      for (let i = 0; i < list.length; i++) {
        try {
          list[i](detail);
        } catch (err) {}
      }
      if (opts.broadcast && syncChannel) {
        try {
          syncChannel.postMessage({ event: eventName, detail: detail });
        } catch (e) {}
      }
    },
    getLast: function (eventName) {
      return Object.prototype.hasOwnProperty.call(busLastState, eventName)
        ? busLastState[eventName]
        : undefined;
    }
  };

  // Bridge legacy window events seamlessly into Sticky Event Bus
  window.addEventListener('vantesis:session-changed', function (ev) {
    bus.emit('session-changed', (ev && ev.detail) || window.VANTHESIS_SESSION_CONTEXT || null);
  });
  window.addEventListener('vanthesis:session-changed', function (ev) {
    bus.emit('session-changed', (ev && ev.detail) || window.VANTHESIS_SESSION_CONTEXT || null);
  });
  window.addEventListener('vantesis:sector-changed', function (ev) {
    bus.emit('sector-changed', (ev && ev.detail) || { sector: 'resources' });
  });
  window.addEventListener('vanthesis:sector-changed', function (ev) {
    bus.emit('sector-changed', (ev && ev.detail) || { sector: 'resources' });
  });

  if (window.VANTHESIS_SESSION_CONTEXT) {
    busLastState['session-changed'] = window.VANTHESIS_SESSION_CONTEXT;
  }

  /* ==========================================================================
   * 2. AUTH SESSION MANAGER (SINGLE-FLIGHT REFRESH) & STANDARD API CLIENT
   * ========================================================================== */

  let inFlightRefreshPromise = null;
  let currentSyncRev = 0;
  let heartbeatTimer = null;

  function checkSignedIn() {
    const ctx = window.VANTHESIS_SESSION_CONTEXT;
    return Boolean(ctx && (ctx.isSignedIn || ctx.email || ctx.accessToken));
  }

  function ensureValidTokenSingleFlight() {
    if (inFlightRefreshPromise) return inFlightRefreshPromise;
    inFlightRefreshPromise = (async function () {
      try {
        if (typeof window.VANTHESIS_REFRESH_TOKEN !== 'function') return false;
        const ok = await window.VANTHESIS_REFRESH_TOKEN();
        if (ok && window.VANTHESIS_SESSION_CONTEXT) {
          bus.emit('session-changed', window.VANTHESIS_SESSION_CONTEXT);
        }
        return Boolean(ok);
      } catch (e) {
        return false;
      } finally {
        inFlightRefreshPromise = null;
      }
    })();
    return inFlightRefreshPromise;
  }

  const auth = Object.freeze({
    setSession: function (ctx) {
      if (!ctx || typeof ctx !== 'object') {
        auth.clearSession();
        return null;
      }
      const next = Object.assign({}, ctx, {
        email: ctx.email ? String(ctx.email).trim().toLowerCase() : '',
        isSignedIn: Boolean(ctx.isSignedIn || ctx.email || ctx.accessToken)
      });
      window.VANTHESIS_SESSION_CONTEXT = next;
      bus.emit('session-changed', next);
      return next;
    },
    getSession: function () {
      const ctx = window.VANTHESIS_SESSION_CONTEXT;
      if (!ctx || (!ctx.email && !ctx.accessToken)) return null;
      return ctx;
    },
    clearSession: function () {
      window.VANTHESIS_SESSION_CONTEXT = null;
      if (typeof api !== 'undefined' && api && typeof api.stopHeartbeat === 'function') {
        api.stopHeartbeat();
      }
      bus.emit('session-changed', null);
    },
    isSignedIn: checkSignedIn,
    isLoggedIn: checkSignedIn,
    isAuthenticated: checkSignedIn,
    getEmail: function () {
      const s = auth.getSession();
      return s && s.email ? String(s.email).trim().toLowerCase() : '';
    },
    getToken: function () {
      const s = auth.getSession();
      return s ? String(s.accessToken || '') : '';
    },
    getAccessToken: function () {
      const s = auth.getSession();
      return s ? String(s.accessToken || '') : '';
    },
    ensureValidToken: ensureValidTokenSingleFlight,
    refreshToken: ensureValidTokenSingleFlight
  });

  function updateSyncRevIfNewer(rev, broadcast) {
    const n = Number(rev);
    if (!isFinite(n) || n <= 0) return;
    if (n > currentSyncRev) {
      currentSyncRev = n;
      bus.emit('sync-rev-changed', { syncRev: currentSyncRev }, { broadcast: Boolean(broadcast) });
    }
  }

  const inFlightRequests = new Map();
  let lastUserActivityTs = Date.now();
  let hiddenSinceTs = 0;
  let visibilityWired = false;

  function markUserActive() {
    lastUserActivityTs = Date.now();
  }

  function wireSmartSyncListeners() {
    if (visibilityWired || typeof document === 'undefined') return;
    visibilityWired = true;
    ['pointerdown', 'keydown', 'scroll'].forEach(function (evt) {
      window.addEventListener(evt, markUserActive, { passive: true });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        hiddenSinceTs = Date.now();
      } else if (document.visibilityState === 'visible') {
        markUserActive();
        const awayMs = hiddenSinceTs ? (Date.now() - hiddenSinceTs) : 0;
        hiddenSinceTs = 0;
        if (awayMs >= HIDDEN_REVALIDATE_MS && auth.isSignedIn()) {
          api.post('sync_heartbeat', {}, { timeoutMs: 10000, silent: true }).catch(function () {});
        }
      }
    });
  }

  function buildDedupeKey(action, payload, opts) {
    if (opts && opts.dedupeKey) return String(opts.dedupeKey);
    try {
      return action + ':' + JSON.stringify(payload || {});
    } catch (e) {
      return action + ':' + Date.now();
    }
  }

  const api = {
    getSyncRev: function () {
      return currentSyncRev;
    },
    post: async function (action, payload, options) {
      const opts = options || {};
      const sess = auth.getSession();
      if (!sess || !sess.bridgeUrl || !sess.accessToken) {
        return { ok: false, error: translateFriendlyError('UNAUTHORIZED_TOKEN'), rawError: 'UNAUTHORIZED_TOKEN' };
      }

      const useDedupe = opts.dedupe !== false && !opts._retried;
      const dedupeKey = useDedupe ? buildDedupeKey(action, payload, opts) : '';

      if (useDedupe && inFlightRequests.has(dedupeKey)) {
        const prev = inFlightRequests.get(dedupeKey);
        if (opts.cancelPrevious && prev.controller) {
          try { prev.controller.abort(); } catch (e) {}
          inFlightRequests.delete(dedupeKey);
        } else {
          return prev.promise;
        }
      }

      const timeoutMs = Math.max(3000, Number(opts.timeoutMs) || DEFAULT_API_TIMEOUT_MS);
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timedOut = false;
      const timer = controller ? setTimeout(function () {
        timedOut = true;
        try { controller.abort(); } catch (e) {}
      }, timeoutMs) : null;

      const execPromise = (async function () {
        try {
          const reqBody = Object.assign({ action: action, accessToken: sess.accessToken }, payload || {});
          const resp = await fetch(sess.bridgeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(reqBody),
            signal: controller ? controller.signal : undefined
          });
          if (timer) clearTimeout(timer);

          if (resp.status === 401 && !opts._retried) {
            const refreshed = await auth.refreshToken();
            if (refreshed) {
              return api.post(action, payload, Object.assign({}, opts, { _retried: true, dedupe: false }));
            }
            return { ok: false, error: translateFriendlyError('UNAUTHORIZED_TOKEN'), rawError: 'UNAUTHORIZED_TOKEN' };
          }

          const data = await resp.json();
          if (data && !data.ok && data.error === 'UNAUTHORIZED_TOKEN' && !opts._retried) {
            const refreshed = await auth.refreshToken();
            if (refreshed) {
              return api.post(action, payload, Object.assign({}, opts, { _retried: true, dedupe: false }));
            }
          }
          if (data && data.syncRev) {
            updateSyncRevIfNewer(data.syncRev, action !== 'sync_heartbeat');
          }
          if (data && !data.ok) {
            return Object.assign({}, data, {
              rawError: data.error,
              error: translateFriendlyError(data.error)
            });
          }
          return data;
        } catch (err) {
          if (timer) clearTimeout(timer);
          const isAbort = err && err.name === 'AbortError';
          if (isAbort && !timedOut) {
            return { ok: false, aborted: true, error: '', rawError: 'ABORTED' };
          }
          const code = timedOut ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR';
          const friendly = translateFriendlyError(code);
          if (timedOut && !opts.silent && typeof ui !== 'undefined' && ui && typeof ui.toast === 'function') {
            const retryCb = typeof opts.onRetry === 'function'
              ? opts.onRetry
              : function () { api.post(action, payload, Object.assign({}, opts, { dedupe: false })); };
            ui.toast(friendly, 'warning', { retryLabel: 'Thử lại', onRetry: retryCb });
          }
          return { ok: false, timedOut: timedOut, error: friendly, rawError: code };
        } finally {
          if (useDedupe && inFlightRequests.get(dedupeKey) && inFlightRequests.get(dedupeKey).controller === controller) {
            inFlightRequests.delete(dedupeKey);
          }
        }
      })();

      if (useDedupe) {
        inFlightRequests.set(dedupeKey, { controller: controller, promise: execPromise });
      }
      return execPromise;
    },
    staleWhileRevalidate: async function (opts) {
      const o = opts || {};
      let cached = null;
      if (o.store && o.key) {
        try {
          cached = await db.get(o.store, o.key);
          if (cached && typeof o.onData === 'function') {
            o.onData(cached, { fromCache: true });
          }
        } catch (e) {}
      }
      const revalidatePromise = Promise.resolve().then(function () {
        return typeof o.fetchFn === 'function' ? o.fetchFn() : null;
      }).then(async function (fresh) {
        if (fresh && fresh.ok !== false) {
          if (o.store && o.key) {
            try { await db.set(o.store, Object.assign({ key: o.key }, fresh)); } catch (e) {}
          }
          if (typeof o.onData === 'function') {
            o.onData(fresh, { fromCache: false });
          }
        }
        return fresh;
      }).catch(function () { return null; });

      return cached || revalidatePromise;
    },
    startHeartbeat: function () {
      wireSmartSyncListeners();
      if (heartbeatTimer) return;
      heartbeatTimer = setInterval(async function () {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        if (Date.now() - lastUserActivityTs > USER_IDLE_WINDOW_MS) return;
        if (!auth.isSignedIn()) return;
        await api.post('sync_heartbeat', {}, { timeoutMs: 10000, silent: true });
      }, HEARTBEAT_INTERVAL_MS);
    },
    stopHeartbeat: function () {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }
  };
  api.call = api.post;
  api.request = api.post;

  bus.on('session-changed', function (s) {
    if (s && s.accessToken) api.startHeartbeat();
    else api.stopHeartbeat();
  });

  /* ==========================================================================
   * 3. DUAL-AXIS 3-TIER POLICY ENGINE (VANTHESIS_CORE.policy)
   * ========================================================================== */

  function parseClassListArray(raw) {
    if (Array.isArray(raw)) {
      return raw.map(function (c) { return String(c || '').trim(); }).filter(Boolean);
    }
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(/[,;|]+/).map(function (c) { return c.trim(); }).filter(Boolean);
    }
    return [];
  }

  function normKey(val) {
    return String(val || '').trim().toUpperCase();
  }

  function resolvePolicyState() {
    const ctx = window.VANTHESIS_SESSION_CONTEXT || {};
    const rawRole = normKey(ctx.assignedRole || ctx.role || '');
    const isAdmin = Boolean(ctx.isAdmin || rawRole === 'SUPER_ADMIN');
    const isTeacher = !isAdmin && (rawRole === 'TEACHER' || rawRole === 'HOMEROOM_TEACHER' || rawRole === 'SUBJECT_TEACHER');
    const isStudent = !isAdmin && !isTeacher && rawRole === 'STUDENT';

    const hrSet = [];
    const pushHr = function (c) {
      const k = String(c || '').trim();
      if (k && hrSet.indexOf(k) === -1) hrSet.push(k);
    };
    parseClassListArray(ctx.homeroomClasses).forEach(pushHr);
    parseClassListArray(ctx.homeroomClass).forEach(pushHr);

    const rawAssigns = Array.isArray(ctx.teachingAssignments) ? ctx.teachingAssignments : [];
    const teachingAssignments = [];
    rawAssigns.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      const subject = String(item.subject || '').trim();
      const classIds = parseClassListArray(item.classIds && item.classIds.length ? item.classIds : item.classes);
      if (subject && classIds.length) {
        teachingAssignments.push({ subject: subject, classIds: classIds });
      }
    });

    return {
      isAdmin: isAdmin,
      isTeacher: isTeacher,
      isStudent: isStudent,
      studentClass: String(ctx.className || ctx.studentClass || '').trim(),
      homeroomClasses: hrSet,
      teachingAssignments: teachingAssignments
    };
  }

  const policy = Object.freeze({
    isAdmin: function () { return resolvePolicyState().isAdmin; },
    isTeacher: function () { return resolvePolicyState().isTeacher; },
    isStudent: function () { return resolvePolicyState().isStudent; },
    isSubjectTeacher: function () {
      const st = resolvePolicyState();
      return st.isAdmin || (st.isTeacher && st.teachingAssignments.length > 0);
    },
    isHomeroomTeacher: function (classId) {
      const st = resolvePolicyState();
      if (st.isAdmin) return true;
      if (!st.isTeacher || !st.homeroomClasses.length) return false;
      if (!classId) return true;
      const target = normKey(classId);
      return st.homeroomClasses.some(function (c) { return normKey(c) === target; });
    },
    getTeachingClasses: function () {
      const st = resolvePolicyState();
      const out = [];
      st.teachingAssignments.forEach(function (a) {
        a.classIds.forEach(function (cid) {
          if (out.indexOf(cid) === -1) out.push(cid);
        });
      });
      return out;
    },
    getAllMyClasses: function () {
      const st = resolvePolicyState();
      const out = st.homeroomClasses.slice();
      policy.getTeachingClasses().forEach(function (cid) {
        if (out.indexOf(cid) === -1) out.push(cid);
      });
      if (st.isStudent && st.studentClass && out.indexOf(st.studentClass) === -1) {
        out.push(st.studentClass);
      }
      return out;
    },
    can: function (action, target) {
      const st = resolvePolicyState();
      if (st.isAdmin) return true;
      const act = String(action || '').trim().toLowerCase();
      const tgt = target || {};

      if (act === 'moderate_publish' || act === 'manage_system' || act === 'manage_users' || act === 'manage_permissions') {
        return false;
      }
      if (act === 'upload_resource' || act === 'upload_exam') {
        return st.isTeacher && st.teachingAssignments.length > 0;
      }
      if (act === 'manage_roster') {
        if (!st.isTeacher || !st.homeroomClasses.length) return false;
        if (!tgt.classId && !tgt.className) return true;
        const tKey = normKey(tgt.classId || tgt.className);
        return st.homeroomClasses.some(function (c) { return normKey(c) === tKey; });
      }
      if (act === 'edit_grade') {
        if (!st.isTeacher || !st.teachingAssignments.length) return false;
        const reqSubj = normKey(tgt.subject);
        const reqCls = normKey(tgt.classId || tgt.className);
        if (!reqSubj && !reqCls) return true;
        return st.teachingAssignments.some(function (a) {
          const subjOk = !reqSubj || normKey(a.subject) === reqSubj;
          const clsOk = !reqCls || a.classIds.some(function (c) { return normKey(c) === reqCls; });
          return subjOk && clsOk;
        });
      }
      return false;
    },
    getScopeBadge: function () {
      const st = resolvePolicyState();
      if (st.isAdmin) return 'Quản trị viên • Toàn quyền';
      if (st.isTeacher) {
        const parts = [];
        if (st.homeroomClasses.length) {
          parts.push('GVCN ' + st.homeroomClasses.join(', '));
        }
        if (st.teachingAssignments.length) {
          const subjects = [];
          st.teachingAssignments.forEach(function (a) {
            if (subjects.indexOf(a.subject) === -1) subjects.push(a.subject);
          });
          const clsCount = policy.getTeachingClasses().length;
          parts.push('GVBM ' + subjects.join(', ') + ' (' + clsCount + ' lớp)');
        }
        return parts.length ? parts.join(' · ') : 'Giáo viên';
      }
      if (st.isStudent) {
        return st.studentClass ? ('Học sinh • ' + st.studentClass) : 'Học sinh';
      }
      return 'Không gian Học tập';
    }
  });

  window.VANTHESIS_POLICY = policy;

  /* ==========================================================================
   * 4. UNIFIED INDEXEDDB V2 (WITH INCOGNITO FALLBACK) & SHARED GOOGLE DRIVE SERVICE
   * ========================================================================== */

  const memoryFallbackDb = Object.create(null);
  let dbPromise = null;

  function openUnifiedDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (ev) {
          const idb = ev.target.result;
          if (!idb.objectStoreNames.contains('resources_cache')) {
            idb.createObjectStore('resources_cache', { keyPath: 'key' });
          }
          if (!idb.objectStoreNames.contains('exam_drafts')) {
            idb.createObjectStore('exam_drafts', { keyPath: 'examId' });
          }
          if (!idb.objectStoreNames.contains('slate_drafts')) {
            idb.createObjectStore('slate_drafts', { keyPath: 'boardId' });
          }
          // Preserve compatibility stores used by earlier modules
          if (!idb.objectStoreNames.contains('hub_cache')) {
            idb.createObjectStore('hub_cache', { keyPath: 'email' });
          }
          if (!idb.objectStoreNames.contains('whiteboard_drafts')) {
            idb.createObjectStore('whiteboard_drafts', { keyPath: 'boardId' });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  function getMemStore(storeName) {
    if (!memoryFallbackDb[storeName]) memoryFallbackDb[storeName] = Object.create(null);
    return memoryFallbackDb[storeName];
  }

  function extractKeyForStore(storeName, val) {
    if (!val || typeof val !== 'object') return String(Date.now());
    if (storeName === 'exam_drafts') return String(val.examId || val.key || Date.now());
    if (storeName === 'slate_drafts' || storeName === 'whiteboard_drafts') return String(val.boardId || Date.now());
    if (storeName === 'hub_cache') return String(val.email || Date.now());
    return String(val.key || val.id || Date.now());
  }

  const db = {
    get: async function (storeName, key) {
      const idb = await openUnifiedDb();
      if (!idb || !idb.objectStoreNames.contains(storeName)) {
        return getMemStore(storeName)[key] || null;
      }
      return new Promise(function (resolve) {
        try {
          const tx = idb.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).get(key);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(getMemStore(storeName)[key] || null); };
        } catch (e) {
          resolve(getMemStore(storeName)[key] || null);
        }
      });
    },
    set: async function (storeName, value) {
      const k = extractKeyForStore(storeName, value);
      getMemStore(storeName)[k] = value;
      const idb = await openUnifiedDb();
      if (!idb || !idb.objectStoreNames.contains(storeName)) return true;
      return new Promise(function (resolve) {
        try {
          const tx = idb.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put(value);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (e) {
          resolve(false);
        }
      });
    },
    remove: async function (storeName, key) {
      delete getMemStore(storeName)[key];
      const idb = await openUnifiedDb();
      if (!idb || !idb.objectStoreNames.contains(storeName)) return true;
      return new Promise(function (resolve) {
        try {
          const tx = idb.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).delete(key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (e) {
          resolve(false);
        }
      });
    },
    getAll: async function (storeName) {
      const idb = await openUnifiedDb();
      if (!idb || !idb.objectStoreNames.contains(storeName)) {
        const m = getMemStore(storeName);
        return Object.keys(m).map(function (k) { return m[k]; });
      }
      return new Promise(function (resolve) {
        try {
          const tx = idb.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
          req.onerror = function () { resolve([]); };
        } catch (e) {
          resolve([]);
        }
      });
    }
  };

  /* ---- Shared Google Drive Service ---- */

  const folderIdCache = Object.create(null);

  async function driveFetch(url, init, _retried) {
    const token = auth.getAccessToken();
    if (!token) throw new Error(translateFriendlyError('UNAUTHORIZED_TOKEN'));
    const headers = Object.assign({}, (init && init.headers) || {}, {
      Authorization: 'Bearer ' + token
    });
    const resp = await fetch(url, Object.assign({}, init || {}, { headers: headers }));
    if (resp.status === 401 && !_retried) {
      const ok = await auth.refreshToken();
      if (ok) return driveFetch(url, init, true);
    }
    return resp;
  }

  function xhrMultipartUpload(url, method, formData, token, onProgress) {
    return new Promise(function (resolve, reject) {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.upload.onprogress = function (ev) {
        if (ev.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
        }
      };
      xhr.onload = function () {
        if (xhr.status === 401) {
          reject({ status: 401 });
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            if (typeof onProgress === 'function') onProgress(100);
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error(translateFriendlyError('DRIVE_UPLOAD_FAILED')));
          }
        } else {
          reject(new Error(translateFriendlyError('DRIVE_UPLOAD_FAILED')));
        }
      };
      xhr.onerror = function () {
        reject(new Error(translateFriendlyError('NETWORK_ERROR')));
      };
      xhr.send(formData);
    });
  }

  const drive = {
    parseDriveLink: function (urlOrId) {
      const raw = String(urlOrId || '').trim();
      if (!raw) return '';
      const m1 = raw.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
      if (m1) return m1[1];
      const m2 = raw.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
      if (m2) return m2[1];
      const m3 = raw.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
      if (m3) return m3[1];
      if (/^[a-zA-Z0-9_-]{15,}$/.test(raw)) return raw;
      return '';
    },
    ensureFolder: async function (folderName) {
      const name = String(folderName || 'VANTHESIS_Hoc_Lieu').trim();
      if (folderIdCache[name]) return folderIdCache[name];
      const q = encodeURIComponent("name='" + name.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      const listResp = await driveFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)&pageSize=1', { method: 'GET' });
      if (listResp.ok) {
        const ld = await listResp.json();
        if (ld.files && ld.files[0] && ld.files[0].id) {
          folderIdCache[name] = ld.files[0].id;
          return ld.files[0].id;
        }
      }
      const createResp = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.folder' })
      });
      if (!createResp.ok) throw new Error(translateFriendlyError('DRIVE_UPLOAD_FAILED'));
      const cd = await createResp.json();
      folderIdCache[name] = cd.id;
      return cd.id;
    },
    ensureSubFolder: async function (parentFolderName, subFolderName) {
      const parentName = String(parentFolderName || 'VANTHESIS_Bang_Giang').trim();
      const subName = String(subFolderName || '').trim();
      if (!subName || subName === 'Chung') {
        return drive.ensureFolder(parentName);
      }
      const cacheKey = parentName + '::' + subName;
      if (folderIdCache[cacheKey]) return folderIdCache[cacheKey];

      const parentId = await drive.ensureFolder(parentName);
      const safeSub = subName.replace(/'/g, "\\'");
      const q = encodeURIComponent("name='" + safeSub + "' and '" + parentId + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false");
      const listResp = await driveFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)&pageSize=1', { method: 'GET' });
      if (listResp.ok) {
        const ld = await listResp.json();
        if (ld.files && ld.files[0] && ld.files[0].id) {
          folderIdCache[cacheKey] = ld.files[0].id;
          return ld.files[0].id;
        }
      }
      const createResp = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
      });
      if (!createResp.ok) throw new Error(translateFriendlyError('DRIVE_UPLOAD_FAILED'));
      const cd = await createResp.json();
      folderIdCache[cacheKey] = cd.id;
      return cd.id;
    },
    uploadFile: async function (opts, _retried) {
      const o = opts || {};
      const token = auth.getAccessToken();
      if (!token) throw new Error(translateFriendlyError('UNAUTHORIZED_TOKEN'));

      const mimeType = o.mimeType || (o.fileOrBlob && o.fileOrBlob.type) || 'application/octet-stream';
      const fileName = o.fileName || (o.fileOrBlob && o.fileOrBlob.name) || 'tai_lieu';
      const isPatch = Boolean(o.existingFileId);

      let metadata;
      let endpoint;
      let method;
      if (isPatch) {
        metadata = { name: fileName, mimeType: mimeType };
        endpoint = 'https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(o.existingFileId) + '?uploadType=multipart&fields=id,name,mimeType';
        method = 'PATCH';
      } else {
        const folderId = o.subFolderName ? await drive.ensureSubFolder(o.folderName || 'VANTHESIS_Bang_Giang', o.subFolderName) : await drive.ensureFolder(o.folderName || 'VANTHESIS_Hoc_Lieu');
        metadata = { name: fileName, mimeType: mimeType, parents: [folderId] };
        endpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType';
        method = 'POST';
      }

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', o.fileOrBlob, fileName);

      let uploaded;
      try {
        uploaded = await xhrMultipartUpload(endpoint, method, form, token, o.onProgress);
      } catch (err) {
        if (err && err.status === 401 && !_retried) {
          const ok = await auth.refreshToken();
          if (ok) return drive.uploadFile(o, true);
        }
        throw err instanceof Error ? err : new Error(translateFriendlyError('DRIVE_UPLOAD_FAILED'));
      }

      if (o.makePublicViewer && uploaded && uploaded.id) {
        try {
          await driveFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(uploaded.id) + '/permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
          });
        } catch (e) {}
      }

      const fid = uploaded.id;
      return {
        fileId: fid,
        name: uploaded.name || fileName,
        mimeType: uploaded.mimeType || mimeType,
        previewUrl: 'https://drive.google.com/file/d/' + fid + '/preview',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fid
      };
    },
    downloadText: async function (fileId) {
      const fid = drive.parseDriveLink(fileId);
      if (!fid) throw new Error(translateFriendlyError('DRIVE_DOWNLOAD_FAILED'));
      const resp = await driveFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fid) + '?alt=media', { method: 'GET' });
      if (!resp.ok) throw new Error(translateFriendlyError('DRIVE_DOWNLOAD_FAILED'));
      return resp.text();
    },
    downloadBlob: async function (fileId) {
      const fid = drive.parseDriveLink(fileId);
      if (!fid) throw new Error(translateFriendlyError('DRIVE_DOWNLOAD_FAILED'));
      const resp = await driveFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fid) + '?alt=media', { method: 'GET' });
      if (!resp.ok) throw new Error(translateFriendlyError('DRIVE_DOWNLOAD_FAILED'));
      return resp.blob();
    }
  };

  /* ==========================================================================
   * 5. UNIFIED COSMIC LIQUID GLASS UX KIT (VANTHESIS_CORE.ui)
   * ========================================================================== */

  function ensureCoreStyles() {
    if (typeof document === 'undefined' || document.getElementById(CORE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = CORE_STYLE_ID;
    style.textContent = `
      :root, html[data-theme="light"] {
        color-scheme: only light;
        --vt-cosmos-bg: #FAF8F3;
        --vt-cosmos-bg-deep: #F2ECE0;
        --vt-cosmos-surface: rgba(255, 253, 248, 0.94);
        --vt-cosmos-surface-strong: rgba(255, 254, 250, 0.97);
        --vt-cosmos-text: #0F172A;
        --vt-cosmos-text-muted: #475569;
        --vt-cosmos-gold: #B45309;
        --vt-cosmos-cobalt: #1D4ED8;
        --vt-cosmos-meridian: rgba(180, 83, 9, 0.08);
        --vt-cosmos-border: rgba(15, 23, 42, 0.11);
        --vt-cosmos-border-hover: rgba(29, 78, 216, 0.36);
        --vt-cosmos-border-top: rgba(255, 255, 255, 0.88);
        --vt-cosmos-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.10);
        --vt-cosmos-radius-outer: 30px;
        --vt-cosmos-radius-frame: 22px;
        --vt-cosmos-radius-card: 16px;
        --vt-cosmos-radius-pill: 9999px;
        --vt-cosmos-font-display: 'Cormorant Garamond', 'Newsreader', Georgia, serif;
        --vt-cosmos-font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        --vt-cosmos-font-mono: 'JetBrains Mono', ui-monospace, monospace;
        --vt-cosmos-ease: cubic-bezier(0.22, 1, 0.36, 1);
      }
      html[data-theme="dark"] {
        color-scheme: dark;
        --vt-cosmos-bg: #030613;
        --vt-cosmos-bg-deep: #070E24;
        --vt-cosmos-surface: rgba(10, 17, 38, 0.92);
        --vt-cosmos-surface-strong: rgba(12, 20, 44, 0.96);
        --vt-cosmos-text: #F1F5F9;
        --vt-cosmos-text-muted: #94A3B8;
        --vt-cosmos-gold: #FBBF24;
        --vt-cosmos-cobalt: #38BDF8;
        --vt-cosmos-meridian: rgba(148, 163, 184, 0.08);
        --vt-cosmos-border: rgba(148, 163, 184, 0.20);
        --vt-cosmos-border-hover: rgba(56, 189, 248, 0.45);
        --vt-cosmos-border-top: rgba(255, 255, 255, 0.20);
        --vt-cosmos-shadow: 0 16px 38px -12px rgba(2, 6, 23, 0.56);
      }
      :root {
        --vt-spec-thcs: #10B981;
        --vt-spec-thpt: #38BDF8;
        --vt-spec-uni: #A78BFA;
        --vt-spec-exam: #F59E0B;
        --vt-spec-intl: #FB7185;
      }
      html[data-atmosphere="deep"] {
        color-scheme: dark;
        --vt-cosmos-bg: #040712;
        --vt-cosmos-bg-deep: #070E24;
        --vt-cosmos-surface: rgba(10, 16, 34, 0.86);
        --vt-cosmos-surface-strong: rgba(12, 20, 44, 0.94);
        --vt-cosmos-text: #F1F5F9;
        --vt-cosmos-text-muted: #94A3B8;
        --vt-cosmos-border: rgba(148, 163, 184, 0.20);
        --vt-cosmos-border-top: rgba(255, 255, 255, 0.18);
      }
      html[data-atmosphere="aurora"] {
        color-scheme: dark;
        --vt-cosmos-bg: #070D1F;
        --vt-cosmos-bg-deep: #0D1B34;
        --vt-cosmos-surface: rgba(13, 25, 48, 0.86);
        --vt-cosmos-surface-strong: rgba(16, 30, 58, 0.94);
        --vt-cosmos-text: #F0FDF4;
        --vt-cosmos-text-muted: #A7F3D0;
        --vt-cosmos-border: rgba(52, 211, 153, 0.26);
        --vt-cosmos-border-top: rgba(167, 243, 208, 0.24);
      }
      html[data-atmosphere="light"] {
        color-scheme: only light;
        --vt-cosmos-bg: #F3F6FB;
        --vt-cosmos-bg-deep: #E8EEF7;
        --vt-cosmos-surface: rgba(255, 255, 255, 0.86);
        --vt-cosmos-surface-strong: rgba(255, 255, 255, 0.95);
        --vt-cosmos-text: #0F172A;
        --vt-cosmos-text-muted: #475569;
        --vt-cosmos-border: rgba(15, 23, 42, 0.12);
        --vt-cosmos-border-top: rgba(255, 255, 255, 0.92);
      }

      /* 60fps Lightweight Translucent Cards (Zero backdrop-filter on repeating lists, pure CSS hover) */
      .vtc-glass-card, .vt-bento-card {
        position: relative;
        background: var(--vt-cosmos-surface);
        border: 1px solid var(--vt-cosmos-border);
        border-top: 1px solid var(--vt-cosmos-border-top);
        border-radius: var(--vt-cosmos-radius-frame);
        box-shadow: var(--vt-cosmos-shadow);
        transition: border-color 150ms ease, transform 150ms ease;
      }
      .vtc-glass-card:hover, .vt-bento-card:hover {
        border-color: var(--vt-cosmos-border-hover);
        transform: translateY(-2px);
      }
      .vtc-glass-subcard {
        border-radius: var(--vt-cosmos-radius-card);
        background: var(--vt-cosmos-surface);
        border: 1px solid var(--vt-cosmos-border);
        border-top: 1px solid var(--vt-cosmos-border-top);
      }

      .vtc-toast-host {
        position: fixed;
        top: calc(16px + env(safe-area-inset-top, 0px));
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        max-width: min(520px, 92vw);
      }
      .vtc-toast {
        pointer-events: auto;
        padding: 10px 18px;
        border-radius: var(--vt-cosmos-radius-pill);
        background: rgba(8, 14, 34, 0.92);
        color: #F8FAFC;
        border: 1px solid rgba(148, 163, 184, 0.30);
        border-top: 1px solid rgba(255, 255, 255, 0.22);
        box-shadow: 0 16px 38px rgba(2, 6, 23, 0.42);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        font-family: var(--vt-cosmos-font-sans);
        font-size: 13.5px;
        font-weight: 700;
        line-height: 1.45;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity 160ms ease, transform 160ms ease;
      }
      .vtc-toast.visible {
        opacity: 1;
        transform: translateY(0);
      }
      html[data-theme="light"] .vtc-toast {
        background: rgba(255, 253, 248, 0.96);
        color: #0F172A;
        border-color: rgba(15, 23, 42, 0.14);
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14);
      }
      .vtc-toast.success { border-color: rgba(16, 185, 129, 0.65); }
      .vtc-toast.warning { border-color: rgba(245, 158, 11, 0.68); }
      .vtc-toast.error { border-color: rgba(239, 68, 68, 0.72); }
      .vtc-toast-retry {
        padding: 4px 11px;
        border-radius: 9999px;
        border: 1px solid rgba(56, 189, 248, 0.55);
        background: rgba(37, 99, 235, 0.18);
        color: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .vtc-confirm-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9998;
        background: rgba(3, 6, 19, 0.52);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .vtc-confirm-card {
        width: min(430px, 94vw);
        border-radius: var(--vt-cosmos-radius-outer);
        padding: 24px;
        background: var(--vt-cosmos-surface-strong);
        color: var(--vt-cosmos-text);
        border: 1px solid var(--vt-cosmos-border);
        border-top: 1px solid var(--vt-cosmos-border-top);
        box-shadow: var(--vt-cosmos-shadow);
        font-family: var(--vt-cosmos-font-sans);
      }
      .vtc-confirm-title {
        margin: 0 0 8px;
        font-family: var(--vt-cosmos-font-display);
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .vtc-confirm-msg {
        margin: 0 0 18px;
        font-size: 13.8px;
        line-height: 1.58;
        color: var(--vt-cosmos-text-muted);
      }
      .vtc-confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .vtc-btn {
        padding: 9px 18px;
        border-radius: var(--vt-cosmos-radius-pill);
        border: 1px solid var(--vt-cosmos-border);
        background: var(--vt-cosmos-surface);
        color: var(--vt-cosmos-text);
        font-family: var(--vt-cosmos-font-sans);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: border-color 150ms ease, transform 150ms ease;
      }
      .vtc-btn:hover { transform: translateY(-1px); border-color: var(--vt-cosmos-border-hover); }
      .vtc-btn-primary {
        background: linear-gradient(135deg, #1D4ED8, #2563EB);
        color: #FFFFFF;
        border-color: transparent;
      }
      .vtc-btn-danger {
        background: linear-gradient(135deg, #DC2626, #B91C1C);
        color: #FFFFFF;
        border-color: transparent;
      }
      .vtc-skeleton-wrap {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 6px 0;
      }
      .vtc-skeleton-line {
        height: 14px;
        border-radius: 9999px;
        background: linear-gradient(90deg, rgba(148,163,184,0.14) 25%, rgba(148,163,184,0.28) 50%, rgba(148,163,184,0.14) 75%);
        background-size: 200% 100%;
        animation: vtcSkelPulse 1.4s ease-in-out infinite;
      }
      @keyframes vtcSkelPulse {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureCoreStyles);
    } else {
      ensureCoreStyles();
    }
  }

  let activeToastTimer = null;

  function formatFallbackMath(expr, displayMode) {
    let s = escapeHtml(decodeHtmlEntities(expr || '').trim());
    for (let pass = 0; pass < 2; pass++) {
      s = s.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="vtc-mf-frac"><span class="vtc-mf-num">$1</span><span class="vtc-mf-den">$2</span></span>');
    }
    s = s.replace(/\\sqrt\{([^{}]+)\}/g, '<span class="vtc-mf-sqrt">&radic;<span class="vtc-mf-rad">$1</span></span>');
    s = s.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>').replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
    s = s.replace(/\^([a-zA-Z0-9\-+])/g, '<sup>$1</sup>').replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
    const syms = [
      [/\\Rightarrow/g, '&rArr;'], [/\\Leftrightarrow/g, '&hArr;'], [/\\rightarrow|\\to\b/g, '&rarr;'],
      [/\\le\b|\\leq\b/g, '&le;'], [/\\ge\b|\\geq\b/g, '&ge;'], [/\\neq\b|\\ne\b/g, '&ne;'],
      [/\\pm\b/g, '&plusmn;'], [/\\times\b/g, '&times;'], [/\\cdot\b/g, '&middot;'],
      [/\\infty\b/g, '&infin;'], [/\\int\b/g, '&int;'], [/\\sum\b/g, '&sum;'],
      [/\\Delta\b/g, '&Delta;'], [/\\pi\b/g, '&pi;'], [/\\alpha\b/g, '&alpha;'],
      [/\\beta\b/g, '&beta;'], [/\\theta\b/g, '&theta;'], [/\\left|\\right|\\,/g, '']
    ];
    for (let i = 0; i < syms.length; i++) s = s.replace(syms[i][0], syms[i][1]);
    return displayMode ? '<div class="vtc-mf-block">' + s + '</div>' : '<span class="vtc-mf-inline">' + s + '</span>';
  }

  function renderMathText(rawText) {
    let safe = escapeHtml(rawText || '');
    const useKatex = Boolean(window.katex && typeof window.katex.renderToString === 'function');
    safe = safe.replace(/\$\$([\s\S]+?)\$\$/g, function (_m, expr) {
      if (useKatex) {
        try { return '<div class="vtc-mf-block">' + window.katex.renderToString(decodeHtmlEntities(expr), { throwOnError: false, displayMode: true }) + '</div>'; }
        catch (e) { return formatFallbackMath(expr, true); }
      }
      return formatFallbackMath(expr, true);
    });
    safe = safe.replace(/\$([^$\n]+)\$/g, function (_m, expr) {
      if (useKatex) {
        try { return window.katex.renderToString(decodeHtmlEntities(expr), { throwOnError: false, displayMode: false }); }
        catch (e) { return formatFallbackMath(expr, false); }
      }
      return formatFallbackMath(expr, false);
    });
    return safe.replace(/\n/g, '<br>');
  }

  const ui = {
    toast: function (message, type, actionOpts) {
      if (typeof document === 'undefined') return;
      ensureCoreStyles();
      let host = document.getElementById('vtcToastHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'vtcToastHost';
        host.className = 'vtc-toast-host';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
      }
      const kind = ['info', 'success', 'warning', 'error'].indexOf(type) !== -1 ? type : 'info';
      host.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'vtc-toast ' + kind;
      const span = document.createElement('span');
      span.textContent = String(message || '');
      el.appendChild(span);
      if (actionOpts && typeof actionOpts.onRetry === 'function') {
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'vtc-toast-retry';
        retryBtn.textContent = actionOpts.retryLabel || 'Thử lại';
        retryBtn.addEventListener('click', function () {
          if (el.parentNode) el.parentNode.removeChild(el);
          actionOpts.onRetry();
        });
        el.appendChild(retryBtn);
      }
      host.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('visible'); });
      clearTimeout(activeToastTimer);
      activeToastTimer = setTimeout(function () {
        el.classList.remove('visible');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
      }, actionOpts && actionOpts.onRetry ? 6500 : 3200);
    },
    confirm: function (opts) {
      if (typeof document === 'undefined') return Promise.resolve(false);
      ensureCoreStyles();
      const o = opts || {};
      return new Promise(function (resolve) {
        const bd = document.createElement('div');
        bd.className = 'vtc-confirm-backdrop';
        bd.setAttribute('role', 'dialog');
        bd.setAttribute('aria-modal', 'true');
        bd.innerHTML =
          '<div class="vtc-confirm-card">' +
            '<h3 class="vtc-confirm-title">' + escapeHtml(o.title || 'Xác nhận thao tác') + '</h3>' +
            '<p class="vtc-confirm-msg">' + escapeHtml(o.message || 'Bạn có chắc chắn muốn tiếp tục không?') + '</p>' +
            '<div class="vtc-confirm-actions">' +
              '<button type="button" class="vtc-btn" data-vtc-cancel>' + escapeHtml(o.cancelText || 'Hủy bỏ') + '</button>' +
              '<button type="button" class="vtc-btn ' + (o.danger ? 'vtc-btn-danger' : 'vtc-btn-primary') + '" data-vtc-ok>' + escapeHtml(o.confirmText || 'Xác nhận') + '</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(bd);

        function cleanup(result) {
          document.removeEventListener('keydown', onKey);
          if (bd.parentNode) bd.parentNode.removeChild(bd);
          resolve(result);
        }
        function onKey(e) {
          if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
          else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
        }
        document.addEventListener('keydown', onKey);
        bd.addEventListener('click', function (e) { if (e.target === bd) cleanup(false); });
        bd.querySelector('[data-vtc-cancel]').addEventListener('click', function () { cleanup(false); });
        bd.querySelector('[data-vtc-ok]').addEventListener('click', function () { cleanup(true); });
      });
    },
    skeleton: function (lines) {
      ensureCoreStyles();
      const n = Math.max(1, Math.min(12, parseInt(lines, 10) || 4));
      const widths = ['92%', '100%', '78%', '86%', '64%'];
      let rows = '';
      for (let i = 0; i < n; i++) {
        rows += '<div class="vtc-skeleton-line" style="width:' + widths[i % widths.length] + ';"></div>';
      }
      return '<div class="vtc-skeleton-wrap" aria-hidden="true">' + rows + '</div>';
    },
    renderMathText: renderMathText,
    renderMath: function (container) {
      if (!container) return;
      ensureCoreStyles();
      try {
        const nodes = container.querySelectorAll('[data-vtc-math]');
        nodes.forEach(function (el) {
          el.innerHTML = renderMathText(el.getAttribute('data-vtc-math') || '');
        });
        if (!window.katex && window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
          window.MathJax.typesetPromise([container]).catch(function () {});
        }
      } catch (e) {}
    }
  };

  /* ==========================================================================
   * 5B. CENTRALIZED SECTOR LIFECYCLE & ERROR ISOLATION SHIELD (v2.0)
   * ========================================================================== */

  const SECTOR_META = {
    dashboard: { label: 'Tổng quan', containerId: 'sectorDashboard' },
    resources: { label: 'Kho Chòm sao', containerId: 'sectorResources' },
    exams: { label: 'Đấu trường Đề', containerId: 'sectorExams' },
    lab: { label: 'Phòng Thí nghiệm', containerId: 'sectorLab' },
    slate: { label: 'Bảng Giảng', containerId: 'sectorSlate' },
    classroom: { label: 'Lớp học', containerId: 'sectorClassroom' }
  };

  const sectorRegistry = new Map();
  let activeSectorId = '';

  function getSectorContainer(sectorId, entry) {
    if (typeof document === 'undefined') return null;
    const cid = (entry && entry.containerId) || (SECTOR_META[sectorId] && SECTOR_META[sectorId].containerId) || sectorId;
    return document.getElementById(cid);
  }

  function renderSectorErrorShield(sectorId, container, err) {
    if (!container) return;
    ensureCoreStyles();
    const meta = SECTOR_META[sectorId] || { label: sectorId };
    const shieldId = 'vtcShield_' + sectorId;
    let shield = container.querySelector('#' + shieldId);
    if (!shield) {
      shield = document.createElement('div');
      shield.id = shieldId;
      shield.style.cssText = 'padding:28px 20px;display:flex;align-items:center;justify-content:center;min-height:260px;';
      container.innerHTML = '';
      container.appendChild(shield);
    }
    shield.innerHTML =
      '<div class="vtc-glass-card" style="max-width:460px;width:100%;padding:24px;text-align:center;">' +
        '<div style="font-family:var(--vt-cosmos-font-display);font-size:22px;font-weight:700;margin-bottom:8px;">Phân khu ' + escapeHtml(meta.label) + ' tạm thời gián đoạn</div>' +
        '<p style="font-size:13.5px;color:var(--vt-cosmos-text-muted);line-height:1.6;margin:0 0 18px;">Hệ thống đã tự động cô lập sự cố để không ảnh hưởng các phân khu khác. Bạn có thể thử tải lại ngay.</p>' +
        '<button type="button" class="vtc-btn vtc-btn-primary" data-vtc-retry-sector="' + escapeHtml(sectorId) + '">↻ Thử tải lại phân khu</button>' +
      '</div>';
    const retryBtn = shield.querySelector('[data-vtc-retry-sector]');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        const entry = sectorRegistry.get(sectorId);
        if (entry) {
          entry.mounted = false;
          entry.lastError = '';
        }
        activateSector(sectorId);
      });
    }
  }

  function registerSector(sectorId, lifecycle) {
    const id = String(sectorId || '').trim().toLowerCase();
    if (!id || !lifecycle || typeof lifecycle !== 'object') return false;
    const prev = sectorRegistry.get(id);
    const entry = {
      id: id,
      mount: typeof lifecycle.mount === 'function' ? lifecycle.mount : null,
      refresh: typeof lifecycle.refresh === 'function' ? lifecycle.refresh : null,
      unmount: typeof lifecycle.unmount === 'function' ? lifecycle.unmount : null,
      containerId: lifecycle.containerId || (SECTOR_META[id] && SECTOR_META[id].containerId) || id,
      mounted: prev ? prev.mounted : false,
      lastError: '',
      lastActiveAt: prev ? prev.lastActiveAt : 0
    };
    sectorRegistry.set(id, entry);
    if (activeSectorId === id && auth.isSignedIn() && !entry.mounted) {
      activateSector(id);
    }
    return true;
  }

  async function activateSector(sectorId) {
    const id = String(sectorId || '').trim().toLowerCase();
    if (!id) return false;

    // Unmount previously active sector safely
    if (activeSectorId && activeSectorId !== id) {
      const prevEntry = sectorRegistry.get(activeSectorId);
      if (prevEntry && prevEntry.unmount) {
        try {
          const prevContainer = getSectorContainer(activeSectorId, prevEntry);
          await Promise.resolve(prevEntry.unmount(prevContainer));
        } catch (e) {}
      }
    }

    activeSectorId = id;

    // Synchronize DOM active class across the 6 standard sectors if present
    if (typeof document !== 'undefined') {
      Object.keys(SECTOR_META).forEach(function (k) {
        const el = document.getElementById(SECTOR_META[k].containerId);
        if (el) el.classList.toggle('is-active', k === id);
      });
    }

    const entry = sectorRegistry.get(id);
    if (!entry) return true;

    const sess = auth.getSession();
    if (!auth.isSignedIn() || !sess) return false;

    const container = getSectorContainer(id, entry);
    entry.lastActiveAt = Date.now();

    try {
      if (!entry.mounted) {
        if (entry.mount) {
          await Promise.resolve(entry.mount(container, sess));
        }
        entry.mounted = true;
      } else if (entry.refresh) {
        await Promise.resolve(entry.refresh(container, sess));
      }
      entry.lastError = '';
      bus.emit('sector-activated', { sectorId: id, ts: Date.now() });
      return true;
    } catch (err) {
      entry.lastError = (err && err.message) ? String(err.message) : 'Lỗi hiển thị phân khu';
      renderSectorErrorShield(id, container, err);
      return false;
    }
  }

  bus.on('session-changed', function (s) {
    if (s && auth.isSignedIn() && activeSectorId) {
      const entry = sectorRegistry.get(activeSectorId);
      if (entry && !entry.mounted) {
        activateSector(activeSectorId);
      }
    }
  });

  /* ==========================================================================
   * 5C. BUILT-IN DIAGNOSTICS STATION (CTRL + SHIFT + D / VANTHESIS_CORE.diagnose)
   * ========================================================================== */

  async function openDiagnosticsModal() {
    if (typeof document === 'undefined') return null;
    ensureCoreStyles();
    const existing = document.getElementById('vtcDiagBackdrop');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    const signedIn = auth.isSignedIn();
    const email = auth.getEmail() || 'Chưa đăng nhập';
    const scopeBadge = policy.getScopeBadge();
    const sectorKeys = Object.keys(SECTOR_META);

    const sectorRows = sectorKeys.map(function (k) {
      const entry = sectorRegistry.get(k);
      const domOk = Boolean(document.getElementById(SECTOR_META[k].containerId));
      let statusTxt = 'Sẵn sàng';
      let statusColor = '#059669';
      if (entry && entry.lastError) { statusTxt = 'Cần tải lại'; statusColor = '#DC2626'; }
      else if (entry && entry.mounted) { statusTxt = 'Đã khởi tạo'; statusColor = '#059669'; }
      else if (entry) { statusTxt = 'Đã đăng ký'; statusColor = '#2563EB'; }
      else if (!domOk) { statusTxt = 'Chưa gắn khung'; statusColor = '#D97706'; }
      return {
        key: k,
        label: SECTOR_META[k].label,
        statusTxt: statusTxt,
        statusColor: statusColor
      };
    });

    const bd = document.createElement('div');
    bd.id = 'vtcDiagBackdrop';
    bd.className = 'vtc-confirm-backdrop';
    bd.setAttribute('role', 'dialog');
    bd.setAttribute('aria-modal', 'true');

    const rowsHtml = sectorRows.map(function (r) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:10px;background:var(--vt-cosmos-surface);border:1px solid var(--vt-cosmos-border);font-size:12.5px;">' +
        '<span>' + escapeHtml(r.label) + (activeSectorId === r.key ? ' (Đang mở)' : '') + '</span>' +
        '<strong style="color:' + r.statusColor + ';">' + escapeHtml(r.statusTxt) + '</strong>' +
      '</div>';
    }).join('');

    bd.innerHTML =
      '<div class="vtc-confirm-card" style="width:min(520px,95vw);max-height:86vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
          '<h3 class="vtc-confirm-title" style="margin:0;">Trạm Chẩn Đoán Hệ Thống</h3>' +
          '<button type="button" class="vtc-btn" data-diag-close style="padding:4px 10px;">Đóng</button>' +
        '</div>' +
        '<div style="display:grid;gap:8px;margin-bottom:14px;font-size:13px;">' +
          '<div><strong>Phiên đăng nhập:</strong> ' + (signedIn ? ('Đang hoạt động (' + escapeHtml(email) + ')') : 'Chưa đăng nhập') + '</div>' +
          '<div><strong>Phạm vi quyền:</strong> ' + escapeHtml(scopeBadge) + '</div>' +
          '<div><strong>Kết nối máy chủ:</strong> <span id="vtcDiagPing">Đang kiểm tra độ trễ...</span></div>' +
          '<div><strong>Bộ nhớ đệm cục bộ:</strong> <span id="vtcDiagDb">' + (typeof indexedDB !== 'undefined' ? 'Sẵn sàng lưu nháp nhanh' : 'Chế độ bộ nhớ tạm') + '</span></div>' +
        '</div>' +
        '<div style="font-size:12px;font-weight:800;margin-bottom:6px;opacity:0.75;">Trạng thái 6 phân khu</div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:16px;">' + rowsHtml + '</div>' +
        '<div class="vtc-confirm-actions" style="flex-wrap:wrap;">' +
          '<button type="button" class="vtc-btn" data-diag-copy>Sao chép báo cáo</button>' +
          '<button type="button" class="vtc-btn vtc-btn-danger" data-diag-clear>Làm sạch bộ nhớ đệm &amp; Tải lại</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(bd);

    let pingSummary = 'Chưa kiểm tra';
    if (signedIn) {
      const t0 = Date.now();
      api.post('sync_heartbeat', {}, { timeoutMs: 8000, silent: true, dedupe: false }).then(function (r) {
        const ms = Date.now() - t0;
        const el = document.getElementById('vtcDiagPing');
        if (r && r.ok) {
          pingSummary = 'Ổn định (' + ms + ' ms)';
          if (el) { el.textContent = pingSummary; el.style.color = '#059669'; }
        } else {
          pingSummary = 'Phản hồi chậm hoặc gián đoạn';
          if (el) { el.textContent = pingSummary; el.style.color = '#D97706'; }
        }
      });
    } else {
      const el = document.getElementById('vtcDiagPing');
      pingSummary = 'Cần đăng nhập để kiểm tra';
      if (el) el.textContent = pingSummary;
    }

    function closeDiag() { if (bd.parentNode) bd.parentNode.removeChild(bd); }
    bd.addEventListener('click', function (e) { if (e.target === bd) closeDiag(); });
    bd.querySelector('[data-diag-close]').addEventListener('click', closeDiag);
    bd.querySelector('[data-diag-copy]').addEventListener('click', function () {
      const report = [
        'Báo cáo chẩn đoán VANTHESIS (' + new Date().toLocaleString('vi-VN') + ')',
        '- Tài khoản: ' + email,
        '- Phạm vi quyền: ' + scopeBadge,
        '- Kết nối máy chủ: ' + pingSummary,
        '- Phân khu: ' + sectorRows.map(function (r) { return r.label + ': ' + r.statusTxt; }).join(' | ')
      ].join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report).then(function () {
          ui.toast('Đã sao chép báo cáo chẩn đoán.', 'success');
        }).catch(function () { ui.toast('Không thể sao chép tự động.', 'warning'); });
      }
    });
    bd.querySelector('[data-diag-clear]').addEventListener('click', async function () {
      SafeStore.clearAll();
      try {
        if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
          indexedDB.deleteDatabase(DB_NAME);
        }
      } catch (e) {}
      window.location.reload();
    });

    return { signedIn: signedIn, email: email, scopeBadge: scopeBadge, sectors: sectorRows };
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        openDiagnosticsModal();
      }
    });
  }


  /* ==========================================================================
   * 5D. CHẶNG 1 (v3.0): SHARED 162-GALAXY CATALOG, 4-LEVEL COSMOS VAULT,
   *     PERSONALIZATION PREFS (PINS · TOP 5 RECENT · 3 ATMOSPHERES) & DEEP LINKS
   * ========================================================================== */

  const COSMOS_WORKSPACE_FILE = 'vanthesis_workspace_v1.json';
  const COSMOS_VAULT_KEY = 'vanthesis_cosmos_vault_v1';
  const COSMOS_PREFS_KEY = 'vanthesis_cosmos_prefs_v1';
  const COSMOS_ATMO_KEY = 'vanthesis_atmosphere_v1';
  const COSMOS_PIN_KEY = 'vanthesis_pinned_galaxies_v1';
  const COSMOS_RECENT_KEY = 'vanthesis_recent_galaxies_v1';

  const SPECTRAL_GROUPS = Object.freeze({
    THCS: Object.freeze({ key: 'THCS', label: 'Trung học Cơ sở (THCS)', color: '#10B981' }),
    THPT: Object.freeze({ key: 'THPT', label: 'Trung học Phổ thông (THPT)', color: '#38BDF8' }),
    UNI: Object.freeze({ key: 'UNI', label: 'Đại học & CNTT', color: '#A78BFA' }),
    EXAM: Object.freeze({ key: 'EXAM', label: 'Kì thi riêng & ĐGNL', color: '#F59E0B' }),
    INTL: Object.freeze({ key: 'INTL', label: 'Chứng chỉ Quốc tế', color: '#FB7185' })
  });

  // Compact 162-Galaxy Shared Index: [id, catalogCode, title, domain, group, chapterCount, lessonCount]
  const COMPACT_GALAXY_INDEX_162 = [["GAL_TOAN_10","M51","Toán 10","HIGH_SCHOOL","THPT",9,36],["GAL_TOAN_11","M33","Toán 11","HIGH_SCHOOL","THPT",9,42],["GAL_TOAN_12","M31","Toán 12","HIGH_SCHOOL","THPT",6,25],["GAL_TOAN_6","M74","Toán 6","MIDDLE_SCHOOL","THCS",9,52],["GAL_TOAN_7","M101","Toán 7","MIDDLE_SCHOOL","THCS",10,47],["GAL_TOAN_8","NGC 3949","Toán 8","MIDDLE_SCHOOL","THCS",10,49],["GAL_TOAN_9","NGC 3726","Toán 9","MIDDLE_SCHOOL","THCS",10,42],["GAL_VATLI_10","M104","Vật lí 10","HIGH_SCHOOL","THPT",7,34],["GAL_VATLI_11","NGC 1385","Vật lí 11","HIGH_SCHOOL","THPT",4,26],["GAL_VATLI_12","NGC 4013","Vật lí 12","HIGH_SCHOOL","THPT",4,24],["GAL_HOA_10","M81","Hóa học 10","HIGH_SCHOOL","THPT",7,23],["GAL_HOA_11","M63","Hóa học 11","HIGH_SCHOOL","THPT",6,25],["GAL_HOA_12","M106","Hóa học 12","HIGH_SCHOOL","THPT",8,30],["GAL_SINH_10","M82","Sinh học 10","HIGH_SCHOOL","THPT",6,26],["GAL_SINH_11","NGC 2613","Sinh học 11","HIGH_SCHOOL","THPT",4,27],["GAL_SINH_12","NGC 4217","Sinh học 12","HIGH_SCHOOL","THPT",7,31],["GAL_KHTN_6","NGC 4676","KHTN 6","MIDDLE_SCHOOL","THCS",10,55],["GAL_KHTN_7","NGC 4039","KHTN 7","MIDDLE_SCHOOL","THCS",10,42],["GAL_KHTN_8","NGC 2535","KHTN 8","MIDDLE_SCHOOL","THCS",8,47],["GAL_KHTN_9","IC 2163","KHTN 9","MIDDLE_SCHOOL","THCS",13,51],["GAL_GT_1","M87","Giải tích 1","UNIVERSITY","UNI",6,19],["GAL_GT_2","M108","Giải tích 2","UNIVERSITY","UNI",4,10],["GAL_GT_3","M109","Giải tích 3","UNIVERSITY","UNI",5,10],["GAL_GT_4","NGC 7582","Giải tích 4","UNIVERSITY","UNI",5,7],["GAL_DSTT_1","M64","Đại số Tuyến tính 1","UNIVERSITY","UNI",6,12],["GAL_DSTT_2","NGC 4438","Đại số Tuyến tính 2","UNIVERSITY","UNI",7,16],["GAL_PPT","NGC 6814","Giải tích số (Phương pháp tính)","UNIVERSITY","UNI",6,12],["GAL_XSTK","NGC 5775","Xác suất Thống kê","UNIVERSITY","UNI",6,17],["GAL_CTDL_GT","NGC 278","Cấu trúc Dữ liệu & Giải thuật","UNIVERSITY","UNI",8,21],["GAL_TRIET_MLN","NGC 3379","Triết học Mác - Lênin","UNIVERSITY","UNI",3,10],["GAL_TIN_10","NGC 5195","Tin học 10","HIGH_SCHOOL","THPT",6,34],["GAL_TIN_11","NGC 4254","Tin học 11","HIGH_SCHOOL","THPT",8,42],["GAL_TIN_12","NGC 4689","Tin học 12","HIGH_SCHOOL","THPT",7,37],["GAL_TIN_6","NGC 3623","Tin học 6","MIDDLE_SCHOOL","THCS",6,17],["GAL_TIN_7","NGC 3511","Tin học 7","MIDDLE_SCHOOL","THCS",5,16],["GAL_TIN_8","NGC 3115","Tin học 8","MIDDLE_SCHOOL","THCS",6,20],["GAL_TIN_9","NGC 2654","Tin học 9","MIDDLE_SCHOOL","THCS",6,21],["GAL_SU_10","NGC 1326","Lịch sử 10","HIGH_SCHOOL","THPT",7,14],["GAL_SU_11","NGC 1097","Lịch sử 11","HIGH_SCHOOL","THPT",6,13],["GAL_SU_12","NGC 1559","Lịch sử 12","HIGH_SCHOOL","THPT",6,17],["GAL_DIA_10","NGC 2985","Địa lí 10","HIGH_SCHOOL","THPT",13,38],["GAL_DIA_11","NGC 3359","Địa lí 11","HIGH_SCHOOL","THPT",10,31],["GAL_DIA_12","NGC 4725","Địa lí 12","HIGH_SCHOOL","THPT",4,32],["GAL_VAN_10","NGC 628","Ngữ văn 10","HIGH_SCHOOL","THPT",9,54],["GAL_VAN_11","NGC 5701","Ngữ văn 11","HIGH_SCHOOL","THPT",9,52],["GAL_VAN_12","NGC 5905","Ngữ văn 12","HIGH_SCHOOL","THPT",9,49],["GAL_VAN_6","NGC 5921","Ngữ văn 6","MIDDLE_SCHOOL","THCS",10,58],["GAL_VAN_7","NGC 4206","Ngữ văn 7","MIDDLE_SCHOOL","THCS",10,60],["GAL_VAN_8","NGC 4781","Ngữ văn 8","MIDDLE_SCHOOL","THCS",10,58],["GAL_VAN_9","NGC 4038","Ngữ văn 9","MIDDLE_SCHOOL","THCS",10,58],["GAL_DIA_6","NGC 4651","Địa lí 6","MIDDLE_SCHOOL","THCS",7,28],["GAL_DIA_7","NGC 4826","Địa lí 7","MIDDLE_SCHOOL","THCS",6,23],["GAL_DIA_8","NGC 4845","Địa lí 8","MIDDLE_SCHOOL","THCS",4,14],["GAL_DIA_9","NGC 4958","Địa lí 9","MIDDLE_SCHOOL","THCS",4,22],["GAL_SU_6","NGC 5170","Lịch sử 6","MIDDLE_SCHOOL","THCS",5,20],["GAL_SU_7","NGC 5204","Lịch sử 7","MIDDLE_SCHOOL","THCS",5,18],["GAL_SU_8","NGC 5247","Lịch sử 8","MIDDLE_SCHOOL","THCS",7,20],["GAL_SU_9","NGC 5585","Lịch sử 9","MIDDLE_SCHOOL","THCS",7,22],["GAL_ANH_10","NGC 7755","Tiếng Anh 10","HIGH_SCHOOL","THPT",4,14],["GAL_ANH_11","NGC 7332","Tiếng Anh 11","HIGH_SCHOOL","THPT",4,14],["GAL_ANH_12","NGC 3079","Tiếng Anh 12","HIGH_SCHOOL","THPT",4,14],["GAL_ANH_6","NGC 2903","Tiếng Anh 6","MIDDLE_SCHOOL","THCS",4,16],["GAL_ANH_7","NGC 3184","Tiếng Anh 7","MIDDLE_SCHOOL","THCS",4,16],["GAL_ANH_8","NGC 3351","Tiếng Anh 8","MIDDLE_SCHOOL","THCS",4,16],["GAL_ANH_9","NGC 3627","Tiếng Anh 9","MIDDLE_SCHOOL","THCS",4,16],["GAL_GDKTPL_10","NGC 4753","GDKT&PL 10","HIGH_SCHOOL","THPT",9,20],["GAL_GDKTPL_11","NGC 5371","GDKT&PL 11","HIGH_SCHOOL","THPT",9,21],["GAL_GDKTPL_12","NGC 5668","GDKT&PL 12","HIGH_SCHOOL","THPT",8,16],["GAL_GDCD_6","NGC 4151","GDCD 6","MIDDLE_SCHOOL","THCS",3,12],["GAL_GDCD_7","NGC 4395","GDCD 7","MIDDLE_SCHOOL","THCS",3,12],["GAL_GDCD_8","NGC 4654","GDCD 8","MIDDLE_SCHOOL","THCS",3,10],["GAL_GDCD_9","NGC 4800","GDCD 9","MIDDLE_SCHOOL","THCS",3,10],["GAL_CN_10","NGC 5055","Công nghệ 10","HIGH_SCHOOL","THPT",6,23],["GAL_CN_11","NGC 7552","Công nghệ 11","HIGH_SCHOOL","THPT",6,25],["GAL_CN_12","NGC 5457","Công nghệ 12","HIGH_SCHOOL","THPT",8,26],["GAL_CN_6","NGC 5746","Công nghệ 6","MIDDLE_SCHOOL","THCS",4,11],["GAL_CN_7","NGC 5866","Công nghệ 7","MIDDLE_SCHOOL","THCS",4,14],["GAL_CN_8","NGC 6118","Công nghệ 8","MIDDLE_SCHOOL","THCS",4,17],["GAL_CN_9","NGC 6384","Công nghệ 9","MIDDLE_SCHOOL","THCS",4,14],["GAL_GDQPAN_10","NGC 6643","GDQP&AN 10","HIGH_SCHOOL","THPT",2,12],["GAL_GDQPAN_11","NGC 6822","GDQP&AN 11","HIGH_SCHOOL","THPT",2,10],["GAL_GDQPAN_12","NGC 7217","GDQP&AN 12","HIGH_SCHOOL","THPT",2,10],["GAL_AI_6","NGC 7479","Trí tuệ nhân tạo 6","MIDDLE_SCHOOL","THCS",5,15],["GAL_AI_7","NGC 7640","Trí tuệ nhân tạo 7","MIDDLE_SCHOOL","THCS",5,15],["GAL_AI_8","NGC 7793","Trí tuệ nhân tạo 8","MIDDLE_SCHOOL","THCS",5,16],["GAL_AI_9","NGC 7727","Trí tuệ nhân tạo 9","MIDDLE_SCHOOL","THCS",5,16],["GAL_AI_10","NGC 7090","Trí tuệ nhân tạo 10","HIGH_SCHOOL","THPT",6,18],["GAL_AI_11","NGC 1672","Trí tuệ nhân tạo 11","HIGH_SCHOOL","THPT",6,18],["GAL_AI_12","NGC 2442","Trí tuệ nhân tạo 12","HIGH_SCHOOL","THPT",6,18],["GAL_CD_TOAN","NGC 7314","Chuyên đề Toán học THPT","HIGH_SCHOOL_SPECIAL","THPT",3,9],["GAL_CD_VATLI","NGC 925","Chuyên đề Vật lí THPT","HIGH_SCHOOL_SPECIAL","THPT",3,9],["GAL_CD_HOA","NGC 1068","Chuyên đề Hóa học THPT","HIGH_SCHOOL_SPECIAL","THPT",3,9],["GAL_CD_SINH","NGC 6951","Chuyên đề Sinh học THPT","HIGH_SCHOOL_SPECIAL","THPT",3,9],["GAL_CD_TIN","NGC 1532","Chuyên đề Tin học THPT","HIGH_SCHOOL_SPECIAL","THPT",3,18],["GAL_CD_VAN","NGC 1566","Chuyên đề Ngữ văn THPT","HIGH_SCHOOL_SPECIAL","THPT",3,9],["GAL_CD_SU","NGC 1792","Chuyên đề Lịch sử THPT","HIGH_SCHOOL_SPECIAL","THPT",3,9],["GAL_CD_DIA","NGC 1808","Chuyên đề Địa lí THPT","HIGH_SCHOOL_SPECIAL","THPT",3,9],["GAL_CD_GDKTPL","NGC 1961","Chuyên đề GDKT&PL THPT","HIGH_SCHOOL_SPECIAL","THPT",3,9],["GAL_CNNN_10","NGC 2207","Công nghệ 10 (Trồng trọt)","HIGH_SCHOOL","THPT",6,25],["GAL_CNNN_11","NGC 2683","Công nghệ 11 (Chăn nuôi)","HIGH_SCHOOL","THPT",6,23],["GAL_CNNN_12","NGC 2997","Công nghệ 12 (Lâm nghiệp – Thủy sản)","HIGH_SCHOOL","THPT",10,25],["GAL_HDTN_THCS","NGC 3109","HĐTN, HN THCS (Lớp 6–9)","MIDDLE_SCHOOL","THCS",4,38],["GAL_HDTN_THPT","NGC 3227","HĐTN, HN THPT (Lớp 10–12)","HIGH_SCHOOL","THPT",3,31],["GAL_AMNHAC_K12","NGC 3344","Âm nhạc Phổ thông (Lớp 6–12)","ARTS_K12","THCS",7,41],["GAL_MITHUAT_K12","NGC 3521","Mĩ thuật Phổ thông (Lớp 6–12)","ARTS_K12","THCS",7,34],["GAL_GDTC_K12","NGC 7814","Giáo dục thể chất Phổ thông (Lớp 6–12)","ARTS_K12","THCS",7,27],["GAL_GDDP_K12","NGC 3810","Giáo dục địa phương Phổ thông (Lớp 6–12)","ARTS_K12","THCS",7,21],["GAL_TRUNG_K12","NGC 3938","Tiếng Trung Quốc Phổ thông (Lớp 6–12)","ARTS_K12","THCS",7,25],["GAL_KTCT_MLN","NGC 4051","Kinh tế chính trị Mác - Lênin","UNIVERSITY","UNI",6,17],["GAL_CNXHKH","NGC 4111","Chủ nghĩa xã hội khoa học","UNIVERSITY","UNI",7,19],["GAL_LSDCSVN","NGC 4216","Lịch sử Đảng Cộng sản Việt Nam","UNIVERSITY","UNI",4,8],["GAL_TTHCM","NGC 4244","Tư tưởng Hồ Chí Minh","UNIVERSITY","UNI",6,15],["GAL_PLDC","NGC 4314","Pháp luật đại cương","UNIVERSITY","UNI",6,12],["GAL_TAMLI_DC","NGC 4414","Tâm lí học đại cương","UNIVERSITY","UNI",7,18],["GAL_LOGIC_DC","NGC 4449","Logic học đại cương","UNIVERSITY","UNI",6,15],["GAL_PPNCKH","NGC 4490","Phương pháp nghiên cứu khoa học","UNIVERSITY","UNI",6,14],["GAL_CSVHVN","NGC 4526","Cơ sở văn hóa Việt Nam","UNIVERSITY","UNI",6,14],["GAL_XHH_DC","NGC 4559","Xã hội học đại cương","UNIVERSITY","UNI",6,12],["GAL_KHQLGD","NGC 7782","Khoa học quản lí giáo dục","UNIVERSITY","UNI",6,18],["GAL_GDH_DC","NGC 4631","Giáo dục học đại cương","UNIVERSITY","UNI",6,14],["GAL_LLDH_DC","NGC 4656","Lí luận dạy học đại cương","UNIVERSITY","UNI",6,14],["GAL_TRR","NGC 4889","Toán rời rạc và Lí thuyết đồ thị","UNIVERSITY","UNI",6,16],["GAL_OOP","NGC 4945","Lập trình hướng đối tượng","UNIVERSITY","UNI",6,12],["GAL_CSDL","NGC 5005","Cơ sở dữ liệu","UNIVERSITY","UNI",6,12],["GAL_HDH","NGC 5033","Hệ điều hành","UNIVERSITY","UNI",6,12],["GAL_MMT","NGC 5128","Mạng máy tính","UNIVERSITY","UNI",6,12],["GAL_SH_DSDC","NGC 5236","Số học và Đại số đại cương","UNIVERSITY","UNI",6,15],["GAL_PTVP","NGC 5248","Phương trình vi phân","UNIVERSITY","UNI",6,13],["GAL_GTP_GTH","NGC 5364","Giải tích phức và Giải tích hàm","UNIVERSITY","UNI",6,12],["GAL_KTMT","NGC 5427","Kiến trúc máy tính","UNIVERSITY","UNI",6,12],["GAL_AI_UNI","NGC 5566","Trí tuệ nhân tạo và Học máy (Bậc Đại học)","UNIVERSITY","UNI",6,13],["GAL_VLDC","NGC 6217","Vật lí đại cương","UNIVERSITY","UNI",6,12],["GAL_HHDC","NGC 7723","Hóa học đại cương","UNIVERSITY","UNI",6,12],["GAL_NMLT","NGC 3034","Nhập môn Lập trình","UNIVERSITY","UNI",6,12],["GAL_KTHDC","NGC 7606","Kinh tế học đại cương (Vi mô & Vĩ mô)","UNIVERSITY","UNI",6,13],["GAL_QTHDC","NGC 7817","Quản trị học đại cương","UNIVERSITY","UNI",6,12],["GAL_QHTT","NGC 5846","Tối ưu hóa và Quy hoạch tuyến tính","UNIVERSITY","UNI",6,12],["GAL_ATTT_MMH","NGC 5907","An toàn thông tin và Mật mã học","UNIVERSITY","UNI",6,12],["GAL_CNPM_TKHT","NGC 6240","Công nghệ phần mềm và Thiết kế hệ thống","UNIVERSITY","UNI",6,12],["GAL_NLKT","NGC 6503","Nguyên lí Kế toán","UNIVERSITY","UNI",6,12],["GAL_TCTT","NGC 6744","Tài chính – Tiền tệ","UNIVERSITY","UNI",6,12],["GAL_KHDL_BIGDATA","NGC 6946","Khoa học dữ liệu và Phân tích dữ liệu lớn","UNIVERSITY","UNI",6,12],["GAL_WEB_CLOUD","NGC 7331","Phát triển Ứng dụng Web và Điện toán đám mây","UNIVERSITY","UNI",6,12],["GAL_HHVP_TOPO","NGC 7418","Hình học vi phân và Tôpô đại cương","UNIVERSITY","UNI",6,12],["GAL_XLTH_XLA","NGC 7541","Xử lí tín hiệu số và Xử lí ảnh","UNIVERSITY","UNI",6,12],["GAL_HSA","NGC 104","Kì thi Đánh giá năng lực ĐHQGHN (HSA)","EXAM_PREP","EXAM",8,75],["GAL_TSA","NGC 224","Kì thi Đánh giá tư duy ĐHBK Hà Nội (TSA)","EXAM_PREP","EXAM",3,28],["GAL_VACT","NGC 598","Kì thi Đánh giá năng lực ĐHQG TP.HCM (V-ACT)","EXAM_PREP","EXAM",4,22],["GAL_SPT","NGC 1300","Kì thi Đánh giá năng lực Trường ĐHSP Hà Nội (SPT)","EXAM_PREP","EXAM",8,28],["GAL_HSCA","NGC 1365","Kì thi Đánh giá năng lực chuyên biệt Trường ĐHSP TP.HCM (H-SCA)","EXAM_PREP","EXAM",6,23],["GAL_BCA","NGC 1512","Kì thi Đánh giá của Bộ Công an (BCA)","EXAM_PREP","EXAM",6,17],["GAL_VSAT","NGC 4594","Kì thi Đánh giá đầu vào Đại học trên máy tính (V-SAT)","EXAM_PREP","EXAM",8,28],["GAL_THPTQG","NGC 253","Kì thi Tốt nghiệp THPT (THPTQG)","EXAM_PREP","EXAM",9,38],["GAL_IELTS","NGC 891","Chứng chỉ Tiếng Anh Quốc tế (IELTS Academic)","INTL_CERT","INTL",4,12],["GAL_SAT","NGC 5194","Chứng chỉ Chuẩn hóa Quốc tế (Digital SAT)","INTL_CERT","INTL",2,9],["GAL_ACT","NGC 4258","Chứng chỉ Chuẩn hóa Quốc tế (ACT)","INTL_CERT","INTL",5,14],["GAL_TOEFL","NGC 3628","Chứng chỉ Tiếng Anh Học thuật Quốc tế (TOEFL iBT)","INTL_CERT","INTL",4,11],["GAL_HSK","NGC 3031","Chứng chỉ Năng lực Hán ngữ Quốc tế (HSK & HSKK)","INTL_CERT","INTL",4,11],["GAL_VSTEP","NGC 2403","Chứng chỉ Năng lực Ngoại ngữ 6 bậc dùng cho Việt Nam (VSTEP)","INTL_CERT","INTL",4,10],["GAL_AP","NGC 4565","Chương trình Tú tài Nâng cao Quốc tế (AP)","INTL_CERT","INTL",8,21],["GAL_HSGQG","NGC 4736","Kì thi Chọn Học sinh giỏi Quốc gia (HSGQG)","EXAM_PREP","EXAM",9,28],["GAL_TOPIK","NGC 2841","Chứng chỉ Năng lực Tiếng Hàn Quốc tế (TOPIK)","INTL_CERT","INTL",3,8]];

  const catalog = (function () {
    const list = COMPACT_GALAXY_INDEX_162.map(function (row) {
      const grp = SPECTRAL_GROUPS[row[4]] || SPECTRAL_GROUPS.THPT;
      return Object.freeze({
        id: row[0],
        catalogCode: row[1],
        title: row[2],
        domain: row[3],
        group: grp.key,
        groupLabel: grp.label,
        spectralColor: grp.color,
        chapterCount: row[5],
        lessonCount: row[6],
        _searchKey: normVi(row[2] + ' ' + row[1] + ' ' + row[0] + ' ' + grp.label)
      });
    });
    const byId = Object.create(null);
    for (let i = 0; i < list.length; i++) byId[list[i].id] = list[i];

    return Object.freeze({
      total: list.length,
      groups: SPECTRAL_GROUPS,
      list: Object.freeze(list),
      byId: byId,
      normVi: normVi,
      get: function (galaxyId) {
        return byId[String(galaxyId || '').trim()] || null;
      },
      getSpectralColor: function (galaxyOrId) {
        if (!galaxyOrId) return SPECTRAL_GROUPS.THPT.color;
        if (typeof galaxyOrId === 'string') {
          const hit = byId[galaxyOrId];
          return hit ? hit.spectralColor : SPECTRAL_GROUPS.THPT.color;
        }
        if (galaxyOrId.spectralColor) return galaxyOrId.spectralColor;
        const grp = SPECTRAL_GROUPS[galaxyOrId.group];
        return grp ? grp.color : SPECTRAL_GROUPS.THPT.color;
      },
      search: function (query, groupFilter) {
        const q = normVi(query);
        const gf = String(groupFilter || 'ALL').toUpperCase();
        return list.filter(function (g) {
          if (gf !== 'ALL' && g.group !== gf) return false;
          if (!q) return true;
          return g._searchKey.indexOf(q) !== -1;
        });
      }
    });
  })();

  /* ---- 4-Level Resource Vault (cosmosVault) ---- */

  function buildVaultKey(galaxyId, chapterIdx, starIdx, planetIdx) {
    const gid = String(galaxyId || '').trim();
    if (!gid) return '';
    if (chapterIdx === undefined || chapterIdx === null || chapterIdx === '') return gid;
    const c = parseInt(chapterIdx, 10);
    if (!isFinite(c) || c < 0) return gid;
    let key = gid + '::c' + c;
    if (starIdx === undefined || starIdx === null || starIdx === '') return key;
    const s = parseInt(starIdx, 10);
    if (!isFinite(s) || s < 0) return key;
    key += '::s' + s;
    if (planetIdx === undefined || planetIdx === null || planetIdx === '') return key;
    const p = parseInt(planetIdx, 10);
    if (!isFinite(p) || p < 0) return key;
    return key + '::p' + p;
  }

  function parseVaultKey(scopeKey) {
    const key = String(scopeKey || '').trim();
    const m = key.match(/^([A-Z0-9_]{3,64})(?:::c(\d+)(?:::s(\d+)(?:::p(\d+))?)?)?$/);
    if (!m) return null;
    const chapterIdx = m[2] !== undefined ? parseInt(m[2], 10) : null;
    const starIdx = m[3] !== undefined ? parseInt(m[3], 10) : null;
    const planetIdx = m[4] !== undefined ? parseInt(m[4], 10) : null;
    const level = planetIdx !== null ? 4 : (starIdx !== null ? 3 : (chapterIdx !== null ? 2 : 1));
    return {
      scopeKey: key,
      galaxyId: m[1],
      level: level,
      chapterIndex: chapterIdx,
      starIndex: starIdx,
      planetIndex: planetIdx
    };
  }

  function canManageVault() {
    if (!auth.isSignedIn()) return true; // Chế độ cục bộ khi chưa đăng nhập
    return policy.isAdmin() || policy.isTeacher();
  }

  function readLocalVaultMap() {
    const raw = SafeStore.getJSON(COSMOS_VAULT_KEY, null);
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : Object.create(null);
  }

  function writeLocalVaultMap(mapObj) {
    SafeStore.setJSON(COSMOS_VAULT_KEY, mapObj);
  }

  function getVaultItems(scopeKey, opts) {
    const o = opts || {};
    const key = String(scopeKey || '').trim();
    const vaultMap = readLocalVaultMap();
    if (!key) {
      const all = [];
      Object.keys(vaultMap).forEach(function (k) {
        const arr = Array.isArray(vaultMap[k]) ? vaultMap[k] : [];
        for (let i = 0; i < arr.length; i++) all.push(arr[i]);
      });
      return all;
    }
    const direct = Array.isArray(vaultMap[key]) ? vaultMap[key].slice() : [];
    if (!o.includeChildren) return direct;
    const prefix = key + '::';
    const out = direct.slice();
    Object.keys(vaultMap).forEach(function (k) {
      if (k.indexOf(prefix) === 0 && Array.isArray(vaultMap[k])) {
        for (let i = 0; i < vaultMap[k].length; i++) out.push(vaultMap[k][i]);
      }
    });
    return out;
  }

  function countVaultByGalaxy(galaxyId) {
    const gid = String(galaxyId || '').trim();
    const res = { direct: 0, children: 0, total: 0, byLevel: { 1: 0, 2: 0, 3: 0, 4: 0 } };
    if (!gid) return res;
    const vaultMap = readLocalVaultMap();
    const prefix = gid + '::';
    Object.keys(vaultMap).forEach(function (k) {
      if (k !== gid && k.indexOf(prefix) !== 0) return;
      const arr = Array.isArray(vaultMap[k]) ? vaultMap[k] : [];
      const n = arr.length;
      if (!n) return;
      const parsed = parseVaultKey(k);
      const lvl = parsed ? parsed.level : 1;
      res.byLevel[lvl] = (res.byLevel[lvl] || 0) + n;
      if (k === gid) res.direct += n;
      else res.children += n;
      res.total += n;
    });
    return res;
  }

  async function addVaultItem(scopeKey, itemPayload) {
    if (!canManageVault()) {
      return { ok: false, error: translateFriendlyError('FORBIDDEN_STUDENT_READ_ONLY'), rawError: 'FORBIDDEN_STUDENT_READ_ONLY' };
    }
    const parsed = parseVaultKey(scopeKey);
    if (!parsed) {
      return { ok: false, error: translateFriendlyError('INVALID_COSMOS_SCOPE_KEY'), rawError: 'INVALID_COSMOS_SCOPE_KEY' };
    }
    const p = itemPayload || {};
    const title = String(p.title || '').trim();
    if (!title) {
      return { ok: false, error: translateFriendlyError('MISSING_VAULT_ITEM_TITLE'), rawError: 'MISSING_VAULT_ITEM_TITLE' };
    }
    const nowIso = new Date().toISOString();
    const item = {
      itemId: String(p.itemId || ('CVI_' + Date.now().toString(36).toUpperCase() + '_' + Math.floor(Math.random() * 900 + 100))),
      scopeKey: parsed.scopeKey,
      galaxyId: parsed.galaxyId,
      level: parsed.level,
      itemType: String(p.itemType || 'FILE').toUpperCase(),
      category: String(p.category || 'LECTURE'),
      title: title,
      url: String(p.url || ''),
      driveFileId: String(p.driveFileId || ''),
      previewUrl: String(p.previewUrl || p.url || ''),
      downloadUrl: String(p.downloadUrl || p.url || ''),
      mimeType: String(p.mimeType || ''),
      sizeBytes: Math.max(0, Number(p.sizeBytes) || 0),
      noteContent: String(p.noteContent || ''),
      authorEmail: auth.getEmail() || '',
      createdAt: p.createdAt || nowIso,
      updatedAt: nowIso
    };

    const vaultMap = readLocalVaultMap();
    if (!Array.isArray(vaultMap[parsed.scopeKey])) vaultMap[parsed.scopeKey] = [];
    vaultMap[parsed.scopeKey].unshift(item);
    writeLocalVaultMap(vaultMap);
    bus.emit('cosmos-vault-changed', { action: 'add', scopeKey: parsed.scopeKey, item: item }, { broadcast: true });

    if (auth.isSignedIn()) {
      const cloudRes = await api.post('cosmos_vault_add', { payload: item }, { dedupe: false });
      if (cloudRes && cloudRes.ok && cloudRes.item) {
        return { ok: true, item: cloudRes.item, synced: true };
      }
      return { ok: true, item: item, synced: false, syncError: cloudRes && cloudRes.error };
    }
    return { ok: true, item: item, synced: false };
  }

  async function renameVaultItem(scopeKey, itemId, newTitle, noteContent) {
    if (!canManageVault()) {
      return { ok: false, error: translateFriendlyError('FORBIDDEN_STUDENT_READ_ONLY'), rawError: 'FORBIDDEN_STUDENT_READ_ONLY' };
    }
    const key = String(scopeKey || '').trim();
    const id = String(itemId || '').trim();
    const cleanTitle = String(newTitle || '').trim();
    if (!key || !id || !cleanTitle) {
      return { ok: false, error: translateFriendlyError('MISSING_VAULT_ITEM_TITLE'), rawError: 'MISSING_VAULT_ITEM_TITLE' };
    }

    const vaultMap = readLocalVaultMap();
    const list = Array.isArray(vaultMap[key]) ? vaultMap[key] : [];
    let updatedItem = null;
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].itemId === id) {
        list[i].title = cleanTitle;
        if (noteContent !== undefined) list[i].noteContent = String(noteContent || '');
        list[i].updatedAt = new Date().toISOString();
        updatedItem = list[i];
        break;
      }
    }
    if (!updatedItem) {
      return { ok: false, error: translateFriendlyError('VAULT_ITEM_NOT_FOUND'), rawError: 'VAULT_ITEM_NOT_FOUND' };
    }
    writeLocalVaultMap(vaultMap);
    bus.emit('cosmos-vault-changed', { action: 'rename', scopeKey: key, item: updatedItem }, { broadcast: true });

    if (auth.isSignedIn()) {
      const payload = { scopeKey: key, itemId: id, newTitle: cleanTitle };
      if (noteContent !== undefined) payload.noteContent = String(noteContent || '');
      const cloudRes = await api.post('cosmos_vault_rename', { payload: payload }, { dedupe: false });
      return { ok: true, item: (cloudRes && cloudRes.item) || updatedItem, synced: Boolean(cloudRes && cloudRes.ok) };
    }
    return { ok: true, item: updatedItem, synced: false };
  }

  async function deleteVaultItem(scopeKey, itemId) {
    if (!canManageVault()) {
      return { ok: false, error: translateFriendlyError('FORBIDDEN_STUDENT_READ_ONLY'), rawError: 'FORBIDDEN_STUDENT_READ_ONLY' };
    }
    const key = String(scopeKey || '').trim();
    const id = String(itemId || '').trim();
    const vaultMap = readLocalVaultMap();
    const list = Array.isArray(vaultMap[key]) ? vaultMap[key] : [];
    const nextList = list.filter(function (it) { return it && it.itemId !== id; });
    if (nextList.length === list.length) {
      return { ok: false, error: translateFriendlyError('VAULT_ITEM_NOT_FOUND'), rawError: 'VAULT_ITEM_NOT_FOUND' };
    }
    if (nextList.length > 0) vaultMap[key] = nextList;
    else delete vaultMap[key];
    writeLocalVaultMap(vaultMap);
    bus.emit('cosmos-vault-changed', { action: 'delete', scopeKey: key, itemId: id }, { broadcast: true });

    if (auth.isSignedIn()) {
      const cloudRes = await api.post('cosmos_vault_delete', { payload: { scopeKey: key, itemId: id } }, { dedupe: false });
      return { ok: true, deletedItemId: id, scopeKey: key, synced: Boolean(cloudRes && cloudRes.ok) };
    }
    return { ok: true, deletedItemId: id, scopeKey: key, synced: false };
  }

  /* ---- Personalization Preferences (cosmosPrefs: Pins, Top 5 Recent, 3 Atmospheres) ---- */

  function getPrefs() {
    const unified = SafeStore.getJSON(COSMOS_PREFS_KEY, null);
    const legacyPins = SafeStore.getJSON(COSMOS_PIN_KEY, []);
    const legacyRecent = SafeStore.getJSON(COSMOS_RECENT_KEY, []);
    const legacyAtmo = SafeStore.getItem(COSMOS_ATMO_KEY, 'deep');
    const pinned = Array.isArray(unified && unified.pinnedGalaxies) ? unified.pinnedGalaxies : (Array.isArray(legacyPins) ? legacyPins : []);
    const recent = Array.isArray(unified && unified.recentGalaxies) ? unified.recentGalaxies : (Array.isArray(legacyRecent) ? legacyRecent : []);
    const rawAtmo = String((unified && unified.atmosphere) || legacyAtmo || 'deep').toLowerCase();
    const atmosphere = (rawAtmo === 'aurora' || rawAtmo === 'light') ? rawAtmo : 'deep';
    return {
      pinnedGalaxies: pinned.slice(0, 60),
      recentGalaxies: recent.slice(0, 5),
      atmosphere: atmosphere
    };
  }

  function persistPrefsLocally(nextPrefs) {
    SafeStore.setJSON(COSMOS_PREFS_KEY, nextPrefs);
    SafeStore.setJSON(COSMOS_PIN_KEY, nextPrefs.pinnedGalaxies);
    SafeStore.setJSON(COSMOS_RECENT_KEY, nextPrefs.recentGalaxies);
    SafeStore.setItem(COSMOS_ATMO_KEY, nextPrefs.atmosphere);
  }

  function applyAtmosphereToDom(mode) {
    const clean = (mode === 'aurora' || mode === 'light') ? mode : 'deep';
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-atmosphere', clean);
      document.documentElement.setAttribute('data-theme', clean === 'light' ? 'light' : 'dark');
    }
    return clean;
  }

  const prefs = Object.freeze({
    get: getPrefs,
    getAtmosphereLabel: function (mode) {
      const m = mode || getPrefs().atmosphere;
      if (m === 'aurora') return 'Cực Quang';
      if (m === 'light') return 'Ánh Sáng';
      return 'Thâm Không';
    },
    setAtmosphere: function (mode, skipCloud) {
      const clean = applyAtmosphereToDom(mode);
      const cur = getPrefs();
      const next = Object.assign({}, cur, { atmosphere: clean });
      persistPrefsLocally(next);
      bus.emit('atmosphere-changed', { atmosphere: clean }, { broadcast: true });
      bus.emit('cosmos-prefs-changed', next, { broadcast: true });
      if (!skipCloud && auth.isSignedIn()) {
        api.post('cosmos_prefs_save', { payload: next }, { silent: true, dedupe: false }).catch(function () {});
      }
      return next;
    },
    cycleAtmosphere: function () {
      const order = ['deep', 'aurora', 'light'];
      const cur = getPrefs().atmosphere;
      const next = order[(order.indexOf(cur) + 1) % order.length];
      return prefs.setAtmosphere(next);
    },
    togglePinGalaxy: function (galaxyId) {
      const gid = String(galaxyId || '').trim();
      if (!gid) return getPrefs();
      const cur = getPrefs();
      const exists = cur.pinnedGalaxies.indexOf(gid) !== -1;
      const nextPins = exists
        ? cur.pinnedGalaxies.filter(function (id) { return id !== gid; })
        : [gid].concat(cur.pinnedGalaxies).slice(0, 60);
      const next = Object.assign({}, cur, { pinnedGalaxies: nextPins });
      persistPrefsLocally(next);
      bus.emit('cosmos-prefs-changed', next, { broadcast: true });
      if (auth.isSignedIn()) {
        api.post('cosmos_prefs_save', { payload: next }, { silent: true, dedupe: false }).catch(function () {});
      }
      return next;
    },
    pushRecentGalaxy: function (galaxyId) {
      const gid = String(galaxyId || '').trim();
      if (!gid) return getPrefs();
      const cur = getPrefs();
      const nextRecent = [gid].concat(cur.recentGalaxies.filter(function (id) { return id !== gid; })).slice(0, 5);
      const next = Object.assign({}, cur, { recentGalaxies: nextRecent });
      persistPrefsLocally(next);
      bus.emit('cosmos-prefs-changed', next, { broadcast: true });
      if (auth.isSignedIn()) {
        api.post('cosmos_prefs_save', { payload: next }, { silent: true, dedupe: false }).catch(function () {});
      }
      return next;
    }
  });

  async function syncCosmosWorkspace() {
    if (!auth.isSignedIn()) {
      return { ok: true, source: 'local', cosmosVault: readLocalVaultMap(), cosmosPrefs: getPrefs(), canManageVault: canManageVault() };
    }
    const res = await api.post('cosmos_get_workspace', {}, { silent: true });
    if (res && res.ok) {
      if (res.cosmosVault && typeof res.cosmosVault === 'object') {
        writeLocalVaultMap(res.cosmosVault);
        bus.emit('cosmos-vault-changed', { action: 'sync', cosmosVault: res.cosmosVault }, { broadcast: false });
      }
      if (res.cosmosPrefs && typeof res.cosmosPrefs === 'object') {
        const merged = {
          pinnedGalaxies: Array.isArray(res.cosmosPrefs.pinnedGalaxies) ? res.cosmosPrefs.pinnedGalaxies : getPrefs().pinnedGalaxies,
          recentGalaxies: Array.isArray(res.cosmosPrefs.recentGalaxies) ? res.cosmosPrefs.recentGalaxies.slice(0, 5) : getPrefs().recentGalaxies,
          atmosphere: res.cosmosPrefs.atmosphere || getPrefs().atmosphere
        };
        persistPrefsLocally(merged);
        applyAtmosphereToDom(merged.atmosphere);
        bus.emit('cosmos-prefs-changed', merged, { broadcast: false });
      }
    }
    return res;
  }

  const vault = Object.freeze({
    workspaceFile: COSMOS_WORKSPACE_FILE,
    buildKey: buildVaultKey,
    parseKey: parseVaultKey,
    canManage: canManageVault,
    getVaultItems: getVaultItems,
    addVaultItem: addVaultItem,
    renameVaultItem: renameVaultItem,
    deleteVaultItem: deleteVaultItem,
    countVaultByGalaxy: countVaultByGalaxy,
    syncWorkspace: syncCosmosWorkspace
  });

  /* ---- Deep Linking Helpers (?galaxy=<id>&chapter=<index>&star=<index>) ---- */

  const nav = Object.freeze({
    buildCosmosUrl: function (params) {
      const p = params || {};
      const base = String(p.basePath || 'cosmos.html');
      const qs = [];
      if (p.galaxy) qs.push('galaxy=' + encodeURIComponent(String(p.galaxy)));
      if (p.chapter !== undefined && p.chapter !== null && p.chapter !== '') qs.push('chapter=' + encodeURIComponent(String(p.chapter)));
      if (p.star !== undefined && p.star !== null && p.star !== '') qs.push('star=' + encodeURIComponent(String(p.star)));
      if (p.planet !== undefined && p.planet !== null && p.planet !== '') qs.push('planet=' + encodeURIComponent(String(p.planet)));
      return qs.length ? (base + '?' + qs.join('&')) : base;
    },
    parseCosmosParams: function (searchStr) {
      const raw = typeof searchStr === 'string'
        ? searchStr
        : (typeof window !== 'undefined' && window.location ? window.location.search : '');
      const sp = new URLSearchParams(raw || '');
      const g = sp.get('galaxy') || '';
      const c = sp.get('chapter');
      const s = sp.get('star');
      const pl = sp.get('planet');
      return {
        galaxy: g ? String(g).trim() : '',
        chapter: c !== null && c !== '' && isFinite(Number(c)) ? parseInt(c, 10) : null,
        star: s !== null && s !== '' && isFinite(Number(s)) ? parseInt(s, 10) : null,
        planet: pl !== null && pl !== '' && isFinite(Number(pl)) ? parseInt(pl, 10) : null
      };
    },
    openInCosmos: function (params) {
      const url = nav.buildCosmosUrl(params);
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = url;
      }
      return url;
    }
  });

  // Apply persisted atmosphere on boot & listen for cross-tab atmosphere updates
  applyAtmosphereToDom(getPrefs().atmosphere);
  bus.on('atmosphere-changed', function (detail) {
    if (detail && detail.atmosphere) applyAtmosphereToDom(detail.atmosphere);
  }, { replay: false });
  bus.on('session-changed', function (s) {
    if (s && auth.isSignedIn()) {
      syncCosmosWorkspace().catch(function () {});
    }
  }, { replay: false });

  /* ==========================================================================
   * 6. PUBLIC EXPORT (window.VANTHESIS_CORE)
   * ========================================================================== */

  window.VANTHESIS_CORE = Object.freeze({
    version: '3.0',
    bus: bus,
    auth: auth,
    api: api,
    policy: policy,
    db: db,
    drive: drive,
    ui: ui,
    storage: SafeStore,
    catalog: catalog,
    vault: vault,
    prefs: prefs,
    nav: nav,
    // Phương thức chuẩn quản lí Kho học liệu 4 cấp dùng chung toàn hệ thống
    buildVaultKey: buildVaultKey,
    parseVaultKey: parseVaultKey,
    getVaultItems: getVaultItems,
    addVaultItem: addVaultItem,
    renameVaultItem: renameVaultItem,
    deleteVaultItem: deleteVaultItem,
    countVaultByGalaxy: countVaultByGalaxy,
    registerSector: registerSector,
    activateSector: activateSector,
    diagnose: openDiagnosticsModal,
    translateError: translateFriendlyError
  });
})();
