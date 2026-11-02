import type { Layout, Settings } from "../../../../shared/layout";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

export function PagePreview({
  layout,
  image,
  settings,
  guides = false,
  interactive = false,
  onGeometryChange,
}: {
  layout: Layout;
  image: string | null;
  settings: Settings;
  guides?: boolean;
  interactive?: boolean;
  onGeometryChange?: (
    key:
      | "header_margin_mm"
      | "footer_margin_mm"
      | "left_margin_mm"
      | "right_margin_mm"
      | "first_baseline_mm",
    value: number,
  ) => void;
}) {
  const slider = (
    key:
      | "header_margin_mm"
      | "footer_margin_mm"
      | "left_margin_mm"
      | "right_margin_mm"
      | "first_baseline_mm",
    label: string,
    value: number,
    max: number,
  ) => ({
    role: "slider" as const,
    tabIndex: 0,
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": max,
    "aria-valuenow": Number(value.toFixed(2)),
    onKeyDown: (event: ReactKeyboardEvent<SVGLineElement>) => {
      const direction =
        event.key === "ArrowUp" || event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowDown" || event.key === "ArrowLeft"
            ? -1
            : 0;
      if (!direction) return;
      event.preventDefault();
      onGeometryChange?.(
        key,
        Math.max(
          0,
          Math.min(max, value + direction * (event.shiftKey ? 5 : 1)),
        ),
      );
    },
  });
  const drag = (
    event: ReactPointerEvent<SVGElement>,
    key:
      | "header_margin_mm"
      | "footer_margin_mm"
      | "left_margin_mm"
      | "right_margin_mm"
      | "first_baseline_mm",
    pageWidth: number,
    pageHeight: number,
  ) => {
    const svg =
      event.currentTarget instanceof SVGSVGElement
        ? event.currentTarget
        : event.currentTarget.ownerSVGElement!;
    const bounds = svg.getBoundingClientRect();
    const pageCoordinate =
      key === "left_margin_mm" || key === "right_margin_mm"
        ? ((event.clientX - bounds.left) / bounds.width) * pageWidth
        : ((event.clientY - bounds.top) / bounds.height) * pageHeight;
    const value =
      key === "right_margin_mm"
        ? pageWidth - pageCoordinate
        : key === "footer_margin_mm"
          ? pageHeight - pageCoordinate
          : pageCoordinate;
    const clamped = Math.max(
      0,
      Math.min(
        key === "left_margin_mm" || key === "right_margin_mm"
          ? pageWidth - 20
          : pageHeight - 20,
        value,
      ),
    );
    onGeometryChange?.(key, Math.round(clamped * 100) / 100);
  };
  return (
    <div className="pages" aria-live="polite">
      {layout.pages.length === 0 && (
        <div className="empty-preview">
          Adjust the settings to display the page.
        </div>
      )}
      {layout.pages.map((page) => (
        <figure className="page-figure" key={page.page_index}>
          <figcaption>
            Page {page.page_index + 1}
            <span>
              {page.width_mm} × {page.height_mm} mm
            </span>
          </figcaption>
          <svg
            className="page"
            role={interactive ? "group" : "img"}
            aria-label={`Document page ${page.page_index + 1}`}
            viewBox={`0 0 ${page.width_mm} ${page.height_mm}`}
            style={{ aspectRatio: `${page.width_mm}/${page.height_mm}` }}
            onPointerMove={
              interactive
                ? (event) => {
                    const key = (event.currentTarget.dataset.dragKey ?? "") as
                      | "header_margin_mm"
                      | "footer_margin_mm"
                      | "left_margin_mm"
                      | "right_margin_mm"
                      | "first_baseline_mm";
                    if (key) drag(event, key, page.width_mm, page.height_mm);
                  }
                : undefined
            }
            onPointerUp={(event) => {
              event.currentTarget.dataset.dragKey = "";
            }}
            onPointerCancel={(event) => {
              event.currentTarget.dataset.dragKey = "";
            }}
          >
            {image && (
              <image
                href={image}
                x="0"
                y="0"
                width={page.width_mm}
                height={page.height_mm}
                preserveAspectRatio="none"
              />
            )}
            {guides && (
              <g className="guides">
                <rect
                  x={settings.left_margin_mm}
                  y={settings.header_margin_mm}
                  width={Math.max(
                    0,
                    page.width_mm -
                      settings.left_margin_mm -
                      settings.right_margin_mm,
                  )}
                  height={Math.max(
                    0,
                    page.height_mm -
                      settings.header_margin_mm -
                      settings.footer_margin_mm,
                  )}
                />
                {Array.from(
                  {
                    length: Math.max(
                      0,
                      Math.floor(
                        (page.height_mm -
                          settings.footer_margin_mm -
                          settings.first_baseline_mm) /
                          settings.line_spacing_mm,
                      ) + 1,
                    ),
                  },
                  (_, index) => (
                    <line
                      key={index}
                      x1={settings.left_margin_mm}
                      x2={page.width_mm - settings.right_margin_mm}
                      y1={
                        settings.first_baseline_mm +
                        index * settings.line_spacing_mm
                      }
                      y2={
                        settings.first_baseline_mm +
                        index * settings.line_spacing_mm
                      }
                    />
                  ),
                )}
              </g>
            )}
            {interactive && (
              <g
                className="edit-guides"
                onPointerDown={(event) => {
                  const target = (event.target as SVGElement).dataset.handle;
                  if (!target) return;
                  event.currentTarget.ownerSVGElement!.dataset.dragKey = target;
                  try {
                    event.currentTarget.ownerSVGElement?.setPointerCapture?.(
                      event.pointerId,
                    );
                  } catch {
                    // Synthetic pointer events in browser tests have no active pointer to capture.
                  }
                  drag(
                    event,
                    target as
                      | "header_margin_mm"
                      | "footer_margin_mm"
                      | "left_margin_mm"
                      | "right_margin_mm"
                      | "first_baseline_mm",
                    page.width_mm,
                    page.height_mm,
                  );
                }}
              >
                <line
                  {...slider(
                    "header_margin_mm",
                    "Top writing boundary",
                    settings.header_margin_mm,
                    page.height_mm - 20,
                  )}
                  data-handle="header_margin_mm"
                  x1="0"
                  x2={page.width_mm}
                  y1={settings.header_margin_mm}
                  y2={settings.header_margin_mm}
                />
                <line
                  {...slider(
                    "footer_margin_mm",
                    "Bottom writing boundary margin",
                    settings.footer_margin_mm,
                    page.height_mm - 20,
                  )}
                  data-handle="footer_margin_mm"
                  x1="0"
                  x2={page.width_mm}
                  y1={page.height_mm - settings.footer_margin_mm}
                  y2={page.height_mm - settings.footer_margin_mm}
                />
                <line
                  {...slider(
                    "left_margin_mm",
                    "Left writing boundary",
                    settings.left_margin_mm,
                    page.width_mm - 20,
                  )}
                  data-handle="left_margin_mm"
                  x1={settings.left_margin_mm}
                  x2={settings.left_margin_mm}
                  y1="0"
                  y2={page.height_mm}
                />
                <line
                  {...slider(
                    "right_margin_mm",
                    "Right writing boundary margin",
                    settings.right_margin_mm,
                    page.width_mm - 20,
                  )}
                  data-handle="right_margin_mm"
                  x1={page.width_mm - settings.right_margin_mm}
                  x2={page.width_mm - settings.right_margin_mm}
                  y1="0"
                  y2={page.height_mm}
                />
                <line
                  {...slider(
                    "first_baseline_mm",
                    "First writing baseline",
                    settings.first_baseline_mm,
                    page.height_mm - 20,
                  )}
                  className="baseline-handle"
                  data-handle="first_baseline_mm"
                  x1={settings.left_margin_mm}
                  x2={page.width_mm - settings.right_margin_mm}
                  y1={settings.first_baseline_mm}
                  y2={settings.first_baseline_mm}
                />
              </g>
            )}
            <g
              className="ink"
              aria-label={page.runs.map((run) => run.text).join("")}
            >
              {page.runs.map((run, index) => (
                <text
                  key={index}
                  transform={`translate(${run.x_mm} ${run.baseline_y_mm}) skewX(${-run.slant_deg})`}
                  x="0"
                  y="0"
                  fontSize={run.font_size_mm}
                  fill={run.ink_color}
                  xmlSpace="preserve"
                  data-baseline-mm={run.baseline_y_mm}
                  data-x-mm={run.x_mm}
                >
                  {run.draw_text}
                </text>
              ))}
            </g>
          </svg>
        </figure>
      ))}
    </div>
  );
}
