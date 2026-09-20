#!/usr/bin/env node
/**
 * Render DOCUMENTATION.md into a print-ready PDF.
 *
 * Goes through Chrome so the screenshots, tables and code blocks lay out the way they
 * do on screen, rather than being redrawn by hand.
 *
 *   node scripts/make-pdf.cjs
 */

const { chromium } = require('@playwright/test');
const { marked } = require('marked');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'DOCUMENTATION.md');
const OUT = path.join(ROOT, 'HireLoop-documentation.pdf');

const COVER = `
<section class="cover">
  <div class="cover-kicker">Build with Fastn · Track 04 · Cross-Platform Publisher</div>
  <h1 class="cover-title">HireLoop</h1>
  <p class="cover-sub">Post once, hire anywhere.</p>
  <div class="cover-team">
    <span class="cover-team-label">Team vibe</span>
    <span>Madni Munnay</span><span>Ahmed Malik</span><span>Maimoona Islam</span>
  </div>
  <div class="cover-links">
    hireloop-lilac.vercel.app &nbsp;·&nbsp; github.com/ahmedmalik07/dexterity_fastn
  </div>
</section>
`;

const CSS = `
  @page { size: A4; margin: 16mm 14mm 18mm; }
  @page :first { margin: 0; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", -apple-system, system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.62;
    color: #1b2030;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* --- cover --- */
  .cover {
    height: 297mm;
    padding: 34mm 22mm;
    background: linear-gradient(150deg, #10131c 0%, #1d2740 55%, #2c3f6b 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    page-break-after: always;
  }
  .cover-kicker {
    font-size: 9pt; letter-spacing: .16em; text-transform: uppercase;
    color: #9fb4e6; margin-bottom: 14mm;
  }
  .cover-title { font-size: 58pt; margin: 0; letter-spacing: -2.5px; font-weight: 700; }
  .cover-sub { font-size: 17pt; color: #c9d6f2; margin: 3mm 0 0; font-weight: 300; }
  .cover-team {
    margin-top: 26mm; display: flex; flex-wrap: wrap; gap: 5mm 8mm; align-items: baseline;
    font-size: 11.5pt; color: #eaf0ff;
  }
  .cover-team-label {
    font-size: 8.5pt; letter-spacing: .16em; text-transform: uppercase; color: #8fa6dd;
    width: 100%;
  }
  .cover-links {
    margin-top: auto; font-size: 9pt; color: #8fa6dd; border-top: 1px solid #ffffff22;
    padding-top: 5mm;
  }

  /* --- headings --- */
  h1, h2, h3 { letter-spacing: -.02em; line-height: 1.25; }
  h1 { font-size: 21pt; margin: 0 0 4mm; }
  h2 {
    font-size: 15pt; margin: 11mm 0 3mm; padding-bottom: 2mm;
    border-bottom: 1.5px solid #e3e8f2; page-break-after: avoid;
  }
  h3 { font-size: 12pt; margin: 7mm 0 2mm; page-break-after: avoid; }
  p { margin: 0 0 3.2mm; }
  strong { color: #111827; }

  /* --- images --- */
  img {
    max-width: 100%; display: block; margin: 5mm auto 3mm;
    border: 1px solid #dfe4ee; border-radius: 6px;
  }
  /* Tall mobile screenshots must not eat a whole page. */
  img[src*="mobile"] { max-width: 58mm; }
  img[src*="landing"], img[src*="capture"], img[src*="empty"] { max-width: 150mm; }

  /* --- tables --- */
  table {
    width: 100%; border-collapse: collapse; margin: 4mm 0 5mm;
    font-size: 9.2pt; page-break-inside: avoid;
  }
  th {
    text-align: left; background: #f3f6fb; border-bottom: 1.5px solid #dbe2ee;
    padding: 2.4mm 3mm; font-weight: 600; color: #35405a;
  }
  td { padding: 2.4mm 3mm; border-bottom: 1px solid #eef1f7; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }

  /* --- code --- */
  code {
    font-family: "Cascadia Mono", Consolas, monospace; font-size: 8.8pt;
    background: #f1f4fa; padding: .4mm 1.4mm; border-radius: 3px; color: #1f3b73;
  }
  pre {
    background: #131722; color: #e8edf8; padding: 4mm 5mm; border-radius: 6px;
    font-size: 8.4pt; line-height: 1.5; overflow: hidden; white-space: pre-wrap;
    word-break: break-word; page-break-inside: avoid; margin: 3mm 0 5mm;
  }
  pre code { background: none; color: inherit; padding: 0; font-size: inherit; }

  blockquote {
    margin: 5mm 0; padding: 3.5mm 5mm; background: #eef3ff;
    border-left: 3px solid #3b62c4; border-radius: 0 5px 5px 0;
    font-size: 11pt; color: #1c2f5c;
  }
  blockquote p { margin: 0; }

  hr { border: 0; border-top: 1px solid #e3e8f2; margin: 8mm 0; }
  ul, ol { margin: 0 0 3.5mm; padding-left: 5.5mm; }
  li { margin-bottom: 1.4mm; }
  a { color: #2450b8; text-decoration: none; }

  h2, h3 { page-break-after: avoid; }
  img, pre, blockquote { page-break-inside: avoid; }
`;

(async () => {
  if (!fs.existsSync(SOURCE)) throw new Error('DOCUMENTATION.md not found');

  let markdown = fs.readFileSync(SOURCE, 'utf8');

  // The cover carries the title, team and links, so drop that header from the body.
  markdown = markdown.replace(/^# HireLoop[\s\S]*?\n---\n/, '');

  const coverDoc = `<!doctype html><html><head><meta charset="utf-8">
<style>${CSS}</style></head><body>${COVER}</body></html>`;
  const bodyDoc = `<!doctype html><html><head><meta charset="utf-8">
<style>${CSS}</style></head><body><main>${marked.parse(markdown)}</main></body></html>`;

  const coverHtml = path.join(ROOT, '.cover.html');
  const bodyHtml = path.join(ROOT, '.body.html');
  fs.writeFileSync(coverHtml, coverDoc);
  fs.writeFileSync(bodyHtml, bodyDoc);

  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();

  const load = async (file) => {
    await page.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    // Every screenshot must be decoded before printing, or it prints as a blank frame.
    await page.waitForFunction(
      () => [...document.images].every((img) => img.complete && img.naturalWidth > 0),
      null,
      { timeout: 60000 },
    );
  };

  // The cover prints on its own, so it carries no page number or running footer.
  await load(coverHtml);
  await page.pdf({
    path: path.join(ROOT, '.cover.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  await load(bodyHtml);
  await page.pdf({
    path: path.join(ROOT, '.body.pdf'),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#9aa3b5;
      font-family:'Segoe UI',sans-serif;padding:0 14mm;display:flex;justify-content:space-between">
      <span>HireLoop · Team vibe</span><span class="pageNumber"></span></div>`,
    margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
  });

  await browser.close();
  fs.unlinkSync(coverHtml);
  fs.unlinkSync(bodyHtml);
  console.log('rendered cover and body — run scripts/merge-pdf.py to finish');
})().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
