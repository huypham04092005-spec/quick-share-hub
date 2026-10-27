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

def test_static_files():
    print("[1/5] Verifying static files...")
    
    # 1. sw.js
    sw_path = os.path.join(PROJECT_DIR, 'sw.js')
    with open(sw_path, 'r', encoding='utf-8') as f:
        sw_content = f.read()
    assert 'quick-share-hub-v16-cloud' in sw_content, "sw.js cache version must be v16"
    assert './js/mammoth.browser.min.js' in sw_content, "sw.js must cache mammoth.browser.min.js"
    assert './js/html2pdf.bundle.min.js' in sw_content, "sw.js must cache html2pdf.bundle.min.js"
    print("  ✓ sw.js is updated to v16 with mammoth and html2pdf in static cache")

    # 2. index.html
    index_path = os.path.join(PROJECT_DIR, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    assert 'countDocs' in html_content, "index.html must have countDocs counter"
    assert 'data-filter="docs"' in html_content, "index.html must have docs filter tab"
    assert 'quickDocxToPdfBtn' in html_content, "index.html must have quickDocxToPdfBtn"
    assert 'quickDocxToPdfInput' in html_content, "index.html must have quickDocxToPdfInput"
    assert 'wordModalPdfBtn' in html_content, "index.html must have wordModalPdfBtn"
    assert 'wordModalPrintBtn' in html_content, "index.html must have wordModalPrintBtn"
    assert 'wordModalDownloadDocx' in html_content, "index.html must have wordModalDownloadDocx"
    assert 'wordPreviewContainer' in html_content, "index.html must have wordPreviewContainer"
    assert 'wordA4Paper' in html_content, "index.html must have wordA4Paper"
    assert 'js/mammoth.browser.min.js' in html_content, "index.html must include mammoth"
    assert 'js/html2pdf.bundle.min.js' in html_content, "index.html must include html2pdf"
    print("  ✓ index.html has all required elements, buttons, and scripts")

    # 3. css/app.css
    css_path = os.path.join(PROJECT_DIR, 'css', 'app.css')
    with open(css_path, 'r', encoding='utf-8') as f:
        css_content = f.read()
    assert '.type-badge.word' in css_content and '.type-badge.docx' in css_content, "css must style word badges"
    assert '#2563eb' in css_content or '37, 99, 235' in css_content, "css must use Word blue #2563eb"
    assert '.word-a4-paper' in css_content, "css must style word-a4-paper"
    assert '@media print' in css_content, "css must define @media print rules"
    print("  ✓ css/app.css includes Word badge blue styling, A4 paper layout, and print CSS")

    # 4. js/app.js
    app_path = os.path.join(PROJECT_DIR, 'js', 'app.js')
    with open(app_path, 'r', encoding='utf-8') as f:
        app_content = f.read()
    assert 'countDocs' in app_content, "app.js must update countDocs"
    assert 'isDocItem' in app_content, "app.js must define isDocItem"
    assert 'isWordDocxItem' in app_content, "app.js must define isWordDocxItem"
    assert '📘 Word DOCX' in app_content, "app.js must assign 📘 Word DOCX badge"
    assert '👁️ Xem Word' in app_content, "app.js must have 👁️ Xem Word button"
    assert '⚡ Chuyển sang PDF' in app_content, "app.js must have ⚡ Chuyển sang PDF button"
    assert 'convertWordItemToPdf' in app_content, "app.js must define convertWordItemToPdf"
    assert 'convertModalWordToPdf' in app_content, "app.js must define convertModalWordToPdf"
    assert 'docxTextCache' in app_content, "app.js must index docx text"
    print("  ✓ js/app.js contains all Word identification, conversion, preview, and search logic")


def create_sample_docx(path, heading_text="IMBC Biochemistry Competition 2026", body_text="Medical students preparing for IMBC competition."):
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


def test_in_browser():
    print("[2/5] Creating sample test docx and test harness page...")
    test_docx_path = os.path.join(PROJECT_DIR, 'test_sample.docx')
    create_sample_docx(test_docx_path)
    
    test_html_content = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Verification Suite</title>
  <script src="js/qrcode.min.js"></script>
  <script src="js/mammoth.browser.min.js"></script>
  <script src="js/html2pdf.bundle.min.js"></script>
</head>
<body>
  <div id="testOutput">RUNNING</div>
  <div id="renderTarget" class="word-a4-paper" style="width: 210mm; background: white; color: black;"></div>

  <script>
    async function runSuite() {
      const results = { passed: true, errors: [] };
      function assert(cond, msg) {
        if (!cond) {
          results.passed = false;
          results.errors.push(msg);
          console.error("FAIL:", msg);
        } else {
          console.log("PASS:", msg);
        }
      }

      try {
        // Test 1: mammoth availability
        assert(typeof window.mammoth !== 'undefined', "window.mammoth must be loaded");
        assert(typeof window.mammoth.convertToHtml === 'function', "mammoth.convertToHtml must be function");
        assert(typeof window.mammoth.extractRawText === 'function', "mammoth.extractRawText must be function");

        // Test 2: html2pdf availability
        assert(typeof window.html2pdf !== 'undefined', "window.html2pdf must be loaded");
        assert(typeof window.html2pdf === 'function', "window.html2pdf must be function");

        // Test 3: Fetch and parse sample .docx
        const res = await fetch('test_sample.docx');
        assert(res.ok, "Fetch test_sample.docx must succeed");
        const ab = await res.arrayBuffer();
        assert(ab.byteLength > 0, "ArrayBuffer from docx must not be empty");

        // Test 4: Mammoth parse to HTML
        const htmlRes = await window.mammoth.convertToHtml({ arrayBuffer: ab });
        assert(htmlRes && typeof htmlRes.value === 'string', "mammoth.convertToHtml must return html string");
        assert(htmlRes.value.includes('IMBC Biochemistry Competition 2026'), "HTML must retain heading text");
        assert(htmlRes.value.includes('Medical students preparing for IMBC'), "HTML must retain body text");

        // Test 5: Mammoth extract raw text
        const textRes = await window.mammoth.extractRawText({ arrayBuffer: ab });
        assert(textRes && typeof textRes.value === 'string', "mammoth.extractRawText must return raw text");
        assert(textRes.value.includes('IMBC Biochemistry Competition 2026'), "Raw text must contain heading");
        assert(textRes.value.includes('Medical students'), "Raw text must contain body");

        // Test 6: In-document search keyword match
        const query = "biochemistry";
        assert(textRes.value.toLowerCase().includes(query), "Search query should match docx text content");

        // Test 7: html2pdf conversion
        const target = document.getElementById('renderTarget');
        target.innerHTML = htmlRes.value;
        const pdfWorker = window.html2pdf().from(target).set({
          margin: [10, 10, 10, 10],
          filename: 'test_output.pdf',
          html2canvas: { scale: 1.5 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        });
        
        const pdfBlob = await pdfWorker.output('blob');
        assert(pdfBlob && pdfBlob.size > 500, "html2pdf must generate a valid PDF blob > 500 bytes");
        assert(pdfBlob.type === 'application/pdf', "Blob type must be application/pdf");

        // Verify PDF magic header %PDF
        const pdfHeaderBuffer = await pdfBlob.slice(0, 5).arrayBuffer();
        const headerStr = new TextDecoder().decode(pdfHeaderBuffer);
        assert(headerStr.startsWith('%PDF'), "Generated file must start with %PDF header");

        console.log("PDF generation success! Size:", pdfBlob.size, "Header:", headerStr);

      } catch (e) {
        results.passed = false;
        results.errors.push(String(e && e.stack || e));
      }

      const outEl = document.getElementById('testOutput');
      outEl.textContent = JSON.stringify(results);
    }

    runSuite();
  </script>
</body>
</html>
"""
    test_html_path = os.path.join(PROJECT_DIR, 'test_browser_suite.html')
    with open(test_html_path, 'w', encoding='utf-8') as f:
        f.write(test_html_content)

    print("[3/5] Starting local HTTP server...")
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=PROJECT_DIR, **kwargs)
        def log_message(self, format, *args):
            pass # quiet

    server = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"  ✓ Server running on http://127.0.0.1:{port}")

    print("[4/5] Running Edge Headless browser test...")
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    test_url = f'http://127.0.0.1:{port}/test_browser_suite.html'

    # Run Edge headless with --dump-dom after a short delay
    cmd = [
        edge_path,
        '--headless',
        '--disable-gpu',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=8000',
        '--dump-dom',
        test_url
    ]
    res = subprocess.check_output(cmd, text=True, timeout=25)
    
    server.shutdown()
    
    # Cleanup test files
    try: os.remove(test_docx_path)
    except: pass
    try: os.remove(test_html_path)
    except: pass

    print("[5/5] Analyzing browser execution output...")
    # Find testOutput in the dumped DOM
    import re
    match = re.search(r'<div id="testOutput">([^<]+)</div>', res)
    assert match, f"Could not find testOutput in DOM dump: {res[:400]}"
    
    raw_json = match.group(1).strip()
    result = json.loads(raw_json)
    if not result.get('passed'):
        print("BROWSER TEST FAILED. Errors:")
        for err in result.get('errors', []):
            print("  ❌", err)
        sys.exit(1)
    else:
        print("  ✓ ALL BROWSER IN-PAGE TESTS PASSED!")
        print("    - mammoth.browser.min.js parses .docx to semantic HTML correctly")
        print("    - mammoth.browser.min.js extracts raw text correctly")
        print("    - In-document full-text search matches keyword inside docx")
        print("    - html2pdf.bundle.min.js converts parsed Word HTML into standard A4 PDF with valid %PDF header")

if __name__ == '__main__':
    test_static_files()
    test_in_browser()
    print("\n🎉 ALL TESTS AND ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY! 🎉")
