/**
 * Deal cost-breakdown export.
 *
 * Single source of truth: `buildExportData(deal, costLines)` returns a
 * normalized { header, rows, totals } shape that all three exporters
 * (xlsx, csv, pdf) consume.
 *
 * The HIDDEN_KEYS filter must stay in sync with the same set in
 * CostBreakdownTab.jsx + the NOT-IN list in deal_cost_summary_view
 * (migration 125) so the export totals match what the UI shows.
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const HIDDEN_KEYS = new Set([
  'environmental_permits',
  'gutters',
  'professional_photos',
  'staging',
  'water_sewer',
]);

const GROUP_ORDER = ['Land', 'Build', 'Sitework', 'Finishing', 'Other'];

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatCurrency(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '';
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAcres(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '';
  // Up to 4 decimals, trailing zeros trimmed.
  const fixed = Number(n).toFixed(4);
  return fixed.replace(/\.?0+$/, '');
}

function blankIfEmpty(v) {
  if (v == null) return '';
  if (typeof v === 'string' && v.trim() === '') return '';
  return v;
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function slugify(s) {
  return (s || 'deal')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'deal';
}

// ── Normalize export data ─────────────────────────────────────────────────────

/**
 * @param {object} deal           — Deal object with address/county/state/zip/parcelId/acreage/arv
 * @param {Array}  costLines      — Lines from deal_cost_resolved_view (or local calculator state).
 *                                  Each line: { category_key, group_name, label, estimated_amount, sort_order }
 * @returns {{ header, rows, totals }}
 */
export function buildExportData(deal = {}, costLines = []) {
  const visible = (costLines || []).filter(l => l && !HIDDEN_KEYS.has(l.category_key));

  const sorted = [...visible].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group_name || 'Other');
    const gb = GROUP_ORDER.indexOf(b.group_name || 'Other');
    const aRank = ga === -1 ? GROUP_ORDER.length : ga;
    const bRank = gb === -1 ? GROUP_ORDER.length : gb;
    if (aRank !== bRank) return aRank - bRank;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const rows = sorted.map(l => ({
    category: l.group_name || 'Other',
    label: l.label || '',
    amount: Number(l.estimated_amount ?? 0),
  }));

  const totalEstimated = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  // Per spec: All-In = sum of estimated expenses + purchase price.
  // In our schema "Land / Purchase Price" is ALREADY one of the cost lines,
  // so summing the lines is the All-In total. This matches `calcAllIn` in
  // data/deals.js where deal.land is treated as one expense among many.
  const allInCost = totalEstimated;

  const header = [
    { label: 'Address',    value: blankIfEmpty(deal.address) },
    { label: 'County',     value: blankIfEmpty(deal.county) },
    { label: 'State',      value: blankIfEmpty(deal.state) },
    { label: 'Zip',        value: blankIfEmpty(deal.zip) },
    { label: 'Parcel ID',  value: blankIfEmpty(deal.parcelId) },
    { label: 'Acreage',    value: deal.acreage != null && deal.acreage !== '' ? formatAcres(deal.acreage) : '' },
    { label: 'ARV',        value: deal.arv != null && deal.arv !== '' ? Number(deal.arv) : '' },
    { label: 'All-In Cost', value: allInCost },
  ];

  return {
    header,
    rows,
    totals: { allIn: allInCost, totalEstimated },
  };
}

// ── XLSX exporter ─────────────────────────────────────────────────────────────

