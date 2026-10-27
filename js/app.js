// public/js/app.js
(function () {
  'use strict';

  // State
  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  let currentRoom = getRoomFromUrl();
  let items = [];
  let activeFilter = 'all';
  let sortOrder = 'newest';
  let searchQuery = '';
  const expandedNoteIds = new Set();
  const selectedItemIds = new Set();
  let lastClickedCheckboxId = null;
  const THEME_STORAGE_KEY = 'qsh_theme';
  let currentTheme = 'dark';
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let currentQrText = '';
  let currentQrTitle = '';
  let currentQrDataUrl = '';
  let currentQrPromise = null;
  let publicOrigin = '';

  // DOM Elements
  const wsStatusPill = document.getElementById('wsStatusPill');
  const wsStatusText = document.getElementById('wsStatusText');
  const currentRoomBadge = document.getElementById('currentRoomBadge');
  const roomSwitchBtn = document.getElementById('roomSwitchBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const shortcutsBtn = document.getElementById('shortcutsBtn');
  const roomQrBtn = document.getElementById('roomQrBtn');
  const clearRoomBtn = document.getElementById('clearRoomBtn');

  const itemInput = document.getElementById('itemInput');
  const ttlSelect = document.getElementById('ttlSelect');
  const sendItemBtn = document.getElementById('sendItemBtn');
  const copyLatestBtn = document.getElementById('copyLatestBtn');
  const pasteClipboardBtn = document.getElementById('pasteClipboardBtn');
  const composerCharCount = document.getElementById('composerCharCount');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadProgressBar = document.getElementById('uploadProgressBar');

  const filterTabs = document.querySelectorAll('.filter-tab');
  const filterTabsBar = document.getElementById('filterTabsBar');
  const sortOrderSelect = document.getElementById('sortOrderSelect');
  const searchInput = document.getElementById('searchInput');
  const batchActionBar = document.getElementById('batchActionBar');
  const batchSelectedCount = document.getElementById('batchSelectedCount');
  const batchSelectAllBtn = document.getElementById('batchSelectAllBtn');
  const batchCopySelectedBtn = document.getElementById('batchCopySelectedBtn');
  const batchDownloadSelectedBtn = document.getElementById('batchDownloadSelectedBtn');
  const batchPinSelectedBtn = document.getElementById('batchPinSelectedBtn');
  const batchExportSelectedBtn = document.getElementById('batchExportSelectedBtn');
  const batchDeleteSelectedBtn = document.getElementById('batchDeleteSelectedBtn');
  const batchClearSelectionBtn = document.getElementById('batchClearSelectionBtn');
  const itemsContainer = document.getElementById('itemsContainer');

  const countAll = document.getElementById('countAll');
  const countPinned = document.getElementById('countPinned');
  const countLink = document.getElementById('countLink');
  const countNote = document.getElementById('countNote');
  const countFile = document.getElementById('countFile');

  // Storage & Bandwidth Dashboard Elements
  const telemetryDashboard = document.getElementById('telemetryDashboard');
  const telemetryToggleBtn = document.getElementById('telemetryToggleBtn');
  const syncCloudNowBtn = document.getElementById('syncCloudNowBtn');
  const exportRoomBtn = document.getElementById('exportRoomBtn');
  const importRoomBtn = document.getElementById('importRoomBtn');
  const importRoomInput = document.getElementById('importRoomInput');
  const cleanupStorageBtn = document.getElementById('cleanupStorageBtn');
  const resetBandwidthBtn = document.getElementById('resetBandwidthBtn');
  const statStoragePercent = document.getElementById('statStoragePercent');
  const statStorageUsed = document.getElementById('statStorageUsed');
  const statStorageQuota = document.getElementById('statStorageQuota');
  const storageQuotaBar = document.getElementById('storageQuotaBar');
  const statStorageBreakdown = document.getElementById('statStorageBreakdown');
  const statBandwidthPercent = document.getElementById('statBandwidthPercent');
  const statBandwidthTotal = document.getElementById('statBandwidthTotal');
  const statBandwidthQuota = document.getElementById('statBandwidthQuota');
  const bandwidthQuotaBar = document.getElementById('bandwidthQuotaBar');
  const statBandwidthSplit = document.getElementById('statBandwidthSplit');
  const statLiveSpeedBadge = document.getElementById('statLiveSpeedBadge');
  const statPageFootprint = document.getElementById('statPageFootprint');
  const statNetworkRequests = document.getElementById('statNetworkRequests');
  const statTransferBreakdown = document.getElementById('statTransferBreakdown');
  const statTotalItemsCount = document.getElementById('statTotalItemsCount');
  const statTypeFileBytes = document.getElementById('statTypeFileBytes');
  const statTypeNoteBytes = document.getElementById('statTypeNoteBytes');
  const statTypeLinkBytes = document.getElementById('statTypeLinkBytes');

  // Modals
  const qrModal = document.getElementById('qrModal');
  const qrModalTitle = document.getElementById('qrModalTitle');
  const qrImage = document.getElementById('qrImage');
  const qrCaption = document.getElementById('qrCaption');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const copyQrTextBtn = document.getElementById('copyQrTextBtn');
  const downloadQrImgBtn = document.getElementById('downloadQrImgBtn');
  const shareQrImgBtn = document.getElementById('shareQrImgBtn');

  const pdfModal = document.getElementById('pdfModal');
  const pdfModalTitle = document.getElementById('pdfModalTitle');
  const pdfViewerFrame = document.getElementById('pdfViewerFrame');
  const pdfModalOpenTab = document.getElementById('pdfModalOpenTab');
  const pdfModalDownload = document.getElementById('pdfModalDownload');
  const closePdfModalBtn = document.getElementById('closePdfModalBtn');
  const copyModalImageBtn = document.getElementById('copyModalImageBtn');
  const copyModalTextBtn = document.getElementById('copyModalTextBtn');
  const pdfMobileFallbackBar = document.getElementById('pdfMobileFallbackBar');
  const pdfFallbackOpenLink = document.getElementById('pdfFallbackOpenLink');
  const pdfFallbackDownloadLink = document.getElementById('pdfFallbackDownloadLink');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const modalImagePreview = document.getElementById('modalImagePreview');
  const textPreviewContainer = document.getElementById('textPreviewContainer');
  const modalTextPreview = document.getElementById('modalTextPreview');
  let currentModalTextContent = '';
  let currentModalItemId = '';
  let lastWakeSyncAt = 0;

  const editModal = document.getElementById('editModal');
  const editModalTitle = document.getElementById('editModalTitle');
  const editItemTitleInput = document.getElementById('editItemTitleInput');
  const editItemTextarea = document.getElementById('editItemTextarea');
  const editItemTtlSelect = document.getElementById('editItemTtlSelect');
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditItemBtn = document.getElementById('cancelEditItemBtn');
  const saveEditItemBtn = document.getElementById('saveEditItemBtn');
  let editingItemId = null;

  const roomModal = document.getElementById('roomModal');
  const roomNameInput = document.getElementById('roomNameInput');
  const recentRoomsList = document.getElementById('recentRoomsList');
  const closeRoomModalBtn = document.getElementById('closeRoomModalBtn');
  const randomRoomBtn = document.getElementById('randomRoomBtn');
  const copyRoomLinkBtn = document.getElementById('copyRoomLinkBtn');
  const resetDefaultRoomBtn = document.getElementById('resetDefaultRoomBtn');
  const confirmRoomBtn = document.getElementById('confirmRoomBtn');

  const shortcutsModal = document.getElementById('shortcutsModal');
  const closeShortcutsModalBtn = document.getElementById('closeShortcutsModalBtn');

  const toastContainer = document.getElementById('toastContainer');

  // Helpers
  function getRoomFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('room');
    return (raw && raw.trim()) ? raw.trim().toLowerCase() : 'default';
  }

  function getInitialTheme() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          return saved;
        }
      }
    } catch (_) {}
    return 'dark';
  }

  function applyTheme(theme, persist = false) {
    const validTheme = theme === 'light' ? 'light' : 'dark';
    currentTheme = validTheme;
    if (document.documentElement && typeof document.documentElement.setAttribute === 'function') {
      document.documentElement.setAttribute('data-theme', validTheme);
    }
    if (themeToggleBtn) {
      themeToggleBtn.textContent = validTheme === 'light' ? '☀️ Sáng' : '🌙 Tối';
      themeToggleBtn.setAttribute(
        'title',
        validTheme === 'light'
          ? 'Đang ở giao diện Sáng — Bấm để chuyển sang Tối'
          : 'Đang ở giao diện Tối — Bấm để chuyển sang Sáng'
      );
    }
    if (persist) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, validTheme);
        }
      } catch (_) {}
    }
  }

  function toggleTheme() {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme, true);
    showToast(nextTheme === 'light' ? '☀️ Đã chuyển sang giao diện Sáng (Light Mode)!' : '🌙 Đã chuyển sang giao diện Tối (Dark Mode)!');
  }

  function getShareOrigin() {
    const host = window.location.hostname;
    if ((host === 'localhost' || host === '127.0.0.1') && publicOrigin) {
      return publicOrigin.replace(/\/+$/, '');
    }
    if (host.endsWith('.github.io')) {
      const basePath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
      return `${window.location.origin}${basePath}`;
    }
    return window.location.origin;
  }

  function getShareRoomUrl(roomOverride) {
    const base = getShareOrigin();
    const targetRoom = (roomOverride && typeof roomOverride === 'string' && roomOverride.trim())
      ? roomOverride.trim().toLowerCase()
      : currentRoom;
    if (targetRoom === 'default') {
      return `${base}/`;
    }
    return `${base}/?room=${encodeURIComponent(targetRoom)}`;
  }

  function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '#';
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'ftp:') {
        return parsed.href;
      }
    } catch (_) {}
    return '#';
  }

  function showToast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3200);
  }

  function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function formatRelativeTime(epochMs) {
    if (!epochMs) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
    if (diffSec < 10) return 'Vừa xong';
    if (diffSec < 60) return `${diffSec} giây trước`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} giờ trước`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays} ngày trước`;
  }

  function formatRemainingTtl(expiresAt) {
    if (!expiresAt) return 'Vĩnh viễn';
    const remMs = expiresAt - Date.now();
    if (remMs <= 0) return 'Đã hết hạn';
    const remSec = Math.floor(remMs / 1000);
    if (remSec < 60) return `Còn ${remSec}s`;
    const remMin = Math.floor(remSec / 60);
    if (remMin < 60) return `Còn ${remMin} phút`;
    const remHr = Math.floor(remMin / 60);
    if (remHr < 24) return `Còn ${remHr}h ${remMin % 60}m`;
    const remDays = Math.floor(remHr / 24);
    return `Còn ${remDays} ngày`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripUnbalancedTrailingPunct(rawUrl) {
    let url = rawUrl;
    let trailing = '';
    while (url.length > 0) {
      const lastChar = url[url.length - 1];
      if (url.endsWith('**')) {
        trailing = '**' + trailing;
        url = url.slice(0, -2);
      } else if (/[.,;:!?]/.test(lastChar)) {
        trailing = lastChar + trailing;
        url = url.slice(0, -1);
      } else if (lastChar === ')') {
        const opens = (url.match(/\(/g) || []).length;
        const closes = (url.match(/\)/g) || []).length;
        if (closes > opens) {
          trailing = lastChar + trailing;
          url = url.slice(0, -1);
        } else {
          break;
        }
      } else if (lastChar === ']') {
        const opens = (url.match(/\[/g) || []).length;
        const closes = (url.match(/\]/g) || []).length;
        if (closes > opens) {
          trailing = lastChar + trailing;
          url = url.slice(0, -1);
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return { url, trailing };
  }

  function escapeTextAndRestoreUrls(rawSlice, urlHtmlList) {
    if (!rawSlice) return '';
    if (!Array.isArray(urlHtmlList) || urlHtmlList.length === 0) {
      return escapeHtml(rawSlice);
    }
    const tokenRegex = /\x00QSHURL_(\d+)_\x00/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = tokenRegex.exec(rawSlice)) !== null) {
      if (m.index > last) {
        out += escapeHtml(rawSlice.slice(last, m.index));
      }
      const idx = Number(m[1]);
      out += (Number.isInteger(idx) && urlHtmlList[idx]) ? urlHtmlList[idx] : '';
      last = m.index + m[0].length;
    }
    if (last < rawSlice.length) {
      out += escapeHtml(rawSlice.slice(last));
    }
    return out;
  }

  function renderTextWithBold(textSlice, urlHtmlList = []) {
    if (!textSlice) return '';
    const str = String(textSlice);
    const boldRegex = /\*\*(?!\s)((?:(?!\*\*)[^\r\n])+?)(?<!\s)\*\*/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = boldRegex.exec(str)) !== null) {
      if (m.index > last) {
        out += escapeTextAndRestoreUrls(str.slice(last, m.index), urlHtmlList);
      }
      out += `<strong>${escapeTextAndRestoreUrls(m[1], urlHtmlList)}</strong>`;
      last = m.index + m[0].length;
    }
    if (last < str.length) {
      out += escapeTextAndRestoreUrls(str.slice(last), urlHtmlList);
    }
    return out;
  }

  function renderPlainTextWithLinks(textSegment) {
    if (!textSegment) return '';
    const str = String(textSegment).replace(/\x00/g, '');
    const urlRegex = /https?:\/\/[^\s<>"'`]+/gi;
    const urlHtmlList = [];
    let tokenized = '';
    let lastIdx = 0;
    let match;
    while ((match = urlRegex.exec(str)) !== null) {
      const matchStart = match.index;
      if (matchStart > lastIdx) {
        tokenized += str.slice(lastIdx, matchStart);
      }
      const { url: rawUrl, trailing } = stripUnbalancedTrailingPunct(match[0]);
      const safeHref = sanitizeUrl(rawUrl);
      if (safeHref !== '#') {
        const urlIdx = urlHtmlList.length;
        urlHtmlList.push(
          `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer" class="note-inline-link">${escapeHtml(rawUrl)}</a>`
        );
        tokenized += `\x00QSHURL_${urlIdx}_\x00${trailing}`;
      } else {
        tokenized += match[0];
      }
      lastIdx = matchStart + match[0].length;
    }
    if (lastIdx < str.length) {
      tokenized += str.slice(lastIdx);
    }
    return renderTextWithBold(tokenized, urlHtmlList);
  }

  function renderInlineCodeAndLinks(lineText) {
    if (!lineText) return '';
    const str = String(lineText);
    const inlineCodeRegex = /(?<!`)`([^`\r\n]+)`(?!`)/g;
    let result = '';
    let lastIdx = 0;
    let match;
    while ((match = inlineCodeRegex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        result += renderPlainTextWithLinks(str.slice(lastIdx, match.index));
      }
      result += `<code class="note-inline-code">${escapeHtml(match[1])}</code>`;
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < str.length) {
      result += renderPlainTextWithLinks(str.slice(lastIdx));
    }
    return result;
  }

  function renderNonFencedSegment(segmentText, baseLineIdx, isAtLineStart, itemId) {
    if (!segmentText) return '';
    const lines = String(segmentText).split('\n');
    return lines.map((rawLine, idx) => {
      const hasCr = rawLine.endsWith('\r');
      const line = hasCr ? rawLine.slice(0, -1) : rawLine;
      const crSuffix = hasCr ? '\r' : '';
      const lineIdx = baseLineIdx + idx;
      const canMatchTask = idx > 0 || isAtLineStart;
      if (canMatchTask) {
        const taskMatch = line.match(/^(\s*[-*]\s+)\[([ xX])\](.*)$/);
        if (taskMatch) {
          const indent = (taskMatch[1].match(/^\s*/) || [''])[0];
          const isChecked = taskMatch[2].toLowerCase() === 'x';
          const taskBody = (taskMatch[3] || '').replace(/^\s+/, '');
          const renderedBody = renderInlineCodeAndLinks(taskBody);
          return `${escapeHtml(indent)}<div class="note-task-row ${isChecked ? 'note-task-done' : ''}"><input type="checkbox" class="note-task-cb js-note-task-cb" data-id="${escapeHtml(itemId || '')}" data-line="${lineIdx}" ${isChecked ? 'checked' : ''} /><span class="note-task-text ${isChecked ? 'note-task-done' : ''}">${renderedBody}</span></div>${crSuffix}`;
        }
      }
      return renderInlineCodeAndLinks(line) + crSuffix;
    }).join('\n');
  }

  function renderNoteContentWithLinks(rawText, itemId = '') {
    if (!rawText) return '';
    const str = String(rawText);
    const fenceRegex = /(`{3,})(?:([a-zA-Z0-9_+#.-]*)[ \t]*\r?\n([\s\S]*?)|[ \t]*([^\r\n`]+?)[ \t]*)\1(?!`)/g;
    let result = '';
    let lastIdx = 0;
    let match;
    while ((match = fenceRegex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        const baseLineIdx = lastIdx === 0 ? 0 : (str.slice(0, lastIdx).match(/\n/g) || []).length;
        const isAtLineStart = lastIdx === 0 || str[lastIdx - 1] === '\n';
        result += renderNonFencedSegment(str.slice(lastIdx, match.index), baseLineIdx, isAtLineStart, itemId);
      }
      const isMultiLine = match[3] !== undefined;
      const lang = isMultiLine ? ((match[2] || '').trim() || 'code') : 'code';
      const rawCode = isMultiLine ? match[3].replace(/\r?\n$/, '') : (match[4] || '');
      result += `<div class="note-code-block"><div class="note-code-header"><span class="note-code-lang">${escapeHtml(lang)}</span><button type="button" class="btn btn-sm js-copy-code-btn" data-code="${escapeHtml(rawCode)}">📋 Copy Code</button></div><code class="note-code-content">${escapeHtml(rawCode)}</code></div>`;
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < str.length) {
      const baseLineIdx = lastIdx === 0 ? 0 : (str.slice(0, lastIdx).match(/\n/g) || []).length;
      const isAtLineStart = lastIdx === 0 || str[lastIdx - 1] === '\n';
      result += renderNonFencedSegment(str.slice(lastIdx), baseLineIdx, isAtLineStart, itemId);
    }
    return result;
  }

  function extractFirstLineTitle(text) {
    if (!text || typeof text !== 'string') return '';
    const firstLine = text.split(/\r?\n/)[0].trim();
    if (firstLine.length <= 60) return firstLine;
    return firstLine.slice(0, 57).trim() + '...';
  }

  function extractLinkDefaultTitle(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname) return parsed.hostname;
    } catch (_) {}
    return '';
  }

  function getCustomItemTitle(item) {
    if (!item || typeof item !== 'object') return '';
    const rawTitle = String(item.title || '').trim();
    if (!rawTitle) return '';
    if (item.type === 'link') {
      const rawContent = String(item.content || '').trim();
      const defaultDomain = String(item.domain || extractLinkDefaultTitle(rawContent) || '').trim();
      if (rawTitle !== rawContent && rawTitle !== defaultDomain) {
        return rawTitle;
      }
      return '';
    }
    if (item.type === 'note') {
      const defaultNoteTitle = extractFirstLineTitle(item.content);
      if (rawTitle !== defaultNoteTitle) {
        return rawTitle;
      }
      return '';
    }
    if (item.type === 'file') {
      const rawFileName = String(item.fileName || item.file_name || '').trim();
      if (rawTitle !== rawFileName) {
        return rawTitle;
      }
      return '';
    }
    return '';
  }

  function updateComposerCounter() {
    if (!composerCharCount || !itemInput) return;
    const val = itemInput.value || '';
    const chars = val.length;
    const lines = val ? val.split(/\r?\n/).length : 1;
    composerCharCount.textContent = `${chars.toLocaleString('vi-VN')} ký tự • ${lines} dòng`;
  }

  const DRAFT_KEY_PREFIX = 'qsh_draft_';

  function getDraftStorageKey(room = currentRoom) {
    const clean = (room && typeof room === 'string' && room.trim())
      ? room.trim().toLowerCase()
      : 'default';
    return `${DRAFT_KEY_PREFIX}${clean}`;
  }

  function saveComposerDraft(room = currentRoom) {
    if (!itemInput) return;
    try {
      if (typeof localStorage !== 'undefined') {
        const key = getDraftStorageKey(room);
        const val = itemInput.value || '';
        if (val.trim()) {
          localStorage.setItem(key, val);
        } else if (typeof localStorage.removeItem === 'function') {
          localStorage.removeItem(key);
        } else if (typeof localStorage.setItem === 'function') {
          localStorage.setItem(key, '');
        }
      }
    } catch (_) {}
  }

  function clearComposerDraft(room = currentRoom) {
    try {
      if (typeof localStorage !== 'undefined') {
        const key = getDraftStorageKey(room);
        if (typeof localStorage.removeItem === 'function') {
          localStorage.removeItem(key);
        } else if (typeof localStorage.setItem === 'function') {
          localStorage.setItem(key, '');
        }
      }
    } catch (_) {}
  }

  function restoreComposerDraft(room = currentRoom) {
    if (!itemInput) return;
    let saved = '';
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        const raw = localStorage.getItem(getDraftStorageKey(room)) || '';
        saved = raw.trim() ? raw : '';
      }
    } catch (_) {}
    itemInput.value = saved;
    updateComposerCounter();
  }

  async function copyToClipboard(text, buttonEl, toastMessage = '📋 Đã sao chép vào Clipboard!') {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (buttonEl) {
      const original = buttonEl.innerHTML;
      buttonEl.innerHTML = '✅ Đã copy!';
      setTimeout(() => {
        buttonEl.innerHTML = original;
      }, 1500);
    }
    if (toastMessage) {
      showToast(toastMessage);
    }
  }

  async function convertImageBlobToPng(blob) {
    try {
      if (typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Image === 'function') {
        const canvas = document.createElement('canvas');
        const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (ctx && typeof canvas.toBlob === 'function') {
          const objUrl = URL.createObjectURL(blob);
          try {
            const img = await new Promise((resolve, reject) => {
              const el = new Image();
              el.onload = () => resolve(el);
              el.onerror = reject;
              el.src = objUrl;
            });
            canvas.width = img.naturalWidth || img.width || 1;
            canvas.height = img.naturalHeight || img.height || 1;
            ctx.drawImage(img, 0, 0);
            const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (pngBlob) return pngBlob;
          } finally {
            if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(objUrl);
          }
        }
      }
    } catch (_) {}
    return new Blob([blob], { type: 'image/png' });
  }

  async function copyImageToClipboard(id, buttonEl) {
    if (!id) return;
    const item = items.find((i) => i.id === id);
    const isCloud = Boolean(window.QSHCloud && window.QSHCloud.isCloudMode());
    try {
      let blob = null;
      if (isCloud && window.QSHCloud && typeof window.QSHCloud.getFileBlob === 'function') {
        blob = await window.QSHCloud.getFileBlob(id);
      } else {
        const res = await fetch(`/api/files/${encodeURIComponent(id)}/download`);
        if (res && res.ok && typeof res.blob === 'function') {
          blob = await res.blob();
        }
      }
      if (!blob) {
        throw new Error('Image blob unavailable');
      }
      const mime = (blob && blob.type) || (item && (item.mimeType || item.mime_type)) || 'image/png';
      const typedBlob = (blob && blob.type) ? blob : new Blob([blob], { type: mime });
      const Ctor = (typeof ClipboardItem === 'function')
        ? ClipboardItem
        : (window && typeof window.ClipboardItem === 'function' ? window.ClipboardItem : null);
      if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && Ctor) {
        const primaryType = typedBlob.type || 'image/png';
        try {
          await navigator.clipboard.write([new Ctor({ [primaryType]: typedBlob })]);
        } catch (writeErr) {
          if (primaryType !== 'image/png') {
            const pngBlob = await convertImageBlobToPng(typedBlob);
            await navigator.clipboard.write([new Ctor({ 'image/png': pngBlob })]);
          } else {
            throw writeErr;
          }
        }
        if (buttonEl) {
          const original = buttonEl.innerHTML;
          buttonEl.innerHTML = '✅ Đã copy ảnh!';
          setTimeout(() => {
            buttonEl.innerHTML = original;
          }, 1500);
        }
        showToast('🖼️ Đã sao chép ảnh vào Clipboard! (Nhấn Ctrl+V để dán)');
        return;
      }
    } catch (_) {}

    const shareOrigin = getShareOrigin();
    const fallbackUrl = isCloud
      ? `${shareOrigin}/?room=${encodeURIComponent(currentRoom)}&preview=${encodeURIComponent(id)}`
      : `${shareOrigin}/api/files/${encodeURIComponent(id)}/preview`;
    await copyToClipboard(fallbackUrl, buttonEl);
  }

  // API Calls
  async function fetchPublicOrigin() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data && typeof data.publicUrl === 'string' && data.publicUrl.startsWith('http')) {
        publicOrigin = data.publicUrl.replace(/\/+$/, '');
        renderItems();
      }
    } catch (_) {}
  }

  let deepLinkHandled = false;
  async function fetchItems(forceSync = false) {
    try {
      const syncParam = forceSync ? '&sync=1' : '';
      const res = await fetch(`/api/items?room=${encodeURIComponent(currentRoom)}${syncParam}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        items = data.items;
        renderItems();
        if (!deepLinkHandled) {
          deepLinkHandled = true;
          const params = new URLSearchParams(window.location.search);
          const previewId = params.get('preview');
          const downloadId = params.get('download');
          const sharedTitle = (params.get('shared_title') || '').trim();
          const sharedText = (params.get('shared_text') || '').trim();
          const sharedUrl = (params.get('shared_url') || '').trim();

          if (sharedTitle || sharedText || sharedUrl) {
            const hasDistinctText = Boolean(
              sharedText &&
              sharedText !== sharedUrl &&
              sharedText !== sharedTitle
            );
            let combinedShare = '';
            let explicitTitle;
            if (sharedUrl && !hasDistinctText && /^https?:\/\/\S+$/i.test(sharedUrl)) {
              combinedShare = sharedUrl;
              if (sharedTitle && sharedTitle !== sharedUrl) {
                explicitTitle = sharedTitle;
              }
            } else {
              const shareParts = [];
              if (sharedTitle && sharedTitle !== sharedUrl && (!sharedText || !sharedText.includes(sharedTitle))) {
                shareParts.push(sharedTitle);
              }
              if (sharedText && sharedText !== sharedUrl) {
                shareParts.push(sharedText);
              }
              if (sharedUrl && (!sharedText || !sharedText.includes(sharedUrl))) {
                shareParts.push(sharedUrl);
              }
              combinedShare = shareParts.join('\n').trim();
            }
            try {
              const cleanUrl = new URL(window.location.href);
              cleanUrl.searchParams.delete('shared_title');
              cleanUrl.searchParams.delete('shared_text');
              cleanUrl.searchParams.delete('shared_url');
              const nextHref = cleanUrl.toString();
              if (window.history && typeof window.history.replaceState === 'function') {
                window.history.replaceState({}, '', nextHref);
              } else if (window.history && typeof window.history.pushState === 'function') {
                window.history.pushState({}, '', nextHref);
              }
            } catch (_) {}
            if (combinedShare) {
              await createTextItem(combinedShare, (ttlSelect && ttlSelect.value) ? ttlSelect.value : 'never', explicitTitle, false);
            }
          } else if (previewId) {
            const target = items.find((i) => i.id === previewId);
            openPdfPreviewModal(previewId, target ? (target.fileName || target.file_name || target.title) : undefined);
          } else if (downloadId) {
            const target = items.find((i) => i.id === downloadId);
            triggerCloudFileDownload(downloadId, target ? (target.fileName || target.file_name || target.title) : undefined);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  }

  async function createTextItem(content, ttl = (ttlSelect && ttlSelect.value) ? ttlSelect.value : 'never', title = undefined, clearDraft = true) {
    const trimmed = (content || '').trim();
    if (!trimmed) {
      showToast('⚠️ Vui lòng nhập nội dung hoặc dán từ Clipboard!');
      return;
    }

    sendItemBtn.disabled = true;
    try {
      const payload = {
        room: currentRoom,
        content: trimmed,
        ttl
      };
      if (title && typeof title === 'string' && title.trim()) {
        payload.title = title.trim();
      }
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success && data.item) {
        if (clearDraft) {
          itemInput.value = '';
          clearComposerDraft(currentRoom);
          updateComposerCounter();
        }
        upsertItemInState(data.item);
        showToast('🚀 Đã chia sẻ thành công!');
      } else {
        showToast('❌ Lỗi: ' + (data.error || 'Không thể tạo mục'));
      }
    } catch (err) {
      showToast('❌ Lỗi kết nối máy chủ');
    } finally {
      sendItemBtn.disabled = false;
    }
  }

  async function uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    uploadProgress.classList.add('active');
    uploadProgressBar.style.width = '20%';
    const optionalCaption = (itemInput && itemInput.value) ? itemInput.value.trim() : '';
    let uploadedAny = false;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append('room', currentRoom);
      formData.append('ttl', (ttlSelect && ttlSelect.value) ? ttlSelect.value : 'never');
      if (optionalCaption) {
        formData.append('caption', optionalCaption);
      }
      formData.append('file', file, file.name);

      try {
        uploadProgressBar.style.width = `${Math.round(((i + 0.5) / fileList.length) * 100)}%`;
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success && data.item) {
          uploadedAny = true;
          upsertItemInState(data.item);
          showToast(`📄 Đã tải lên: ${file.name}`);
        } else {
          showToast(`❌ Lỗi tải file ${file.name}: ${data.error || 'Thất bại'}`);
        }
      } catch (err) {
        showToast(`❌ Lỗi mạng khi tải lên ${file.name}`);
      }
    }

    if (uploadedAny && optionalCaption && itemInput) {
      itemInput.value = '';
      clearComposerDraft(currentRoom);
      updateComposerCounter();
    }

    uploadProgressBar.style.width = '100%';
    setTimeout(() => {
      uploadProgress.classList.remove('active');
      uploadProgressBar.style.width = '0%';
      fileInput.value = '';
    }, 500);
  }

  async function deleteItemById(id) {
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        removeItemFromState(id);
        showToast('🗑️ Đã xóa mục');
      }
    } catch (err) {
      showToast('❌ Không thể xóa mục');
    }
  }

  let clearRoomConfirmArmed = false;
  let clearRoomConfirmTimer = null;

  function resetClearRoomConfirm() {
    clearRoomConfirmArmed = false;
    if (clearRoomConfirmTimer) {
      clearTimeout(clearRoomConfirmTimer);
      clearRoomConfirmTimer = null;
    }
    if (clearRoomBtn) {
      clearRoomBtn.textContent = '🗑️ Xóa tất cả';
      clearRoomBtn.classList.remove('confirm-armed');
    }
  }

  async function clearCurrentRoom() {
    if (items.length === 0) return;
    try {
      const res = await fetch(`/api/items/clear?room=${encodeURIComponent(currentRoom)}`, {
        method: 'POST'
      });
      if (res.ok) {
        items = [];
        expandedNoteIds.clear();
        selectedItemIds.clear();
        renderItems();
        showToast(`🗑️ Đã xóa toàn bộ mục trong phòng "${currentRoom}"`);
      }
    } catch (err) {
      showToast('❌ Lỗi khi xóa phòng');
    }
  }

  async function handleClearRoomClick() {
    if (items.length === 0) {
      resetClearRoomConfirm();
      showToast('ℹ️ Phòng hiện đang trống');
      return;
    }
    if (!clearRoomConfirmArmed) {
      clearRoomConfirmArmed = true;
      if (clearRoomBtn) {
        clearRoomBtn.textContent = '⚠️ Bấm lần nữa để xóa';
        clearRoomBtn.classList.add('confirm-armed');
      }
      showToast('⚠️ Bấm "Xóa tất cả" lần nữa trong 3.5 giây để xác nhận xóa toàn bộ phòng');
      if (clearRoomConfirmTimer) clearTimeout(clearRoomConfirmTimer);
      clearRoomConfirmTimer = setTimeout(() => {
        resetClearRoomConfirm();
      }, 3500);
      return;
    }
    resetClearRoomConfirm();
    await clearCurrentRoom();
  }

  async function copyLatestItem() {
    const now = Date.now();
    const activeItems = (items || []).filter((item) => {
      const exp = item.expiresAt ?? item.expires_at;
      return !exp || exp > now;
    });
    if (activeItems.length === 0) {
      showToast('⚠️ Chưa có mục nào trong phòng để sao chép!');
      return;
    }
    const newest = activeItems.slice().sort((a, b) => {
      const timeDiff = (b.createdAt || b.created_at || 0) - (a.createdAt || a.created_at || 0);
      if (timeDiff !== 0) return timeDiff;
      return (a.pinned ? 1 : 0) - (b.pinned ? 1 : 0);
    })[0];
    if (!newest) return;
    const shareOrigin = getShareOrigin();
    const isCloud = Boolean(window.QSHCloud && window.QSHCloud.isCloudMode());
    const copyTarget = newest.type === 'file'
      ? (isCloud
        ? `${shareOrigin}/?room=${encodeURIComponent(currentRoom)}&download=${encodeURIComponent(newest.id)}`
        : `${shareOrigin}/api/files/${encodeURIComponent(newest.id)}/download`)
      : (newest.content || '');
    await copyToClipboard(copyTarget, copyLatestBtn);
  }

  async function togglePinItem(id) {
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(id)}/pin`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success && data.item) {
        upsertItemInState(data.item);
        showToast(data.item.pinned ? '📌 Đã ghim mục lên đầu phòng!' : '📍 Đã bỏ ghim mục');
      }
    } catch (_) {
      showToast('❌ Không thể thay đổi trạng thái ghim');
    }
  }

  const noteTaskToggleSeq = new Map();

  async function toggleNoteTaskLine(itemId, lineIdx) {
    const parsedIdx = Number(lineIdx);
    if (!itemId || !Number.isFinite(parsedIdx) || parsedIdx < 0) return;
    const item = items.find((i) => i.id === itemId);
    if (!item || typeof item.content !== 'string') return;
    const prevContent = item.content;
    const lines = prevContent.split(/\r?\n/);
    if (parsedIdx >= lines.length) return;
    const targetLine = lines[parsedIdx];
    const m = targetLine.match(/^(\s*[-*]\s+)\[([ xX])\](.*)$/);
    if (!m) return;
    const isChecked = m[2].toLowerCase() === 'x';
    const nextChecked = !isChecked;
    const nextMark = nextChecked ? 'x' : ' ';
    lines[parsedIdx] = `${m[1]}[${nextMark}]${m[3]}`;
    const updatedContent = lines.join('\n');

    const seq = (noteTaskToggleSeq.get(itemId) || 0) + 1;
    noteTaskToggleSeq.set(itemId, seq);

    item.content = updatedContent;
    renderItems();

    try {
      const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: updatedContent,
          taskToggle: {
            lineIndex: parsedIdx,
            checked: nextChecked,
            lineText: (m[3] || '').trim()
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.item) {
        if (noteTaskToggleSeq.get(itemId) === seq) {
          upsertItemInState(data.item);
        }
      } else {
        if (noteTaskToggleSeq.get(itemId) === seq) {
          item.content = prevContent;
          renderItems();
        }
        showToast('❌ ' + (data.error || 'Không thể cập nhật checklist'));
      }
    } catch (_) {
      if (noteTaskToggleSeq.get(itemId) === seq) {
        item.content = prevContent;
        renderItems();
      }
      showToast('❌ Lỗi kết nối khi đồng bộ checklist');
    }
  }

  function downloadNoteAsTxt(id, showSingleToast = true) {
    const item = items.find((i) => i.id === id);
    if (!item) return false;
    const blob = new Blob([String(item.content || '')], { type: 'text/plain;charset=utf-8' });
    const url = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
      ? URL.createObjectURL(blob)
      : `data:text/plain;charset=utf-8,${encodeURIComponent(String(item.content || ''))}`;
    const safeTitle = String(item.title || 'ghi-chu').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'note';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function' && String(url).startsWith('blob:')) {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (showSingleToast) {
      showToast(`💾 Đã tải xuống ${safeTitle}.txt`);
    }
    return true;
  }

  async function forceSyncFromCloud() {
    if (syncCloudNowBtn) syncCloudNowBtn.disabled = true;
    try {
      const res = await fetch(`/api/items?room=${encodeURIComponent(currentRoom)}&sync=1`);
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        items = data.items;
        renderItems();
        showToast('☁️ Đã đồng bộ dữ liệu mới nhất từ Cloud 24/7!');
      }
    } catch (_) {
      showToast('❌ Không thể đồng bộ từ Cloud');
    } finally {
      if (syncCloudNowBtn) syncCloudNowBtn.disabled = false;
    }
  }

  function exportRoomBackupJson() {
    const snap = (window.QSHCloud && typeof window.QSHCloud.getTelemetrySnapshot === 'function')
      ? window.QSHCloud.getTelemetrySnapshot(currentRoom, items)
      : null;
    const payload = {
      exportedAt: new Date().toISOString(),
      cloudPlatform: 'Quick Share Hub 24/7 Cloud',
      room: currentRoom,
      itemCount: items.length,
      telemetry: snap,
      items
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quick-share-hub-${currentRoom}-backup.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`📥 Đã xuất file backup phòng "${currentRoom}" (.json)!`);
  }

  function resolveBackupEntryTtl(entry) {
    if (!entry || typeof entry !== 'object') return '7d';
    const hasExplicitExpires = entry.expiresAt !== undefined || entry.expires_at !== undefined;
    const rawExp = entry.expiresAt !== undefined ? entry.expiresAt : entry.expires_at;
    if (hasExplicitExpires && rawExp === null) {
      return 'never';
    }
    if (typeof rawExp === 'number' && Number.isFinite(rawExp)) {
      return rawExp > Date.now() ? rawExp : '7d';
    }
    if (typeof entry.ttl === 'string' && entry.ttl.trim()) {
      return entry.ttl.trim();
    }
    if (typeof entry.ttl === 'number' && Number.isFinite(entry.ttl)) {
      return entry.ttl;
    }
    return '7d';
  }

  async function importRoomBackupJson(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.items) ? parsed.items : null);
      if (!list) {
        showToast('❌ File JSON không đúng định dạng Backup của Quick Share Hub');
        return;
      }
      let restored = 0;
      for (const entry of list.slice().reverse()) {
        if (!entry || typeof entry !== 'object') continue;
        const resolvedTtl = resolveBackupEntryTtl(entry);

        if (entry.type === 'file') {
          const fName = entry.fileName || entry.file_name || entry.title || '';
          const fPath = entry.fileGistId || entry.filePath || entry.file_path || '';
          if (!fName || !fPath) continue;
          const entryContent = String(entry.content || fName);
          const exists = items.some((i) => {
            if (i.type !== 'file') return false;
            const iPath = i.fileGistId || i.filePath || i.file_path || '';
            const iName = i.fileName || i.file_name || i.title || '';
            return (fPath && iPath === fPath) || (iName === fName && i.content === entryContent);
          });
          if (exists) continue;
          const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              room: currentRoom,
              type: 'file',
              content: entryContent,
              title: entry.title || fName,
              fileName: fName,
              filePath: fPath,
              fileGistId: entry.fileGistId || fPath,
              fileSize: entry.fileSize ?? entry.file_size ?? null,
              mimeType: entry.mimeType || entry.mime_type || null,
              isPdf: Boolean(entry.isPdf || entry.is_pdf || String(fName).toLowerCase().endsWith('.pdf')),
              pinned: Boolean(entry.pinned),
              ttl: resolvedTtl
            })
          });
          const data = await res.json();
          if (res.ok && data.success && data.item) {
            upsertItemInState(data.item);
            restored++;
          }
          continue;
        }

        if (!entry.content) continue;
        const exists = items.some((i) => i.content === entry.content && i.type === entry.type);
        if (exists) continue;
        const explicitType = (entry.type === 'link' || entry.type === 'note') ? entry.type : undefined;
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: currentRoom,
            type: explicitType,
            content: String(entry.content),
            title: entry.title || undefined,
            pinned: Boolean(entry.pinned),
            ttl: resolvedTtl
          })
        });
        const data = await res.json();
        if (res.ok && data.success && data.item) {
          upsertItemInState(data.item);
          restored++;
        }
      }
      showToast(`📤 Đã khôi phục ${restored} mục vào phòng "${currentRoom}"!`);
    } catch (_) {
      showToast('❌ Lỗi khi đọc file Backup JSON');
    } finally {
      if (importRoomInput) importRoomInput.value = '';
    }
  }

  function openEditModal(id) {
    const item = items.find((i) => i.id === id);
    if (!item || !editModal || !editItemTextarea) return;
    editingItemId = id;
    const fileName = item.fileName || item.file_name || item.title || '';
    if (editModalTitle) {
      editModalTitle.textContent = item.type === 'file'
        ? '✏️ Chỉnh sửa ghi chú & Thời hạn File'
        : '✏️ Chỉnh sửa nội dung';
    }
    if (editItemTtlSelect) {
      editItemTtlSelect.value = 'keep';
    }
    if (editItemTitleInput) {
      editItemTitleInput.placeholder = item.type === 'file'
        ? 'Tiêu đề tùy chỉnh cho file (tùy chọn)...'
        : 'Tiêu đề / Nhãn gợi nhớ (tùy chọn)...';
      editItemTitleInput.value = getCustomItemTitle(item);
    }
    editItemTextarea.placeholder = item.type === 'file'
      ? 'Nhập ghi chú đính kèm cho file (để trống nếu không cần)...'
      : 'Nhập nội dung mới...';
    editItemTextarea.value = (item.type === 'file' && item.content === fileName)
      ? ''
      : (item.content || '');
    editModal.classList.add('open');
    editItemTextarea.focus();
  }

  async function saveEditedItem() {
    if (!editingItemId || !editItemTextarea) return;
    const targetItem = items.find((i) => i.id === editingItemId);
    const trimmed = editItemTextarea.value.trim();
    if ((!targetItem || targetItem.type !== 'file') && !trimmed) {
      showToast('⚠️ Nội dung không được để trống!');
      return;
    }
    const ttlVal = editItemTtlSelect ? editItemTtlSelect.value : 'keep';
    const payload = { content: trimmed };
    if (editItemTitleInput) {
      payload.title = String(editItemTitleInput.value || '').trim();
    }
    if (ttlVal && ttlVal !== 'keep') {
      payload.ttl = ttlVal;
    }
    if (saveEditItemBtn) saveEditItemBtn.disabled = true;
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(editingItemId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success && data.item) {
        upsertItemInState(data.item);
        editModal.classList.remove('open');
        editingItemId = null;
        showToast('✏️ Đã cập nhật nội dung thành công!');
      } else {
        showToast('❌ ' + (data.error || 'Không thể cập nhật mục'));
      }
    } catch (_) {
      showToast('❌ Lỗi kết nối khi lưu chỉnh sửa');
    } finally {
      if (saveEditItemBtn) saveEditItemBtn.disabled = false;
    }
  }

  // State Manipulation
  function upsertItemInState(newItem) {
    const idx = items.findIndex((i) => i.id === newItem.id);
    if (idx >= 0) {
      items[idx] = newItem;
    } else {
      items.unshift(newItem);
    }
    if (newItem && newItem.id && expandedNoteIds.has(newItem.id)) {
      const raw = String(newItem.content || '');
      const lines = raw ? raw.split(/\r?\n/).length : 1;
      if (newItem.type !== 'note' || (raw.length <= 900 && lines <= 14)) {
        expandedNoteIds.delete(newItem.id);
      }
    }
    renderItems();
  }

  function removeItemFromState(id) {
    removeItemsFromState([id]);
  }

  function removeItemsFromState(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids);
    items = items.filter((i) => !idSet.has(i.id));
    for (const id of idSet) {
      expandedNoteIds.delete(id);
      selectedItemIds.delete(id);
      noteTaskToggleSeq.delete(id);
      if (lastClickedCheckboxId === id) {
        lastClickedCheckboxId = null;
      }
    }
    renderItems();
  }

  // Render UI
  function getItemSortSize(item) {
    const fSize = Number(item.fileSize ?? item.file_size);
    if (Number.isFinite(fSize) && (fSize > 0 || (item.type === 'file' && fSize === 0))) {
      return fSize;
    }
    return String(item.content || '').length;
  }

  function compareItemsBySortOrder(a, b, order) {
    const pinA = a.pinned ? 1 : 0;
    const pinB = b.pinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;

    const timeA = a.createdAt || a.created_at || 0;
    const timeB = b.createdAt || b.created_at || 0;

    if (order === 'oldest') {
      if (timeA !== timeB) return timeA - timeB;
      return 0;
    }
    if (order === 'expiring') {
      const expA = Number(a.expiresAt ?? a.expires_at);
      const expB = Number(b.expiresAt ?? b.expires_at);
      const hasExpA = Number.isFinite(expA) && expA > 0;
      const hasExpB = Number.isFinite(expB) && expB > 0;
      if (hasExpA && hasExpB) {
        if (expA !== expB) return expA - expB;
      } else if (hasExpA !== hasExpB) {
        return hasExpA ? -1 : 1;
      }
      return timeB - timeA;
    }
    if (order === 'size_desc') {
      const sizeDiff = getItemSortSize(b) - getItemSortSize(a);
      if (sizeDiff !== 0) return sizeDiff;
      return timeB - timeA;
    }
    if (order === 'title_asc') {
      const labelA = String(a.title || a.fileName || a.file_name || a.content || '').trim();
      const labelB = String(b.title || b.fileName || b.file_name || b.content || '').trim();
      const cmp = labelA.localeCompare(labelB, 'vi', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return timeB - timeA;
    }
    return timeB - timeA;
  }

  function getFilteredSortedItems() {
    return items
      .filter((item) => {
        if (activeFilter === 'pinned') {
          if (!item.pinned) return false;
        } else if (activeFilter !== 'all' && item.type !== activeFilter) {
          return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const hay = `${item.title || ''} ${item.content || ''} ${item.fileName || item.file_name || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => compareItemsBySortOrder(a, b, sortOrder));
  }

  function updateBatchActionBar(visibleItems) {
    if (!batchActionBar) return;
    const count = selectedItemIds.size;
    if (count === 0) {
      batchActionBar.style.display = 'none';
      batchActionBar.classList.remove('active');
      if (batchSelectedCount) {
        batchSelectedCount.textContent = 'Đã chọn 0 mục';
      }
      if (batchSelectAllBtn) {
        batchSelectAllBtn.textContent = '☑️ Chọn tất cả';
      }
      if (batchPinSelectedBtn) {
        batchPinSelectedBtn.textContent = '📌 Ghim đã chọn';
      }
      return;
    }
    batchActionBar.style.display = 'flex';
    batchActionBar.classList.add('active');
    if (batchSelectedCount) {
      batchSelectedCount.textContent = `Đã chọn ${count} mục`;
    }
    if (batchSelectAllBtn) {
      const list = Array.isArray(visibleItems) ? visibleItems : getFilteredSortedItems();
      const allVisibleSelected = list.length === 0 || list.every((i) => selectedItemIds.has(i.id));
      batchSelectAllBtn.textContent = allVisibleSelected ? '☑️ Bỏ chọn tất cả' : '☑️ Chọn tất cả';
    }
    if (batchPinSelectedBtn) {
      const selectedList = items.filter((i) => selectedItemIds.has(i.id));
      const allSelectedPinned = selectedList.length > 0 && selectedList.every((i) => Boolean(i.pinned));
      batchPinSelectedBtn.textContent = allSelectedPinned ? '📍 Bỏ ghim đã chọn' : '📌 Ghim đã chọn';
    }
  }

  function toggleSelectAllVisibleItems() {
    const visible = getFilteredSortedItems();
    if (visible.length === 0) {
      if (selectedItemIds.size > 0) {
        selectedItemIds.clear();
        lastClickedCheckboxId = null;
        renderItems();
      }
      return;
    }
    const allVisibleSelected = visible.every((i) => selectedItemIds.has(i.id));
    if (allVisibleSelected) {
      selectedItemIds.clear();
      lastClickedCheckboxId = null;
    } else {
      visible.forEach((i) => selectedItemIds.add(i.id));
    }
    renderItems();
  }

  function getSelectedItemsInDisplayOrder() {
    if (selectedItemIds.size === 0) return [];
    const visibleOrder = getFilteredSortedItems().filter((i) => selectedItemIds.has(i.id));
    const visibleSet = new Set(visibleOrder.map((i) => i.id));
    const hiddenSelected = items.filter((i) => selectedItemIds.has(i.id) && !visibleSet.has(i.id));
    return [...visibleOrder, ...hiddenSelected];
  }

  async function batchCopySelectedItems() {
    const selectedList = getSelectedItemsInDisplayOrder();
    if (selectedList.length === 0) return;

    const shareOrigin = getShareOrigin();
    const isCloud = Boolean(window.QSHCloud && window.QSHCloud.isCloudMode());
    const combinedText = selectedList.map((item) => {
      if (item.type === 'file') {
        return isCloud
          ? `${shareOrigin}/?room=${encodeURIComponent(currentRoom)}&download=${encodeURIComponent(item.id)}`
          : `${shareOrigin}/api/files/${encodeURIComponent(item.id)}/download`;
      }
      return String(item.content || '');
    }).filter(Boolean).join('\n\n');

    await copyToClipboard(combinedText, batchCopySelectedBtn, `📋 Đã sao chép ${selectedList.length} mục đã chọn!`);
  }

  async function batchDownloadSelectedItems() {
    const selectedList = getSelectedItemsInDisplayOrder();
    if (selectedList.length === 0) return;
    const isCloud = Boolean(window.QSHCloud && window.QSHCloud.isCloudMode());
    let downloadedCount = 0;
    for (const item of selectedList) {
      if (item.type === 'file') {
        const fileName = item.fileName || item.file_name || item.title || 'download';
        if (isCloud) {
          if (await triggerCloudFileDownload(item.id, fileName)) {
            downloadedCount++;
          }
        } else {
          const a = document.createElement('a');
          a.href = `/api/files/${encodeURIComponent(item.id)}/download`;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          downloadedCount++;
        }
      } else {
        if (downloadNoteAsTxt(item.id, false)) {
          downloadedCount++;
        }
      }
    }
    if (downloadedCount > 0) {
      showToast(`⬇️ Đã tải xuống ${downloadedCount} mục đã chọn!`);
    }
  }

  async function batchPinSelectedItems() {
    const selectedList = getSelectedItemsInDisplayOrder();
    if (selectedList.length === 0) return;
    const allPinned = selectedList.every((i) => Boolean(i.pinned));
    const targetPinned = !allPinned;
    const itemsToUpdate = selectedList.filter((i) => Boolean(i.pinned) !== targetPinned);
    if (batchPinSelectedBtn) batchPinSelectedBtn.disabled = true;
    let updatedCount = 0;
    let hadError = false;
    try {
      for (const item of itemsToUpdate) {
        try {
          const res = await fetch(`/api/items/${encodeURIComponent(item.id)}/pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned: targetPinned })
          });
          if (res && res.ok) {
            const data = await res.json();
            if (data && data.success && data.item) {
              const idx = items.findIndex((i) => i.id === data.item.id);
              if (idx >= 0) {
                items[idx] = data.item;
              } else {
                items.unshift(data.item);
              }
              updatedCount++;
            }
          } else if (res && res.status === 404) {
            items = items.filter((i) => i.id !== item.id);
            expandedNoteIds.delete(item.id);
            selectedItemIds.delete(item.id);
          } else {
            hadError = true;
          }
        } catch (_) {
          hadError = true;
        }
      }
      renderItems();
      if (updatedCount > 0) {
        showToast(
          targetPinned
            ? `📌 Đã ghim ${updatedCount} mục đã chọn!`
            : `📍 Đã bỏ ghim ${updatedCount} mục đã chọn!`
        );
      } else if (hadError) {
        showToast('❌ Không thể thay đổi trạng thái ghim hàng loạt');
      }
    } finally {
      if (batchPinSelectedBtn) batchPinSelectedBtn.disabled = false;
    }
  }

  function batchExportSelectedItems() {
    const selectedList = getSelectedItemsInDisplayOrder();
    if (selectedList.length === 0) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      cloudPlatform: 'Quick Share Hub 24/7 Cloud',
      room: currentRoom,
      selectionExport: true,
      itemCount: selectedList.length,
      items: selectedList
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quick-share-hub-${currentRoom}-selected-${selectedList.length}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`📥 Đã xuất ${selectedList.length} mục đã chọn (.json)!`);
  }

  async function batchDeleteSelectedItems() {
    const idsToDelete = Array.from(selectedItemIds);
    if (idsToDelete.length === 0) return;
    if (batchDeleteSelectedBtn) batchDeleteSelectedBtn.disabled = true;
    let deletedCount = 0;
    try {
      const res = await fetch('/api/items/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: currentRoom, ids: idsToDelete })
      });
      if (res && res.ok) {
        let data = {};
        try { data = await res.json(); } catch (_) {}
        const removedSet = new Set(Array.isArray(data.deletedIds) ? data.deletedIds : idsToDelete);
        for (const id of idsToDelete) removedSet.add(id);
        items = items.filter((i) => !removedSet.has(i.id));
        for (const id of removedSet) {
          expandedNoteIds.delete(id);
          selectedItemIds.delete(id);
        }
        lastClickedCheckboxId = null;
        deletedCount = typeof data.deletedCount === 'number' ? data.deletedCount : idsToDelete.length;
      } else {
        for (const id of idsToDelete) {
          try {
            const delRes = await fetch(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (delRes.ok) {
              items = items.filter((i) => i.id !== id);
              expandedNoteIds.delete(id);
              selectedItemIds.delete(id);
              deletedCount++;
            }
          } catch (_) {}
        }
        lastClickedCheckboxId = null;
      }
      renderItems();
      if (deletedCount > 0) {
        showToast(`🗑️ Đã xóa ${deletedCount} mục đã chọn!`);
      }
    } catch (_) {
      showToast('❌ Lỗi khi xóa các mục đã chọn');
    } finally {
      if (batchDeleteSelectedBtn) batchDeleteSelectedBtn.disabled = false;
    }
  }

  function renderItems() {
    const now = Date.now();
    // Filter out expired items client-side too, and sort pinned items first
    items = items
      .filter((item) => {
        const exp = item.expiresAt ?? item.expires_at;
        return !exp || exp > now;
      })
      .sort((a, b) => compareItemsBySortOrder(a, b, 'newest'));

    if (selectedItemIds.size > 0 || lastClickedCheckboxId) {
      const validIds = new Set(items.map((i) => i.id));
      for (const selId of Array.from(selectedItemIds)) {
        if (!validIds.has(selId)) {
          selectedItemIds.delete(selId);
        }
      }
      if (lastClickedCheckboxId && !validIds.has(lastClickedCheckboxId)) {
        lastClickedCheckboxId = null;
      }
    }

    if (items.length === 0 && clearRoomConfirmArmed) {
      resetClearRoomConfirm();
    }

    // Update counts
    countAll.textContent = items.length;
    if (countPinned) {
      countPinned.textContent = items.filter((i) => Boolean(i.pinned)).length;
    }
    countLink.textContent = items.filter((i) => i.type === 'link').length;
    countNote.textContent = items.filter((i) => i.type === 'note').length;
    countFile.textContent = items.filter((i) => i.type === 'file').length;

    const filtered = getFilteredSortedItems();
    updateBatchActionBar(filtered);

    if (filtered.length === 0) {
      if (items.length > 0) {
        itemsContainer.innerHTML = `
          <div class="empty-state filter-empty-state">
            <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
            <div>Không có mục nào khớp với bộ lọc / từ khóa hiện tại trong phòng <strong>${escapeHtml(currentRoom)}</strong>.</div>
            <div style="margin-top: 12px;">
              <button type="button" class="btn btn-sm btn-primary js-reset-filter-btn">
                🔄 Xem tất cả (${items.length})
              </button>
            </div>
          </div>
        `;
      } else {
        itemsContainer.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2rem; margin-bottom: 8px;">✨</div>
            <div>Chưa có mục nào trong phòng <strong>${escapeHtml(currentRoom)}</strong>.</div>
            <div style="font-size: 0.82rem; margin-top: 4px;">Dán Link, Ghi chú hoặc tải lên file PDF để đồng bộ tức thì sang thiết bị khác!</div>
          </div>
        `;
      }
      updateTelemetryDashboard();
      return;
    }

    itemsContainer.innerHTML = filtered.map((item) => renderSingleCard(item)).join('');
    hydrateCloudImages();
    updateTelemetryDashboard();
  }

  function updateTelemetryDashboard() {
    if (!statStorageUsed || !window.QSHCloud || typeof window.QSHCloud.getTelemetrySnapshot !== 'function') {
      return;
    }
    const snap = window.QSHCloud.getTelemetrySnapshot(currentRoom, items);
    if (!snap) return;

    const { storage, bandwidth } = snap;
    const sPct = storage.percentUsed < 0.1 && storage.usedBytes > 0 ? '< 0.1%' : `${storage.percentUsed.toFixed(1)}%`;
    const bPct = bandwidth.percentUsed < 0.1 && bandwidth.totalBytes > 0 ? '< 0.1%' : `${bandwidth.percentUsed.toFixed(2)}%`;

    statStoragePercent.textContent = sPct;
    statStorageUsed.textContent = formatBytes(storage.usedBytes);
    statStorageQuota.textContent = formatBytes(storage.quotaBytes);
    storageQuotaBar.style.width = `${Math.max(1.5, Math.min(100, storage.percentUsed))}%`;
    statStorageBreakdown.textContent = `Dữ liệu phòng "${currentRoom}": ${formatBytes(storage.roomBytes)} • Còn trống: ${formatBytes(storage.freeBytes)}`;

    statBandwidthPercent.textContent = bPct;
    statBandwidthTotal.textContent = formatBytes(bandwidth.totalBytes);
    statBandwidthQuota.textContent = formatBytes(bandwidth.quotaBytes);
    bandwidthQuotaBar.style.width = `${Math.max(1.5, Math.min(100, bandwidth.percentUsed))}%`;
    statBandwidthSplit.textContent = `⬆ Tải lên: ${formatBytes(bandwidth.uploadBytes)} • ⬇ Tải xuống: ${formatBytes(bandwidth.downloadBytes)}`;

    if (statLiveSpeedBadge) {
      statLiveSpeedBadge.textContent = `Ping: ${bandwidth.latencyMs || 42}ms • 24/7 Cloud`;
    }
    statPageFootprint.textContent = formatBytes(storage.pageFootprintBytes);
    statNetworkRequests.textContent = `${bandwidth.apiRequests} API Requests • ${bandwidth.wsEvents} Sự kiện Realtime WS`;
    statTransferBreakdown.textContent = `Tài nguyên trang (${bandwidth.resourceCount} files HTML/CSS/JS/PWA): ${formatBytes(storage.pageFootprintBytes)}`;

    statTotalItemsCount.textContent = `${storage.breakdown.totalItems} mục`;
    statTypeFileBytes.textContent = `${formatBytes(storage.breakdown.fileBytes)} (${storage.breakdown.fileCount})`;
    statTypeNoteBytes.textContent = `${formatBytes(storage.breakdown.noteBytes)} (${storage.breakdown.noteCount})`;
    statTypeLinkBytes.textContent = `${formatBytes(storage.breakdown.linkBytes)} (${storage.breakdown.linkCount})`;
  }

  function hydrateCloudImages() {
    if (!window.QSHCloud || !window.QSHCloud.isCloudMode()) return;
    const imgs = itemsContainer.querySelectorAll('img[data-cloud-image-id]');
    imgs.forEach(async (img) => {
      const id = img.getAttribute('data-cloud-image-id');
      if (!id) return;
      const blobUrl = await window.QSHCloud.getBlobUrlForFile(id);
      if (blobUrl) img.src = blobUrl;
    });
  }

  function renderSingleCard(item) {
    const fileName = item.fileName || item.file_name || item.title || 'file';
    const lowerName = String(fileName).toLowerCase();
    const isPdf = Boolean(item.isPdf || item.is_pdf || lowerName.endsWith('.pdf'));
    const mime = item.mimeType || item.mime_type || '';
    const isImage = item.type === 'file' && !isPdf && (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(lowerName));
    const isTextPreviewable = item.type === 'file' && !isPdf && !isImage && (
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('javascript') ||
      /\.(txt|md|json|csv|tsv|log|js|ts|py|html|css|xml|ya?ml|ini|sh|bat|sql)$/i.test(lowerName)
    );
    const canPreviewModal = isPdf || isImage || isTextPreviewable;
    const createdAt = item.createdAt || item.created_at;
    const expiresAt = item.expiresAt || item.expires_at;
    const fileSize = item.fileSize ?? item.file_size;

    let badgeClass = item.type;
    let badgeLabel = '📝 Ghi chú';
    if (item.type === 'link') badgeLabel = '🔗 Link';
    if (item.type === 'file') {
      badgeClass = isPdf ? 'pdf' : 'file';
      badgeLabel = isPdf ? '📕 PDF' : (isImage ? '🖼️ Ảnh' : '📎 File');
    }

    const shareOrigin = getShareOrigin();
    const isCloud = Boolean(window.QSHCloud && window.QSHCloud.isCloudMode());
    const previewUrl = isCloud
      ? `${shareOrigin}/?room=${encodeURIComponent(currentRoom)}&preview=${encodeURIComponent(item.id)}`
      : `${shareOrigin}/api/files/${encodeURIComponent(item.id)}/preview`;
    const downloadUrl = isCloud
      ? `${shareOrigin}/?room=${encodeURIComponent(currentRoom)}&download=${encodeURIComponent(item.id)}`
      : `${shareOrigin}/api/files/${encodeURIComponent(item.id)}/download`;
    const localPreviewUrl = `/api/files/${encodeURIComponent(item.id)}/preview`;
    const localDownloadUrl = `/api/files/${encodeURIComponent(item.id)}/download`;

    const customTitle = getCustomItemTitle(item);
    let bodyHtml = '';
    if (item.type === 'link') {
      const safeLink = sanitizeUrl(item.content);
      bodyHtml = `
        <div class="item-body">
          ${customTitle ? `<div class="item-custom-title">${escapeHtml(customTitle)}</div>` : ''}
          <a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer" class="item-link">
            ${escapeHtml(item.content)}
          </a>
        </div>
      `;
    } else if (item.type === 'note') {
      const rawNote = String(item.content || '');
      const noteLineCount = rawNote ? rawNote.split(/\r?\n/).length : 1;
      const isLongNote = rawNote.length > 900 || noteLineCount > 14;
      const isNoteExpanded = expandedNoteIds.has(item.id);
      const notePreClass = isLongNote
        ? (isNoteExpanded ? 'item-note-pre expanded' : 'item-note-pre collapsed')
        : 'item-note-pre';
      bodyHtml = `
        <div class="item-body">
          ${customTitle ? `<div class="item-custom-title">${escapeHtml(customTitle)}</div>` : ''}
          <pre class="${notePreClass}" data-note-id="${escapeHtml(item.id)}">${renderNoteContentWithLinks(item.content, item.id)}</pre>
          ${isLongNote ? `
            <button type="button" class="btn btn-sm note-expand-btn js-toggle-note-expand" data-id="${escapeHtml(item.id)}" data-lines="${noteLineCount}">
              ${isNoteExpanded ? '🔼 Thu gọn' : `🔽 Xem thêm (${noteLineCount} dòng)`}
            </button>
          ` : ''}
        </div>
      `;
    } else if (item.type === 'file') {
      const hasCaption = item.content && item.content !== fileName;
      bodyHtml = `
        <div class="item-body">
          ${customTitle ? `<div class="item-custom-title">${escapeHtml(customTitle)}</div>` : ''}
          <div class="item-file-row">
            <div class="file-info-main">
              <span class="file-icon-box">${isPdf ? '📕' : (isImage ? '🖼️' : '📄')}</span>
              <div>
                <div class="file-name">${escapeHtml(fileName)}</div>
                <div class="file-size">${formatBytes(fileSize)} ${mime ? '• ' + escapeHtml(mime) : ''}</div>
              </div>
            </div>
          </div>
          ${hasCaption ? `<div style="margin-top: 6px; font-size: 0.85rem; color: var(--text-secondary); white-space: pre-wrap;">${renderNoteContentWithLinks(item.content, item.id)}</div>` : ''}
          ${isImage ? `<img src="${isCloud ? TRANSPARENT_PIXEL : localPreviewUrl}" data-cloud-image-id="${escapeHtml(item.id)}" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(fileName)}" alt="${escapeHtml(fileName)}" title="Bấm để xem ảnh lớn (${escapeHtml(fileName)})" class="item-image-preview" loading="lazy" />` : ''}
        </div>
      `;
    }

    const copyTarget = item.type === 'file' ? downloadUrl : (item.content || '');
    const qrTarget = item.type === 'file' ? previewUrl : (item.content || '');
    const safeLinkHref = item.type === 'link' ? sanitizeUrl(item.content) : '#';
    const linkDomain = item.type === 'link'
      ? String(item.domain || extractLinkDefaultTitle(item.content) || '').trim()
      : '';
    const isPinned = Boolean(item.pinned);
    const isSelected = selectedItemIds.has(item.id);

    return `
      <article class="item-card ${isPinned ? 'pinned' : ''} ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(item.id)}">
        <div class="item-top">
          <div class="item-meta">
            <input type="checkbox" class="item-select-cb js-select-item-cb" data-id="${escapeHtml(item.id)}" ${isSelected ? 'checked' : ''} title="Chọn mục này để thao tác hàng loạt" aria-label="Chọn mục" />
            ${isPinned ? '<span class="pin-badge">📌 Đã ghim</span>' : ''}
            <span class="type-badge ${badgeClass}">${badgeLabel}</span>
            ${linkDomain ? `<span class="domain-badge" title="Tên miền liên kết">🌐 ${escapeHtml(linkDomain)}</span>` : ''}
            <span class="time-badge">🕒 ${formatRelativeTime(createdAt)}</span>
            <span class="ttl-badge" title="Thời gian tự động xóa">⏳ ${formatRemainingTtl(expiresAt)}</span>
          </div>
        </div>

        ${bodyHtml}

        <div class="item-actions">
          <button type="button" class="btn btn-sm js-copy-btn" data-copy="${escapeHtml(copyTarget)}">
            📋 Copy ${item.type === 'file' ? 'Link Tải' : ''}
          </button>

          ${isImage ? `
            <button type="button" class="btn btn-sm js-copy-image-btn" data-id="${escapeHtml(item.id)}" title="Sao chép hình ảnh trực tiếp vào Clipboard để dán (Ctrl+V) vào Word, Zalo, Docs...">
              🖼️ Copy Ảnh
            </button>
          ` : ''}

          ${item.type === 'link' ? `
            <a href="${escapeHtml(safeLinkHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
              ↗ Mở nhanh
            </a>
          ` : ''}

          ${item.type === 'note' ? `
            <button type="button" class="btn btn-sm js-download-note-btn" data-id="${escapeHtml(item.id)}" title="Tải ghi chú về máy dưới dạng file .txt">
              💾 Tải .txt
            </button>
          ` : ''}

          ${canPreviewModal ? `
            <button type="button" class="btn btn-sm btn-primary js-preview-pdf-btn" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(fileName)}">
              👁️ Xem trước ${isPdf ? 'PDF' : ''}
            </button>
          ` : ''}

          ${item.type === 'file' ? `
            <a href="${localDownloadUrl}" download="${escapeHtml(fileName)}" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(fileName)}" class="btn btn-sm btn-emerald js-download-file-btn">
              ⬇ Tải xuống
            </a>
          ` : ''}

          <button type="button" class="btn btn-sm js-qr-btn" data-qr="${escapeHtml(qrTarget)}" data-title="${escapeHtml(item.title || fileName)}">
            📱 Mã QR
          </button>

          <button type="button" class="btn btn-sm js-share-btn" data-id="${escapeHtml(item.id)}" title="Chia sẻ nhanh qua ứng dụng khác (Zalo, Telegram, AirDrop, Messenger...)">
            📤 Chia sẻ
          </button>

          <button type="button" class="btn btn-sm js-edit-btn" data-id="${escapeHtml(item.id)}" title="${item.type === 'file' ? 'Chỉnh sửa ghi chú đính kèm &amp; thời hạn tự hủy' : 'Chỉnh sửa nội dung &amp; thời hạn mục này'}">
            ✏️ Sửa
          </button>

          <button type="button" class="btn btn-sm js-pin-btn" data-id="${escapeHtml(item.id)}" title="${isPinned ? 'Bỏ ghim mục này' : 'Ghim mục này lên đầu phòng'}">
            ${isPinned ? '📍 Bỏ ghim' : '📌 Ghim'}
          </button>

          <button type="button" class="btn btn-sm btn-danger js-delete-btn" data-id="${escapeHtml(item.id)}" style="margin-left: auto;">
            🗑️ Xóa
          </button>
        </div>
      </article>
    `;
  }

  async function shareItem(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const shareOrigin = getShareOrigin();
    const isCloud = Boolean(window.QSHCloud && window.QSHCloud.isCloudMode());
    let shareData = {};
    let fallbackCopy = '';

    if (item.type === 'link') {
      shareData = {
        title: item.title || 'Quick Share Hub — Link',
        text: item.title || '',
        url: item.content
      };
      fallbackCopy = item.content || '';
    } else if (item.type === 'note') {
      shareData = {
        title: item.title || 'Quick Share Hub — Ghi chú',
        text: item.content || ''
      };
      fallbackCopy = item.content || '';
    } else if (item.type === 'file') {
      const fName = item.fileName || item.file_name || item.title || 'file';
      const fileUrl = isCloud
        ? `${shareOrigin}/?room=${encodeURIComponent(currentRoom)}&preview=${encodeURIComponent(item.id)}`
        : `${shareOrigin}/api/files/${encodeURIComponent(item.id)}/download`;
      shareData = {
        title: fName,
        text: `📄 ${fName}`,
        url: fileUrl
      };
      fallbackCopy = fileUrl;

      // Web Share API Level 2: share actual binary File (PDF / Image / Doc) if supported
      if (navigator.share && typeof navigator.canShare === 'function') {
        try {
          let blob = null;
          if (isCloud && window.QSHCloud && typeof window.QSHCloud.getFileBlob === 'function') {
            blob = await window.QSHCloud.getFileBlob(item.id);
          } else {
            const res = await fetch(`/api/files/${encodeURIComponent(item.id)}/download`);
            if (res && res.ok && typeof res.blob === 'function') {
              blob = await res.blob();
            }
          }
          if (blob) {
            const mime = item.mimeType || item.mime_type || blob.type || 'application/octet-stream';
            const fileObj = typeof File === 'function'
              ? new File([blob], fName, { type: mime })
              : Object.assign(blob, { name: fName, type: mime });
            if (navigator.canShare({ files: [fileObj] })) {
              await navigator.share({
                files: [fileObj],
                title: fName,
                text: (item.content && item.content !== fName) ? item.content : fName
              });
              return;
            }
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
    }

    if (navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    await copyToClipboard(fallbackCopy, null, '📤 Đã sao chép nội dung để chia sẻ!');
  }

  // QR Modal
  async function openQrModal(text, title) {
    currentQrText = text;
    currentQrTitle = title || '';
    currentQrDataUrl = '';
    qrModalTitle.textContent = title ? `📱 Mã QR: ${title}` : '📱 Quét mã QR trên Điện thoại';
    qrCaption.textContent = text;
    qrImage.src = TRANSPARENT_PIXEL;
    qrModal.classList.add('open');

    const loadTask = (async () => {
      try {
        const res = await fetch(`/api/qr?text=${encodeURIComponent(text)}`);
        const data = await res.json();
        if (data.success && data.dataUrl && currentQrText === text) {
          currentQrDataUrl = data.dataUrl;
          qrImage.src = data.dataUrl;
        }
      } catch (err) {
        showToast('❌ Không thể tạo mã QR');
      }
    })();
    currentQrPromise = loadTask;
    await loadTask;
  }

  function downloadQrCodePng() {
    const srcUrl = currentQrDataUrl || (qrImage && qrImage.src) || '';
    if (!srcUrl || srcUrl === TRANSPARENT_PIXEL || !String(srcUrl).startsWith('data:image/')) {
      showToast('⚠️ Mã QR chưa sẵn sàng để tải xuống');
      return;
    }
    const rawLabel = currentQrTitle
      ? `${currentRoom || 'default'}-${currentQrTitle}`
      : (currentRoom || 'default');
    const safeSlug = String(rawLabel)
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'default';
    const a = document.createElement('a');
    a.href = srcUrl;
    a.download = `qr-quick-share-${safeSlug}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('💾 Đã tải xuống ảnh mã QR (.png)!');
  }

  function dataUrlToPngBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const meta = dataUrl.slice(0, commaIdx);
    const rawData = dataUrl.slice(commaIdx + 1);
    const mimeMatch = meta.match(/^data:([^;]+)/i);
    const mime = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : 'image/png';
    try {
      if (/;base64/i.test(meta)) {
        let bytes = null;
        if (typeof atob === 'function') {
          const binStr = atob(rawData.replace(/\s+/g, ''));
          bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) {
            bytes[i] = binStr.charCodeAt(i);
          }
        } else if (typeof Buffer !== 'undefined') {
          bytes = new Uint8Array(Buffer.from(rawData, 'base64'));
        } else {
          const b64 = rawData.replace(/[^A-Za-z0-9+/=]/g, '');
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          const out = [];
          for (let i = 0; i < b64.length; i += 4) {
            const c0 = alphabet.indexOf(b64[i]);
            const c1 = alphabet.indexOf(b64[i + 1]);
            const c2 = b64[i + 2] === '=' ? -1 : alphabet.indexOf(b64[i + 2]);
            const c3 = b64[i + 3] === '=' ? -1 : alphabet.indexOf(b64[i + 3]);
            if (c0 < 0 || c1 < 0) break;
            const triple = (c0 << 18) | (c1 << 12) | ((c2 > 0 ? c2 : 0) << 6) | (c3 > 0 ? c3 : 0);
            out.push((triple >> 16) & 0xff);
            if (c2 >= 0) out.push((triple >> 8) & 0xff);
            if (c3 >= 0) out.push(triple & 0xff);
          }
          bytes = new Uint8Array(out);
        }
        if (bytes) {
          return new Blob([bytes], { type: mime });
        }
      } else {
        return new Blob([decodeURIComponent(rawData)], { type: mime });
      }
    } catch (_) {}
    return null;
  }

  async function shareQrCodeImage() {
    if (!currentQrDataUrl && currentQrPromise) {
      try {
        await currentQrPromise;
      } catch (_) {}
    }
    const srcUrl = currentQrDataUrl || (qrImage && qrImage.src) || '';
    const qrTitle = currentQrTitle || 'Quick Share Hub — Mã QR';
    const qrText = currentQrText || '';
    const rawLabel = currentQrTitle
      ? `${currentRoom || 'default'}-${currentQrTitle}`
      : (currentRoom || 'default');
    const safeSlug = String(rawLabel)
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'default';
    const fileName = `qr-quick-share-${safeSlug}.png`;

    if (srcUrl && srcUrl !== TRANSPARENT_PIXEL && String(srcUrl).startsWith('data:image/')) {
      if (navigator.share && typeof navigator.canShare === 'function') {
        try {
          const blob = dataUrlToPngBlob(srcUrl);
          if (blob) {
            const qrFile = typeof File === 'function'
              ? new File([blob], fileName, { type: 'image/png' })
              : Object.assign(blob, { name: fileName, type: 'image/png' });
            if (navigator.canShare({ files: [qrFile] })) {
              await navigator.share({
                files: [qrFile],
                title: qrTitle,
                text: qrText
              });
              showToast('📤 Đã chia sẻ ảnh mã QR!');
              return;
            }
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
    }

    if (navigator.share && typeof navigator.share === 'function' && qrText) {
      const isHttpUrl = /^https?:\/\/\S+$/i.test(qrText.trim());
      const sharePayload = isHttpUrl
        ? { title: qrTitle, text: qrText, url: qrText.trim() }
        : { title: qrTitle, text: qrText };
      try {
        await navigator.share(sharePayload);
        showToast('📤 Đã mở bảng chia sẻ mã QR!');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        if (isHttpUrl) {
          try {
            await navigator.share({ title: qrTitle, text: qrText });
            showToast('📤 Đã mở bảng chia sẻ mã QR!');
            return;
          } catch (retryErr) {
            if (retryErr && retryErr.name === 'AbortError') return;
          }
        }
      }
    }

    if (qrText) {
      await copyToClipboard(qrText, shareQrImgBtn, '📤 Đã sao chép nội dung mã QR để chia sẻ!');
    } else {
      showToast('⚠️ Mã QR chưa sẵn sàng để chia sẻ');
    }
  }

  // Multi-Format File & PDF Preview Modal
  function closePdfPreviewModal() {
    if (!pdfModal) return;
    pdfModal.classList.remove('open');
    if (pdfViewerFrame) pdfViewerFrame.src = 'about:blank';
    if (modalImagePreview) modalImagePreview.src = TRANSPARENT_PIXEL;
    if (modalTextPreview) modalTextPreview.textContent = '';
    if (copyModalImageBtn) copyModalImageBtn.style.display = 'none';
    if (copyModalTextBtn) copyModalTextBtn.style.display = 'none';
    currentModalTextContent = '';
    currentModalItemId = '';
  }

  function closeAllModals() {
    if (qrModal) qrModal.classList.remove('open');
    closePdfPreviewModal();
    if (roomModal) roomModal.classList.remove('open');
    if (shortcutsModal) shortcutsModal.classList.remove('open');
    if (editModal) {
      editModal.classList.remove('open');
      editingItemId = null;
    }
  }

  async function openPdfPreviewModal(id, fileName) {
    currentModalItemId = id || '';
    const isCloud = Boolean(window.QSHCloud && window.QSHCloud.isCloudMode());
    let previewUrl = `/api/files/${encodeURIComponent(id)}/preview`;
    let downloadUrl = `/api/files/${encodeURIComponent(id)}/download`;

    if (isCloud) {
      const blobUrl = await window.QSHCloud.getBlobUrlForFile(id);
      if (!blobUrl) {
        showToast('⚠️ File này vượt giới hạn lưu trữ Cloud Gist (25MB) hoặc đã bị xóa khỏi bộ nhớ đám mây.');
        return;
      }
      previewUrl = blobUrl;
      downloadUrl = blobUrl;
    }

    const cloudMeta = (isCloud && typeof window.QSHCloud.getFileMeta === 'function')
      ? window.QSHCloud.getFileMeta(id)
      : null;
    const item = items.find((i) => i.id === id) || cloudMeta;
    const resolvedName = fileName || (item && (item.fileName || item.file_name || item.title)) || 'document.pdf';
    const lowerName = String(resolvedName).toLowerCase();
    const mime = (item && (item.mimeType || item.mime_type)) || '';
    const isPdf = Boolean((item && (item.isPdf || item.is_pdf)) || mime === 'application/pdf' || lowerName.endsWith('.pdf'));
    const isImage = !isPdf && Boolean(mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(lowerName));
    const isText = !isPdf && !isImage && Boolean(
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('javascript') ||
      /\.(txt|md|json|csv|tsv|log|js|ts|py|html|css|xml|ya?ml|ini|sh|bat|sql)$/i.test(lowerName)
    );

    pdfModalOpenTab.href = previewUrl;
    pdfModalDownload.href = downloadUrl;
    pdfModalDownload.setAttribute('download', resolvedName);
    pdfModalDownload.textContent = isPdf ? '⬇ Tải xuống PDF' : '⬇ Tải xuống';
    if (pdfFallbackOpenLink) pdfFallbackOpenLink.href = previewUrl;
    if (pdfFallbackDownloadLink) {
      pdfFallbackDownloadLink.href = downloadUrl;
      pdfFallbackDownloadLink.setAttribute('download', resolvedName);
    }

    if (isImage) {
      pdfModalTitle.textContent = `🖼️ ${resolvedName}`;
      if (copyModalImageBtn) copyModalImageBtn.style.display = 'inline-flex';
      if (copyModalTextBtn) copyModalTextBtn.style.display = 'none';
      if (pdfMobileFallbackBar) pdfMobileFallbackBar.style.display = 'none';
      pdfViewerFrame.style.display = 'none';
      pdfViewerFrame.src = 'about:blank';
      if (textPreviewContainer) textPreviewContainer.style.display = 'none';
      if (imagePreviewContainer && modalImagePreview) {
        modalImagePreview.src = previewUrl;
        modalImagePreview.alt = resolvedName;
        imagePreviewContainer.style.display = 'flex';
      }
      pdfModal.classList.add('open');
      return;
    }

    if (isText) {
      pdfModalTitle.textContent = `📝 ${resolvedName}`;
      if (copyModalImageBtn) copyModalImageBtn.style.display = 'none';
      if (copyModalTextBtn) copyModalTextBtn.style.display = 'inline-flex';
      if (pdfMobileFallbackBar) pdfMobileFallbackBar.style.display = 'none';
      pdfViewerFrame.style.display = 'none';
      pdfViewerFrame.src = 'about:blank';
      if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      if (textPreviewContainer && modalTextPreview) {
        modalTextPreview.textContent = 'Đang tải nội dung...';
        textPreviewContainer.style.display = 'flex';
      }
      pdfModal.classList.add('open');

      try {
        let rawText = null;
        if (isCloud && typeof window.QSHCloud.getTextForFile === 'function') {
          rawText = await window.QSHCloud.getTextForFile(id);
        } else {
          const res = await fetch(`/api/files/${encodeURIComponent(id)}/preview`);
          if (res.ok) rawText = await res.text();
        }
        currentModalTextContent = rawText !== null ? rawText : '';
        if (modalTextPreview) {
          modalTextPreview.textContent = currentModalTextContent || '(File trống)';
        }
      } catch (_) {
        if (modalTextPreview) {
          modalTextPreview.textContent = 'Không thể đọc nội dung văn bản của file này.';
        }
      }
      return;
    }

    // Default: PDF / Document iframe preview
    pdfModalTitle.textContent = `📄 ${resolvedName}`;
    if (copyModalImageBtn) copyModalImageBtn.style.display = 'none';
    if (copyModalTextBtn) copyModalTextBtn.style.display = 'none';
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    if (textPreviewContainer) textPreviewContainer.style.display = 'none';
    if (pdfMobileFallbackBar) pdfMobileFallbackBar.style.display = 'flex';
    pdfViewerFrame.style.display = 'block';
    pdfViewerFrame.src = previewUrl;
    pdfModal.classList.add('open');
  }

  async function triggerCloudFileDownload(id, fileName) {
    if (window.QSHCloud && window.QSHCloud.isCloudMode()) {
      const blobUrl = await window.QSHCloud.getBlobUrlForFile(id);
      if (blobUrl) {
        const meta = typeof window.QSHCloud.getFileMeta === 'function' ? window.QSHCloud.getFileMeta(id) : null;
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName || (meta && meta.fileName) || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return true;
      }
      showToast('⚠️ Không thể tải file: dữ liệu nhị phân không còn trên Cloud Gist.');
    }
    return false;
  }

  // WebSocket Real-Time Engine
  function connectWebSocket() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(currentRoom)}`;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
      wsStatusPill.classList.remove('offline');
      wsStatusText.textContent = 'Đồng bộ Live';
      ws.send(JSON.stringify({ action: 'join', room: currentRoom }));
    };

    ws.onmessage = (event) => {
      try {
        if (window.QSHCloud && typeof window.QSHCloud.recordTraffic === 'function') {
          const byteLen = event.data ? String(event.data).length : 64;
          window.QSHCloud.recordTraffic({ downloadBytes: byteLen, wsEvents: 1 });
        }
        const msg = JSON.parse(event.data);
        if ((msg.type === 'item_created' || msg.type === 'item_updated' || msg.type === 'item_pinned') && msg.item) {
          if ((msg.item.room || 'default') === currentRoom) {
            upsertItemInState(msg.item);
          }
        } else if (msg.type === 'item_deleted' && msg.id) {
          removeItemFromState(msg.id);
        } else if ((msg.type === 'items_expired' || msg.type === 'items_deleted') && Array.isArray(msg.ids)) {
          removeItemsFromState(msg.ids);
        } else if (msg.type === 'room_cleared') {
          if (!msg.room || msg.room === currentRoom) {
            items = [];
            expandedNoteIds.clear();
            selectedItemIds.clear();
            lastClickedCheckboxId = null;
            renderItems();
          }
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      wsStatusPill.classList.add('offline');
      wsStatusText.textContent = 'Đang kết nối lại...';
      scheduleReconnect();
    };

    ws.onerror = () => {
      try { ws.close(); } catch (_) {}
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = Math.min(8000, 1000 * Math.pow(1.5, reconnectAttempts++));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
      fetchItems();
    }, delay);
  }

  const RECENT_ROOMS_KEY = 'qsh_recent_rooms';

  function getRecentRooms() {
    let list = ['default'];
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(RECENT_ROOMS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            list = parsed.filter((r) => typeof r === 'string' && r.trim()).map((r) => r.trim().toLowerCase());
          }
        }
      }
    } catch (_) {}
    if (!list.includes('default')) list.unshift('default');
    if (currentRoom && !list.includes(currentRoom)) {
      list = [currentRoom, ...list];
    }
    return Array.from(new Set(list)).slice(0, 8);
  }

  function recordRecentRoom(room) {
    const clean = (room && room.trim()) ? room.trim().toLowerCase() : 'default';
    const existing = getRecentRooms().filter((r) => r !== clean && r !== 'default');
    const next = clean === 'default' ? ['default', ...existing] : ['default', clean, ...existing];
    const dedup = Array.from(new Set(next)).slice(0, 8);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(dedup));
      }
    } catch (_) {}
    renderRecentRooms();
  }

  function renderRecentRooms() {
    if (!recentRoomsList) return;
    const rooms = getRecentRooms();
    recentRoomsList.innerHTML = rooms.map((r) => `
      <button type="button" class="recent-room-chip ${r === currentRoom ? 'active' : ''}" data-room="${escapeHtml(r)}">
        🔒 ${escapeHtml(r)}
      </button>
    `).join('');
  }

  function generateRandomRoomSlug() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const pick = (len) => {
      let out = '';
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(len);
        crypto.getRandomValues(bytes);
        for (let i = 0; i < len; i++) {
          out += alphabet[bytes[i] % alphabet.length];
        }
        return out;
      }
      for (let i = 0; i < len; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      return out;
    };
    let candidate = `room-${pick(4)}-${pick(4)}`;
    if (candidate === currentRoom) {
      candidate = `room-${pick(4)}-${pick(4)}`;
    }
    return candidate;
  }

  function switchRoom(newRoom) {
    const clean = (newRoom && newRoom.trim()) ? newRoom.trim().toLowerCase() : 'default';
    saveComposerDraft(currentRoom);
    resetClearRoomConfirm();
    expandedNoteIds.clear();
    selectedItemIds.clear();
    lastClickedCheckboxId = null;
    updateBatchActionBar();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'leave', room: currentRoom }));
      ws.send(JSON.stringify({ action: 'join', room: clean }));
    }
    currentRoom = clean;
    currentRoomBadge.textContent = currentRoom;
    recordRecentRoom(currentRoom);
    restoreComposerDraft(currentRoom);

    const url = new URL(window.location.href);
    if (currentRoom === 'default') {
      url.searchParams.delete('room');
    } else {
      url.searchParams.set('room', currentRoom);
    }
    window.history.pushState({}, '', url.toString());
    fetchItems(true);
  }

  // Event Listeners
  sendItemBtn.addEventListener('click', () => {
    createTextItem(itemInput.value, ttlSelect.value);
  });

  if (copyLatestBtn) {
    copyLatestBtn.addEventListener('click', () => {
      copyLatestItem();
    });
  }

  itemInput.addEventListener('input', () => {
    updateComposerCounter();
    saveComposerDraft(currentRoom);
  });

  itemInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      createTextItem(itemInput.value, ttlSelect.value);
    }
  });

  pasteClipboardBtn.addEventListener('click', async () => {
    try {
      const hasReadText = Boolean(navigator.clipboard && typeof navigator.clipboard.readText === 'function');
      const hasReadItems = Boolean(navigator.clipboard && typeof navigator.clipboard.read === 'function');
      if (!hasReadText && !hasReadItems) {
        throw new Error('Clipboard API unavailable');
      }

      let readTextErr = null;
      if (hasReadText) {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            itemInput.value = text;
            updateComposerCounter();
            await createTextItem(text, ttlSelect.value);
            return;
          }
        } catch (err) {
          readTextErr = err;
        }
      }

      if (hasReadItems) {
        const clipItems = await navigator.clipboard.read();
        for (const clipItem of (clipItems || [])) {
          const types = Array.isArray(clipItem.types) ? clipItem.types : [];
          const imgType = types.find((t) => /^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i.test(t) || t.startsWith('image/'));
          if (imgType && typeof clipItem.getType === 'function') {
            const blob = await clipItem.getType(imgType);
            if (blob) {
              const ext = imgType.includes('jpeg') || imgType.includes('jpg') ? 'jpg'
                : imgType.includes('webp') ? 'webp'
                : imgType.includes('gif') ? 'gif'
                : 'png';
              const fName = `clipboard-image-${Date.now()}.${ext}`;
              const fileObj = typeof File === 'function'
                ? new File([blob], fName, { type: imgType })
                : Object.assign(blob, { name: fName, type: imgType });
              await uploadFiles([fileObj]);
              return;
            }
          }
          if (types.includes('text/plain') && typeof clipItem.getType === 'function') {
            const textBlob = await clipItem.getType('text/plain');
            const textVal = textBlob && typeof textBlob.text === 'function' ? await textBlob.text() : '';
            if (textVal && textVal.trim()) {
              itemInput.value = textVal;
              updateComposerCounter();
              await createTextItem(textVal, ttlSelect.value);
              return;
            }
          }
        }
      } else if (readTextErr) {
        throw readTextErr;
      }

      showToast('⚠️ Clipboard đang trống hoặc chứa dữ liệu không hỗ trợ');
    } catch (err) {
      itemInput.focus();
      showToast('💡 Nhấn Ctrl+V hoặc giữ chạm để dán nội dung từ Clipboard');
    }
  });

  // Global Ctrl+V Paste listener for files or quick text
  window.addEventListener('paste', (e) => {
    const activeTag = document.activeElement && document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
      // Still allow file paste even when focused in textarea
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        uploadFiles(e.clipboardData.files);
      }
      return;
    }

    if (e.clipboardData) {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        uploadFiles(e.clipboardData.files);
        return;
      }
      const pastedText = e.clipboardData.getData('text/plain');
      if (pastedText && pastedText.trim()) {
        e.preventDefault();
        itemInput.value = pastedText;
        updateComposerCounter();
        createTextItem(pastedText, ttlSelect.value);
      }
    }
  });

  // Drag & Drop File Upload
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      uploadFiles(fileInput.files);
    }
  });

  function hasDraggedFiles(e) {
    if (!e || !e.dataTransfer) return false;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) return true;
    const types = e.dataTransfer.types;
    if (!types) return false;
    if (typeof types.includes === 'function') return types.includes('Files');
    if (typeof types.contains === 'function') return types.contains('Files');
    return Array.from(types).includes('Files');
  }

  let windowDragDepth = 0;

  window.addEventListener('dragenter', (e) => {
    if (!hasDraggedFiles(e)) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    windowDragDepth++;
    if (dropzone) dropzone.classList.add('drag-active');
  });

  window.addEventListener('dragover', (e) => {
    if (!hasDraggedFiles(e)) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    if (dropzone) dropzone.classList.add('drag-active');
  });

  window.addEventListener('dragleave', (e) => {
    if (!hasDraggedFiles(e) && windowDragDepth <= 0) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    windowDragDepth = Math.max(0, windowDragDepth - 1);
    if (windowDragDepth === 0 || !e.relatedTarget) {
      windowDragDepth = 0;
      if (dropzone) dropzone.classList.remove('drag-active');
    }
  });

  window.addEventListener('drop', (e) => {
    if (!hasDraggedFiles(e)) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    windowDragDepth = 0;
    if (dropzone) dropzone.classList.remove('drag-active');
    if (e._qshDropHandled) return;
    e._qshDropHandled = true;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      if (!hasDraggedFiles(e)) return;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      dropzone.classList.add('drag-active');
    });
  });

  dropzone.addEventListener('dragleave', (e) => {
    if (!hasDraggedFiles(e) && windowDragDepth <= 0) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (e.relatedTarget && typeof dropzone.contains === 'function' && dropzone.contains(e.relatedTarget)) {
      return;
    }
    if (windowDragDepth === 0) {
      dropzone.classList.remove('drag-active');
    }
  });

  dropzone.addEventListener('drop', (e) => {
    if (!hasDraggedFiles(e)) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    windowDragDepth = 0;
    dropzone.classList.remove('drag-active');
    if (e._qshDropHandled) return;
    e._qshDropHandled = true;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  // Delegated Card Actions
  itemsContainer.addEventListener('click', (e) => {
    const taskCb = e.target.closest('.js-note-task-cb, .note-task-cb');
    if (taskCb) {
      const noteId = taskCb.getAttribute('data-id');
      const lineIdx = taskCb.getAttribute('data-line');
      if (noteId && lineIdx !== null) {
        toggleNoteTaskLine(noteId, parseInt(lineIdx, 10));
      }
      return;
    }

    const selectCb = e.target.closest('.js-select-item-cb, .item-select-cb');
    if (selectCb) {
      const selId = selectCb.getAttribute('data-id');
      if (selId) {
        const shouldSelect = !selectedItemIds.has(selId);
        if (e.shiftKey && lastClickedCheckboxId && lastClickedCheckboxId !== selId) {
          const visible = getFilteredSortedItems();
          const startIdx = visible.findIndex((i) => i.id === lastClickedCheckboxId);
          const endIdx = visible.findIndex((i) => i.id === selId);
          if (startIdx >= 0 && endIdx >= 0) {
            const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
            for (let k = from; k <= to; k++) {
              if (shouldSelect) {
                selectedItemIds.add(visible[k].id);
              } else {
                selectedItemIds.delete(visible[k].id);
              }
            }
          } else if (shouldSelect) {
            selectedItemIds.add(selId);
          } else {
            selectedItemIds.delete(selId);
          }
        } else if (shouldSelect) {
          selectedItemIds.add(selId);
        } else {
          selectedItemIds.delete(selId);
        }
        lastClickedCheckboxId = selId;
        renderItems();
      }
      return;
    }

    const resetFilterBtn = e.target.closest('.js-reset-filter-btn');
    if (resetFilterBtn) {
      activeFilter = 'all';
      sortOrder = 'newest';
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      if (sortOrderSelect) sortOrderSelect.value = 'newest';
      filterTabs.forEach((t) => {
        if ((t.getAttribute('data-filter') || 'all') === 'all') {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      if (filterTabsBar && typeof filterTabsBar.querySelectorAll === 'function') {
        filterTabsBar.querySelectorAll('.filter-tab').forEach((t) => {
          if ((t.getAttribute('data-filter') || 'all') === 'all') {
            t.classList.add('active');
          } else {
            t.classList.remove('active');
          }
        });
      }
      renderItems();
      return;
    }

    const toggleNoteBtn = e.target.closest('.js-toggle-note-expand');
    if (toggleNoteBtn) {
      const noteId = toggleNoteBtn.getAttribute('data-id');
      if (noteId) {
        if (expandedNoteIds.has(noteId)) {
          expandedNoteIds.delete(noteId);
        } else {
          expandedNoteIds.add(noteId);
        }
        renderItems();
      }
      return;
    }

    const copyCodeBtn = e.target.closest('.js-copy-code-btn');
    if (copyCodeBtn) {
      copyToClipboard(copyCodeBtn.getAttribute('data-code') || '', copyCodeBtn);
      return;
    }

    const copyImgBtn = e.target.closest('.js-copy-image-btn');
    if (copyImgBtn) {
      copyImageToClipboard(copyImgBtn.getAttribute('data-id'), copyImgBtn);
      return;
    }

    const copyBtn = e.target.closest('.js-copy-btn');
    if (copyBtn) {
      copyToClipboard(copyBtn.getAttribute('data-copy'), copyBtn);
      return;
    }

    const qrBtn = e.target.closest('.js-qr-btn');
    if (qrBtn) {
      openQrModal(qrBtn.getAttribute('data-qr'), qrBtn.getAttribute('data-title'));
      return;
    }

    const shareBtn = e.target.closest('.js-share-btn');
    if (shareBtn) {
      shareItem(shareBtn.getAttribute('data-id'));
      return;
    }

    const pinBtn = e.target.closest('.js-pin-btn');
    if (pinBtn) {
      togglePinItem(pinBtn.getAttribute('data-id'));
      return;
    }

    const editBtn = e.target.closest('.js-edit-btn');
    if (editBtn) {
      openEditModal(editBtn.getAttribute('data-id'));
      return;
    }

    const noteDlBtn = e.target.closest('.js-download-note-btn');
    if (noteDlBtn) {
      downloadNoteAsTxt(noteDlBtn.getAttribute('data-id'));
      return;
    }

    const pdfBtn = e.target.closest('.js-preview-pdf-btn');
    if (pdfBtn) {
      openPdfPreviewModal(pdfBtn.getAttribute('data-id'), pdfBtn.getAttribute('data-name'));
      return;
    }

    const imgThumb = e.target.closest('.item-image-preview');
    if (imgThumb) {
      openPdfPreviewModal(
        imgThumb.getAttribute('data-id') || imgThumb.getAttribute('data-cloud-image-id'),
        imgThumb.getAttribute('data-name') || imgThumb.getAttribute('alt')
      );
      return;
    }

    const dlBtn = e.target.closest('.js-download-file-btn');
    if (dlBtn && window.QSHCloud && window.QSHCloud.isCloudMode()) {
      e.preventDefault();
      triggerCloudFileDownload(dlBtn.getAttribute('data-id'), dlBtn.getAttribute('data-name'));
      return;
    }

    const delBtn = e.target.closest('.js-delete-btn');
    if (delBtn) {
      deleteItemById(delBtn.getAttribute('data-id'));
    }
  });

  // Batch Action Bar Buttons
  if (batchSelectAllBtn) {
    batchSelectAllBtn.addEventListener('click', () => {
      toggleSelectAllVisibleItems();
    });
  }
  if (batchCopySelectedBtn) {
    batchCopySelectedBtn.addEventListener('click', () => {
      return batchCopySelectedItems();
    });
  }
  if (batchDownloadSelectedBtn) {
    batchDownloadSelectedBtn.addEventListener('click', () => {
      return batchDownloadSelectedItems();
    });
  }
  if (batchPinSelectedBtn) {
    batchPinSelectedBtn.addEventListener('click', () => {
      return batchPinSelectedItems();
    });
  }
  if (batchExportSelectedBtn) {
    batchExportSelectedBtn.addEventListener('click', () => {
      batchExportSelectedItems();
    });
  }
  if (batchDeleteSelectedBtn) {
    batchDeleteSelectedBtn.addEventListener('click', () => {
      return batchDeleteSelectedItems();
    });
  }
  if (batchClearSelectionBtn) {
    batchClearSelectionBtn.addEventListener('click', () => {
      selectedItemIds.clear();
      lastClickedCheckboxId = null;
      renderItems();
    });
  }

  // Filter Tabs & Search
  function activateFilterTab(filterValue, tabEl) {
    filterTabs.forEach((t) => t.classList.remove('active'));
    if (filterTabsBar && typeof filterTabsBar.querySelectorAll === 'function') {
      filterTabsBar.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
    }
    if (tabEl && tabEl.classList) tabEl.classList.add('active');
    activeFilter = filterValue || 'all';
    renderItems();
  }

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activateFilterTab(tab.getAttribute('data-filter') || 'all', tab);
    });
  });

  if (filterTabsBar) {
    filterTabsBar.addEventListener('click', (e) => {
      const tab = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('.filter-tab')
        : null;
      if (tab) {
        activateFilterTab(tab.getAttribute('data-filter') || 'all', tab);
      }
    });
  }

  if (sortOrderSelect) {
    sortOrderSelect.addEventListener('change', () => {
      sortOrder = sortOrderSelect.value || 'newest';
      renderItems();
    });
  }

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    renderItems();
  });

  // Header Buttons & Modals
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      toggleTheme();
    });
  }

  if (shortcutsBtn && shortcutsModal) {
    shortcutsBtn.addEventListener('click', () => {
      shortcutsModal.classList.add('open');
    });
  }

  if (closeShortcutsModalBtn && shortcutsModal) {
    closeShortcutsModalBtn.addEventListener('click', () => {
      shortcutsModal.classList.remove('open');
    });
  }

  if (telemetryToggleBtn && telemetryDashboard) {
    telemetryToggleBtn.addEventListener('click', () => {
      telemetryDashboard.classList.toggle('collapsed');
      updateTelemetryDashboard();
    });
  }

  if (syncCloudNowBtn) {
    syncCloudNowBtn.addEventListener('click', () => {
      forceSyncFromCloud();
    });
  }

  if (exportRoomBtn) {
    exportRoomBtn.addEventListener('click', () => {
      exportRoomBackupJson();
    });
  }

  if (importRoomBtn && importRoomInput) {
    importRoomBtn.addEventListener('click', () => {
      importRoomInput.click();
    });
    importRoomInput.addEventListener('change', () => {
      if (importRoomInput.files && importRoomInput.files[0]) {
        importRoomBackupJson(importRoomInput.files[0]);
      }
    });
  }

  if (closeEditModalBtn && editModal) {
    closeEditModalBtn.addEventListener('click', () => {
      editModal.classList.remove('open');
      editingItemId = null;
    });
  }
  if (cancelEditItemBtn && editModal) {
    cancelEditItemBtn.addEventListener('click', () => {
      editModal.classList.remove('open');
      editingItemId = null;
    });
  }
  if (saveEditItemBtn) {
    saveEditItemBtn.addEventListener('click', () => {
      saveEditedItem();
    });
  }
  if (editItemTitleInput) {
    editItemTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEditedItem();
      }
    });
  }
  if (editItemTextarea) {
    editItemTextarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveEditedItem();
      }
    });
  }

  if (cleanupStorageBtn) {
    cleanupStorageBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/cleanup', { method: 'POST' });
        const data = await res.json();
        await fetchItems();
        updateTelemetryDashboard();
        showToast(`🧹 Đã dọn dẹp ${data.deletedCount || 0} mục hết hạn & giải phóng bộ nhớ!`);
      } catch (_) {
        showToast('❌ Không thể dọn dẹp bộ nhớ');
      }
    });
  }

  if (resetBandwidthBtn) {
    resetBandwidthBtn.addEventListener('click', () => {
      if (window.QSHCloud && typeof window.QSHCloud.resetTelemetry === 'function') {
        window.QSHCloud.resetTelemetry();
        updateTelemetryDashboard();
        showToast('🔄 Đã đặt lại bộ đếm băng thông phiên!');
      }
    });
  }

  roomQrBtn.addEventListener('click', () => {
    return openQrModal(getShareRoomUrl(), `Phòng "${currentRoom}"`);
  });

  clearRoomBtn.addEventListener('click', () => {
    handleClearRoomClick();
  });

  closeQrModalBtn.addEventListener('click', () => qrModal.classList.remove('open'));
  copyQrTextBtn.addEventListener('click', () => copyToClipboard(currentQrText, copyQrTextBtn));
  if (downloadQrImgBtn) {
    downloadQrImgBtn.addEventListener('click', () => {
      downloadQrCodePng();
    });
  }
  if (shareQrImgBtn) {
    shareQrImgBtn.addEventListener('click', () => {
      return shareQrCodeImage();
    });
  }

  if (copyModalImageBtn) {
    copyModalImageBtn.addEventListener('click', () => {
      if (currentModalItemId) {
        copyImageToClipboard(currentModalItemId, copyModalImageBtn);
      }
    });
  }

  if (copyModalTextBtn) {
    copyModalTextBtn.addEventListener('click', () => {
      copyToClipboard(currentModalTextContent, copyModalTextBtn);
    });
  }

  closePdfModalBtn.addEventListener('click', () => {
    closePdfPreviewModal();
  });

  roomSwitchBtn.addEventListener('click', () => {
    roomNameInput.value = currentRoom === 'default' ? '' : currentRoom;
    renderRecentRooms();
    roomModal.classList.add('open');
    roomNameInput.focus();
  });

  if (recentRoomsList) {
    recentRoomsList.addEventListener('click', (e) => {
      const chip = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('.recent-room-chip')
        : null;
      if (chip) {
        const targetRoom = chip.getAttribute('data-room') || 'default';
        roomModal.classList.remove('open');
        switchRoom(targetRoom);
      }
    });
  }

  if (randomRoomBtn) {
    randomRoomBtn.addEventListener('click', () => {
      const randomRoom = generateRandomRoomSlug();
      if (roomNameInput) {
        roomNameInput.value = randomRoom;
      }
      if (roomModal) {
        roomModal.classList.remove('open');
      }
      switchRoom(randomRoom);
      showToast(`🎲 Đã tạo & chuyển sang phòng riêng "${randomRoom}"! Hãy quét mã QR hoặc Copy Link Phòng để mời thiết bị khác.`);
    });
  }

  if (copyRoomLinkBtn) {
    copyRoomLinkBtn.addEventListener('click', () => {
      const typedRoom = (roomNameInput && typeof roomNameInput.value === 'string' && roomNameInput.value.trim())
        ? roomNameInput.value.trim().toLowerCase()
        : currentRoom;
      return copyToClipboard(
        getShareRoomUrl(typedRoom),
        copyRoomLinkBtn,
        `🔗 Đã sao chép link phòng "${typedRoom}" vào Clipboard!`
      );
    });
  }

  closeRoomModalBtn.addEventListener('click', () => roomModal.classList.remove('open'));
  resetDefaultRoomBtn.addEventListener('click', () => {
    roomModal.classList.remove('open');
    switchRoom('default');
  });
  confirmRoomBtn.addEventListener('click', () => {
    roomModal.classList.remove('open');
    switchRoom(roomNameInput.value);
  });
  roomNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      roomModal.classList.remove('open');
      switchRoom(roomNameInput.value);
    }
  });

  // Close modals on backdrop click or Escape key
  [qrModal, pdfModal, roomModal, editModal, shortcutsModal].filter(Boolean).forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (modal === pdfModal) {
          closePdfPreviewModal();
        } else {
          modal.classList.remove('open');
          if (modal === editModal) editingItemId = null;
        }
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      resetClearRoomConfirm();
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      copyLatestItem();
    } else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        if (typeof searchInput.select === 'function') searchInput.select();
      }
    } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const activeEl = document.activeElement;
      const activeTag = activeEl && activeEl.tagName ? String(activeEl.tagName).toUpperCase() : '';
      const isEditable = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || Boolean(activeEl && activeEl.isContentEditable);
      const anyModalOpen = [qrModal, pdfModal, roomModal, editModal, shortcutsModal].some((m) => m && m.classList && m.classList.contains('open'));
      if (!isEditable && !anyModalOpen && searchInput) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        searchInput.focus();
        if (typeof searchInput.select === 'function') searchInput.select();
      }
    } else if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const activeEl = document.activeElement;
      const activeTag = activeEl && activeEl.tagName ? String(activeEl.tagName).toUpperCase() : '';
      const isEditable = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || Boolean(activeEl && activeEl.isContentEditable);
      const anyOtherModalOpen = [qrModal, pdfModal, roomModal, editModal].some((m) => m && m.classList && m.classList.contains('open'));
      if (!isEditable && !anyOtherModalOpen && shortcutsModal) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        shortcutsModal.classList.add('open');
      }
    }
  });

  // Auto-sync from 24/7 Cloud Gist on mobile/desktop wake-up or tab focus
  function handleAppWakeOrFocus() {
    if (document.visibilityState && document.visibilityState !== 'visible') {
      if (window.QSHCloud && typeof window.QSHCloud.flushDirtyRoomsToGist === 'function') {
        try { window.QSHCloud.flushDirtyRoomsToGist(); } catch (_) {}
      }
      return;
    }
    const now = Date.now();
    if (now - lastWakeSyncAt < 3500) return;
    lastWakeSyncAt = now;
    fetchItems(true);
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connectWebSocket();
    }
  }

  document.addEventListener('visibilitychange', handleAppWakeOrFocus);
  window.addEventListener('focus', handleAppWakeOrFocus);

  // Periodic UI countdown & heartbeat
  setInterval(() => {
    renderItems();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'ping' }));
    }
  }, 30000);

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // Initialize
  applyTheme(getInitialTheme(), false);
  currentRoomBadge.textContent = currentRoom;
  recordRecentRoom(currentRoom);
  if (itemInput && !itemInput.value) {
    restoreComposerDraft(currentRoom);
  } else {
    updateComposerCounter();
  }
  fetchPublicOrigin();
  fetchItems();
  connectWebSocket();
})();

