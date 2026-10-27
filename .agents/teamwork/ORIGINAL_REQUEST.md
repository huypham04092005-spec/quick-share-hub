# Original User Request

## 2026-10-27T16:35:34Z

This is a single self-contained project; keep it small and focused.
Quick Share Hub is a serverless multi-device real-time clipboard and file sharing web application running on GitHub Pages with GitHub Gist database and ntfy.sh WebSocket. Enhance Quick Share Hub with 100% client-side Word (.docx) to PDF conversion, dedicated Word & Docs upload support, in-app Word document previewing, full-text in-document search, print formatting, and updated PWA service worker caching.

Working directory: C:\Users\huyph\.gemini\antigravity\scratch\quick-share-hub
Integrity mode: development

## Requirements

### R1. Word (.docx) & Office Docs Upload and Visual Identification
- Support drag-and-drop and manual file selection of Word documents (.docx, .doc) and office files in the Dropzone.
- Assign specialized visual badges (📘 Word DOCX / 📘 Word with Word blue styling #2563eb) to distinguish Word files from generic files.
- Add a dedicated 📘 Word & Docs filter tab to the filter toolbar with live item counter (countDocs).

### R2. 100% Client-Side In-App Word Document Previewer
- Integrate mammoth.browser.min.js to parse .docx files directly in the browser into semantic HTML (retaining headings, tables, bullet/numbered lists, and embedded images).
- Display the formatted Word document inside the modal viewer with an A4 paper design and smooth scrolling.
- Include action controls inside the preview modal: "⚡ Tải xuống PDF", "📋 Copy nội dung", "🖨️ In ấn / Xuất PDF", and "⬇ Tải file gốc (.docx)".

### R3. Instant 1-Click Word to PDF Converter
- Integrate html2pdf.bundle.min.js to convert parsed Word HTML into standard A4 PDF files entirely client-side without any third-party backend servers.
- Provide a ⚡ Chuyển sang PDF button on every Word item card, inside the preview modal, and as a quick tool in the upload panel header.
- The conversion must directly download the resulting .pdf file to the user's device with proper naming.

### R4. Search & Printing Optimizations
- Extract and index raw text from .docx files so that users can search by text content inside Word documents using the global search input (/ or Ctrl + K).
- Add print-specific CSS (@media print) so printing from the Word preview generates clean, margin-aligned A4 pages without web UI chrome.
- Update sw.js (increment cache version to v16) and include mammoth.browser.min.js and html2pdf.bundle.min.js in static assets for offline PWA support.

## Acceptance Criteria
- [ ] Dragging or selecting a .docx file uploads it and renders it with a blue 📘 Word DOCX badge.
- [ ] Clicking the 📘 Word & Docs filter tab displays only Word and office document items.
- [ ] Clicking "👁️ Xem Word" opens the modal and displays formatted document content (headings, tables, text) parsed by mammoth.
- [ ] Clicking "⚡ Chuyển sang PDF" converts the .docx document to a valid .pdf file and initiates a direct download.
- [ ] Searching a keyword contained within a Word document's text filters and reveals that Word item card.
- [ ] In-browser print dialog formats the Word document cleanly according to A4 print rules.
- [ ] Service worker cache installs without errors and includes all new client-side script assets.
