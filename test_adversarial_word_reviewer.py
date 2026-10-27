import os
import sys
import json
import zipfile
import http.server
import socketserver
import threading
import subprocess
import time

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

def create_valid_docx_with_image(path):
    # Minimal 1x1 transparent PNG
    png_bytes = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])

    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
            '  <Default Extension="xml" ContentType="application/xml"/>\n'
            '  <Default Extension="png" ContentType="image/png"/>\n'
            '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n'
            '</Types>'
        )
        z.writestr('[Content_Types].xml', content_types)
        
        rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n'
            '</Relationships>'
        )
        z.writestr('_rels/.rels', rels)

        doc_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '  <Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>\n'
            '</Relationships>'
        )
        z.writestr('word/_rels/document.xml.rels', doc_rels)
        z.writestr('word/media/image1.png', png_bytes)
        
        doc_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n'
            '  <w:body>\n'
            '    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Biochemistry Enzymology Report</w:t></w:r></w:p>\n'
            '    <w:p><w:r><w:t>Michaelis-Menten kinetics with embedded diagnostic gel electrophoresis image:</w:t></w:r></w:p>\n'
            '    <w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>\n'
            '    <w:tbl>\n'
            '      <w:tr><w:tc><w:p><w:r><w:t>Enzyme</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Km (mM)</w:t></w:r></w:p></w:tc></w:tr>\n'
            '      <w:tr><w:tc><w:p><w:r><w:t>Hexokinase IV (Glucokinase)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10.0</w:t></w:r></w:p></w:tc></w:tr>\n'
            '    </w:tbl>\n'
            '  </w:body>\n'
            '</w:document>'
        )
        z.writestr('word/document.xml', doc_xml)

def create_encrypted_docx(path):
    # Simulated OLE Compound Document with EncryptedPackage stream
    header = bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) + (b'\x00' * 504)
    stream_data = b"EncryptionInfo ... EncryptedPackage ... PasswordRequired" + (b'\x00' * 512)
    with open(path, 'wb') as f:
        f.write(header + stream_data)

def create_corrupted_docx(path):
    with open(path, 'wb') as f:
        f.write(b"NOT_A_ZIP_FILE_RANDOM_TEXT_CORRUPTED_DOCUMENT_DATA_1234567890")

