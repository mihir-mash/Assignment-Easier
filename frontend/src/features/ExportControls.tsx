import type { useInkMatch } from "../useInkMatch";
export function ExportControls({
  editor,
}: {
  editor: ReturnType<typeof useInkMatch>;
}) {
  const { exporting, settings, layout, download, numeric } = editor;
  return (
    <aside className="control-panel">
      <p className="eyebrow">03 / Preview and Export</p>
      <h2>Ready for real paper.</h2>
      <p className="help">
        Review every page. The PDF contains generated ink only. The paper
        photograph and setup guides stay in the preview.
      </p>
      <h3>Print alignment</h3>
      <div className="field-grid">
        {numeric("offset_x_mm", "X offset (mm)", -30, 30, 0.1)}
        {numeric("offset_y_mm", "Y offset (mm)", -30, 30, 0.1)}
      </div>
      <p className="help">
        Positive X moves ink right. Positive Y moves ink down.
      </p>
      <ol className="print-guide">
        <li>
          Load the same physical paper in the printer, checking feed
          orientation.
        </li>
        <li>
          Select the matching {settings.width_mm} × {settings.height_mm} mm page
          size.
        </li>
        <li>Print at Actual size / 100%. Turn off fit-to-page scaling.</li>
        <li>
          Print one sheet first. Measure any baseline error in mm, then adjust X
          and Y offsets.
        </li>
      </ol>
      <button
        className="primary"
        disabled={
          exporting ||
          !layout.pages.length ||
          layout.warnings.some((warning) =>
            warning.includes("outside the sheet"),
          )
        }
        onClick={() => void download()}
      >
        {exporting ? "Preparing PDF..." : "Download ink-only PDF"}
      </button>
      <p className="help">
        Printer margins and paper feed vary. A physical alignment test is still
        required.
      </p>
    </aside>
  );
}
