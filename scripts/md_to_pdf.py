"""
Convert the ASP-registration markdown docs to styled A4 PDFs (via headless Chrome).

Usage:
    python scripts/md_to_pdf.py

Reads every *.md in docs/asp-registration/, renders styled HTML (tables, code,
and real Mermaid diagrams via mermaid.js), then prints each to PDF with headless
Chrome/Edge into docs/asp-registration/pdf/.

Requires Chrome or Edge installed (auto-detected). Mermaid diagrams need internet
(mermaid.js is loaded from a CDN); text/tables work offline.
"""
import os
import re
import sys
import glob
import time
import datetime
import subprocess

import markdown

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, 'docs', 'asp-registration')
OUT = os.path.join(SRC, 'pdf')

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

CSS = """
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI","Helvetica Neue",Arial,sans-serif;
       font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; margin: 0; }
h1 { font-size: 20pt; color: #0b4f8a; border-bottom: 3px solid #0b4f8a;
     padding-bottom: 6px; margin: 0 0 14px; }
h2 { font-size: 14pt; color: #0b4f8a; margin: 22px 0 8px;
     border-bottom: 1px solid #d6e2ee; padding-bottom: 3px; page-break-after: avoid; }
h3 { font-size: 11.5pt; color: #18608f; margin: 16px 0 6px; page-break-after: avoid; }
p { margin: 6px 0; }
a { color: #0b4f8a; text-decoration: none; }
ul, ol { margin: 6px 0 6px 18px; }
li { margin: 3px 0; }
hr { border: none; border-top: 1px solid #d6e2ee; margin: 16px 0; }
blockquote { margin: 10px 0; padding: 8px 14px; background: #f1f6fb;
             border-left: 4px solid #0b4f8a; color: #333; font-size: 10pt; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5pt;
        page-break-inside: avoid; }
th, td { border: 1px solid #c9d6e3; padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #0b4f8a; color: #fff; font-weight: 600; }
tr:nth-child(even) td { background: #f5f9fc; }
code { font-family: Consolas,"Courier New",monospace; font-size: 9pt;
       background: #eef2f5; padding: 1px 4px; border-radius: 3px; }
pre { background: #f5f7f9; border: 1px solid #d6e2ee; border-left: 3px solid #0b4f8a;
      padding: 10px 12px; border-radius: 4px; font-size: 8.6pt; line-height: 1.35;
      white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid; }
pre code { background: none; padding: 0; }
pre.mermaid { background: #fff; border: none; text-align: center; }
.cover { color: #666; font-size: 9pt; margin-bottom: 18px; }
"""

HEAD = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>{css}</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>try{{mermaid.initialize({{startOnLoad:true,theme:'neutral'}});}}catch(e){{}}</script>
</head><body>
<div class="cover"><strong>E-Numerak</strong> &middot; AL MERAK TAX CONSULTANT L.L.C
&middot; PEPPOL Service Provider &middot; Generated {date}</div>
{body}</body></html>"""

_MERMAID_RE = re.compile(
    r'<pre><code class="language-mermaid">(.*?)</code></pre>', re.DOTALL)


def find_chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def md_to_html(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        text = f.read()
    body = markdown.markdown(
        text, extensions=['tables', 'fenced_code', 'toc', 'sane_lists', 'attr_list'])
    # Re-tag mermaid code blocks so mermaid.js renders them as diagrams
    body = _MERMAID_RE.sub(r'<pre class="mermaid">\1</pre>', body)
    return HEAD.format(css=CSS, date=datetime.date.today().isoformat(), body=body)


def main():
    # Optional: pass a source folder of .md files as the first argument.
    # Defaults to docs/asp-registration. PDFs are written to <src>/pdf.
    src = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else SRC
    out = os.path.join(src, 'pdf')
    chrome = find_chrome()
    if not chrome:
        print("Chrome/Edge not found. Install one or adjust CHROME_CANDIDATES.")
        return 1
    print(f"Using browser: {chrome}")
    os.makedirs(out, exist_ok=True)
    OUT = out  # local override so the loop + final print use the chosen folder
    mds = sorted(glob.glob(os.path.join(src, '*.md')))
    if not mds:
        print("No .md files found.")
        return 1
    for md in mds:
        stem = os.path.splitext(os.path.basename(md))[0]
        html_path = os.path.join(OUT, stem + '.html')
        pdf_path = os.path.join(OUT, stem + '.pdf')
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(md_to_html(md))
        file_url = 'file:///' + html_path.replace('\\', '/')
        cmd = [
            chrome, '--headless=new', '--disable-gpu', '--no-sandbox',
            '--virtual-time-budget=20000',
            '--run-all-compositor-stages-before-draw',
            '--no-pdf-header-footer',
            f'--print-to-pdf={pdf_path}', file_url,
        ]
        subprocess.run(cmd, capture_output=True, timeout=120)
        time.sleep(0.3)
        ok = os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0
        print(f"  {'OK ' if ok else 'FAIL'} {stem}.pdf"
              + ('' if ok else ' (no output)'))
    print(f"\nPDFs in: {OUT}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