def run_adversarial_suite():
    print("=====================================================================")
    print("🧪 ADVERSARIAL TEST SUITE: Word Previewer & PDF Converter Edge Cases")
    print("=====================================================================")
    
    valid_docx = os.path.join(PROJECT_DIR, 'test_adv_valid.docx')
    enc_docx = os.path.join(PROJECT_DIR, 'test_adv_encrypted.docx')
    corrupt_docx = os.path.join(PROJECT_DIR, 'test_adv_corrupt.docx')
    
    create_valid_docx_with_image(valid_docx)
    create_encrypted_docx(enc_docx)
    create_corrupted_docx(corrupt_docx)

    # Prepare injected test script into a test harness html page
    with open(os.path.join(PROJECT_DIR, 'index.html'), 'r', encoding='utf-8') as f:
        html = f.read()

    adv_test_script = """
    <div id="advOutput" style="display:none;"></div>
    <script>
      window.addEventListener('load', async () => {
        const results = { passed: true, checks: [], errors: [] };
        function check(name, pass, detail) {
          if (!pass) {
            results.passed = false;
            results.errors.push(`${name}: ${detail || 'failed'}`);
            console.error("FAIL:", name, detail);
          } else {
            results.checks.push(name);
            console.log("PASS:", name);
          }
        }

        try {
          await new Promise(r => setTimeout(r, 400));
          const {
            isEncryptedOfficeDoc,
            isZipPackage,
            exportHtmlToPdf,
            openPdfPreviewModal,
            closePdfPreviewModal,
            convertModalWordToPdf,
            upsertItemInState,
            renderItems,
            ensureDocxTextIndexed,
            docxTextCache
          } = window.QSHWord;

          // -------------------------------------------------------------
          // T1: Encrypted / Password-Protected Word Document
          // -------------------------------------------------------------
          const encRes = await fetch('test_adv_encrypted.docx');
          const encAb = await encRes.arrayBuffer();
          check("DetectEncryptedDoc", isEncryptedOfficeDoc(encAb), "isEncryptedOfficeDoc identified encrypted OLE header");

          // Test opening encrypted doc in preview modal
          const encItem = {
            id: 'item-encrypted-doc',
            type: 'file',
            fileName: 'secret_confidential.docx',
            fileSize: encAb.byteLength,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000
          };
          upsertItemInState(encItem);

          // Mock QSHCloud getFileBlob for this item
          window.QSHCloud = window.QSHCloud || {};
          window.QSHCloud.isCloudMode = () => true;
          window.QSHCloud.getBlobUrlForFile = async (id) => 'blob:mock-url-' + id;
          window.QSHCloud.getFileBlob = async (id) => {
            if (id === 'item-encrypted-doc') return new Blob([encAb]);
            if (id === 'item-corrupt-doc') return new Blob([await (await fetch('test_adv_corrupt.docx')).arrayBuffer()]);
            if (id === 'item-valid-img-doc') return new Blob([await (await fetch('test_adv_valid.docx')).arrayBuffer()]);
            return null;
          };

          await openPdfPreviewModal('item-encrypted-doc', 'secret_confidential.docx');
          await new Promise(r => setTimeout(r, 200));

          const wordA4 = document.getElementById('wordA4Paper');
          const pdfBtn = document.getElementById('wordModalPdfBtn');
          const printBtn = document.getElementById('wordModalPrintBtn');
          const copyBtn = document.getElementById('copyModalTextBtn');
          const downloadBtn = document.getElementById('wordModalDownloadDocx');

          check("EncryptedErrorBanner", wordA4 && wordA4.innerHTML.includes('mật khẩu bảo vệ'), "Encrypted doc shows password protection error banner");
          check("EncryptedPdfBtnHidden", pdfBtn && pdfBtn.style.display === 'none', "PDF button hidden for encrypted doc");
          check("EncryptedPrintBtnHidden", printBtn && printBtn.style.display === 'none', "Print button hidden for encrypted doc");
          check("EncryptedCopyBtnHidden", copyBtn && copyBtn.style.display === 'none', "Copy button hidden for encrypted doc");
          check("EncryptedDownloadVisible", downloadBtn && downloadBtn.style.display !== 'none', "Download original file button visible");

          // Verify convertModalWordToPdf refuses to export error message
          let toastMsg = '';
          const origToast = window.showToast;
          // Hook toast
          const toasts = [];
          const toastContainer = document.getElementById('toastContainer');
          const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
              for (const node of m.addedNodes) {
                if (node.textContent) toasts.push(node.textContent);
              }
            }
          });
          if (toastContainer) observer.observe(toastContainer, { childList: true });

          await convertModalWordToPdf();
          await new Promise(r => setTimeout(r, 100));
          check("RefuseExportErrorPdf", toasts.some(t => t.includes('Không có nội dung tài liệu hợp lệ')), "Refuses to convert error banner to PDF");

          closePdfPreviewModal();

          // -------------------------------------------------------------
          // T2: Corrupted or non-zip file renamed to .docx
          // -------------------------------------------------------------
          const corruptItem = {
            id: 'item-corrupt-doc',
            type: 'file',
            fileName: 'corrupted_file.docx',
            fileSize: 100,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000
          };
          upsertItemInState(corruptItem);

          await openPdfPreviewModal('item-corrupt-doc', 'corrupted_file.docx');
          await new Promise(r => setTimeout(r, 200));

          check("CorruptedBannerShown", wordA4 && (wordA4.innerHTML.includes('không phải định dạng Word') || wordA4.innerHTML.includes('lỗi')), "Corrupted doc shows format warning banner");
          check("CorruptedPdfBtnHidden", pdfBtn && pdfBtn.style.display === 'none', "PDF button hidden for corrupted doc");
          check("CorruptedPrintBtnHidden", printBtn && printBtn.style.display === 'none', "Print button hidden for corrupted doc");

          closePdfPreviewModal();

          // -------------------------------------------------------------
          // T3: Legacy .doc file handling
          // -------------------------------------------------------------
          const legacyDocItem = {
            id: 'item-legacy-doc',
            type: 'file',
            fileName: 'patient_case_history.doc',
            fileSize: 15400,
            mimeType: 'application/msword',
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000
          };
          upsertItemInState(legacyDocItem);

          // Card check
          renderItems();
          const itemsEl = document.getElementById('itemsContainer');
          const legacyCard = itemsEl.querySelector('.item-card[data-id="item-legacy-doc"]');
          check("LegacyCardRendered", Boolean(legacyCard), "Legacy .doc card rendered");
          if (legacyCard) {
            const badge = legacyCard.querySelector('.type-badge.word');
            check("LegacyWordBadge", Boolean(badge) && badge.textContent.includes('Word'), "Card has 📘 Word badge");
            const previewBtn = legacyCard.querySelector('.js-preview-word-btn');
            check("LegacyPreviewBtnExists", Boolean(previewBtn), "Card has 👁️ Xem Word button");
          }

          // Open legacy .doc preview
          await openPdfPreviewModal('item-legacy-doc', 'patient_case_history.doc');
          await new Promise(r => setTimeout(r, 200));

          check("LegacyDocBannerShown", wordA4 && wordA4.innerHTML.includes('Word 97-2003 (.doc)'), "Shows dedicated legacy .doc guidance banner");
          check("LegacyDownloadText", downloadBtn && downloadBtn.textContent.includes('.doc'), "Download button specifies .doc format");
          check("LegacyPdfBtnHidden", pdfBtn && pdfBtn.style.display === 'none', "PDF button hidden for .doc");

          closePdfPreviewModal();

          // -------------------------------------------------------------
          // T4: Valid .docx with Image & Table (html2pdf & copy)
          // -------------------------------------------------------------
          const validItem = {
            id: 'item-valid-img-doc',
            type: 'file',
            fileName: 'biochemistry_enzymology.docx',
            fileSize: 5200,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000
          };
          upsertItemInState(validItem);

          await openPdfPreviewModal('item-valid-img-doc', 'biochemistry_enzymology.docx');
          await new Promise(r => setTimeout(r, 600));

          check("ValidDocHtmlRendered", Boolean(wordA4 && wordA4.innerHTML.includes('Biochemistry Enzymology Report')), `wordA4 content: ${wordA4 ? wordA4.innerHTML.slice(0, 300) : 'none'}`);
          check("ValidDocTableRendered", wordA4 && wordA4.querySelector('table') !== null, "Table rendered in A4 paper");
          check("ValidDocImageRendered", wordA4 && wordA4.querySelector('img') !== null, "Embedded image parsed and rendered in A4 paper");
          check("ValidPdfBtnVisible", pdfBtn && pdfBtn.style.display !== 'none', "PDF button visible");
          check("ValidPrintBtnVisible", printBtn && printBtn.style.display !== 'none', "Print button visible");
          check("ValidCopyBtnVisible", copyBtn && copyBtn.style.display !== 'none', "Copy button visible");

          // Test Copy Text & Document Text Indexing
          const cachedText = docxTextCache.get('item-valid-img-doc') || '';
          check("ModalTextContentSet", cachedText.includes('Hexokinase IV'), "docxTextCache contains raw document text");

          // Test HTML to PDF direct conversion with valid result
          const pdfBlob = await exportHtmlToPdf(wordA4.innerHTML, 'test_output_check.pdf', true);
          check("ExportHtmlToPdfSuccess", Boolean(pdfBlob && pdfBlob.size > 500), `exportHtmlToPdf generated valid PDF blob (${pdfBlob ? pdfBlob.size : 0} bytes)`);

          // -------------------------------------------------------------
          // T5: Print CSS Scoping & Lifecycle Class Management
          // -------------------------------------------------------------
          check("BodyHasWordPreviewClass", document.body.classList.contains('word-preview-open'), "document.body has 'word-preview-open' while Word preview is open");

          closePdfPreviewModal();
          check("BodyRemovedWordPreviewClass", !document.body.classList.contains('word-preview-open'), "document.body removes 'word-preview-open' when modal closed");

          // -------------------------------------------------------------
          // T6: Infinite Re-Indexing Prevention Sentinel Test
          // -------------------------------------------------------------
          const blankItem = {
            id: 'item-blank-doc',
            type: 'file',
            fileName: 'blank.docx',
            fileSize: 10,
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000
          };
          await ensureDocxTextIndexed(blankItem);
          check("CacheSentinelRecorded", docxTextCache.has('item-blank-doc'), "docxTextCache recorded sentinel entry for unparseable item");

        } catch (err) {
          results.passed = false;
          results.errors.push(String(err && err.stack || err));
        }

        const out = document.getElementById('advOutput');
        out.textContent = JSON.stringify(results);
        out.style.display = 'block';
      });
    </script>
    </body>
    """

    test_page_html = html.replace('</body>', adv_test_script)
    test_page_path = os.path.join(PROJECT_DIR, 'test_adv_page.html')
    with open(test_page_path, 'w', encoding='utf-8') as f:
        f.write(test_page_html)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=PROJECT_DIR, **kwargs)
        def log_message(self, format, *args):
            pass

    server = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"  ✓ Local server running on http://127.0.0.1:{port}")

    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "msedge"
    ]
    edge_bin = None
    for p in edge_paths:
        if os.path.isfile(p):
            edge_bin = p
            break
    if not edge_bin:
        edge_bin = "msedge"

    url = f"http://127.0.0.1:{port}/test_adv_page.html"
    cmd = [
        edge_bin,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=10000",
        "--dump-dom",
        url
    ]

    print(f"  ✓ Running Edge headless against {url}...")
    res = subprocess.check_output(cmd, encoding='utf-8', errors='replace', timeout=30)
    server.shutdown()

    import re
    match = re.search(r'<div id="advOutput"[^>]*>([^<]+)</div>', res)
    if not match:
        print("❌ Could not find advOutput in DOM dump:")
        print(res[:600])
        sys.exit(1)

    data = json.loads(match.group(1).strip())
    print("\n[Adversarial Results]")
    for c in data.get('checks', []):
        print(f"  ✓ {c}")

    if not data.get('passed'):
        print("\n❌ SOME ADVERSARIAL CHECKS FAILED:")
        for err in data.get('errors', []):
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("\n🎉 ALL ADVERSARIAL CHECKS PASSED WITH ZERO ERRORS! 🎉\n")

    # Clean temporary files
    for tmp in [valid_docx, enc_docx, corrupt_docx, test_page_path]:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass

if __name__ == '__main__':
    run_adversarial_suite()
