import type { Layout, Settings } from "../../../../shared/layout";

export function PagePreview({
  layout,
  image,
  settings,
  guides = false,
}: {
  layout: Layout;
  image: string | null;
  settings: Settings;
  guides?: boolean;
}) {
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
            role="img"
            aria-label={`Document page ${page.page_index + 1}`}
            viewBox={`0 0 ${page.width_mm} ${page.height_mm}`}
            style={{ aspectRatio: `${page.width_mm}/${page.height_mm}` }}
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
