import { useEffect, useRef, useState } from "react";
import { cropPaper, detectPaper, type Corners } from "../../api";
export type PaperImage = {
  id: string;
  original: string;
  corners: Corners;
  corrected: string | null;
  widthMm: number;
  heightMm: number;
};
export const initialCorners: Corners = [
  [0.05, 0.05],
  [0.95, 0.05],
  [0.95, 0.95],
  [0.05, 0.95],
];
const names = ["Top left", "Top right", "Bottom right", "Bottom left"];

export function PaperCrop({
  paper,
  widthMm,
  heightMm,
  onChange,
  onNotice,
}: {
  paper: PaperImage;
  widthMm: number;
  heightMm: number;
  onChange: (paper: PaperImage) => void;
  onNotice: (notice: string) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  const updateCorners = (corners: Corners) => {
    revision.current++;
    setPending(null);
    onChange({ ...paper, corners, corrected: null });
  };
  const operation = async (kind: "detect" | "crop") => {
    const current = ++revision.current;
    setBusy(true);
    setPending(null);
    try {
      if (kind === "detect") {
        const result = await detectPaper(paper.original);
        if (current !== revision.current) return;
        onChange({ ...paper, corners: result.corners, corrected: null });
        onNotice(result.message);
      } else {
        const result = await cropPaper(
          paper.original,
          paper.corners,
          widthMm,
          heightMm,
        );
        if (current !== revision.current) return;
        setPending(result.image);
        onNotice("Inspect the corrected sheet, then accept the crop.");
      }
    } catch (error) {
      if (current === revision.current)
        onNotice(
          error instanceof Error
            ? error.message
            : "Start the local backend for image processing.",
        );
    } finally {
      setBusy(false);
    }
  };
  const move = (index: number, x: number, y: number) =>
    updateCorners(
      paper.corners.map((point, position) =>
        position === index
          ? [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]
          : point,
      ),
    );
  return (
    <div className="crop-workflow">
      <div className="section-heading">
        <div>
          <h2>Select the actual sheet</h2>
          <p>
            Drag the corners or select a numbered corner and use arrow keys.
            Keep the desk outside the outline.
          </p>
        </div>
        <span className="badge">Review required</span>
      </div>
      <div className="crop-photo">
        <img
          src={paper.original}
          alt="Original paper photograph with surroundings"
          draggable="false"
        />
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-label="Paper corner selection"
        >
          <polygon
            points={paper.corners
              .map((point) => `${point[0] * 1000},${point[1] * 1000}`)
              .join(" ")}
            fill="#75997022"
            stroke="#145d48"
            strokeWidth="3"
          />
          {paper.corners.map((point, index) => (
            <circle
              key={index}
              cx={point[0] * 1000}
              cy={point[1] * 1000}
              r="15"
              fill={selected === index ? "#e7b66b" : "white"}
              stroke="#145d48"
              strokeWidth="4"
              role="button"
              tabIndex={0}
              aria-label={`${names[index]} corner`}
              onFocus={() => setSelected(index)}
              onKeyDown={(event) => {
                const delta = event.shiftKey ? 0.01 : 0.002;
                const offsets: Record<string, [number, number]> = {
                  ArrowLeft: [-delta, 0],
                  ArrowRight: [delta, 0],
                  ArrowUp: [0, -delta],
                  ArrowDown: [0, delta],
                };
                if (offsets[event.key]) {
                  event.preventDefault();
                  move(
                    index,
                    point[0] + offsets[event.key][0],
                    point[1] + offsets[event.key][1],
                  );
                }
              }}
              onPointerDown={(event) => {
                setSelected(index);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                const rect =
                  event.currentTarget.ownerSVGElement!.getBoundingClientRect();
                move(
                  index,
                  (event.clientX - rect.left) / rect.width,
                  (event.clientY - rect.top) / rect.height,
                );
              }}
              onPointerUp={(event) =>
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
            />
          ))}
        </svg>
      </div>
      <div className="corner-fields">
        {paper.corners.map((point, index) => (
          <fieldset key={index}>
            <legend>
              {index + 1}. {names[index]}
            </legend>
            {point.map((value, axis) => (
              <label key={axis}>
                {axis === 0 ? "X" : "Y"} (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step=".1"
                  value={Math.round(value * 1000) / 10}
                  onChange={(event) =>
                    move(
                      index,
                      axis === 0 ? Number(event.target.value) / 100 : point[0],
                      axis === 1 ? Number(event.target.value) / 100 : point[1],
                    )
                  }
                />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="actions">
        <button disabled={busy} onClick={() => void operation("detect")}>
          Detect sheet corners
        </button>
        <button
          disabled={busy}
          onClick={() => {
            revision.current++;
            onChange({ ...paper, corners: initialCorners, corrected: null });
            setPending(null);
          }}
        >
          Reset to original
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void operation("crop")}
        >
          {busy ? "Processing..." : "Preview corrected crop"}
        </button>
      </div>
      {pending && (
        <div className="crop-review">
          <h3>Confirm the corrected sheet</h3>
          <p>
            Check all four edges. If any desk remains, adjust the corners and
            preview again.
          </p>
          <img
            alt="Corrected crop awaiting confirmation"
            src={pending}
            style={{ aspectRatio: `${widthMm}/${heightMm}` }}
          />
          <button
            className="primary"
            onClick={() => {
              onChange({ ...paper, corrected: pending, widthMm, heightMm });
              setPending(null);
              onNotice(
                "Crop accepted. You can still edit the corners or paper configuration.",
              );
            }}
          >
            Accept crop
          </button>
        </div>
      )}
    </div>
  );
}
