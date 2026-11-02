import type { useInkMatch } from "../useInkMatch";
import { NumberField } from "./editor/NumberField";
export function PaperSetupControls({
  editor,
}: {
  editor: ReturnType<typeof useInkMatch>;
}) {
  const {
    workspace,
    setWorkspace,
    setActiveTab,
    setNotice,
    templates,
    templateName,
    setTemplateName,
    suggestions,
    setSuggestions,
    settings,
    acceptedImage,
    pageSize,
    upload,
    saveTemplate,
    findLines,
    numeric,
  } = editor;
  return (
    <aside className="control-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 / Paper Setup</p>
          <h2>A sheet that fits</h2>
        </div>
      </div>
      <label className="upload-field">
        Upload paper photo
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(event) => void upload(event)}
        />
        <small>
          JPG, JPEG or PNG. Up to 10 MB. Processed by your local backend.
        </small>
      </label>
      <div className="field-grid">
        <label className="field">
          Paper size
          <select
            value={workspace.preset}
            onChange={(event) =>
              pageSize(
                event.target.value,
                workspace.orientation,
                workspace.custom,
              )
            }
          >
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="Letter">Letter (215.9 × 279.4 mm)</option>
            <option value="Custom">Custom</option>
          </select>
        </label>
        <label className="field">
          Orientation
          <select
            value={workspace.orientation}
            onChange={(event) =>
              pageSize(workspace.preset, event.target.value, workspace.custom)
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
      </div>
      {workspace.preset === "Custom" && (
        <div className="field-grid">
          <NumberField
            label="Custom width (mm)"
            value={workspace.custom[0]}
            min={50}
            max={1000}
            onChange={(value) =>
              pageSize("Custom", workspace.orientation, [
                value,
                workspace.custom[1],
              ])
            }
          />
          <NumberField
            label="Custom height (mm)"
            value={workspace.custom[1]}
            min={50}
            max={1000}
            onChange={(value) =>
              pageSize("Custom", workspace.orientation, [
                workspace.custom[0],
                value,
              ])
            }
          />
        </div>
      )}
      <h3>Writing boundaries</h3>
      <p className="help">
        All measurements are in millimetres from the top or side of the sheet.
      </p>
      <div className="field-grid">
        {numeric("header_margin_mm", "Header exclusion (mm)")}
        {numeric("first_baseline_mm", "First baseline (mm)", 1, 999)}
        {numeric("line_spacing_mm", "Line spacing (mm)", 2, 50)}
        {numeric("footer_margin_mm", "Footer exclusion (mm)")}
        {numeric("left_margin_mm", "Left margin (mm)")}
        {numeric("right_margin_mm", "Right margin (mm)")}
      </div>
      <button onClick={() => void findLines()} disabled={!acceptedImage}>
        Suggest printed lines
      </button>
      {suggestions && (
        <div className="suggestions">
          <p>
            {suggestions.baseline_ys_mm.length} ruled lines found. Suggested
            spacing: {suggestions.line_spacing_mm?.toFixed(2) ?? "not found"}{" "}
            mm.
          </p>
          <p>{suggestions.message}</p>
          <button
            onClick={() => {
              const first = suggestions.baseline_ys_mm.find(
                (value) =>
                  value >= settings.header_margin_mm + settings.font_size_mm,
              );
              if (!first || !suggestions.line_spacing_mm) {
                setNotice(
                  "No usable ruled lines found. Set the baseline and spacing manually.",
                );
                return;
              }
              setWorkspace((current) => ({
                ...current,
                settings: {
                  ...current.settings,
                  first_baseline_mm: first,
                  line_spacing_mm: Math.max(
                    current.settings.font_size_mm * 1.25,
                    suggestions.line_spacing_mm!,
                  ),
                },
              }));
              setSuggestions(null);
            }}
          >
            Apply reviewed line suggestions
          </button>
        </div>
      )}
      <div className="template-section">
        <h3>Reusable templates</h3>
        <label className="field">
          Template name
          <input
            value={templateName}
            maxLength={80}
            onChange={(event) => setTemplateName(event.target.value)}
          />
        </label>
        <button onClick={() => void saveTemplate()}>Save template</button>
        <label className="field">
          Load a template
          <select
            value=""
            onChange={(event) => {
              const saved = templates.find(
                (template) => template.name === event.target.value,
              );
              if (saved) {
                setWorkspace((current) => ({
                  ...saved.workspace,
                  source: current.source,
                }));
                setTemplateName(saved.name);
                setSuggestions(null);
                setNotice(
                  "Template loaded. Current document text is preserved.",
                );
              }
            }}
          >
            <option value="">Choose saved template</option>
            {templates.map((template) => (
              <option key={template.name}>{template.name}</option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary" onClick={() => setActiveTab(1)}>
        Continue to Writing Editor
      </button>
    </aside>
  );
}
