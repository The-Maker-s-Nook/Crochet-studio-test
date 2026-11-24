"""Builds guides/tester-guide.pdf and guides/whats-new-24.pdf from the .txt sources here.
Markup: '# ' title, '## ' section, '### ' subsection, '- ' bullet, '1. ' numbered step,
'[] ' checkbox, '[ ] ' indented checkbox, '> ' tip box, blank line = break, other lines = paragraph.
Inline: **bold**, {NEW} = pink NEW tag. Run: python3 build.py (needs node + playwright)."""
import re, html, subprocess, sys, pathlib, json
HERE = pathlib.Path(__file__).parent

def inline(t):
    t = html.escape(t.replace('->', '→'), quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = t.replace('{NEW}', '<span class="new">NEW</span>')
    t = t.replace('->', '→')
    return t

def to_html(src):
    out, lst = [], None
    def close():
        nonlocal lst
        if lst: out.append(f'</{lst}>'); lst = None
    def open_(kind, cls=''):
        nonlocal lst
        if lst != kind:
            close(); out.append(f'<{kind}{cls}>'); lst = kind
    for raw in src.splitlines():
        line = raw.rstrip()
        if not line.strip():
            close(); continue
        if line.startswith('# '):
            close(); out.append(f'<h1>{inline(line[2:])}</h1>')
        elif line.startswith('## '):
            close(); out.append(f'<h2>{inline(line[3:])}</h2>')
        elif line.startswith('### '):
            close(); out.append(f'<h3>{inline(line[4:])}</h3>')
        elif line.startswith('- '):
            open_('ul'); out.append(f'<li>{inline(line[2:])}</li>')
        elif re.match(r'\d+\. ', line):
            open_('ol'); out.append(f'<li>{inline(line.split(" ", 1)[1])}</li>')
        elif line.startswith('[ ] '):
            open_('div'); out.append(f'<p class="cb sub">☐ {inline(line[4:])}</p>')
        elif line.startswith('[] '):
            open_('div'); out.append(f'<p class="cb">☐ {inline(line[3:])}</p>')
        elif line.startswith('> '):
            close(); out.append(f'<div class="tip">{inline(line[2:])}</div>')
        else:
            close(); out.append(f'<p>{inline(line)}</p>')
    close()
    return '\n'.join(out)

CSS = """
@font-face{font-family:'Lora';font-weight:400 700;src:url('file:///usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf')}
body{font-family:'Liberation Sans',Arial,sans-serif;font-size:10.5pt;line-height:1.45;color:#222;margin:0}
h1{font-family:Lora,Georgia,serif;font-weight:400;font-size:24pt;margin:0 0 14pt;color:#111}
h2{font-family:Lora,Georgia,serif;font-weight:400;font-size:15pt;margin:20pt 0 6pt;color:#111;break-after:avoid}
h3{font-size:10.5pt;margin:12pt 0 4pt;break-after:avoid}
p{margin:0 0 7pt}ul,ol{margin:0 0 8pt;padding-left:18pt}li{margin:0 0 4pt}
.cb{margin:0 0 4pt 10pt}.cb.sub{margin-left:26pt}
.tip{background:#F3EEFF;border-left:3pt solid #9A83C9;padding:7pt 10pt;margin:6pt 0 10pt;break-inside:avoid}
.new{display:inline-block;background:#B23A62;color:#fff;font-size:7pt;font-weight:700;border-radius:8pt;padding:1pt 5pt;vertical-align:2pt;margin:0 2pt}
li,p{break-inside:avoid}
"""

def build(name, title):
    src = (HERE / f'{name}.txt').read_text()
    page = f'<!DOCTYPE html><html><head><meta charset="utf-8"><title>{html.escape(title)}</title><style>{CSS}</style></head><body>{to_html(src)}</body></html>'
    (HERE / f'{name}.html').write_text(page)
    return title

JOBS = [('tester-guide', 'The Makers Nook: Tester Guide'), ('whats-new-24', "The Makers Nook: What's New in Version 24")]
for n, t in JOBS:
    build(n, t)
js = """
const { chromium } = require('playwright');
const jobs = %s, dir = %s, out = %s;
(async () => { const b = await chromium.launch(); const p = await b.newPage();
for (const [n, t] of jobs) {
  await p.goto('file://' + dir + '/' + n + '.html'); await p.waitForTimeout(300);
  const hd = `<div style="font-family:Arial;font-size:7.5px;color:#555;width:100%%;padding:0 0.75in">${t.replace(/'/g,'&#39;')}</div>`;
  const ft = `<div style="font-family:Arial;font-size:7.5px;color:#555;width:100%%;padding:0 0.75in;text-align:right">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`;
  await p.pdf({ path: out + '/' + n + '.pdf', format: 'Letter', printBackground: true, displayHeaderFooter: true, headerTemplate: hd, footerTemplate: ft, margin: { top: '0.7in', bottom: '0.7in', left: '0.75in', right: '0.75in' } });
}
await b.close(); })();
""" % (json.dumps(JOBS), json.dumps(str(HERE)), json.dumps(sys.argv[1] if len(sys.argv) > 1 else str(HERE)))
(HERE / '_render.js').write_text(js)
npm_root = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
subprocess.run(['node', str(HERE / '_render.js')], check=True, env={**__import__('os').environ, 'NODE_PATH': npm_root})
print('built')
