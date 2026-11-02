import type { useInkMatch } from "../useInkMatch";
import { NumberField } from "./editor/NumberField";
export function PaperSetupControls({
  editor,
  mode = "paper",
}: {
  editor: ReturnType<typeof useInkMatch>;
  mode?: "paper" | "writing-area";
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
    updateTemplate,
    selectedTemplateId,
    loadTemplate,
    findLines,
    numeric,
  } = editor;
  const updateZone = (
    index: number,
    key: "x_mm" | "y_mm" | "width_mm" | "height_mm",
    value: number,
  ) => {
    setWorkspace((current) => ({
      ...current,
      settings: {
        ...current.settings,
        exclusion_zones_mm: current.settings.exclusion_zones_mm.map(
          (zone, zoneIndex) =>
            zoneIndex === index ? { ...zone, [key]: value } : zone,
        ),
      },
    }));
  };
  return (
    <aside className="control-panel">
      {mode === "paper" && (
        <>
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
                  pageSize(
                    workspace.preset,
                    event.target.value,
                    workspace.custom,
                  )
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
        </>
      )}
      {mode === "writing-area" && (
        <>
          <h3>Writing boundaries</h3>
          <p className="help">
            All measurements are in millimetres from the top or side of the
            sheet.
          </p>
          <div className="field-grid">
            {numeric("header_margin_mm", "Header exclusion (mm)")}
            {!settings.line_baselines_mm.length &&
              numeric("first_baseline_mm", "First baseline (mm)", 1, 999)}
            {!settings.line_baselines_mm.length &&
              numeric("line_spacing_mm", "Line spacing (mm)", 2, 50)}
            {numeric("footer_margin_mm", "Footer exclusion (mm)")}
            {numeric("left_margin_mm", "Left margin (mm)")}
            {numeric("right_margin_mm", "Right margin (mm)")}
          </div>
          {settings.line_baselines_mm.length === 0 ? (
            <button
              onClick={() =>
                setWorkspace((current) => {
                  const count = Math.min(
                    200,
                    Math.floor(
                      (current.settings.height_mm -
                        current.settings.footer_margin_mm -
                        current.settings.first_baseline_mm) /
                        current.settings.line_spacing_mm,
                    ) + 1,
                  );
                  return {
                    ...current,
                    settings: {
                      ...current.settings,
                      line_baselines_mm: Array.from(
                        { length: Math.max(0, count) },
                        (_, index) =>
                          current.settings.first_baseline_mm +
                          index * current.settings.line_spacing_mm,
                      ),
                    },
                  };
                })
              }
            >
              Configure individual baselines
            </button>
          ) : (
            <div className="geometry-list">
              <h3>Individual line baselines (mm)</h3>
              {settings.line_baselines_mm.map((baseline, index) => (
                <div className="geometry-row" key={index}>
                  <NumberField
                    label={`Line ${index + 1} baseline (mm)`}
                    value={baseline}
                    min={1}
                    max={settings.height_mm}
                    step={0.1}
                    onChange={(value) =>
                      setWorkspace((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          line_baselines_mm:
                            current.settings.line_baselines_mm.map(
                              (line, lineIndex) =>
                                lineIndex === index ? value : line,
                            ),
                        },
                      }))
                    }
                  />
                  <button
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() =>
                      setWorkspace((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          line_baselines_mm:
                            current.settings.line_baselines_mm.filter(
                              (_, lineIndex) => lineIndex !== index,
                            ),
                        },
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="actions">
                <button
                  disabled={settings.line_baselines_mm.length >= 200}
                  onClick={() =>
                    setWorkspace((current) => {
                      const last =
                        current.settings.line_baselines_mm.at(-1) ??
                        current.settings.first_baseline_mm;
                      const next = last + current.settings.line_spacing_mm;
                      if (
                        next + current.settings.font_size_mm * 0.3 >
                        current.settings.height_mm -
                          current.settings.footer_margin_mm
                      )
                        return current;
                      return {
                        ...current,
                        settings: {
                          ...current.settings,
                          line_baselines_mm: [
                            ...current.settings.line_baselines_mm,
                            next,
                          ],
                        },
                      };
                    })
                  }
                >
                  Add baseline
                </button>
                <button
                  onClick={() =>
                    setWorkspace((current) => ({
                      ...current,
                      settings: { ...current.settings, line_baselines_mm: [] },
                    }))
                  }
                >
                  Use regular spacing
                </button>
              </div>
            </div>
          )}
          <div className="geometry-list">
            <div className="section-heading">
              <div>
                <h3>Writing exclusion zones</h3>
                <p>
                  Text will flow around these areas. Red overlays are not
                  printed.
                </p>
              </div>
              <button
                disabled={settings.exclusion_zones_mm.length >= 50}
                onClick={() =>
                  setWorkspace((current) => {
                    const x = Math.min(
                      current.settings.left_margin_mm,
                      current.settings.width_mm - 10,
                    );
                    const y = Math.min(
                      Math.max(
                        0,
                        current.settings.first_baseline_mm -
                          current.settings.font_size_mm,
                      ),
                      current.settings.height_mm - 10,
                    );
                    return {
                      ...current,
                      settings: {
                        ...current.settings,
                        exclusion_zones_mm: [
                          ...current.settings.exclusion_zones_mm,
                          {
                            x_mm: x,
                            y_mm: y,
                            width_mm: Math.min(
                              30,
                              current.settings.width_mm - x,
                            ),
                            height_mm: Math.min(
                              12,
                              current.settings.height_mm - y,
                            ),
                          },
                        ],
                      },
                    };
                  })
                }
              >
                Add zone
              </button>
            </div>
            {settings.exclusion_zones_mm.map((zone, index) => (
              <fieldset className="zone-fields" key={index}>
                <legend>Zone {index + 1}</legend>
                <div className="field-grid">
                  <NumberField
                    label="Left (mm)"
                    value={zone.x_mm}
                    min={0}
                    max={settings.width_mm}
                    onChange={(value) => updateZone(index, "x_mm", value)}
                  />
                  <NumberField
                    label="Top (mm)"
                    value={zone.y_mm}
                    min={0}
                    max={settings.height_mm}
                    onChange={(value) => updateZone(index, "y_mm", value)}
                  />
                  <NumberField
                    label="Width (mm)"
                    value={zone.width_mm}
                    min={1}
                    max={settings.width_mm}
                    onChange={(value) => updateZone(index, "width_mm", value)}
                  />
                  <NumberField
                    label="Height (mm)"
                    value={zone.height_mm}
                    min={1}
                    max={settings.height_mm}
                    onChange={(value) => updateZone(index, "height_mm", value)}
                  />
                </div>
                <button
                  onClick={() =>
                    setWorkspace((current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        exclusion_zones_mm:
                          current.settings.exclusion_zones_mm.filter(
                            (_, zoneIndex) => zoneIndex !== index,
                          ),
                      },
                    }))
                  }
                >
                  Delete zone
                </button>
              </fieldset>
            ))}
          </div>
          <button onClick={() => void findLines()} disabled={!acceptedImage}>
            Suggest printed lines
          </button>
          {suggestions && (
            <div className="suggestions">
              <p>
                {suggestions.baseline_ys_mm.length} ruled lines found. Suggested
                spacing:{" "}
                {suggestions.line_spacing_mm?.toFixed(2) ?? "not found"} mm.
              </p>
              <p>
                Suggested side margins: {suggestions.left_margin_mm.toFixed(1)}{" "}
                mm left and {suggestions.right_margin_mm.toFixed(1)} mm right.
                Review these estimates before applying them.
              </p>
              <p>{suggestions.message}</p>
              <button
                onClick={() => {
                  const first = suggestions.baseline_ys_mm.find(
                    (value) =>
                      value >=
                      settings.header_margin_mm + settings.font_size_mm,
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
                      line_baselines_mm: suggestions.baseline_ys_mm.filter(
                        (value, index, rows) =>
                          value >=
                            current.settings.header_margin_mm +
                              current.settings.font_size_mm &&
                          value + current.settings.font_size_mm * 0.3 <=
                            current.settings.height_mm -
                              current.settings.footer_margin_mm &&
                          (index === 0 ||
                            value - rows[index - 1] >=
                              current.settings.font_size_mm * 1.25),
                      ),
                      left_margin_mm: suggestions.left_margin_mm,
                      right_margin_mm: suggestions.right_margin_mm,
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
            <button
              disabled={!selectedTemplateId}
              onClick={() => void updateTemplate()}
            >
              Update selected template
            </button>
            <label className="field">
              Load a template
              <select
                value={selectedTemplateId}
                onChange={(event) => void loadTemplate(event.target.value)}
              >
                <option value="">Choose saved template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} (
                    {template.storage === "sqlite"
                      ? "local library"
                      : "browser"}
                    )
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="primary" onClick={() => setActiveTab(2)}>
            Continue to Write and Edit
          </button>
        </>
      )}
      {mode === "paper" && (
        <button className="primary" onClick={() => setActiveTab(1)}>
          Continue to Configure Writing Area
        </button>
      )}
    </aside>
  );
}
