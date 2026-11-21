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
  const HEARTBEAT_INTERVAL_MS = 8000;
  const DEFAULT_API_TIMEOUT_MS = 25000;

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
      DRIVE_DOWNLOAD_FAILED: 'Không thể tải tệp từ Google Drive. Vui lòng kiểm tra quyền truy cập tệp.'
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

  const auth = {
    getSession: function () {
      const ctx = window.VANTHESIS_SESSION_CONTEXT;
      if (!ctx || !ctx.bridgeUrl || !ctx.accessToken) return null;
      return ctx;
    },
    isAuthenticated: function () {
      return Boolean(auth.getSession());
    },
    getEmail: function () {
      const s = auth.getSession();
      return s && s.email ? String(s.email).trim().toLowerCase() : '';
    },
    getAccessToken: function () {
      const s = auth.getSession();
      return s ? String(s.accessToken || '') : '';
    },
    refreshToken: function () {
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
  };

  function updateSyncRevIfNewer(rev, broadcast) {
    const n = Number(rev);
    if (!isFinite(n) || n <= 0) return;
    if (n > currentSyncRev) {
      currentSyncRev = n;
      bus.emit('sync-rev-changed', { syncRev: currentSyncRev }, { broadcast: Boolean(broadcast) });
    }
  }

  const api = {
    getSyncRev: function () {
      return currentSyncRev;
    },
    post: async function (action, payload, options) {
      const opts = options || {};
      const sess = auth.getSession();
      if (!sess) {
        return { ok: false, error: translateFriendlyError('UNAUTHORIZED_TOKEN'), rawError: 'UNAUTHORIZED_TOKEN' };
      }

      const timeoutMs = Math.max(3000, Number(opts.timeoutMs) || DEFAULT_API_TIMEOUT_MS);
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

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
            return api.post(action, payload, Object.assign({}, opts, { _retried: true }));
          }
          return { ok: false, error: translateFriendlyError('UNAUTHORIZED_TOKEN'), rawError: 'UNAUTHORIZED_TOKEN' };
        }

        const data = await resp.json();
        if (data && !data.ok && data.error === 'UNAUTHORIZED_TOKEN' && !opts._retried) {
          const refreshed = await auth.refreshToken();
          if (refreshed) {
            return api.post(action, payload, Object.assign({}, opts, { _retried: true }));
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
        const code = isAbort ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR';
        return { ok: false, error: translateFriendlyError(code), rawError: code };
      }
    },
    startHeartbeat: function () {
      if (heartbeatTimer) return;
      heartbeatTimer = setInterval(async function () {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        if (!auth.isAuthenticated()) return;
        const res = await api.post('sync_heartbeat', {}, { timeoutMs: 10000 });
        if (res && res.ok && res.syncRev) {
          updateSyncRevIfNewer(res.syncRev, true);
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    stopHeartbeat: function () {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }
  };

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
        const folderId = await drive.ensureFolder(o.folderName || 'VANTHESIS_Hoc_Lieu');
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
        --vt-cosmos-surface: rgba(255, 253, 248, 0.78);
        --vt-cosmos-surface-strong: rgba(255, 254, 250, 0.92);
        --vt-cosmos-text: #0F172A;
        --vt-cosmos-text-muted: #475569;
        --vt-cosmos-gold: #B45309;
        --vt-cosmos-cobalt: #1D4ED8;
        --vt-cosmos-meridian: rgba(180, 83, 9, 0.08);
        --vt-cosmos-border: rgba(15, 23, 42, 0.10);
        --vt-cosmos-border-top: rgba(255, 255, 255, 0.88);
        --vt-cosmos-glow: rgba(29, 78, 216, 0.11);
        --vt-cosmos-glow-gold: rgba(180, 83, 9, 0.09);
        --vt-cosmos-shadow: 0 18px 46px -14px rgba(15, 23, 42, 0.12);
        --vt-cosmos-radius-outer: 30px;
        --vt-cosmos-radius-frame: 22px;
        --vt-cosmos-radius-card: 16px;
        --vt-cosmos-radius-pill: 9999px;
        --vt-cosmos-font-display: 'Cormorant Garamond', 'Newsreader', Georgia, serif;
        --vt-cosmos-font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        --vt-cosmos-font-mono: 'JetBrains Mono', ui-monospace, monospace;
        --vt-cosmos-ease: cubic-bezier(0.22, 1, 0.36, 1);
        --vt-mx: 50vw;
        --vt-my: 20vh;
      }
      html[data-theme="dark"] {
        color-scheme: dark;
        --vt-cosmos-bg: #030613;
        --vt-cosmos-bg-deep: #070E24;
        --vt-cosmos-surface: rgba(10, 17, 38, 0.72);
        --vt-cosmos-surface-strong: rgba(12, 20, 44, 0.88);
        --vt-cosmos-text: #F1F5F9;
        --vt-cosmos-text-muted: #94A3B8;
        --vt-cosmos-gold: #FBBF24;
        --vt-cosmos-cobalt: #38BDF8;
        --vt-cosmos-meridian: rgba(148, 163, 184, 0.08);
        --vt-cosmos-border: rgba(148, 163, 184, 0.18);
        --vt-cosmos-border-top: rgba(255, 255, 255, 0.22);
        --vt-cosmos-glow: rgba(56, 189, 248, 0.15);
        --vt-cosmos-glow-gold: rgba(251, 191, 36, 0.10);
        --vt-cosmos-shadow: 0 22px 56px -14px rgba(2, 6, 23, 0.65);
      }

      /* Starlight Refractive Liquid Glass Cards */
      .vtc-glass-card, .vt-bento-card {
        position: relative;
        background: var(--vt-cosmos-surface);
        border: 1px solid var(--vt-cosmos-border);
        border-top: 1px solid var(--vt-cosmos-border-top);
        border-radius: var(--vt-cosmos-radius-frame);
        box-shadow: var(--vt-cosmos-shadow);
        backdrop-filter: blur(22px) saturate(145%);
        -webkit-backdrop-filter: blur(22px) saturate(145%);
        transition: transform 0.24s var(--vt-cosmos-ease), border-color 0.24s var(--vt-cosmos-ease), box-shadow 0.24s var(--vt-cosmos-ease);
        overflow: hidden;
      }
      .vtc-glass-card::before, .vt-bento-card::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        background: radial-gradient(380px circle at var(--vt-card-mx, 50%) var(--vt-card-my, 0%), var(--vt-cosmos-glow), transparent 62%);
        transition: opacity 0.28s var(--vt-cosmos-ease);
        z-index: 0;
      }
      .vtc-glass-card:hover::before, .vt-bento-card:hover::before {
        opacity: 1;
      }
      .vtc-glass-card > *, .vt-bento-card > * {
        position: relative;
        z-index: 1;
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
        padding: 11px 20px;
        border-radius: var(--vt-cosmos-radius-pill);
        background: rgba(8, 14, 34, 0.88);
        color: #F8FAFC;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-top: 1px solid rgba(255, 255, 255, 0.24);
        box-shadow: 0 20px 48px rgba(2, 6, 23, 0.44);
        backdrop-filter: blur(22px) saturate(145%);
        -webkit-backdrop-filter: blur(22px) saturate(145%);
        font-family: var(--vt-cosmos-font-sans);
        font-size: 13.5px;
        font-weight: 700;
        line-height: 1.45;
        opacity: 0;
        transform: translateY(-12px) scale(0.97);
        transition: opacity 0.22s var(--vt-cosmos-ease), transform 0.22s var(--vt-cosmos-ease);
      }
      .vtc-toast.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      html[data-theme="light"] .vtc-toast {
        background: rgba(255, 253, 248, 0.94);
        color: #0F172A;
        border-color: rgba(15, 23, 42, 0.12);
        border-top-color: rgba(255, 255, 255, 0.95);
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
      }
      .vtc-toast.success { border-color: rgba(16, 185, 129, 0.65); }
      .vtc-toast.warning { border-color: rgba(245, 158, 11, 0.68); }
      .vtc-toast.error { border-color: rgba(239, 68, 68, 0.72); }

      .vtc-confirm-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9998;
        background: rgba(3, 6, 19, 0.56);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
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
        backdrop-filter: blur(24px) saturate(145%);
        -webkit-backdrop-filter: blur(24px) saturate(145%);
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
        transition: transform 0.16s var(--vt-cosmos-ease), filter 0.16s ease;
      }
      .vtc-btn:hover { transform: translateY(-1px); }
      .vtc-btn-primary {
        background: linear-gradient(135deg, #1D4ED8, #2563EB);
        color: #FFFFFF;
        border-color: transparent;
        box-shadow: 0 8px 20px -6px rgba(29, 78, 216, 0.45);
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

  let starlightTrackerInitialized = false;
  function initStarlightTracker() {
    if (starlightTrackerInitialized || typeof window === 'undefined' || typeof document === 'undefined') return;
    starlightTrackerInitialized = true;
    ensureCoreStyles();

    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (isCoarse && !canHover) return;

    let rafId = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTarget = null;

    function flushPointer() {
      rafId = 0;
      document.documentElement.style.setProperty('--vt-mx', lastX + 'px');
      document.documentElement.style.setProperty('--vt-my', lastY + 'px');
      if (lastTarget && typeof lastTarget.closest === 'function') {
        const card = lastTarget.closest('.vtc-glass-card, .vt-bento-card, .bento-card, .vt-res-card, .vt-cls-card');
        if (card) {
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--vt-card-mx', (lastX - rect.left) + 'px');
          card.style.setProperty('--vt-card-my', (lastY - rect.top) + 'px');
        }
      }
    }

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTarget = e.target;
      if (!rafId) rafId = requestAnimationFrame(flushPointer);
    }, { passive: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initStarlightTracker);
    } else {
      initStarlightTracker();
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
    toast: function (message, type) {
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
      el.textContent = String(message || '');
      host.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('visible'); });
      clearTimeout(activeToastTimer);
      activeToastTimer = setTimeout(function () {
        el.classList.remove('visible');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
      }, 3200);
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
    initStarlightTracker: initStarlightTracker,
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
   * 6. PUBLIC EXPORT (window.VANTHESIS_CORE)
   * ========================================================================== */

  window.VANTHESIS_CORE = Object.freeze({
    version: '1.0',
    bus: bus,
    auth: auth,
    api: api,
    policy: policy,
    db: db,
    drive: drive,
    ui: ui,
    translateError: translateFriendlyError
  });
})();