// Making files to download, with no extra libraries: a zip folder (makeZip) and an Excel workbook (makeXlsx).
// Used by the report download (report-files.js) and the year-end receipts folder (yearend.js).
// Part of the Crochet Studio app. Files load in the order listed in index.html.

// ---- Zip (files are stored as they are; photos are already compressed) ----
let crcTable = null;
function crc32(bytes) {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++)
                c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            crcTable[n] = c >>> 0;
        }
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++)
        c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
async function zipBytes(d) {
    if (d instanceof Uint8Array)
        return d;
    if (typeof d === 'string')
        return new TextEncoder().encode(d);
    return new Uint8Array(await d.arrayBuffer());
}
// files: [{ name: 'folder/file.jpg', data: Blob | Uint8Array | string }]
async function makeZip(files, type = 'application/zip') {
    let parts = [], central = [], offset = 0, enc = new TextEncoder(), now = new Date();
    let dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (let f of files) {
        let name = enc.encode(f.name), bytes = await zipBytes(f.data), crc = crc32(bytes), h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 0x0800, true); // file names are UTF-8
        h.setUint16(8, 0, true);
        h.setUint16(10, dosTime, true);
        h.setUint16(12, dosDate, true);
        h.setUint32(14, crc, true);
        h.setUint32(18, bytes.length, true);
        h.setUint32(22, bytes.length, true);
        h.setUint16(26, name.length, true);
        h.setUint16(28, 0, true);
        parts.push(h.buffer, name, bytes);
        let c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true);
        c.setUint16(4, 20, true);
        c.setUint16(6, 20, true);
        c.setUint16(8, 0x0800, true);
        c.setUint16(10, 0, true);
        c.setUint16(12, dosTime, true);
        c.setUint16(14, dosDate, true);
        c.setUint32(16, crc, true);
        c.setUint32(20, bytes.length, true);
        c.setUint32(24, bytes.length, true);
        c.setUint16(28, name.length, true);
        c.setUint32(42, offset, true);
        central.push(c.buffer, name);
        offset += 30 + name.length + bytes.length;
    }
    let size = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, size, true);
    e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, e.buffer], { type });
}

// ---- Excel workbook ----
// sheets: [{ name, cols: [widths], rows: [[cell, ...], ...], freeze: rowsToKeepAtTop }]
// A cell is text, a number, null, or { v, s } where s is 'b' (bold), 'm' (money), 'bm' (bold money), 't' (title), 'p' (percent).
const XL_STYLE = { b: 1, m: 2, bm: 3, t: 4, p: 5, h: 6 };
function xlEsc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
function xlCol(i) {
    let s = '';
    for (i++; i > 0; i = Math.floor((i - 1) / 26))
        s = String.fromCharCode(65 + (i - 1) % 26) + s;
    return s;
}
function xlSheet(sh) {
    let rows = sh.rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
        if (cell === null || cell === undefined || cell === '')
            return '';
        let o = typeof cell === 'object' ? cell : { v: cell }, ref = xlCol(c) + (r + 1), st = XL_STYLE[o.s] ? ` s="${XL_STYLE[o.s]}"` : '';
        if (typeof o.v === 'number' && Number.isFinite(o.v))
            return `<c r="${ref}"${st}><v>${o.v}</v></c>`;
        return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xlEsc(o.v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    let cols = sh.cols?.length ? `<cols>${sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    let freeze = sh.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}
function xlSheetName(n, used) {
    let s = String(n).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Sheet', base = s, i = 2;
    while (used.has(s.toLowerCase()))
        s = base.slice(0, 28) + ' ' + i++;
    used.add(s.toLowerCase());
    return s;
}
async function makeXlsx(sheets) {
    let used = new Set(), names = sheets.map(s => xlSheetName(s.name, used));
    let files = [
        { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
        { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
        { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
        { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
        { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00;\\-&quot;$&quot;#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDE6FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
        ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: xlSheet(s) }))
    ];
    return makeZip(files, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
// Helpers for building rows
const xm = v => ({ v: round2(Number(v) || 0), s: 'm' }), xbm = v => ({ v: round2(Number(v) || 0), s: 'bm' }), xb = v => ({ v, s: 'b' }), xh = v => ({ v, s: 'h' });
