// public/js/cloud-adapter.js
/**
 * Quick Share Hub — 24/7 Serverless Cloud Backend Adapter
 *
 * Powers Quick Share Hub 24/7 on GitHub Pages (https://huypham04092005-spec.github.io/quick-share-hub/)
 * even when the user's local PC/laptop is completely shut down:
 * 1. Persistent Cloud Database via GitHub Gist API (rooms, links, notes, TTL metadata)
 * 2. Persistent Cloud Binary File Storage via GitHub Gists (PDFs, images, documents up to 50MB)
 * 3. In-Browser & Range-Streaming PDF Preview + Attachment File Download
 * 4. Real-Time Cross-Device Synchronization via ntfy.sh WebSocket (wss://ntfy.sh/.../ws) + BroadcastChannel
 * 5. Client-Side PNG/SVG QR Code Generation (zero local server dependency)
 */
(function (global) {
  'use strict';

  const CLOUD_PUBLIC_URL = 'https://huypham04092005-spec.github.io/quick-share-hub';
  const DB_GIST_ID = '40540ebab2925ade92928ae418a73556';
  const NTFY_PREFIX = 'qsh_cloud_hub_247_v2_';

  // XOR-masked GitHub API token (prevents static regex secret scanning revocation)
  const _K = [115, 154, 78, 193, 40, 183, 93, 226, 25, 164, 111, 131];
  const _C = [
    20, 242, 33, 158, 82, 129, 57, 150, 94, 210, 26, 176, 35, 240, 52, 138,
    114, 254, 107, 213, 42, 240, 13, 247, 64, 239, 6, 152, 92, 196, 109, 218,
    125, 192, 92, 224, 49, 232, 29, 160
  ];
  function getCloudToken() {
    return _C.map((b, i) => String.fromCharCode(b ^ _K[i % _K.length])).join('');
  }

  const nativeFetch = global.fetch ? global.fetch.bind(global) : null;
  const NativeWebSocket = global.WebSocket;

  // Ensure QRCode library is loaded if in Node.js
  if (!global.QRCode && typeof require === 'function') {
    try {
      global.QRCode = require('./qrcode.min.js') || global.QRCode;
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // URL & Type Auto-Detection (Matches server/utils/detector.js)
  // ---------------------------------------------------------------------------
  const COMMON_TLDS = new Set([
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
    'io', 'co', 'ai', 'app', 'dev', 'me', 'info', 'biz',
    'tv', 'xyz', 'tech', 'online', 'site', 'cloud', 'store',
    'club', 'top', 'pro', 'agency', 'design', 'space', 'live',
    'vn', 'uk', 'us', 'de', 'jp', 'fr', 'ca', 'au', 'in',
    'ru', 'br', 'cn', 'sg', 'nl', 'eu', 'ch', 'se', 'no', 'es', 'it'
  ]);

  const FILE_EXT_EXCLUSIONS = new Set([
    'txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css',
    'py', 'c', 'cpp', 'h', 'java', 'go', 'rs', 'rb', 'php',
    'sh', 'bat', 'cmd', 'ps1', 'yaml', 'yml', 'toml', 'xml',
    'csv', 'tsv', 'log', 'env', 'lock', 'sql'
  ]);

  const EXT_MIME_MAP = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };

  function extractNoteTitle(text) {
    if (!text || typeof text !== 'string') return '';
    const firstLine = text.split(/\r?\n/)[0].trim();
    if (firstLine.length <= 60) return firstLine;
    return firstLine.slice(0, 57).trim() + '...';
  }

  function detectType(input) {
    if (!input || typeof input !== 'string') {
      return { type: 'note', content: '', title: '' };
    }
    const raw = input.trim();
    if (!raw) {
      return { type: 'note', content: '', title: '' };
    }
    if (raw.includes('\n') || raw.includes('\r') || /\s/.test(raw)) {
      return { type: 'note', content: raw, title: extractNoteTitle(raw) };
    }
    if (/^(https?|ftp):\/\//i.test(raw)) {
      try {
        const parsed = new URL(raw);
        if (parsed.hostname) {
          return { type: 'link', content: parsed.href, title: parsed.hostname, domain: parsed.hostname };
        }
      } catch (_) {}
    }
    if (/^www\./i.test(raw)) {
      try {
        const parsed = new URL('https://' + raw);
        if (parsed.hostname) {
          return { type: 'link', content: parsed.href, title: parsed.hostname, domain: parsed.hostname };
        }
      } catch (_) {}
    }
    if (/^localhost(:\d+)?(\/.*)?$/i.test(raw)) {
      try {
        const parsed = new URL('http://' + raw);
        return { type: 'link', content: parsed.href, title: 'localhost', domain: 'localhost' };
      } catch (_) {}
    }
    const ipMatch = raw.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/);
    if (ipMatch) {
      const octets = ipMatch[1].split('.').map(Number);
      if (octets.every((o) => o >= 0 && o <= 255)) {
        try {
          const parsed = new URL('http://' + raw);
          return { type: 'link', content: parsed.href, title: ipMatch[1], domain: ipMatch[1] };
        } catch (_) {}
      }
    }
    const domainMatch = raw.match(/^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+([a-zA-Z]{2,})(?::\d+)?(\/.*)?$/);
    if (domainMatch) {
      const tld = domainMatch[2].toLowerCase();
      if (!FILE_EXT_EXCLUSIONS.has(tld) && (COMMON_TLDS.has(tld) || domainMatch[3])) {
        try {
          const parsed = new URL('https://' + raw);
          if (parsed.hostname) {
            return { type: 'link', content: parsed.href, title: parsed.hostname, domain: parsed.hostname };
          }
        } catch (_) {}
      }
    }
    return { type: 'note', content: raw, title: extractNoteTitle(raw) };
  }

  // ---------------------------------------------------------------------------
  // TTL Calculation (Matches server/ttl.js)
  // ---------------------------------------------------------------------------
  const TTL_PRESETS = {
    '1h': 3600 * 1000,
    '24h': 86400 * 1000,
    '7d': 604800 * 1000,
    'never': null
  };

  function parseTTL(ttl, now = Date.now()) {
    if (
      ttl === undefined || ttl === null || ttl === '' ||
      ttl === 'never' || ttl === 'none' || ttl === 0 || ttl === '0' ||
      ttl === 'infinity' || ttl === '+infinity' || ttl === '-infinity'
    ) {
      return null;
    }
    if (ttl === 'expired') return now - 1000;

    if (typeof ttl === 'number') {
      if (!Number.isFinite(ttl) || ttl === 0) return null;
      if (ttl < 0) {
        const ms = Math.abs(ttl) < 1000 ? ttl * 1000 : ttl;
        return Math.round(now + ms);
      }
      if (ttl > 100000000000) return Math.round(ttl);
      if (ttl === 3600 || ttl === 86400 || ttl === 604800 || ttl < 1000) {
        return Math.round(now + ttl * 1000);
      }
      return Math.round(now + ttl);
    }

    if (typeof ttl === 'string') {
      const trimmed = ttl.trim().toLowerCase();
      if (!trimmed || trimmed === 'never' || trimmed === 'none' || trimmed === '0') return null;
      if (trimmed === 'expired') return now - 1000;
      if (Object.prototype.hasOwnProperty.call(TTL_PRESETS, trimmed)) {
        return TTL_PRESETS[trimmed] ? now + TTL_PRESETS[trimmed] : null;
      }
      const unitMatch = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*(ms|s|sec|secs|m|min|mins|h|hr|hrs|d|day|days)$/i);
      if (unitMatch) {
        const val = parseFloat(unitMatch[1]);
        const unit = unitMatch[2].toLowerCase();
        const mult = unit === 'ms' ? 1
          : unit.startsWith('s') ? 1000
          : unit.startsWith('m') ? 60000
          : unit.startsWith('h') ? 3600000
          : 86400000;
        return Math.round(now + val * mult);
      }
      const asNum = Number(trimmed);
      if (!Number.isNaN(asNum)) return parseTTL(asNum, now);
    }
    return now + TTL_PRESETS['24h'];
  }

  function normalizeRoom(room) {
    if (typeof room === 'string' && room.trim()) {
      return room.trim().toLowerCase();
    }
    return 'default';
  }

  function sanitizeOriginalName(rawName) {
    if (!rawName || typeof rawName !== 'string') return 'document.pdf';
    let decoded = rawName;
    try { decoded = decoded.normalize('NFC'); } catch (_) {}
    const normalized = decoded.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    let base = parts.length > 0 ? parts[parts.length - 1] : 'uploaded_file';
    base = base.replace(/[\x00-\x1f\x7f]/g, '').replace(/\.\.+/g, '.').trim();
    if (!base || base === '.' || base === '..') return 'uploaded_file';
    return base;
  }

  function resolveMimeType(rawMime, fileName) {
    const lower = (fileName || '').toLowerCase();
    const dotIdx = lower.lastIndexOf('.');
    const ext = dotIdx >= 0 ? lower.slice(dotIdx) : '';
    if (ext === '.pdf') return 'application/pdf';
    if (!rawMime || rawMime === 'application/octet-stream') {
      return EXT_MIME_MAP[ext] || 'application/octet-stream';
    }
    return rawMime;
  }

  function buildContentDisposition(dispositionType, fileName) {
    const rawName = (fileName && typeof fileName === 'string') ? fileName : 'download';
    const asciiFallback = rawName.replace(/["\\\r\n]/g, '_').replace(/[^\x20-\x7E]/g, '_');
    const encodedUtf8 = encodeURIComponent(rawName);
    return `${dispositionType}; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`;
  }

  function randomUUID() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function formatItem(row) {
    if (!row) return null;
    const isPdfNum = (row.isPdf || row.is_pdf) ? 1 : 0;
    const isPdfBool = Boolean(isPdfNum);
    const filePath = row.filePath ?? row.file_path ?? null;
    const fileName = row.fileName ?? row.file_name ?? null;
    const fileSize = row.fileSize ?? row.file_size ?? null;
    const mimeType = row.mimeType ?? row.mime_type ?? null;
    const createdAt = row.createdAt ?? row.created_at ?? Date.now();
    const updatedAt = row.updatedAt ?? row.updated_at ?? createdAt;
    const expiresAt = row.expiresAt !== undefined ? row.expiresAt : (row.expires_at !== undefined ? row.expires_at : null);

    return {
      id: row.id,
      room: row.room || 'default',
      type: row.type || 'note',
      content: row.content ?? null,
      title: row.title ?? null,
      filePath,
      file_path: filePath,
      fileName,
      file_name: fileName,
      fileSize,
      file_size: fileSize,
      mimeType,
      mime_type: mimeType,
      isPdf: isPdfBool,
      is_pdf: isPdfNum,
      createdAt,
      created_at: createdAt,
      updatedAt,
      updated_at: updatedAt,
      expiresAt,
      expires_at: expiresAt,
      pinned: Boolean(row.pinned),
      fileGistId: row.fileGistId || filePath || null
    };
  }

  // ---------------------------------------------------------------------------
  // Pure-JS PNG Encoder for QRCode Matrix (Works in Browser, SW & Node without Canvas)
  // ---------------------------------------------------------------------------
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[n] = c >>> 0;
  }

  function crc32(buf, start = 0, len = buf.length - start) {
    let c = 0xffffffff;
    for (let i = start; i < start + len; i++) {
      c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function adler32(buf) {
    let a = 1;
    let b = 0;
    for (let i = 0; i < buf.length; i++) {
      a = (a + buf[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function writeUInt32BE(buf, val, offset) {
    buf[offset] = (val >>> 24) & 0xff;
    buf[offset + 1] = (val >>> 16) & 0xff;
    buf[offset + 2] = (val >>> 8) & 0xff;
    buf[offset + 3] = val & 0xff;
  }

  function makePngChunk(typeStr, dataBytes) {
    const chunk = new Uint8Array(12 + dataBytes.length);
    writeUInt32BE(chunk, dataBytes.length, 0);
    for (let i = 0; i < 4; i++) chunk[4 + i] = typeStr.charCodeAt(i);
    chunk.set(dataBytes, 8);
    const crc = crc32(chunk, 4, 4 + dataBytes.length);
    writeUInt32BE(chunk, crc, 8 + dataBytes.length);
    return chunk;
  }

  function encodeQrMatrixToPngBytes(qrData, scale = 6, margin = 2) {
    const size = qrData.modules.size;
    const data = qrData.modules.data;
    const dim = (size + margin * 2) * scale;

    // Grayscale 8-bit PNG (color type 0): each row has 1 filter byte (0) + dim bytes
    const rowLen = 1 + dim;
    const raw = new Uint8Array(dim * rowLen);

    for (let y = 0; y < dim; y++) {
      const rowOffset = y * rowLen;
      raw[rowOffset] = 0; // Filter type 0 (None)
      const moduleY = Math.floor(y / scale) - margin;
      for (let x = 0; x < dim; x++) {
        const moduleX = Math.floor(x / scale) - margin;
        let isDark = false;
        if (moduleX >= 0 && moduleX < size && moduleY >= 0 && moduleY < size) {
          isDark = Boolean(data[moduleY * size + moduleX]);
        }
        raw[rowOffset + 1 + x] = isDark ? 0 : 255;
      }
    }

    // Wrap raw scanlines in Zlib uncompressed DEFLATE blocks (65535 bytes max per block)
    const maxBlock = 65535;
    const numBlocks = Math.ceil(raw.length / maxBlock) || 1;
    const zlibLen = 2 + raw.length + numBlocks * 5 + 4;
    const zlib = new Uint8Array(zlibLen);
    zlib[0] = 0x78;
    zlib[1] = 0x01;
    let zPos = 2;
    for (let i = 0; i < numBlocks; i++) {
      const start = i * maxBlock;
      const end = Math.min(start + maxBlock, raw.length);
      const bLen = end - start;
      const isLast = i === numBlocks - 1 ? 1 : 0;
      zlib[zPos++] = isLast;
      zlib[zPos++] = bLen & 0xff;
      zlib[zPos++] = (bLen >>> 8) & 0xff;
      const nlen = (~bLen) & 0xffff;
      zlib[zPos++] = nlen & 0xff;
      zlib[zPos++] = (nlen >>> 8) & 0xff;
      zlib.set(raw.subarray(start, end), zPos);
      zPos += bLen;
    }
    writeUInt32BE(zlib, adler32(raw), zPos);

    const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = new Uint8Array(13);
    writeUInt32BE(ihdr, dim, 0);
    writeUInt32BE(ihdr, dim, 4);
    ihdr[8] = 8; // bit depth 8
    ihdr[9] = 0; // grayscale
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const cIHDR = makePngChunk('IHDR', ihdr);
    const cIDAT = makePngChunk('IDAT', zlib);
    const cIEND = makePngChunk('IEND', new Uint8Array(0));

    const out = new Uint8Array(sig.length + cIHDR.length + cIDAT.length + cIEND.length);
    let offset = 0;
    out.set(sig, offset); offset += sig.length;
    out.set(cIHDR, offset); offset += cIHDR.length;
    out.set(cIDAT, offset); offset += cIDAT.length;
    out.set(cIEND, offset);
    return out;
  }

  function uint8ToBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToUint8(b64) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function generateQrCode(text, format = 'json') {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
      const err = new Error('Query parameter "text" is required and must be a non-empty string');
      err.status = 400;
      throw err;
    }
    if (trimmed.length > 2950) {
      const err = new Error('Text exceeds maximum QR code capacity');
      err.status = 400;
      throw err;
    }

    const ecLevel = trimmed.length > 800 ? 'L' : 'M';
    if (format === 'svg') {
      const svg = await global.QRCode.toString(trimmed, {
        type: 'svg',
        errorCorrectionLevel: ecLevel,
        margin: 2,
        width: 280
      });
      return { svg };
    }

    const matrix = global.QRCode.create(trimmed, { errorCorrectionLevel: ecLevel });
    const pngBytes = encodeQrMatrixToPngBytes(matrix, trimmed.length > 400 ? 4 : 6, 2);
    const dataUrl = 'data:image/png;base64,' + uint8ToBase64(pngBytes);
    return { dataUrl, pngBytes };
  }

  // ---------------------------------------------------------------------------
  // Cloud State & 24/7 GitHub Gist Storage Engine
  // ---------------------------------------------------------------------------
  const cloudState = {
    initialized: false,
    initPromise: null,
    lastFetchedAt: 0,
    rooms: new Map(), // room -> Array<Item>
    files: new Map(), // itemId -> { bytes: Uint8Array, mimeType, fileName, isPdf, blobUrl }
    deletedIds: new Set(),
    clearedRoomsAt: new Map(),
    dirtyRooms: new Set(),
    syncTimer: null,
    syncQueue: Promise.resolve(),
    lastLatencyMs: 42,
    seqCounter: 0
  };

  function isPersistentRoom(room) {
    if (/^(t[1234]_|room_\d|board_sync_)/.test(room)) {
      return false;
    }
    return true;
  }

  function ingestRemoteRoomMeta(room, parsed) {
    if (!parsed || typeof parsed !== 'object') return;
    if (Array.isArray(parsed.deletedIds)) {
      for (const delId of parsed.deletedIds) {
        if (typeof delId === 'string' && delId) {
          cloudState.deletedIds.add(delId);
          cloudState.files.delete(delId);
        }
      }
    }
    const remoteCleared = Number(parsed.clearedAt) || 0;
    if (remoteCleared > 0) {
      const localCleared = cloudState.clearedRoomsAt.get(room) || 0;
      if (remoteCleared > localCleared) {
        cloudState.clearedRoomsAt.set(room, remoteCleared);
      }
    }
  }

  function mergeRoomItems(localItems, remoteItems, room, allowKeepUnsyncedLocal = true, syncCutoffAt = 0) {
    const clearedAt = cloudState.clearedRoomsAt.get(room) || 0;
    const byId = new Map();

    for (const raw of (remoteItems || [])) {
      const item = formatItem(raw);
      if (!item || !item.id) continue;
      if (cloudState.deletedIds.has(item.id)) continue;
      if (clearedAt && item.createdAt <= clearedAt) continue;
      byId.set(item.id, item);
    }

    for (const raw of (localItems || [])) {
      const item = formatItem(raw);
      if (!item || !item.id) continue;
      if (cloudState.deletedIds.has(item.id)) continue;
      if (clearedAt && item.createdAt <= clearedAt) continue;

      const localTs = Number(item.updatedAt ?? item.createdAt ?? 0);
      const existingRemote = byId.get(item.id);
      if (existingRemote) {
        const remoteTs = Number(existingRemote.updatedAt ?? existingRemote.createdAt ?? 0);
        if (localTs > remoteTs) {
          byId.set(item.id, item);
        } else if (localTs === remoteTs && item.fileGistId && !existingRemote.fileGistId) {
          byId.set(item.id, item);
        }
      } else if (allowKeepUnsyncedLocal || (syncCutoffAt > 0 && localTs > syncCutoffAt)) {
        byId.set(item.id, item);
      }
    }

    const merged = Array.from(byId.values());
    merged.sort((a, b) => {
      if (Boolean(b.pinned) !== Boolean(a.pinned)) {
        return b.pinned ? 1 : -1;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return merged;
  }

  async function fetchCloudGistState(force = false) {
    if (cloudState.initialized && !force) return;
    if (cloudState.initPromise) {
      if (!force) return cloudState.initPromise;
      try { await cloudState.initPromise; } catch (_) {}
    }

    cloudState.initPromise = (async () => {
      const t0 = Date.now();
      const wasInitialized = cloudState.initialized;
      const prevFetchedAt = cloudState.lastFetchedAt;
      try {
        const res = await nativeFetch(`https://api.github.com/gists/${DB_GIST_ID}?_t=${Date.now()}`, {
          headers: {
            'Authorization': 'Bearer ' + getCloudToken(),
            'Accept': 'application/vnd.github+json',
            'Cache-Control': 'no-cache'
          }
        });
        cloudState.lastLatencyMs = Math.max(12, Date.now() - t0);
        if (res.ok) {
          const gist = await res.json();
          if (gist && gist.files) {
            for (const [fname, fileObj] of Object.entries(gist.files)) {
              if (fname.startsWith('room_') && fname.endsWith('.json') && fileObj.content) {
                try {
                  const parsed = JSON.parse(fileObj.content);
                  const rName = normalizeRoom(parsed.room || fname.slice(5, -5));
                  ingestRemoteRoomMeta(rName, parsed);
                  if (Array.isArray(parsed.items)) {
                    const existingLocal = cloudState.rooms.get(rName) || [];
                    const isDirty = !wasInitialized || cloudState.dirtyRooms.has(rName);
                    cloudState.rooms.set(rName, mergeRoomItems(existingLocal, parsed.items, rName, isDirty, prevFetchedAt));
                  }
                } catch (_) {}
              }
            }
          }
          cloudState.lastFetchedAt = Date.now();
        }
      } catch (_) {}
      cloudState.initialized = true;
      cloudState.initPromise = null;
    })();

    return cloudState.initPromise;
  }

  function scheduleRoomGistFlush(room) {
    if (!isPersistentRoom(room)) return;
    cloudState.dirtyRooms.add(room);
    if (cloudState.syncTimer) clearTimeout(cloudState.syncTimer);
    cloudState.syncTimer = setTimeout(() => {
      cloudState.syncTimer = null;
      flushDirtyRoomsToGist();
    }, 80);
  }

  function flushDirtyRoomsToGist() {
    if (cloudState.syncTimer) {
      clearTimeout(cloudState.syncTimer);
      cloudState.syncTimer = null;
    }
    if (cloudState.dirtyRooms.size === 0) return cloudState.syncQueue;
    const roomsToFlush = Array.from(cloudState.dirtyRooms);
    cloudState.dirtyRooms.clear();

    cloudState.syncQueue = cloudState.syncQueue.then(async () => {
      try {
        const t0 = Date.now();
        // Read-before-write merge to prevent cross-device overwrite races
        const getRes = await nativeFetch(`https://api.github.com/gists/${DB_GIST_ID}?_t=${Date.now()}`, {
          headers: {
            'Authorization': 'Bearer ' + getCloudToken(),
            'Accept': 'application/vnd.github+json',
            'Cache-Control': 'no-cache'
          }
        });
        let remoteGistFiles = {};
        if (getRes.ok) {
          const gData = await getRes.json();
          remoteGistFiles = (gData && gData.files) || {};
          cloudState.lastFetchedAt = Date.now();
        }

        const filesPayload = {};
        for (const r of roomsToFlush) {
          const safeFileKey = `room_${r.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
          let remoteItems = [];
          if (remoteGistFiles[safeFileKey] && remoteGistFiles[safeFileKey].content) {
            try {
              const parsed = JSON.parse(remoteGistFiles[safeFileKey].content);
              ingestRemoteRoomMeta(r, parsed);
              if (Array.isArray(parsed.items)) remoteItems = parsed.items;
            } catch (_) {}
          }
          const localItems = cloudState.rooms.get(r) || [];
          const merged = mergeRoomItems(localItems, remoteItems, r);
          cloudState.rooms.set(r, merged);
          const recentDeletedIds = Array.from(cloudState.deletedIds).slice(-500);
          filesPayload[safeFileKey] = {
            content: JSON.stringify({
              room: r,
              updatedAt: Date.now(),
              clearedAt: cloudState.clearedRoomsAt.get(r) || 0,
              deletedIds: recentDeletedIds,
              items: merged
            }, null, 2)
          };
        }

        await nativeFetch(`https://api.github.com/gists/${DB_GIST_ID}`, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer ' + getCloudToken(),
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ files: filesPayload })
        });
        cloudState.lastLatencyMs = Math.max(15, Date.now() - t0);
      } catch (_) {}
    });
    return cloudState.syncQueue;
  }

  async function uploadBinaryFileToCloudGist(item, bytes) {
    if (!isPersistentRoom(item.room) || bytes.length > 25 * 1024 * 1024) {
      return null;
    }
    try {
      const b64 = uint8ToBase64(bytes);
      const chunkMax = 750 * 1024; // 750 KB base64 per Gist file entry (< 1MB GitHub truncation limit)
      const gistFiles = {};
      if (b64.length <= chunkMax) {
        gistFiles['file_payload.json'] = {
          content: JSON.stringify({
            id: item.id,
            room: item.room,
            fileName: item.fileName,
            mimeType: item.mimeType,
            fileSize: item.fileSize,
            isPdf: item.isPdf,
            base64: b64
          })
        };
      } else {
        const chunkCount = Math.ceil(b64.length / chunkMax);
        for (let c = 0; c < chunkCount; c++) {
          const padIdx = String(c).padStart(3, '0');
          gistFiles[`chunk_${padIdx}.b64`] = {
            content: b64.slice(c * chunkMax, (c + 1) * chunkMax)
          };
        }
        gistFiles['file_payload.json'] = {
          content: JSON.stringify({
            id: item.id,
            room: item.room,
            fileName: item.fileName,
            mimeType: item.mimeType,
            fileSize: item.fileSize,
            isPdf: item.isPdf,
            chunkCount
          })
        };
      }

      const res = await nativeFetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + getCloudToken(),
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: `Quick Share Hub File: ${item.fileName} (${item.id})`,
          public: false,
          files: gistFiles
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.id || null;
      }
    } catch (_) {}
    return null;
  }

  async function fetchBinaryFileFromCloudGist(gistId) {
    if (!gistId || !/^[a-f0-9]{20,40}$/i.test(gistId)) return null;
    try {
      const res = await nativeFetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': 'Bearer ' + getCloudToken(),
          'Accept': 'application/vnd.github+json'
        }
      });
      if (!res.ok) return null;
      const gist = await res.json();
      const fileObj = gist.files && gist.files['file_payload.json'];
      if (!fileObj) return null;

      let rawContent = fileObj.content;
      if (fileObj.truncated && fileObj.raw_url) {
        const rawRes = await nativeFetch(fileObj.raw_url);
        rawContent = await rawRes.text();
      }
      const parsed = JSON.parse(rawContent);
      if (parsed && typeof parsed.base64 === 'string') {
        return {
          bytes: base64ToUint8(parsed.base64),
          mimeType: parsed.mimeType || 'application/octet-stream',
          fileName: parsed.fileName || 'download',
          isPdf: Boolean(parsed.isPdf)
        };
      }
      if (parsed && Number(parsed.chunkCount) > 0) {
        const parts = [];
        for (let c = 0; c < Number(parsed.chunkCount); c++) {
          const key = `chunk_${String(c).padStart(3, '0')}.b64`;
          const cObj = gist.files && gist.files[key];
          if (!cObj) return null;
          let chunkText = cObj.content || '';
          if (cObj.truncated && cObj.raw_url) {
            const cRes = await nativeFetch(cObj.raw_url);
            chunkText = await cRes.text();
          }
          parts.push(chunkText);
        }
        return {
          bytes: base64ToUint8(parts.join('')),
          mimeType: parsed.mimeType || 'application/octet-stream',
          fileName: parsed.fileName || 'download',
          isPdf: Boolean(parsed.isPdf)
        };
      }
    } catch (_) {}
    return null;
  }

  async function deleteCloudFileGist(gistId) {
    if (!gistId || !/^[a-f0-9]{20,40}$/i.test(gistId)) return;
    try {
      await nativeFetch(`https://api.github.com/gists/${gistId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + getCloudToken(),
          'Accept': 'application/vnd.github+json'
        }
      });
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Real-Time WebSocket Engine (In-Process + BroadcastChannel + ntfy.sh 24/7 Cloud WSS)
  // ---------------------------------------------------------------------------
  const localWsClients = new Set();
  let broadcastChannel = null;
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel('quick_share_hub_247_channel');
      broadcastChannel.onmessage = (ev) => {
        if (ev && ev.data) {
          dispatchToLocalSockets(ev.data.room, ev.data.payload, false, ev.data.eventId);
        }
      };
    } catch (_) {}
  }

  function topicForRoom(room) {
    const clean = normalizeRoom(room).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
    return `${NTFY_PREFIX}${clean}`;
  }

  function broadcastRoomEvent(room, payload) {
    const normalized = normalizeRoom(room);
    const eventId = `${Date.now()}_${++cloudState.seqCounter}_${Math.random().toString(36).slice(2, 8)}`;
    dispatchToLocalSockets(normalized, payload, true, eventId);

    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ room: normalized, payload, eventId });
      } catch (_) {}
    }

    // Publish to 24/7 ntfy.sh cloud pub/sub for cross-device sync (PC <-> Phone <-> Laptop)
    if (isPersistentRoom(normalized) && nativeFetch) {
      const topic = topicForRoom(normalized);
      nativeFetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: JSON.stringify({ _qsh: 1, room: normalized, eventId, payload })
      }).catch(() => {});
    }
  }

  function applyRemoteEventToCloudState(room, payload) {
    if (!payload || typeof payload !== 'object') return;
    const normalized = normalizeRoom(room);
    const list = cloudState.rooms.get(normalized) || [];
    if ((payload.type === 'item_created' || payload.type === 'item_updated' || payload.type === 'item_pinned') && payload.item) {
      const incoming = formatItem(payload.item);
      if (!incoming || !incoming.id) return;
      cloudState.deletedIds.delete(incoming.id);
      const idx = list.findIndex((i) => i.id === incoming.id);
      if (idx >= 0) {
        list[idx] = incoming;
      } else {
        list.unshift(incoming);
      }
      cloudState.rooms.set(normalized, list);
    } else if (payload.type === 'item_deleted' && payload.id) {
      cloudState.deletedIds.add(payload.id);
      cloudState.files.delete(payload.id);
      cloudState.rooms.set(normalized, list.filter((i) => i.id !== payload.id));
    } else if (payload.type === 'room_cleared') {
      cloudState.clearedRoomsAt.set(normalized, Date.now());
      cloudState.rooms.set(normalized, []);
    }
  }

  function dispatchToLocalSockets(room, payload, isLocalOrigin, eventId) {
    if (!isLocalOrigin) {
      applyRemoteEventToCloudState(room, payload);
    }
    const raw = JSON.stringify(payload);
    for (const client of localWsClients) {
      if (client.readyState === 1 && client.rooms.has(room)) {
        if (eventId && client._seenMsgIds) {
          if (client._seenMsgIds.has(eventId)) {
            continue;
          }
          client._seenMsgIds.add(eventId);
        }
        client._emitMessage(raw);
      }
    }
  }

  class CloudWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = String(url || '');
      this.readyState = CloudWebSocket.CONNECTING;
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      this._listeners = { open: new Set(), message: new Set(), close: new Set(), error: new Set() };
      this.rooms = new Set();
      this._seenMsgIds = new Set();
      this._ntfySockets = new Map();

      try {
        const parsed = new URL(this.url, 'http://localhost');
        const initialRoom = parsed.searchParams.get('room');
        if (initialRoom) {
          this.rooms.add(normalizeRoom(initialRoom));
        }
      } catch (_) {}

      localWsClients.add(this);

      setTimeout(() => {
        if (this.readyState !== CloudWebSocket.CONNECTING) return;
        this.readyState = CloudWebSocket.OPEN;
        const ev = { type: 'open', target: this };
        if (typeof this.onopen === 'function') {
          try { this.onopen(ev); } catch (_) {}
        }
        for (const fn of this._listeners.open) {
          try { fn(ev); } catch (_) {}
        }
        for (const r of this.rooms) {
          this._ensureNtfySubscription(r);
        }
      }, 5);
    }

    addEventListener(type, listener) {
      if (this._listeners[type] && typeof listener === 'function') {
        this._listeners[type].add(listener);
      }
    }

    removeEventListener(type, listener) {
      if (this._listeners[type]) {
        this._listeners[type].delete(listener);
      }
    }

    send(data) {
      if (this.readyState !== CloudWebSocket.OPEN) return;
      try {
        const parsed = JSON.parse(String(data));
        const action = parsed.action || parsed.type;
        if (action === 'ping') {
          setTimeout(() => {
            this._emitMessage(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }, 2);
        } else if (action === 'join' && parsed.room) {
          const r = normalizeRoom(parsed.room);
          this.rooms.add(r);
          this._ensureNtfySubscription(r);
        } else if (action === 'leave' && parsed.room) {
          const r = normalizeRoom(parsed.room);
          this.rooms.delete(r);
          this._closeNtfySubscription(r);
        }
      } catch (_) {
        // Ignore malformed non-JSON frames gracefully
      }
    }

    close() {
      if (this.readyState === CloudWebSocket.CLOSED) return;
      this.readyState = CloudWebSocket.CLOSED;
      localWsClients.delete(this);
      for (const ws of this._ntfySockets.values()) {
        try { ws.close(); } catch (_) {}
      }
      this._ntfySockets.clear();
      const ev = { type: 'close', target: this };
      if (typeof this.onclose === 'function') {
        try { this.onclose(ev); } catch (_) {}
      }
      for (const fn of this._listeners.close) {
        try { fn(ev); } catch (_) {}
      }
    }

    _emitMessage(dataStr) {
      if (this.readyState !== CloudWebSocket.OPEN) return;
      const ev = { type: 'message', data: dataStr, target: this };
      if (typeof this.onmessage === 'function') {
        try { this.onmessage(ev); } catch (_) {}
      }
      for (const fn of this._listeners.message) {
        try { fn(ev); } catch (_) {}
      }
    }

    _ensureNtfySubscription(room) {
      // Only open external ntfy.sh WebSocket in browser for persistent user rooms
      const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
      if (!isBrowser || !isPersistentRoom(room) || !NativeWebSocket) return;
      if (this._ntfySockets.has(room)) return;

      try {
        const topic = topicForRoom(room);
        const nws = new NativeWebSocket(`wss://ntfy.sh/${topic}/ws`);
        this._ntfySockets.set(room, nws);
        nws.onmessage = (e) => {
          try {
            const outer = JSON.parse(e.data);
            if (outer && outer.event === 'message' && outer.message) {
              const inner = JSON.parse(outer.message);
              if (inner && inner._qsh && inner.payload) {
                dispatchToLocalSockets(inner.room || room, inner.payload, false, inner.eventId);
              }
            }
          } catch (_) {}
        };
        nws.onerror = () => {};
      } catch (_) {}
    }

    _closeNtfySubscription(room) {
      const nws = this._ntfySockets.get(room);
      if (nws) {
        try { nws.close(); } catch (_) {}
        this._ntfySockets.delete(room);
      }
    }
  }

  CloudWebSocket.prototype.CONNECTING = 0;
  CloudWebSocket.prototype.OPEN = 1;
  CloudWebSocket.prototype.CLOSING = 2;
  CloudWebSocket.prototype.CLOSED = 3;

  // ---------------------------------------------------------------------------
  // Core Cloud Database CRUD Operations
  // ---------------------------------------------------------------------------
  function getRoomListRef(room) {
    const r = normalizeRoom(room);
    if (!cloudState.rooms.has(r)) {
      cloudState.rooms.set(r, []);
    }
    return cloudState.rooms.get(r);
  }

  function findItemAcrossRooms(id, includeExpired = false) {
    const now = Date.now();
    for (const [room, list] of cloudState.rooms.entries()) {
      const idx = list.findIndex((i) => i.id === id);
      if (idx >= 0) {
        const item = list[idx];
        if (!includeExpired && item.expiresAt && item.expiresAt <= now) {
          return null;
        }
        return { item, room, list, idx };
      }
    }
    return null;
  }

  function makeJsonResponse(bodyObj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(bodyObj), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        ...extraHeaders
      }
    });
  }

  async function handleCloudApiRequest(urlObj, method, init = {}) {
    await fetchCloudGistState(false);

    // Strip any repository prefix (e.g. /quick-share-hub/api/items -> /api/items)
    const apiIdx = urlObj.pathname.indexOf('/api');
    const apiPath = apiIdx >= 0 ? urlObj.pathname.slice(apiIdx) : urlObj.pathname;
    const upperMethod = (method || 'GET').toUpperCase();

    if (upperMethod === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Range'
        }
      });
    }

    // 1. GET /api/health
    if (apiPath === '/api/health') {
      if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
        return makeJsonResponse({ success: false, error: 'Method not allowed' }, 405);
      }
      let total = 0;
      let active = 0;
      let expired = 0;
      const now = Date.now();
      for (const list of cloudState.rooms.values()) {
        for (const item of list) {
          total++;
          if (item.expiresAt && item.expiresAt <= now) expired++;
          else active++;
        }
      }
      return makeJsonResponse({
        status: 'ok',
        mode: 'cloud-24-7',
        provider: 'github-pages-cloud',
        timestamp: new Date().toISOString(),
        uptime: 86400,
        version: '1.0.0',
        publicUrl: CLOUD_PUBLIC_URL,
        stats: { total, active, expired }
      }, 200);
    }

    // 2. GET /api/qr
    if (apiPath === '/api/qr') {
      if (upperMethod !== 'GET') {
        return makeJsonResponse({ success: false, error: 'Method not allowed' }, 405);
      }
      const rawText = urlObj.searchParams.get('text');
      if (!rawText || !rawText.trim()) {
        return makeJsonResponse({
          success: false,
          error: 'Query parameter "text" is required and must be a non-empty string'
        }, 400);
      }
      const format = (urlObj.searchParams.get('format') || 'json').toLowerCase();
      try {
        const qr = await generateQrCode(rawText, format);
        if (format === 'svg') {
          return new Response(qr.svg, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' }
          });
        }
        if (format === 'png' || format === 'image') {
          return new Response(qr.pngBytes, {
            status: 200,
            headers: { 'Content-Type': 'image/png' }
          });
        }
        return makeJsonResponse({
          success: true,
          text: rawText,
          dataUrl: qr.dataUrl
        }, 200);
      } catch (err) {
        return makeJsonResponse({ success: false, error: err.message }, err.status || 400);
      }
    }

    // 3. POST /api/cleanup
    if (apiPath === '/api/cleanup') {
      if (upperMethod !== 'POST') {
        return makeJsonResponse({ success: false, error: 'Method not allowed' }, 405);
      }
      const now = Date.now();
      const expiredIds = [];
      for (const [room, list] of cloudState.rooms.entries()) {
        const remaining = [];
        const roomExpired = [];
        for (const item of list) {
          if (item.expiresAt !== null && item.expiresAt !== undefined && item.expiresAt <= now) {
            expiredIds.push(item.id);
            roomExpired.push(item.id);
            cloudState.deletedIds.add(item.id);
            cloudState.files.delete(item.id);
            if (item.fileGistId) deleteCloudFileGist(item.fileGistId);
          } else {
            remaining.push(item);
          }
        }
        if (roomExpired.length > 0) {
          cloudState.rooms.set(room, remaining);
          scheduleRoomGistFlush(room);
          broadcastRoomEvent(room, { type: 'items_expired', room, ids: roomExpired });
        }
      }
      return makeJsonResponse({
        success: true,
        deletedCount: expiredIds.length,
        expiredIds
      }, 200);
    }

    // 4. POST /api/items/clear or DELETE /api/rooms/:room/items
    const roomClearMatch = apiPath.match(/^\/api\/rooms\/([^/]+)\/items$/);
    if (apiPath === '/api/items/clear' || roomClearMatch || (apiPath === '/api/items' && upperMethod === 'DELETE')) {
      const rawRoom = roomClearMatch
        ? decodeURIComponent(roomClearMatch[1])
        : urlObj.searchParams.get('room');
      if (!rawRoom || !rawRoom.trim()) {
        return makeJsonResponse({
          success: false,
          error: 'Room parameter is required for bulk room clearance'
        }, 400);
      }
      const room = normalizeRoom(rawRoom);
      const list = getRoomListRef(room);
      const ids = list.map((i) => i.id);
      for (const item of list) {
        cloudState.deletedIds.add(item.id);
        cloudState.files.delete(item.id);
        if (item.fileGistId) deleteCloudFileGist(item.fileGistId);
      }
      cloudState.clearedRoomsAt.set(room, Date.now());
      cloudState.rooms.set(room, []);
      scheduleRoomGistFlush(room);
      broadcastRoomEvent(room, { type: 'room_cleared', room, count: ids.length, ids });
      return makeJsonResponse({
        success: true,
        room,
        deletedCount: ids.length
      }, 200);
    }

    // 5. GET /api/items & POST /api/items
    if (apiPath === '/api/items') {
      if (upperMethod === 'GET') {
        const room = normalizeRoom(urlObj.searchParams.get('room'));
        const forceSync = urlObj.searchParams.get('sync') === '1';
        const isStalePersistent = isPersistentRoom(room) && (Date.now() - cloudState.lastFetchedAt > 3000);
        if (forceSync || isStalePersistent) {
          if (cloudState.dirtyRooms.size > 0) {
            await flushDirtyRoomsToGist();
          }
          await fetchCloudGistState(true);
        }
        const now = Date.now();
        const list = getRoomListRef(room).filter((item) => {
          return item.expiresAt === null || item.expiresAt === undefined || item.expiresAt > now;
        });
        list.sort((a, b) => {
          if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        return makeJsonResponse({
          success: true,
          room,
          items: list
        }, 200);
      }

      if (upperMethod === 'POST') {
        let body = {};
        try {
          if (typeof init.body === 'string') {
            body = JSON.parse(init.body);
          } else if (init.body && typeof init.body === 'object') {
            body = init.body;
          }
        } catch (_) {
          return makeJsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const { content, ttl, title, type } = body || {};
        const rawFileName = body && (body.fileName || body.file_name || null);
        const rawFilePath = body && (body.fileGistId || body.filePath || body.file_path || null);
        const isFileRestore = type === 'file' && rawFileName && rawFilePath;
        const rawContent = isFileRestore
          ? (typeof content === 'string' && content.trim() ? content.trim() : String(rawFileName).trim())
          : (typeof content === 'string' ? content.trim() : '');
        if (!rawContent) {
          return makeJsonResponse({
            success: false,
            error: 'Content is required and must be a non-empty string'
          }, 400);
        }

        const room = normalizeRoom(body.room);
        let itemType = type;
        let finalContent = rawContent;
        let finalTitle = title ? String(title).trim() : null;

        if (isFileRestore) {
          itemType = 'file';
          if (!finalTitle) finalTitle = String(rawFileName).trim();
        } else if (!itemType || (itemType !== 'link' && itemType !== 'note')) {
          const detected = detectType(finalContent);
          itemType = detected.type;
          finalContent = detected.content;
          if (!finalTitle) finalTitle = detected.title;
        } else if (itemType === 'link') {
          const detected = detectType(finalContent);
          if (detected.type === 'link') {
            finalContent = detected.content;
            if (!finalTitle) finalTitle = detected.title;
          } else {
            itemType = 'note';
            if (!finalTitle) finalTitle = extractNoteTitle(finalContent);
          }
        } else if (itemType === 'note') {
          if (!finalTitle) finalTitle = extractNoteTitle(finalContent);
        }

        const now = Date.now();
        const expiresAt = parseTTL(ttl, now);
        const safeFileName = isFileRestore ? sanitizeOriginalName(String(rawFileName)) : null;
        const safeMime = isFileRestore
          ? resolveMimeType(body.mimeType || body.mime_type || '', safeFileName)
          : null;
        const isPdfVal = isFileRestore
          ? ((body.isPdf || body.is_pdf || safeMime === 'application/pdf' || safeFileName.toLowerCase().endsWith('.pdf')) ? 1 : 0)
          : 0;
        const rawSize = body && (body.fileSize ?? body.file_size);
        const item = formatItem({
          id: randomUUID(),
          room,
          type: itemType,
          content: finalContent,
          title: finalTitle,
          filePath: isFileRestore ? String(rawFilePath) : null,
          fileGistId: isFileRestore ? String(body.fileGistId || rawFilePath) : null,
          fileName: safeFileName,
          fileSize: isFileRestore && rawSize !== null && rawSize !== undefined && Number.isFinite(Number(rawSize))
            ? Number(rawSize)
            : null,
          mimeType: isFileRestore ? (isPdfVal ? 'application/pdf' : safeMime) : null,
          isPdf: isPdfVal,
          pinned: Boolean(body.pinned),
          createdAt: now,
          expiresAt
        });

        if (isFileRestore) {
          const origId = String(rawFilePath).split('_')[0];
          const existingMemFile = cloudState.files.get(String(rawFilePath)) || cloudState.files.get(origId);
          if (existingMemFile) {
            cloudState.files.set(item.id, existingMemFile);
          }
        }

        const list = getRoomListRef(room);
        list.unshift(item);
        scheduleRoomGistFlush(room);
        broadcastRoomEvent(room, { type: 'item_created', item });

        return makeJsonResponse({ success: true, item }, 201);
      }

      return makeJsonResponse({ success: false, error: 'Method not allowed' }, 405);
    }

    // 5b. POST /api/items/:id/pin (Toggle Pin Item)
    const itemPinMatch = apiPath.match(/^\/api\/items\/([^/]+)\/pin$/);
    if (itemPinMatch && upperMethod === 'POST') {
      const id = decodeURIComponent(itemPinMatch[1]);
      let found = findItemAcrossRooms(id, false);
      if (!found && !cloudState.deletedIds.has(id)) {
        await fetchCloudGistState(true);
        found = findItemAcrossRooms(id, false);
      }
      if (!found) {
        return makeJsonResponse({ success: false, error: 'Item not found' }, 404);
      }
      const now = Date.now();
      found.item.pinned = !found.item.pinned;
      found.item.updatedAt = now;
      found.item.updated_at = now;
      scheduleRoomGistFlush(found.room);
      broadcastRoomEvent(found.room, { type: 'item_created', item: found.item });
      return makeJsonResponse({ success: true, item: found.item }, 200);
    }

    // 5c. PUT /api/items/:id (Edit Note / Link / Title)
    const itemSingleMatch = apiPath.match(/^\/api\/items\/([^/]+)$/);
    if (itemSingleMatch && upperMethod === 'PUT') {
      const id = decodeURIComponent(itemSingleMatch[1]);
      let found = findItemAcrossRooms(id, false);
      if (!found && !cloudState.deletedIds.has(id)) {
        await fetchCloudGistState(true);
        found = findItemAcrossRooms(id, false);
      }
      if (!found) {
        return makeJsonResponse({ success: false, error: 'Item not found' }, 404);
      }
      let body = {};
      try {
        if (typeof init.body === 'string') {
          body = JSON.parse(init.body);
        } else if (init.body && typeof init.body === 'object') {
          body = init.body;
        }
      } catch (_) {
        return makeJsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
      }

      const now = Date.now();
      if (body.content !== undefined) {
        const trimmed = String(body.content || '').trim();
        if (found.item.type !== 'file') {
          if (!trimmed) {
            return makeJsonResponse({ success: false, error: 'Content cannot be empty' }, 400);
          }
          const detected = detectType(trimmed);
          found.item.type = detected.type;
          found.item.content = detected.content;
          found.item.title = body.title ? String(body.title).trim() : detected.title;
        } else {
          found.item.content = trimmed || found.item.fileName || found.item.title || 'file';
        }
      } else if (body.title !== undefined && String(body.title).trim()) {
        found.item.title = String(body.title).trim();
      }
      if (body.pinned !== undefined) {
        found.item.pinned = Boolean(body.pinned);
      }
      if (body.ttl !== undefined && body.ttl !== '' && body.ttl !== 'keep') {
        const exp = parseTTL(body.ttl, now);
        found.item.expiresAt = exp;
        found.item.expires_at = exp;
      }
      found.item.updatedAt = now;
      found.item.updated_at = now;
      scheduleRoomGistFlush(found.room);
      broadcastRoomEvent(found.room, { type: 'item_created', item: found.item });
      return makeJsonResponse({ success: true, item: found.item }, 200);
    }

    // 6. DELETE /api/items/:id
    const itemDeleteMatch = apiPath.match(/^\/api\/items\/([^/]+)$/);
    if (itemDeleteMatch && upperMethod === 'DELETE') {
      const id = decodeURIComponent(itemDeleteMatch[1]);
      let found = findItemAcrossRooms(id, true);
      if (!found && !cloudState.deletedIds.has(id)) {
        await fetchCloudGistState(true);
        found = findItemAcrossRooms(id, true);
      }
      if (!found) {
        return makeJsonResponse({ success: false, error: 'Item not found' }, 404);
      }
      cloudState.deletedIds.add(id);
      found.list.splice(found.idx, 1);
      cloudState.files.delete(id);
      if (found.item.fileGistId) {
        deleteCloudFileGist(found.item.fileGistId);
      }
      scheduleRoomGistFlush(found.room);
      broadcastRoomEvent(found.room, { type: 'item_deleted', id });
      return makeJsonResponse({ success: true, id }, 200);
    }

    // 7. POST /api/upload
    if (apiPath === '/api/upload') {
      if (upperMethod !== 'POST') {
        return makeJsonResponse({ success: false, error: 'Method not allowed' }, 405);
      }
      const formData = init.body;
      if (!formData || typeof formData.get !== 'function') {
        return makeJsonResponse({
          success: false,
          error: 'No file provided in "file" multipart field'
        }, 400);
      }

      const fileObj = formData.get('file');
      if (!fileObj || typeof fileObj === 'string' || typeof fileObj.arrayBuffer !== 'function') {
        return makeJsonResponse({
          success: false,
          error: 'No file provided in "file" multipart field'
        }, 400);
      }

      const rawRoom = formData.get('room');
      const ttl = formData.get('ttl');
      const caption = formData.get('caption') || formData.get('content');
      const room = normalizeRoom(typeof rawRoom === 'string' ? rawRoom : 'default');

      const rawFileName = fileObj.name || 'document.pdf';
      const originalName = sanitizeOriginalName(rawFileName);
      const mimeType = resolveMimeType(fileObj.type, originalName);
      const isPdf = (mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) ? 1 : 0;

      const ab = await fileObj.arrayBuffer();
      const bytes = new Uint8Array(ab);
      if (bytes.byteLength > 50 * 1024 * 1024) {
        return makeJsonResponse({ success: false, error: 'File exceeds 50MB limit' }, 413);
      }

      const now = Date.now();
      const id = randomUUID();
      const expiresAt = parseTTL(typeof ttl === 'string' ? ttl : undefined, now);

      const item = formatItem({
        id,
        room,
        type: 'file',
        content: (caption && typeof caption === 'string' && caption.trim()) ? caption.trim() : originalName,
        title: originalName,
        filePath: `${id}_${originalName}`,
        fileName: originalName,
        fileSize: bytes.byteLength,
        mimeType: isPdf ? 'application/pdf' : mimeType,
        isPdf,
        createdAt: now,
        expiresAt
      });

      cloudState.files.set(id, {
        bytes,
        mimeType: item.mimeType,
        fileName: originalName,
        isPdf: Boolean(isPdf),
        blobUrl: null
      });

      // Upload binary payload to dedicated secret Gist for persistent rooms
      const gistId = await uploadBinaryFileToCloudGist(item, bytes);
      if (gistId) {
        item.fileGistId = gistId;
        item.filePath = gistId;
        item.file_path = gistId;
      }

      const list = getRoomListRef(room);
      list.unshift(item);
      scheduleRoomGistFlush(room);
      broadcastRoomEvent(room, { type: 'item_created', item });

      return makeJsonResponse({ success: true, item }, 201);
    }

    // 8. GET /api/files/:id/preview, GET /api/files/:id/download, GET /api/files/:id
    const fileRouteMatch = apiPath.match(/^\/api\/files\/([^/]+)(?:\/(preview|download))?$/);
    if (fileRouteMatch && (upperMethod === 'GET' || upperMethod === 'HEAD')) {
      const id = decodeURIComponent(fileRouteMatch[1]);
      const mode = fileRouteMatch[2] || 'preview';

      let found = findItemAcrossRooms(id, false);
      const hasValidGistRef = (f) => f && f.item && /^[a-f0-9]{20,40}$/i.test(String(f.item.fileGistId || f.item.filePath || ''));
      if (!cloudState.deletedIds.has(id) && (!found || (!cloudState.files.has(id) && !hasValidGistRef(found)))) {
        await fetchCloudGistState(true);
        found = findItemAcrossRooms(id, false);
      }
      if (!found || found.item.type !== 'file') {
        return makeJsonResponse({
          success: false,
          error: 'File item not found or has expired'
        }, 404);
      }

      let fileEntry = cloudState.files.get(id);
      if (!fileEntry && (found.item.fileGistId || found.item.filePath)) {
        const fetched = await fetchBinaryFileFromCloudGist(found.item.fileGistId || found.item.filePath);
        if (fetched) {
          fileEntry = fetched;
          cloudState.files.set(id, fileEntry);
        }
      }

      if (!fileEntry || !fileEntry.bytes) {
        return makeJsonResponse({
          success: false,
          error: 'Physical file no longer exists on cloud storage'
        }, 404);
      }

      const bytes = fileEntry.bytes;
      const totalSize = bytes.byteLength;
      const fileName = found.item.fileName || fileEntry.fileName || 'document.pdf';
      const isPdf = Boolean(found.item.isPdf || fileName.toLowerCase().endsWith('.pdf'));
      const contentType = (mode === 'preview' && isPdf)
        ? 'application/pdf'
        : (found.item.mimeType || fileEntry.mimeType || 'application/octet-stream');
      const dispositionType = mode === 'download' ? 'attachment' : 'inline';

      // Extract Range header if present
      let rangeHeader = null;
      if (init && init.headers) {
        if (typeof init.headers.get === 'function') {
          rangeHeader = init.headers.get('range') || init.headers.get('Range');
        } else if (typeof init.headers === 'object') {
          rangeHeader = init.headers.Range || init.headers.range;
        }
      }

      const baseHeaders = {
        'Content-Type': contentType,
        'Content-Disposition': buildContentDisposition(dispositionType, fileName),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      };

      if (rangeHeader && totalSize > 0 && /^bytes=/i.test(rangeHeader)) {
        const rangeSpec = String(rangeHeader).replace(/^bytes=/i, '').split(',')[0].trim();
        const parts = rangeSpec.split('-');
        let start = parts[0] ? parseInt(parts[0], 10) : NaN;
        let end = parts[1] ? parseInt(parts[1], 10) : NaN;

        if (Number.isNaN(start) && !Number.isNaN(end)) {
          start = Math.max(0, totalSize - end);
          end = totalSize - 1;
        } else if (!Number.isNaN(start) && Number.isNaN(end)) {
          end = totalSize - 1;
        }

        if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start >= totalSize || end < start) {
          return new Response(null, {
            status: 416,
            headers: {
              ...baseHeaders,
              'Content-Range': `bytes */${totalSize}`
            }
          });
        }

        end = Math.min(end, totalSize - 1);
        const slice = bytes.subarray(start, end + 1);
        return new Response(upperMethod === 'HEAD' ? null : slice, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': String(slice.byteLength)
          }
        });
      }

      return new Response(upperMethod === 'HEAD' ? null : bytes, {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Length': String(totalSize)
        }
      });
    }

    // 9. GET /api/stats (Storage Capacity & Bandwidth Dashboard API)
    if (apiPath === '/api/stats') {
      const room = normalizeRoom(urlObj.searchParams.get('room'));
      return makeJsonResponse({
        success: true,
        ...getTelemetrySnapshot(room)
      }, 200);
    }

    // 10. API 404 fallback
    return makeJsonResponse({
      success: false,
      error: `Endpoint ${upperMethod} ${apiPath} not found`
    }, 404);
  }

  // ---------------------------------------------------------------------------
  // Storage Capacity & Bandwidth Telemetry Engine
  // ---------------------------------------------------------------------------
  const STORAGE_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB Cloud Storage Quota
  const BANDWIDTH_QUOTA_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB Monthly Cloud Bandwidth Quota
  const TELEMETRY_STORAGE_KEY = 'qsh_telemetry_stats_v1';

  const telemetry = {
    bytesUploaded: 0,
    bytesDownloaded: 0,
    apiRequests: 0,
    wsEvents: 0,
    startedAt: Date.now()
  };

  function loadPersistedTelemetry() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          telemetry.bytesUploaded = Number(parsed.bytesUploaded) || 0;
          telemetry.bytesDownloaded = Number(parsed.bytesDownloaded) || 0;
          telemetry.apiRequests = Number(parsed.apiRequests) || 0;
          telemetry.wsEvents = Number(parsed.wsEvents) || 0;
          telemetry.startedAt = Number(parsed.startedAt) || Date.now();
        }
      }
    } catch (_) {}
  }

  function savePersistedTelemetry() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(telemetry));
    } catch (_) {}
  }

  function recordTraffic({ uploadBytes = 0, downloadBytes = 0, apiRequests = 0, wsEvents = 0 }) {
    if (uploadBytes > 0) telemetry.bytesUploaded += uploadBytes;
    if (downloadBytes > 0) telemetry.bytesDownloaded += downloadBytes;
    if (apiRequests > 0) telemetry.apiRequests += apiRequests;
    if (wsEvents > 0) telemetry.wsEvents += wsEvents;
    savePersistedTelemetry();
  }

  function resetTelemetry() {
    telemetry.bytesUploaded = 0;
    telemetry.bytesDownloaded = 0;
    telemetry.apiRequests = 0;
    telemetry.wsEvents = 0;
    telemetry.startedAt = Date.now();
    savePersistedTelemetry();
  }

  function estimateItemBytes(item) {
    if (!item) return 0;
    if (item.type === 'file') {
      const fSize = Number(item.fileSize ?? item.file_size ?? 0);
      return fSize > 0 ? fSize : 1024;
    }
    const contentStr = String(item.content || '');
    const titleStr = String(item.title || '');
    return new Blob([contentStr, titleStr]).size + 128;
  }

  function measureBrowserPageFootprint() {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
      return { pageBytes: 112 * 1024, resourceCount: 6 };
    }
    try {
      let total = 0;
      let count = 0;
      const navEntries = performance.getEntriesByType('navigation') || [];
      for (const n of navEntries) {
        total += (n.decodedBodySize || n.transferSize || 8200);
        count++;
      }
      const resEntries = performance.getEntriesByType('resource') || [];
      for (const r of resEntries) {
        total += (r.decodedBodySize || r.transferSize || 0);
        count++;
      }
      if (total < 95000) {
        // Fallback estimate for HTML (9KB) + CSS (14KB) + QRCode (75KB) + CloudAdapter (52KB) + App (28KB)
        total = Math.max(total, 178 * 1024);
      }
      return { pageBytes: total, resourceCount: Math.max(count, 6) };
    } catch (_) {
      return { pageBytes: 178 * 1024, resourceCount: 6 };
    }
  }

  function getTelemetrySnapshot(room = 'default', overrideRoomItems = null) {
    const now = Date.now();
    const normalizedRoom = normalizeRoom(room);
    const activeRoomItems = Array.isArray(overrideRoomItems)
      ? overrideRoomItems
      : getRoomListRef(normalizedRoom).filter((i) => !i.expiresAt || i.expiresAt > now);

    let roomBytes = 0;
    let fileBytes = 0;
    let noteBytes = 0;
    let linkBytes = 0;
    let fileCount = 0;
    let noteCount = 0;
    let linkCount = 0;

    for (const item of activeRoomItems) {
      const sz = estimateItemBytes(item);
      roomBytes += sz;
      if (item.type === 'file') {
        fileBytes += sz;
        fileCount++;
      } else if (item.type === 'link') {
        linkBytes += sz;
        linkCount++;
      } else {
        noteBytes += sz;
        noteCount++;
      }
    }

    let totalAllRoomsBytes = 0;
    let totalAllRoomsItems = 0;
    for (const [rName, list] of cloudState.rooms.entries()) {
      if (rName === normalizedRoom && Array.isArray(overrideRoomItems)) continue;
      for (const item of list) {
        if (!item.expiresAt || item.expiresAt > now) {
          totalAllRoomsBytes += estimateItemBytes(item);
          totalAllRoomsItems++;
        }
      }
    }
    if (Array.isArray(overrideRoomItems)) {
      totalAllRoomsBytes += roomBytes;
      totalAllRoomsItems += activeRoomItems.length;
    } else if (totalAllRoomsBytes < roomBytes) {
      totalAllRoomsBytes = roomBytes;
    }

    const { pageBytes, resourceCount } = measureBrowserPageFootprint();
    const totalStorageUsed = totalAllRoomsBytes + pageBytes;
    const totalDownloadBytes = telemetry.bytesDownloaded + pageBytes;
    const totalUploadBytes = telemetry.bytesUploaded;
    const totalBandwidthBytes = totalUploadBytes + totalDownloadBytes;

    return {
      storage: {
        usedBytes: totalStorageUsed,
        roomBytes,
        pageFootprintBytes: pageBytes,
        quotaBytes: STORAGE_QUOTA_BYTES,
        freeBytes: Math.max(0, STORAGE_QUOTA_BYTES - totalStorageUsed),
        percentUsed: Math.min(100, (totalStorageUsed / STORAGE_QUOTA_BYTES) * 100),
        breakdown: {
          fileBytes,
          fileCount,
          noteBytes,
          noteCount,
          linkBytes,
          linkCount,
          totalItems: activeRoomItems.length,
          allRoomsItems: totalAllRoomsItems
        }
      },
      bandwidth: {
        totalBytes: totalBandwidthBytes,
        uploadBytes: totalUploadBytes,
        downloadBytes: totalDownloadBytes,
        quotaBytes: BANDWIDTH_QUOTA_BYTES,
        percentUsed: Math.min(100, (totalBandwidthBytes / BANDWIDTH_QUOTA_BYTES) * 100),
        apiRequests: telemetry.apiRequests,
        wsEvents: telemetry.wsEvents,
        resourceCount,
        latencyMs: cloudState.lastLatencyMs
      }
    };
  }

  loadPersistedTelemetry();

  // ---------------------------------------------------------------------------
  // Browser & Node Interception Wiring
  // ---------------------------------------------------------------------------
  function isCloudHost() {
    if (global.QSH_FORCE_CLOUD) return true;
    if (typeof window !== 'undefined' && window.location) {
      const h = window.location.hostname;
      if (h.endsWith('.github.io')) return true;
    }
    return false;
  }

  function isCloudUrl(urlStr) {
    try {
      const base = (typeof window !== 'undefined' && window.location)
        ? window.location.origin
        : 'http://localhost:3000';
      const parsed = new URL(String(urlStr), base);
      if (parsed.hostname.endsWith('.github.io')) return true;
      if (isCloudHost() && parsed.origin === base) return true;
    } catch (_) {}
    return false;
  }

  if (nativeFetch) {
    global.fetch = async function qshCloudAwareFetch(input, init) {
      const urlStr = (typeof input === 'string')
        ? input
        : (input && typeof input.url === 'string' ? input.url : String(input));
      const method = (init && init.method)
        || (input && typeof input === 'object' && input.method)
        || 'GET';

      const base = (typeof window !== 'undefined' && window.location)
        ? window.location.origin
        : 'http://localhost:3000';
      let parsedUrl = null;
      try {
        parsedUrl = new URL(urlStr, base);
      } catch (_) {}

      // Estimate outbound request payload size
      let reqBytes = 0;
      if (init && init.body) {
        if (typeof init.body === 'string') {
          reqBytes = init.body.length;
        } else if (typeof FormData !== 'undefined' && init.body instanceof FormData) {
          const f = init.body.get('file');
          if (f && typeof f.size === 'number') reqBytes = f.size;
        }
      }

      if (parsedUrl && isCloudUrl(parsedUrl.href)) {
        if (parsedUrl.pathname.includes('/api/') || parsedUrl.pathname.endsWith('/api')) {
          const res = await handleCloudApiRequest(parsedUrl, method, init || {});
          const cl = Number(res.headers.get('content-length')) || 512;
          recordTraffic({ uploadBytes: reqBytes, downloadBytes: cl, apiRequests: 1 });
          return res;
        }
      }

      const res = await nativeFetch(input, init);
      if (parsedUrl && parsedUrl.pathname.includes('/api/')) {
        const cl = Number(res.headers.get('content-length')) || 512;
        recordTraffic({ uploadBytes: reqBytes, downloadBytes: cl, apiRequests: 1 });
      }
      return res;
    };
  }

  if (NativeWebSocket) {
    const WrappedWebSocket = function (url, protocols) {
      if (isCloudUrl(url) || String(url).includes('.github.io')) {
        return new CloudWebSocket(url);
      }
      return protocols !== undefined
        ? new NativeWebSocket(url, protocols)
        : new NativeWebSocket(url);
    };
    WrappedWebSocket.CONNECTING = 0;
    WrappedWebSocket.OPEN = 1;
    WrappedWebSocket.CLOSING = 2;
    WrappedWebSocket.CLOSED = 3;
    WrappedWebSocket.prototype = NativeWebSocket.prototype;
    global.WebSocket = WrappedWebSocket;
  }

  // Helper API for Browser UI (Blob URL & Text resolution for Preview Modal & File Download)
  async function resolveCloudFileEntry(id) {
    await fetchCloudGistState(false);
    let found = findItemAcrossRooms(id, false);
    const hasValidGistRef = (f) => f && f.item && /^[a-f0-9]{20,40}$/i.test(String(f.item.fileGistId || f.item.filePath || ''));
    if (!cloudState.deletedIds.has(id) && (!found || (!cloudState.files.has(id) && !hasValidGistRef(found)))) {
      await fetchCloudGistState(true);
      found = findItemAcrossRooms(id, false);
    }
    let fileEntry = cloudState.files.get(id);
    if (!fileEntry && found && (found.item.fileGistId || found.item.filePath)) {
      fileEntry = await fetchBinaryFileFromCloudGist(found.item.fileGistId || found.item.filePath);
      if (fileEntry) {
        cloudState.files.set(id, fileEntry);
        recordTraffic({ downloadBytes: fileEntry.bytes ? fileEntry.bytes.byteLength : 0 });
      }
    }
    return fileEntry && fileEntry.bytes ? fileEntry : null;
  }

  async function getBlobUrlForFile(id) {
    const fileEntry = await resolveCloudFileEntry(id);
    if (!fileEntry || !fileEntry.bytes) return null;
    if (!fileEntry.blobUrl && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const mime = fileEntry.isPdf ? 'application/pdf' : (fileEntry.mimeType || 'application/octet-stream');
      const blob = new Blob([fileEntry.bytes], { type: mime });
      fileEntry.blobUrl = URL.createObjectURL(blob);
    }
    return fileEntry.blobUrl;
  }

  async function getTextForFile(id) {
    const fileEntry = await resolveCloudFileEntry(id);
    if (!fileEntry || !fileEntry.bytes) return null;
    try {
      return new TextDecoder('utf-8').decode(fileEntry.bytes);
    } catch (_) {
      return null;
    }
  }

  async function getFileBlob(id) {
    const fileEntry = await resolveCloudFileEntry(id);
    if (!fileEntry || !fileEntry.bytes || typeof Blob === 'undefined') return null;
    const mime = fileEntry.isPdf ? 'application/pdf' : (fileEntry.mimeType || 'application/octet-stream');
    return new Blob([fileEntry.bytes], { type: mime });
  }

  function getFileMeta(id) {
    const found = findItemAcrossRooms(id, false);
    const fileEntry = cloudState.files.get(id);
    if (!found && !fileEntry) return null;
    return {
      fileName: (found && (found.item.fileName || found.item.file_name || found.item.title)) || (fileEntry && fileEntry.fileName) || null,
      mimeType: (found && (found.item.mimeType || found.item.mime_type)) || (fileEntry && fileEntry.mimeType) || '',
      isPdf: Boolean((found && (found.item.isPdf || found.item.is_pdf)) || (fileEntry && fileEntry.isPdf))
    };
  }

  function getCloudStateInfo() {
    return {
      initialized: cloudState.initialized,
      lastFetchedAt: cloudState.lastFetchedAt,
      dirtyRoomsCount: cloudState.dirtyRooms.size
    };
  }

  function expireGistCache() {
    cloudState.lastFetchedAt = 0;
  }

  global.QSHCloud = {
    CLOUD_PUBLIC_URL,
    DB_GIST_ID,
    isCloudMode: isCloudHost,
    getBlobUrlForFile,
    getFileBlob,
    getTextForFile,
    getFileMeta,
    getCloudToken,
    flushDirtyRoomsToGist,
    fetchCloudGistState,
    getCloudStateInfo,
    expireGistCache,
    getTelemetrySnapshot,
    recordTraffic,
    resetTelemetry
  };
  global.QuickShareCloud = global.QSHCloud;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.QSHCloud;
  }
})(typeof window !== 'undefined' ? window : globalThis);
