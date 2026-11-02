import { useInkMatch } from "./useInkMatch";
import { PagePreview } from "./features/editor/PagePreview";
import { PaperCrop } from "./features/paper/PaperCrop";
import { PaperSetupControls } from "./features/PaperSetupControls";
import { WritingControls } from "./features/WritingControls";
import { ExportControls } from "./features/ExportControls";
const tabs = ["Paper Setup", "Writing Editor", "Preview and Export"];
export function App() {
  const editor = useInkMatch();
  const {
    activeTab,
    setActiveTab,
    health,
    notice,
    setNotice,
    ready,
    settings,
    paper,
    effectiveSettings,
    layout,
    acceptedImage,
    updatePaper,
  } = editor;
  if (!ready)
    return (
      <main className="app-shell">
        <p role="status">Opening your local workspace...</p>
      </main>
    );
  return (
    <main className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setActiveTab(0);
          }}
        >
          <span className="brand-mark">i</span>InkMatch
        </a>
        <span className="connection">{health}</span>
      </header>
      <div className="intro">
        <div>
          <p className="eyebrow">Your paper. Your words.</p>
          <h1>Make room for what you write.</h1>
          <p>
            Prepare your sheet, compose on the page, then print only the ink.
          </p>
        </div>
        <span className="badge">Demo font, Stage 1</span>
      </div>
      <nav className="tabs" role="tablist" aria-label="Document workflow">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            role="tab"
            id={`tab-${index}`}
            aria-selected={activeTab === index}
            aria-controls={`panel-${index}`}
            tabIndex={activeTab === index ? 0 : -1}
            onClick={() => setActiveTab(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                const next = (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                setActiveTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
          >
            <span>0{index + 1}</span>
            {tab}
          </button>
        ))}
      </nav>
      {notice && (
        <div role="status" className="notice">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {layout.warnings.length > 0 && (
        <div role="alert" className="validation">
          {layout.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      <section
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        id={`panel-${activeTab}`}
        className="workspace"
      >
        {activeTab === 0 && (
          <>
            <PaperSetupControls editor={editor} />
            <div className="preview-area">
              {paper && (
                <PaperCrop
                  key={`${paper.id}-${settings.width_mm}-${settings.height_mm}`}
                  paper={paper}
                  widthMm={settings.width_mm}
                  heightMm={settings.height_mm}
                  onChange={updatePaper}
                  onNotice={setNotice}
                />
              )}
              {paper && !acceptedImage && (
                <p className="callout">
                  A confirmed crop is required to show your paper in the editor.
                  After changing the aspect ratio, reprocess the original photo.
                </p>
              )}
              <div className="section-heading">
                <div>
                  <h2>Layout preview</h2>
                  <p>
                    Green guides are for setup only and are excluded from the
                    PDF.
                  </p>
                </div>
              </div>
              <PagePreview
                layout={layout}
                image={acceptedImage}
                settings={effectiveSettings}
                guides
              />
            </div>
          </>
        )}
        {activeTab === 1 && (
          <>
            <WritingControls editor={editor} />
            <div className="preview-area">
              <div className="section-heading">
                <div>
                  <h2>Live on your paper</h2>
                  <p>
                    {layout.pages.length}{" "}
                    {layout.pages.length === 1 ? "page" : "pages"}. Updates as
                    you type.
                  </p>
                </div>
                <span className="badge">
                  {acceptedImage ? "Confirmed paper" : "Blank sheet"}
                </span>
              </div>
              <PagePreview
                layout={layout}
                image={acceptedImage}
                settings={effectiveSettings}
              />
            </div>
          </>
        )}
        {activeTab === 2 && (
          <>
            <ExportControls editor={editor} />
            <div className="preview-area">
              <div className="section-heading">
                <div>
                  <h2>Final document</h2>
                  <p>
                    Same physical layout as your export, with the paper visible
                    for inspection.
                  </p>
                </div>
              </div>
              <PagePreview
                layout={layout}
                image={acceptedImage}
                settings={effectiveSettings}
              />
            </div>
          </>
        )}
      </section>
      <footer>InkMatch · Local workspace · Demo font</footer>
    </main>
  );
}
