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
  const pasteClipboardBtn = document.getElementById('pasteClipboardBtn');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadProgressBar = document.getElementById('uploadProgressBar');

  const filterTabs = document.querySelectorAll('.filter-tab');
  const searchInput = document.getElementById('searchInput');
  const itemsContainer = document.getElementById('itemsContainer');

  const countAll = document.getElementById('countAll');
  const countLink = document.getElementById('countLink');
  const countNote = document.getElementById('countNote');
  const countFile = document.getElementById('countFile');

  // Modals
  const qrModal = document.getElementById('qrModal');
  const qrModalTitle = document.getElementById('qrModalTitle');
  const qrImage = document.getElementById('qrImage');
  const qrCaption = document.getElementById('qrCaption');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const copyQrTextBtn = document.getElementById('copyQrTextBtn');

  const pdfModal = document.getElementById('pdfModal');
  const pdfModalTitle = document.getElementById('pdfModalTitle');
  const pdfViewerFrame = document.getElementById('pdfViewerFrame');
  const pdfModalOpenTab = document.getElementById('pdfModalOpenTab');
  const pdfModalDownload = document.getElementById('pdfModalDownload');
  const closePdfModalBtn = document.getElementById('closePdfModalBtn');

  const roomModal = document.getElementById('roomModal');
  const roomNameInput = document.getElementById('roomNameInput');
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
  async function fetchItems() {
    try {
      const res = await fetch(`/api/items?room=${encodeURIComponent(currentRoom)}`);
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
            openPdfPreviewModal(previewId, target ? (target.fileName || target.file_name || target.title) : 'PDF');
          } else if (downloadId) {
            const target = items.find((i) => i.id === downloadId);
            triggerCloudFileDownload(downloadId, target ? (target.fileName || target.file_name || target.title) : 'download');
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

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append('room', currentRoom);
      formData.append('ttl', ttlSelect.value);
      formData.append('file', file, file.name);

      try {
        uploadProgressBar.style.width = `${Math.round(((i + 0.5) / fileList.length) * 100)}%`;
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success && data.item) {
          upsertItemInState(data.item);
          showToast(`📄 Đã tải lên: ${file.name}`);
        } else {
          showToast(`❌ Lỗi tải file ${file.name}: ${data.error || 'Thất bại'}`);
        }
      } catch (err) {
        showToast(`❌ Lỗi mạng khi tải lên ${file.name}`);
      }
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
    // Filter out expired items client-side too
    items = items.filter((item) => {
      const exp = item.expiresAt ?? item.expires_at;
      return !exp || exp > now;
    });

    // Update counts
    countAll.textContent = items.length;
    countLink.textContent = items.filter((i) => i.type === 'link').length;
    countNote.textContent = items.filter((i) => i.type === 'note').length;
    countFile.textContent = items.filter((i) => i.type === 'file').length;

    const filtered = items.filter((item) => {
      if (activeFilter !== 'all' && item.type !== activeFilter) return false;
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
      return;
    }

    itemsContainer.innerHTML = filtered.map((item) => renderSingleCard(item)).join('');
    hydrateCloudImages();
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
    const isPdf = Boolean(item.isPdf || item.is_pdf);
    const mime = item.mimeType || item.mime_type || '';
    const isImage = item.type === 'file' && mime.startsWith('image/');
    const isTextPreviewable = item.type === 'file' && (mime.startsWith('text/') || mime.includes('json'));
    const canPreviewModal = isPdf || isImage || isTextPreviewable;
    const createdAt = item.createdAt || item.created_at;
    const expiresAt = item.expiresAt || item.expires_at;
    const fileName = item.fileName || item.file_name || item.title || 'file';
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
          <pre class="item-note-pre">${escapeHtml(item.content)}</pre>
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
          ${hasCaption ? `<div style="margin-top: 6px; font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(item.content)}</div>` : ''}
          ${isImage ? `<img src="${isCloud ? '' : localPreviewUrl}" data-cloud-image-id="${escapeHtml(item.id)}" alt="${escapeHtml(fileName)}" class="item-image-preview" loading="lazy" />` : ''}
        </div>
      `;
    }

    const copyTarget = item.type === 'file' ? downloadUrl : (item.content || '');
    const qrTarget = item.type === 'file' ? previewUrl : (item.content || '');
    const safeLinkHref = item.type === 'link' ? sanitizeUrl(item.content) : '#';

    return `
      <article class="item-card" data-id="${escapeHtml(item.id)}">
        <div class="item-top">
          <div class="item-meta">
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

          <button type="button" class="btn btn-sm btn-danger js-delete-btn" data-id="${escapeHtml(item.id)}" style="margin-left: auto;">
            🗑️ Xóa
          </button>
        </div>
      </article>
    `;
  }

  // QR Modal
  async function openQrModal(text, title) {
    currentQrText = text;
    qrModalTitle.textContent = title ? `📱 Mã QR: ${title}` : '📱 Quét mã QR trên Điện thoại';
    qrCaption.textContent = text;
    qrImage.src = '';
    qrModal.classList.add('open');

    try {
      const res = await fetch(`/api/qr?text=${encodeURIComponent(text)}`);
      const data = await res.json();
      if (data.success && data.dataUrl) {
        qrImage.src = data.dataUrl;
      }
    } catch (err) {
      showToast('❌ Không thể tạo mã QR');
    }
  }

  // PDF Preview Modal & Cloud File Download
  async function openPdfPreviewModal(id, fileName) {
    pdfModalTitle.textContent = `📄 ${fileName || 'Xem trước PDF'}`;
    pdfModal.classList.add('open');

    if (window.QSHCloud && window.QSHCloud.isCloudMode()) {
      const blobUrl = await window.QSHCloud.getBlobUrlForFile(id);
      if (blobUrl) {
        pdfViewerFrame.src = blobUrl;
        pdfModalOpenTab.href = blobUrl;
        pdfModalDownload.href = blobUrl;
        pdfModalDownload.setAttribute('download', fileName || 'document.pdf');
        return;
      }
    }

    const previewUrl = `/api/files/${encodeURIComponent(id)}/preview`;
    const downloadUrl = `/api/files/${encodeURIComponent(id)}/download`;
    pdfViewerFrame.src = previewUrl;
    pdfModalOpenTab.href = previewUrl;
    pdfModalDownload.href = downloadUrl;
    pdfModalDownload.setAttribute('download', fileName || 'document.pdf');
  }

  async function triggerCloudFileDownload(id, fileName) {
    if (window.QSHCloud && window.QSHCloud.isCloudMode()) {
      const blobUrl = await window.QSHCloud.getBlobUrlForFile(id);
      if (blobUrl) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
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
        const msg = JSON.parse(event.data);
        if (msg.type === 'item_created' && msg.item) {
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

  function switchRoom(newRoom) {
    const clean = (newRoom && newRoom.trim()) ? newRoom.trim().toLowerCase() : 'default';
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'leave', room: currentRoom }));
      ws.send(JSON.stringify({ action: 'join', room: clean }));
    }
    currentRoom = clean;
    currentRoomBadge.textContent = currentRoom;

    const url = new URL(window.location.href);
    if (currentRoom === 'default') {
      url.searchParams.delete('room');
    } else {
      url.searchParams.set('room', currentRoom);
    }
    window.history.pushState({}, '', url.toString());
    fetchItems();
  }

  // Event Listeners
  sendItemBtn.addEventListener('click', () => {
    createTextItem(itemInput.value, ttlSelect.value);
  });

  itemInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      createTextItem(itemInput.value, ttlSelect.value);
    }
  });

  pasteClipboardBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        itemInput.value = text;
        await createTextItem(text, ttlSelect.value);
      } else {
        showToast('⚠️ Clipboard đang trống hoặc chứa dữ liệu không phải văn bản');
      }
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

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
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
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.getAttribute('data-filter') || 'all';
      renderItems();
    });
  });

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    renderItems();
  });

  // Header Buttons & Modals
  roomQrBtn.addEventListener('click', () => {
    openQrModal(getShareRoomUrl(), `Phòng "${currentRoom}"`);
  });

  clearRoomBtn.addEventListener('click', () => {
    clearCurrentRoom();
  });

  closeQrModalBtn.addEventListener('click', () => qrModal.classList.remove('open'));
  copyQrTextBtn.addEventListener('click', () => copyToClipboard(currentQrText, copyQrTextBtn));

  closePdfModalBtn.addEventListener('click', () => {
    pdfModal.classList.remove('open');
    pdfViewerFrame.src = 'about:blank';
  });

  roomSwitchBtn.addEventListener('click', () => {
    roomNameInput.value = currentRoom === 'default' ? '' : currentRoom;
    roomModal.classList.add('open');
    roomNameInput.focus();
  });

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

  // Close modals on backdrop click
  [qrModal, pdfModal, roomModal].forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
        if (modal === pdfModal) pdfViewerFrame.src = 'about:blank';
      }
    });
  });

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
  fetchPublicOrigin();
  fetchItems();
  connectWebSocket();
})();
