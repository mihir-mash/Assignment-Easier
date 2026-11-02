import type { useInkMatch } from "../useInkMatch";
export function WritingControls({
  editor,
}: {
  editor: ReturnType<typeof useInkMatch>;
}) {
  const {
    setWorkspace,
    equationMode,
    setEquationMode,
    setActiveTab,
    settings,
    source,
    updateSettings,
    numeric,
  } = editor;
  return (
    <aside className="control-panel">
      <p className="eyebrow">03 / Write and Edit</p>
      <h2>Words, placed with care.</h2>
      <label className="field">
        Your text
        <textarea
          value={source}
          maxLength={20000}
          rows={10}
          onChange={(event) =>
            setWorkspace((current) => ({
              ...current,
              source: event.target.value,
            }))
          }
          spellCheck
        />
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={equationMode}
          onChange={(event) => setEquationMode(event.target.checked)}
        />
        Equation Mode
      </label>
      <p className="help">
        Off by default each session. Supports x^2, a_1 and signed integers in
        braces. Your source text stays intact.
      </p>
      <h3>Writing style</h3>
      <p className="help">
        Temporary demo italic font. Personal handwriting training is planned for
        Stage 2.
      </p>
      <div className="field-grid">
        {numeric("font_size_mm", "Writing size (mm)", 1, 20, 0.25)}
        {numeric("letter_spacing_mm", "Letter spacing (mm)", 0, 5, 0.05)}
        {numeric("word_spacing_mm", "Word spacing (mm)", 0, 15, 0.1)}
        {numeric("slant_deg", "Slant (degrees)", -25, 25, 1)}
        <label className="field">
          Ink colour
          <input
            type="color"
            value={settings.ink_color}
            onChange={(event) =>
              updateSettings("ink_color", event.target.value)
            }
          />
        </label>
      </div>
      <button className="primary" onClick={() => setActiveTab(2)}>
        Review and export
      </button>
    </aside>
  );
}
