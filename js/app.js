// public/js/app.js
(function () {
  'use strict';

  // State
  let currentRoom = getRoomFromUrl();
  let items = [];
  let activeFilter = 'all';
  let searchQuery = '';
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let currentQrText = '';
  let currentQrTitle = '';
  let currentQrDataUrl = '';
  let publicOrigin = '';

  // DOM Elements
  const wsStatusPill = document.getElementById('wsStatusPill');
  const wsStatusText = document.getElementById('wsStatusText');
  const currentRoomBadge = document.getElementById('currentRoomBadge');
  const roomSwitchBtn = document.getElementById('roomSwitchBtn');
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
  const searchInput = document.getElementById('searchInput');
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

  const pdfModal = document.getElementById('pdfModal');
  const pdfModalTitle = document.getElementById('pdfModalTitle');
  const pdfViewerFrame = document.getElementById('pdfViewerFrame');
  const pdfModalOpenTab = document.getElementById('pdfModalOpenTab');
  const pdfModalDownload = document.getElementById('pdfModalDownload');
  const closePdfModalBtn = document.getElementById('closePdfModalBtn');
  const copyModalTextBtn = document.getElementById('copyModalTextBtn');
  const pdfMobileFallbackBar = document.getElementById('pdfMobileFallbackBar');
  const pdfFallbackOpenLink = document.getElementById('pdfFallbackOpenLink');
  const pdfFallbackDownloadLink = document.getElementById('pdfFallbackDownloadLink');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const modalImagePreview = document.getElementById('modalImagePreview');
  const textPreviewContainer = document.getElementById('textPreviewContainer');
  const modalTextPreview = document.getElementById('modalTextPreview');
  let currentModalTextContent = '';
  let lastWakeSyncAt = 0;

  const editModal = document.getElementById('editModal');
  const editModalTitle = document.getElementById('editModalTitle');
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
  const resetDefaultRoomBtn = document.getElementById('resetDefaultRoomBtn');
  const confirmRoomBtn = document.getElementById('confirmRoomBtn');

  const toastContainer = document.getElementById('toastContainer');

  // Helpers
  function getRoomFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('room');
    return (raw && raw.trim()) ? raw.trim().toLowerCase() : 'default';
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

  function getShareRoomUrl() {
    const base = getShareOrigin();
    if (currentRoom === 'default') {
      return `${base}/`;
    }
    return `${base}/?room=${encodeURIComponent(currentRoom)}`;
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
      if (/[.,;:!?]/.test(lastChar)) {
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

  function renderNoteContentWithLinks(rawText) {
    if (!rawText) return '';
    const str = String(rawText);
    const urlRegex = /https?:\/\/[^\s<>"'`]+/gi;
    let result = '';
    let lastIdx = 0;
    let match;
    while ((match = urlRegex.exec(str)) !== null) {
      const matchStart = match.index;
      if (matchStart > lastIdx) {
        result += escapeHtml(str.slice(lastIdx, matchStart));
      }
      const { url: rawUrl, trailing } = stripUnbalancedTrailingPunct(match[0]);
      const safeHref = sanitizeUrl(rawUrl);
      if (safeHref !== '#') {
        result += `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer" class="note-inline-link">${escapeHtml(rawUrl)}</a>${escapeHtml(trailing)}`;
      } else {
        result += escapeHtml(match[0]);
      }
      lastIdx = matchStart + match[0].length;
    }
    if (lastIdx < str.length) {
      result += escapeHtml(str.slice(lastIdx));
    }
    return result;
  }

  function updateComposerCounter() {
    if (!composerCharCount || !itemInput) return;
    const val = itemInput.value || '';
    const chars = val.length;
    const lines = val ? val.split(/\r?\n/).length : 1;
    composerCharCount.textContent = `${chars.toLocaleString('vi-VN')} ký tự • ${lines} dòng`;
  }

  async function copyToClipboard(text, buttonEl) {
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
    showToast('📋 Đã sao chép vào Clipboard!');
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
          if (previewId) {
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

  async function createTextItem(content, ttl = ttlSelect.value) {
    const trimmed = (content || '').trim();
    if (!trimmed) {
      showToast('⚠️ Vui lòng nhập nội dung hoặc dán từ Clipboard!');
      return;
    }

    sendItemBtn.disabled = true;
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: currentRoom,
          content: trimmed,
          ttl
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.item) {
        itemInput.value = '';
        updateComposerCounter();
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
      formData.append('ttl', ttlSelect.value);
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

  function downloadNoteAsTxt(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const blob = new Blob([String(item.content || '')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeTitle = String(item.title || 'ghi-chu').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'note';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`💾 Đã tải xuống ${safeTitle}.txt`);
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
        if (!entry || !entry.content || entry.type === 'file') continue;
        const exists = items.some((i) => i.content === entry.content && i.type === entry.type);
        if (exists) continue;
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: currentRoom,
            content: String(entry.content),
            title: entry.title || undefined,
            pinned: Boolean(entry.pinned),
            ttl: '7d'
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
    renderItems();
  }

  function removeItemFromState(id) {
    items = items.filter((i) => i.id !== id);
    renderItems();
  }

  // Render UI
  function renderItems() {
    const now = Date.now();
    // Filter out expired items client-side too, and sort pinned items first
    items = items
      .filter((item) => {
        const exp = item.expiresAt ?? item.expires_at;
        return !exp || exp > now;
      })
      .sort((a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return ((b.createdAt || b.created_at || 0) - (a.createdAt || a.created_at || 0));
      });

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

    const filtered = items.filter((item) => {
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
    });

    if (filtered.length === 0) {
      itemsContainer.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 2rem; margin-bottom: 8px;">✨</div>
          <div>Chưa có mục nào trong phòng <strong>${escapeHtml(currentRoom)}</strong>.</div>
          <div style="font-size: 0.82rem; margin-top: 4px;">Dán Link, Ghi chú hoặc tải lên file PDF để đồng bộ tức thì sang thiết bị khác!</div>
        </div>
      `;
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
    const isImage = item.type === 'file' && (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(lowerName));
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

    let bodyHtml = '';
    if (item.type === 'link') {
      const safeLink = sanitizeUrl(item.content);
      bodyHtml = `
        <div class="item-body">
          <a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer" class="item-link">
            ${escapeHtml(item.content)}
          </a>
        </div>
      `;
    } else if (item.type === 'note') {
      bodyHtml = `
        <div class="item-body">
          <pre class="item-note-pre">${renderNoteContentWithLinks(item.content)}</pre>
        </div>
      `;
    } else if (item.type === 'file') {
      const hasCaption = item.content && item.content !== fileName;
      bodyHtml = `
        <div class="item-body">
          <div class="item-file-row">
            <div class="file-info-main">
              <span class="file-icon-box">${isPdf ? '📕' : (isImage ? '🖼️' : '📄')}</span>
              <div>
                <div class="file-name">${escapeHtml(fileName)}</div>
                <div class="file-size">${formatBytes(fileSize)} ${mime ? '• ' + escapeHtml(mime) : ''}</div>
              </div>
            </div>
          </div>
          ${hasCaption ? `<div style="margin-top: 6px; font-size: 0.85rem; color: var(--text-secondary); white-space: pre-wrap;">${renderNoteContentWithLinks(item.content)}</div>` : ''}
          ${isImage ? `<img src="${isCloud ? '' : localPreviewUrl}" data-cloud-image-id="${escapeHtml(item.id)}" alt="${escapeHtml(fileName)}" class="item-image-preview" loading="lazy" />` : ''}
        </div>
      `;
    }

    const copyTarget = item.type === 'file' ? downloadUrl : (item.content || '');
    const qrTarget = item.type === 'file' ? previewUrl : (item.content || '');
    const safeLinkHref = item.type === 'link' ? sanitizeUrl(item.content) : '#';
    const isPinned = Boolean(item.pinned);

    return `
      <article class="item-card ${isPinned ? 'pinned' : ''}" data-id="${escapeHtml(item.id)}">
        <div class="item-top">
          <div class="item-meta">
            ${isPinned ? '<span class="pin-badge">📌 Đã ghim</span>' : ''}
            <span class="type-badge ${badgeClass}">${badgeLabel}</span>
            <span class="time-badge">🕒 ${formatRelativeTime(createdAt)}</span>
            <span class="ttl-badge" title="Thời gian tự động xóa">⏳ ${formatRemainingTtl(expiresAt)}</span>
          </div>
        </div>

        ${bodyHtml}

        <div class="item-actions">
          <button type="button" class="btn btn-sm js-copy-btn" data-copy="${escapeHtml(copyTarget)}">
            📋 Copy ${item.type === 'file' ? 'Link Tải' : ''}
          </button>

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
    await copyToClipboard(fallbackCopy, null);
    showToast('📤 Đã sao chép nội dung để chia sẻ!');
  }

  // QR Modal
  async function openQrModal(text, title) {
    currentQrText = text;
    currentQrTitle = title || '';
    currentQrDataUrl = '';
    qrModalTitle.textContent = title ? `📱 Mã QR: ${title}` : '📱 Quét mã QR trên Điện thoại';
    qrCaption.textContent = text;
    qrImage.src = '';
    qrModal.classList.add('open');

    try {
      const res = await fetch(`/api/qr?text=${encodeURIComponent(text)}`);
      const data = await res.json();
      if (data.success && data.dataUrl) {
        currentQrDataUrl = data.dataUrl;
        qrImage.src = data.dataUrl;
      }
    } catch (err) {
      showToast('❌ Không thể tạo mã QR');
    }
  }

  function downloadQrCodePng() {
    const srcUrl = currentQrDataUrl || (qrImage && qrImage.src) || '';
    if (!srcUrl || !String(srcUrl).startsWith('data:image/')) {
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

  // Multi-Format File & PDF Preview Modal
  function closePdfPreviewModal() {
    if (!pdfModal) return;
    pdfModal.classList.remove('open');
    if (pdfViewerFrame) pdfViewerFrame.src = 'about:blank';
    if (modalImagePreview) modalImagePreview.src = '';
    if (modalTextPreview) modalTextPreview.textContent = '';
    currentModalTextContent = '';
  }

  function closeAllModals() {
    if (qrModal) qrModal.classList.remove('open');
    closePdfPreviewModal();
    if (roomModal) roomModal.classList.remove('open');
    if (editModal) {
      editModal.classList.remove('open');
      editingItemId = null;
    }
  }

  async function openPdfPreviewModal(id, fileName) {
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
        return;
      }
      showToast('⚠️ Không thể tải file: dữ liệu nhị phân không còn trên Cloud Gist.');
    }
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
        } else if (msg.type === 'items_expired' && Array.isArray(msg.ids)) {
          msg.ids.forEach((id) => removeItemFromState(id));
        } else if (msg.type === 'room_cleared') {
          if (!msg.room || msg.room === currentRoom) {
            items = [];
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

  function switchRoom(newRoom) {
    const clean = (newRoom && newRoom.trim()) ? newRoom.trim().toLowerCase() : 'default';
    resetClearRoomConfirm();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'leave', room: currentRoom }));
      ws.send(JSON.stringify({ action: 'join', room: clean }));
    }
    currentRoom = clean;
    currentRoomBadge.textContent = currentRoom;
    recordRecentRoom(currentRoom);

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

  // Filter Tabs & Search
  function activateFilterTab(filterValue, tabEl) {
    filterTabs.forEach((t) => t.classList.remove('active'));
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

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    renderItems();
  });

  // Header Buttons & Modals
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
    openQrModal(getShareRoomUrl(), `Phòng "${currentRoom}"`);
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
  [qrModal, pdfModal, roomModal, editModal].filter(Boolean).forEach((modal) => {
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
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      copyLatestItem();
    }
  });

  // Auto-sync from 24/7 Cloud Gist on mobile/desktop wake-up or tab focus
  function handleAppWakeOrFocus() {
    if (document.visibilityState && document.visibilityState !== 'visible') return;
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
  currentRoomBadge.textContent = currentRoom;
  recordRecentRoom(currentRoom);
  updateComposerCounter();
  fetchPublicOrigin();
  fetchItems();
  connectWebSocket();
})();

