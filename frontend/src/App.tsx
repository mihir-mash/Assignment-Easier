import { ChangeEvent, useEffect, useState } from 'react';
import { exportPdf, getHealth, getLayout, LayoutResponse } from './api';

const sampleText = 'A clear page, written with intention.\n\nTry x^2 + y^2 = z^2';
const templateStorageKey = 'inkmatch.stage1.template';

type TemplateSettings = { firstBaselineMm: number; lineSpacingMm: number; leftMarginMm: number; rightMarginMm: number; offsetXmm: number; offsetYmm: number; imageUrl: string | null };
const defaultTemplate: TemplateSettings = { firstBaselineMm: 45, lineSpacingMm: 8, leftMarginMm: 22, rightMarginMm: 18, offsetXmm: 0, offsetYmm: 0, imageUrl: null };

export function App() {
  const [sourceText, setSourceText] = useState(sampleText);
  const [equationMode, setEquationMode] = useState(true);
  const [health, setHealth] = useState<'checking' | 'ready' | 'offline'>('checking');
  const [template, setTemplate] = useState<TemplateSettings>(() => {
    const saved = localStorage.getItem(templateStorageKey);
    return saved ? { ...defaultTemplate, ...JSON.parse(saved) as Partial<TemplateSettings> } : defaultTemplate;
  });
  const [notice, setNotice] = useState('');
  const [layout, setLayout] = useState<LayoutResponse | null>(null);

  useEffect(() => {
    getHealth().then(() => setHealth('ready')).catch(() => setHealth('offline'));
  }, []);

  useEffect(() => {
    if (health !== 'ready') return;
    getLayout({ source_text: sourceText, equation_mode: equationMode, first_baseline_mm: template.firstBaselineMm, line_spacing_mm: template.lineSpacingMm, left_margin_mm: template.leftMarginMm, right_margin_mm: template.rightMarginMm })
      .then(setLayout).catch(() => setLayout(null));
  }, [health, sourceText, equationMode, template.firstBaselineMm, template.lineSpacingMm, template.leftMarginMm, template.rightMarginMm]);

  const visualText = layout ? layout.pages.flatMap((page) => page.runs.map((run) => run.text)).join('') : equationMode ? sourceText.replace(/\^2/g, '²').replace(/_([0-9])/g, '₍$1₎') : sourceText;
  const updateTemplate = (key: keyof TemplateSettings, value: number) => setTemplate((current) => ({ ...current, [key]: value }));
  const handlePaperUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setNotice('Please choose a JPG or PNG image.'); return; }
    if (file.size > 10 * 1024 * 1024) { setNotice('That image is larger than the 10 MB Stage 1 limit.'); return; }
    setNotice('Paper image loaded locally.');
    setTemplate((current) => ({ ...current, imageUrl: URL.createObjectURL(file) }));
  };
  const saveTemplate = () => { localStorage.setItem(templateStorageKey, JSON.stringify(template)); setNotice('Template saved in this browser.'); };
  const handleExport = async () => {
    try {
      const blob = await exportPdf({ source_text: sourceText, equation_mode: equationMode, first_baseline_mm: template.firstBaselineMm, line_spacing_mm: template.lineSpacingMm, left_margin_mm: template.leftMarginMm, right_margin_mm: template.rightMarginMm, offset_x_mm: template.offsetXmm, offset_y_mm: template.offsetYmm });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'inkmatch-ink-only.pdf'; link.click(); URL.revokeObjectURL(link.href); setNotice('Ink-only PDF downloaded. Print at Actual size / 100%.');
    } catch { setNotice('PDF export is unavailable. Check that the local backend is running.'); }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✦</span><span>InkMatch</span></div>
        <div className="status-pill"><span className={`status-dot ${health}`} />{health === 'ready' ? 'Local workspace ready' : health === 'offline' ? 'Backend offline' : 'Connecting…'}</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Stage 1 · paper-first writing</p>
          <h1>Make typed words<br /><em>belong on paper.</em></h1>
          <p className="lede">Set up the sheet you already own, write in a clearly labeled demo style, and keep every printable mark under your control.</p>
        </div>
        <div className="hero-note"><span>01</span><p>Upload a blank sheet<br />to begin your template.</p></div>
      </section>

      <section className="workspace" aria-label="InkMatch editor workspace">
        <aside className="setup-panel">
          <div className="panel-heading"><div><p className="eyebrow">Workspace</p><h2>Set up your sheet</h2></div><span className="step-count">1 / 3</span></div>
          <div className="setup-card upload-card">
            <div className="upload-icon">↑</div><div><strong>Upload blank paper</strong><p>JPG, PNG · max 10 MB</p></div><label className="secondary-button">Choose file<input className="file-input" type="file" accept="image/jpeg,image/png" onChange={handlePaperUpload} /></label>
          </div>
          <div className="field-grid"><label>Paper size<select defaultValue="A4"><option>A4 · 210 × 297 mm</option><option>Letter · 216 × 279 mm</option><option>Custom size</option></select></label><label>Orientation<select defaultValue="Portrait"><option>Portrait</option><option>Landscape</option></select></label></div>
          <div className="setup-card detect-card"><div className="detect-badge">◎</div><div><strong>Auto-detection assist</strong><p>Line and margin suggestions will stay editable.</p></div><button className="text-button" type="button" onClick={() => setNotice('Auto-detection is queued for the paper-analysis task; your manual settings remain authoritative.')}>Configure →</button></div>
          <div className="layout-fields"><p className="eyebrow">Manual layout corrections · mm</p><div className="field-grid"><label>First baseline<input type="number" min="1" max="296" value={template.firstBaselineMm} onChange={(event) => updateTemplate('firstBaselineMm', Number(event.target.value))} /></label><label>Line spacing<input type="number" min="2" max="30" value={template.lineSpacingMm} onChange={(event) => updateTemplate('lineSpacingMm', Number(event.target.value))} /></label><label>Left margin<input type="number" min="0" max="100" value={template.leftMarginMm} onChange={(event) => updateTemplate('leftMarginMm', Number(event.target.value))} /></label><label>Right margin<input type="number" min="0" max="100" value={template.rightMarginMm} onChange={(event) => updateTemplate('rightMarginMm', Number(event.target.value))} /></label></div><div className="save-row"><button className="text-button" type="button" onClick={saveTemplate}>Save template</button><span>Saved layouts reload automatically.</span></div></div>
          <div className="panel-footer"><p><span className="lock">⌁</span> Images stay in your local workspace.</p>{notice && <p className="notice" role="status">{notice}</p>}<button className="primary-button" type="button" onClick={() => setNotice('Editor settings are ready. Continue with your text when the paper looks aligned.')}>Continue to editor <span>→</span></button></div>
        </aside>

        <section className="editor-panel">
          <div className="editor-toolbar"><div><span className="live-dot" />Live preview <span className="muted">· Demo handwriting</span></div><button className="export-button" type="button" onClick={handleExport}>Export ink-only PDF <span>↓</span></button></div>
          <div className="paper-stage"><div className="paper-placeholder" style={template.imageUrl ? { backgroundImage: `url(${template.imageUrl})` } : undefined}><div className="paper-lines" /> <div className="paper-content"><div className="paper-label">{template.imageUrl ? 'UPLOADED PAPER PREVIEW' : 'BLANK PAPER PREVIEW'}</div><div className="ink-preview">{visualText.split('\n').map((line, index) => <div key={`${line}-${index}`}>{line || '\u00a0'}</div>)}</div></div><div className="paper-corner">A4<br /><span>210 × 297 mm</span></div></div></div>
          <div className="editor-controls"><label className="text-control">Your text<textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={3} /></label><div className="control-stack"><label>Ink color<input type="color" defaultValue="#263832" /></label><label>Size<input type="range" min="3" max="10" defaultValue="6" /></label><label className="toggle-label">Equation Mode <button className={`toggle ${equationMode ? 'on' : ''}`} aria-pressed={equationMode} type="button" onClick={() => setEquationMode((value) => !value)}><span /></button></label></div></div>
          <p className="editor-disclaimer">Demo handwriting is a temporary Stage 1 renderer — it does not learn or reproduce a personal handwriting profile.</p>
        </section>
      </section>
    </main>
  );
}
