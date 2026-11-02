import type { useInkMatch } from "../useInkMatch";
export function ExportControls({
  editor,
}: {
  editor: ReturnType<typeof useInkMatch>;
}) {
  const {
    exporting,
    settings,
    layout,
    download,
    numeric,
    calibrations,
    calibrationName,
    setCalibrationName,
    saveCalibration,
    downloadCalibration,
    setWorkspace,
  } = editor;
  return (
    <aside className="control-panel">
      <p className="eyebrow">04 / Preview and Export</p>
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
        Positive X moves ink right. Positive Y moves ink down. Offsets adjust
        exported ink only; they do not change the saved paper or writing area.
      </p>
      <label className="field">
        Saved printer profile
        <select
          value=""
          onChange={(event) => {
            const item = calibrations.find(
              (profile) => profile.name === event.target.value,
            );
            if (item)
              setWorkspace((current) => ({
                ...current,
                settings: {
                  ...current.settings,
                  offset_x_mm: item.offset_x_mm,
                  offset_y_mm: item.offset_y_mm,
                },
              }));
          }}
        >
          <option value="">Choose saved offsets</option>
          {calibrations.map((item) => (
            <option key={item.name}>{item.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Printer profile name
        <input
          value={calibrationName}
          maxLength={80}
          onChange={(event) => setCalibrationName(event.target.value)}
        />
      </label>
      <button onClick={() => void saveCalibration()}>
        Save current X/Y offsets
      </button>
      <button onClick={() => void downloadCalibration()}>
        Download calibration PDF
      </button>
      <p className="help">
        The calibration sheet prints a center cross and a 100 mm ruler. Check
        that the ruler measures 100 mm before using the cross to tune alignment.
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
          Print the calibration sheet first. If its mark is X mm too far right,
          set X to the negative of that error. If it is Y mm too low, set Y to
          the negative of that error. Save the profile and repeat until the mark
          aligns.
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
