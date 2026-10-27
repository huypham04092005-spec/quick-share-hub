import os
import sys
import io
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

def create_sample_docx(path, heading_text="IMBC Biochemistry Research Report", body_text="Electrophoresis and enzyme kinetics analysis."):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
            '  <Default Extension="xml" ContentType="application/xml"/>\n'
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
        
        doc_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
            '  <w:body>\n'
            '    <w:p>\n'
            '      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>\n'
            f'      <w:r><w:t>{heading_text}</w:t></w:r>\n'
            '    </w:p>\n'
            '    <w:p>\n'
            f'      <w:r><w:t>{body_text}</w:t></w:r>\n'
            '    </w:p>\n'
            '  </w:body>\n'
            '</w:document>'
        )
        z.writestr('word/document.xml', doc_xml)

def run_e2e():
    print("[E2E] Preparing test docx file...")
    test_docx_path = os.path.join(PROJECT_DIR, 'test_e2e_doc.docx')
    create_sample_docx(test_docx_path)

    # Read original index.html
    index_path = os.path.join(PROJECT_DIR, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Inject an E2E test verification runner right before </body>
    e2e_script = """
    <div id="e2eOutput" style="display:none;"></div>
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
          // Wait 300ms for app initialization
          await new Promise(r => setTimeout(r, 300));

          // C1: Verify Mammoth & html2pdf loaded
          check("MammothLoaded", typeof window.mammoth !== 'undefined' && typeof window.mammoth.convertToHtml === 'function');
          check("Html2PdfLoaded", typeof window.html2pdf === 'function');

          // C2: Verify Docs counter in toolbar
          const countDocsEl = document.getElementById('countDocs');
          check("CountDocsExists", Boolean(countDocsEl));

          // C3: Verify Quick PDF button in upload header
          const quickBtn = document.getElementById('quickDocxToPdfBtn');
          const quickInput = document.getElementById('quickDocxToPdfInput');
          check("QuickToolExists", Boolean(quickBtn && quickInput));

          // C4: Simulate a Word DOCX item in the Hub
          const testWordItem = {
            id: 'test-docx-item-123',
            room: 'default',
            type: 'file',
            content: 'test_e2e_doc.docx',
            title: 'test_e2e_doc.docx',
            fileName: 'test_e2e_doc.docx',
            fileSize: 4500,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            isPdf: false,
            createdAt: Date.now(),
            expiresAt: Date.now() + 86400000,
            pinned: false
          };

          // Real file upload simulation via fileInput and DataTransfer
          const rawDocxRes = await fetch('test_e2e_doc.docx');
          const docxBlob = await rawDocxRes.blob();
          const docxFile = new File([docxBlob], 'test_e2e_doc.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

          const fileInput = document.getElementById('fileInput');
          const dt = new DataTransfer();
          dt.items.add(docxFile);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change'));

          // Wait for uploadFiles to complete
          await new Promise(r => setTimeout(r, 1500));

          // C5: Check item card rendering and badge
          const itemsContainer = document.getElementById('itemsContainer');
          const card = itemsContainer ? itemsContainer.querySelector('.item-card') : null;
          check("CardRendered", Boolean(card), "Word item card rendered in items container");

          if (card) {
            const badge = card.querySelector('.type-badge.docx');
            check("BadgeDOCX", Boolean(badge) && badge.textContent.includes('Word DOCX'), `Badge text: ${badge ? badge.textContent : 'none'}`);

            const previewBtn = card.querySelector('.js-preview-word-btn');
            check("PreviewBtnText", Boolean(previewBtn) && previewBtn.textContent.includes('Xem Word'), "Card has '👁️ Xem Word' button");

            const convertBtn = card.querySelector('.js-convert-word-pdf-btn');
            check("ConvertBtnText", Boolean(convertBtn) && convertBtn.textContent.includes('Chuyển sang PDF'), "Card has '⚡ Chuyển sang PDF' button");
          }

          // C6: Test Docs Filter tab
          const docsTab = document.querySelector('.filter-tab[data-filter="docs"]');
          check("DocsFilterTabExists", Boolean(docsTab));
          if (docsTab) {
            docsTab.click();
            await new Promise(r => setTimeout(r, 100));
            const visibleCards = itemsContainer.querySelectorAll('.item-card');
            check("DocsFilterActive", visibleCards.length > 0, "Docs filter shows the Word document");
          }

          // C7: Test Full-text in-document search
          const searchInput = document.getElementById('searchInput');
          if (searchInput) {
            // Index the docx text
            const docxRes = await fetch('test_e2e_doc.docx');
            const docxAb = await docxRes.arrayBuffer();
            const textResult = await window.mammoth.extractRawText({ arrayBuffer: docxAb });
            
            // Search keyword "electrophoresis" from document text
            searchInput.value = 'electrophoresis';
            searchInput.dispatchEvent(new Event('input'));
            await new Promise(r => setTimeout(r, 200));
            
            const matchedCards = itemsContainer.querySelectorAll('.item-card');
            check("InDocSearchMatches", matchedCards.length > 0, "Search query 'electrophoresis' matched docx text");

            // Clear search
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            await new Promise(r => setTimeout(r, 100));
          }

          // C8: Test Preview Modal Opening & A4 Word Rendering
          const activeCard = itemsContainer.querySelector('.item-card');
          check("ActiveCardExists", Boolean(activeCard));
          if (activeCard) {
            const previewBtn = activeCard.querySelector('.js-preview-word-btn');
            check("ActivePreviewBtnExists", Boolean(previewBtn));
            if (previewBtn) {
              previewBtn.click();
              await new Promise(r => setTimeout(r, 800));

              const pdfModal = document.getElementById('pdfModal');
              check("ModalOpened", pdfModal && pdfModal.classList.contains('open'));

              const wordContainer = document.getElementById('wordPreviewContainer');
              check("WordContainerVisible", wordContainer && wordContainer.style.display !== 'none');

              const wordA4Paper = document.getElementById('wordA4Paper');
              check("WordA4HasContent", wordA4Paper && wordA4Paper.innerHTML.includes('IMBC Biochemistry Research Report'), `A4 content: ${wordA4Paper ? wordA4Paper.innerHTML.slice(0, 100) : 'none'}`);

              const wordModalPdfBtn = document.getElementById('wordModalPdfBtn');
              check("ModalPdfBtnVisible", wordModalPdfBtn && wordModalPdfBtn.style.display !== 'none');

              const wordModalPrintBtn = document.getElementById('wordModalPrintBtn');
              check("ModalPrintBtnVisible", wordModalPrintBtn && wordModalPrintBtn.style.display !== 'none');

              const wordModalDownloadDocx = document.getElementById('wordModalDownloadDocx');
              check("ModalDownloadDocxVisible", wordModalDownloadDocx && wordModalDownloadDocx.style.display !== 'none');
            }
          }

        } catch (e) {
          results.passed = false;
          results.errors.push(String(e && e.stack || e));
        }

        const out = document.getElementById('e2eOutput');
        out.textContent = JSON.stringify(results);
        out.style.display = 'block';
      });
    </script>
    </body>
    """

    test_index_content = html.replace('<head>', '<head><script>window.QSH_FORCE_CLOUD = true;</script>').replace('</body>', e2e_script)
    test_index_path = os.path.join(PROJECT_DIR, 'test_e2e_page.html')
    with open(test_index_path, 'w', encoding='utf-8') as f:
        f.write(test_index_content)

    print("[E2E] Starting local server...")
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=PROJECT_DIR, **kwargs)
        def log_message(self, format, *args):
            pass

    server = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    print(f"[E2E] Running Edge headless against http://127.0.0.1:{port}/test_e2e_page.html...")
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    test_url = f'http://127.0.0.1:{port}/test_e2e_page.html'

    cmd = [
        edge_path,
        '--headless',
        '--disable-gpu',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=9000',
        '--dump-dom',
        test_url
    ]
    res = subprocess.check_output(cmd, encoding='utf-8', errors='replace', timeout=30)
    server.shutdown()

    # Cleanup
    try: os.remove(test_docx_path)
    except: pass
    try: os.remove(test_index_path)
    except: pass

    import re
    match = re.search(r'<div id="e2eOutput"[^>]*>([^<]+)</div>', res)
    assert match, f"Could not find e2eOutput in DOM: {res[:500]}"
    
    result = json.loads(match.group(1).strip())
    print("\n[E2E] Test Results:")
    for c in result.get('checks', []):
        print(f"  ✓ {c}")
    if not result.get('passed'):
        print("\n[E2E] Failures detected:")
        for err in result.get('errors', []):
            print(f"  ❌ {err}")
        sys.exit(1)
    else:
        print("\n🎉 ALL E2E USER INTERFACE & WORKFLOW TESTS PASSED! 🎉")

if __name__ == '__main__':
    run_e2e()