export function exportToXlsx(deal, costLines) {
  const data = buildExportData(deal, costLines);
  const wb = XLSX.utils.book_new();

  // Build an array-of-arrays so we can control row positions and apply
  // cell-level number formats afterwards.
  const aoa = [];
  data.header.forEach(({ label, value }) => aoa.push([label, value]));
  aoa.push([]); // blank row
  aoa.push(['Line Item', 'Estimated Amount']);
  data.rows.forEach(r => aoa.push([r.label, r.amount]));
  aoa.push(['Total Estimated Expenses', data.totals.totalEstimated]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Currency formatting on ARV + All-In (header rows 7, 8 -> indices 6, 7)
  const arvAddr   = XLSX.utils.encode_cell({ r: 6, c: 1 });
  const allInAddr = XLSX.utils.encode_cell({ r: 7, c: 1 });
  if (ws[arvAddr]   && typeof ws[arvAddr].v   === 'number') ws[arvAddr].z   = '"$"#,##0.00';
  if (ws[allInAddr] && typeof ws[allInAddr].v === 'number') ws[allInAddr].z = '"$"#,##0.00';

  // Acreage cell (row 6, col 1) — up to 4 decimals (xlsx stores it as string,
  // already formatted via formatAcres; leave as-is).

  // Currency format on Estimated Amount column (now column B / index 1) for
  // the table body + total row.
  const tableStartRow = data.header.length + 2; // blank row + header row
  for (let i = 0; i < data.rows.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: tableStartRow + i, c: 1 });
    if (ws[addr]) ws[addr].z = '"$"#,##0.00';
  }
  const totalRowIdx = tableStartRow + data.rows.length;
  const totalAddr   = XLSX.utils.encode_cell({ r: totalRowIdx, c: 1 });
  if (ws[totalAddr]) ws[totalAddr].z = '"$"#,##0.00';

  // Bold styling — XLSX (the SheetJS community build) ignores cell styles
  // unless you ship `xlsx-style`; we set them anyway so they're present for
  // tooling that does read them.
  const boldHeaderCells = [
    'A1','A2','A3','A4','A5','A6','A7','A8',       // metadata labels
    `A${tableStartRow + 1}`, `B${tableStartRow + 1}`, // table header
    `A${totalRowIdx + 1}`, `B${totalRowIdx + 1}`,  // total row
  ];
  boldHeaderCells.forEach(a => { if (ws[a]) ws[a].s = { font: { bold: true } }; });

  // Column widths
  ws['!cols'] = [{ wch: 40 }, { wch: 18 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Cost Breakdown');

  const filename = `${slugify(deal.address)}-cost-breakdown-${todayIso()}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

// ── CSV exporter ──────────────────────────────────────────────────────────────

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCsv(deal, costLines) {
  const data = buildExportData(deal, costLines);
  const lines = [];

  data.header.forEach(({ label, value }) => {
    let v = value;
    if (label === 'ARV' || label === 'All-In Cost') v = value === '' ? '' : Number(value).toFixed(2);
    lines.push(`${csvEscape(label)},${csvEscape(v)}`);
  });
  lines.push('');
  lines.push('Line Item,Estimated Amount');
  data.rows.forEach(r => {
    lines.push(`${csvEscape(r.label)},${r.amount.toFixed(2)}`);
  });
  lines.push(`Total Estimated Expenses,${data.totals.totalEstimated.toFixed(2)}`);

  const csv = lines.join('\r\n');
  const filename = `${slugify(deal.address)}-cost-breakdown-${todayIso()}.csv`;
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
  return filename;
}

// ── PDF exporter ──────────────────────────────────────────────────────────────

// LotLine brand palette (matches tailwind.config.js).
const BRAND = {
  navy:     [26, 35, 50],     // #1a2332 — sidebar / primary
  accent:   [200, 97, 58],    // #c8613a — accent orange
  cream:    [245, 243, 238],  // #f5f3ee — cream
  cardGray: [235, 235, 235],  // #ebebeb — card surface
  muted:    [130, 138, 150],  // muted gray for secondary text
};

// Cache the logo dataURL so subsequent exports skip the fetch.
// We downscale via canvas (keeps the embedded image ~10–30KB instead of
// jsPDF inflating to multi-megabyte bitmaps) and tint every non-transparent
// pixel to cream so the logo reads on the navy banner.
let _logoPromise = null;
function loadLogoDataUrl() {
  if (_logoPromise) return _logoPromise;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return Promise.resolve(null);
  _logoPromise = (async () => {
    try {
      const blob = await fetch('/lotline-logo.png').then(r => r.ok ? r.blob() : null);
      if (!blob) return null;
      const bitmap = await createImageBitmap(blob);
      const targetH = 128;
      const targetW = Math.round((bitmap.width / bitmap.height) * targetH);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      // Draw original, then use 'source-in' to recolor opaque pixels to cream
      // while preserving the alpha mask.
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = `rgb(${BRAND.cream[0]}, ${BRAND.cream[1]}, ${BRAND.cream[2]})`;
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.globalCompositeOperation = 'source-over';
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  })();
  return _logoPromise;
}

export async function exportToPdf(deal, costLines) {
  const data = buildExportData(deal, costLines);
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });

  const pageWidth  = doc.internal.pageSize.getWidth();
  const margin     = 48;
  const bannerH    = 64;

  // ── Brand banner ──────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, pageWidth, bannerH, 'F');

  // Accent orange rule
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, bannerH, pageWidth, 3, 'F');

  // Logo (load + place on the right of the banner)
  const logoDataUrl = await loadLogoDataUrl();
  if (logoDataUrl) {
    try {
      const props = doc.getImageProperties(logoDataUrl);
      const logoH = 32;
      const logoW = (props.width / props.height) * logoH;
      doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - logoW, (bannerH - logoH) / 2, logoW, logoH, undefined, 'FAST');
    } catch (e) {
      // Image failed to decode — proceed without it.
    }
  }

  // Title in cream — vertically centered in the banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.cream);
  doc.text('Cost Breakdown', margin, bannerH / 2 + 6);

  // ── Metadata block ────────────────────────────────────────────────────────
  const metaRows = data.header.map(({ label, value }) => {
    let display = value;
    if (label === 'ARV' || label === 'All-In Cost') display = value === '' ? '' : formatCurrency(value);
    return [label, display];
  });

  autoTable(doc, {
    startY: bannerH + 20,
    head: [],
    body: metaRows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 0, right: 8 } },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 110, textColor: BRAND.navy },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
  });

  // ── Expenses table ────────────────────────────────────────────────────────
  const expensesStartY = doc.lastAutoTable.finalY + 18;
  autoTable(doc, {
    startY: expensesStartY,
    head: [['Line Item', 'Estimated Amount']],
    body: data.rows.map(r => [r.label, formatCurrency(r.amount)]),
    foot: [[
      { content: 'Total Estimated Expenses', styles: { fontStyle: 'bold', halign: 'left' } },
      { content: formatCurrency(data.totals.totalEstimated), styles: { fontStyle: 'bold', halign: 'right' } },
    ]],
    theme: 'striped',
    headStyles: {
      fillColor:  BRAND.navy,
      textColor:  BRAND.cream,
      fontStyle:  'bold',
      halign:     'left',
    },
    alternateRowStyles: { fillColor: BRAND.cardGray },
    footStyles: {
      fillColor: BRAND.accent,
      textColor: BRAND.cream,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 130, halign: 'right' },
    },
    styles: { fontSize: 10, textColor: [40, 40, 40] },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      // Footer accent rule + page number only.
      doc.setFillColor(...BRAND.accent);
      doc.rect(margin, pageHeight - 36, pageWidth - margin * 2, 1, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.muted);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pageWidth - margin,
        pageHeight - 22,
        { align: 'right' },
      );
      doc.setTextColor(0);
    },
  });

  const filename = `${slugify(deal.address)}-cost-breakdown-${todayIso()}.pdf`;
  doc.save(filename);
  return filename;
}

// ── Browser download helper ───────────────────────────────────────────────────

function triggerDownload(blob, filename) {
  if (typeof document === 'undefined') return; // SSR / test safety
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
