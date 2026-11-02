from dataclasses import dataclass

from app.math.parser import VisualToken, parse_visual_tokens


@dataclass(frozen=True)
class LayoutSettings:
    font_size_mm: float = 6.0
    letter_spacing_mm: float = 0.4
    word_spacing_mm: float = 1.4
    first_baseline_mm: float = 45.0
    line_spacing_mm: float = 8.0
    left_margin_mm: float = 22.0
    right_margin_mm: float = 18.0
    footer_margin_mm: float = 18.0
    equation_mode: bool = True
    ink_color: str = "#263832"
    offset_x_mm: float = 0.0
    offset_y_mm: float = 0.0


@dataclass(frozen=True)
class LayoutRun:
    text: str
    x_mm: float
    baseline_y_mm: float
    width_mm: float
    font_size_mm: float
    source_range: tuple[int, int]
    kind: str
    ink_color: str


@dataclass(frozen=True)
class LayoutPage:
    page_index: int
    width_mm: float
    height_mm: float
    runs: list[LayoutRun]
    warnings: list[str]


def _token_width(token: VisualToken, settings: LayoutSettings) -> float:
    if token.text == "\n":
        return 0.0
    base_width = settings.font_size_mm * (0.35 if token.text == " " else 0.55)
    spacing = 0.0 if token.text == " " else settings.letter_spacing_mm
    return (base_width + spacing) * token.scale + (settings.word_spacing_mm if token.text == " " else 0.0)


def layout_document(source_text: str, settings: LayoutSettings, width_mm: float = 210.0, height_mm: float = 297.0) -> list[LayoutPage]:
    tokens = parse_visual_tokens(source_text, settings.equation_mode)
    usable_right = width_mm - settings.right_margin_mm
    baseline_y = settings.first_baseline_mm + settings.offset_y_mm
    x_mm = settings.left_margin_mm + settings.offset_x_mm
    page_index = 0
    pages: list[LayoutPage] = [LayoutPage(page_index, width_mm, height_mm, [], [])]

    def new_line() -> None:
        nonlocal baseline_y, x_mm, page_index
        baseline_y += settings.line_spacing_mm
        x_mm = settings.left_margin_mm + settings.offset_x_mm
        if baseline_y > height_mm - settings.footer_margin_mm:
            page_index += 1
            baseline_y = settings.first_baseline_mm + settings.offset_y_mm
            pages.append(LayoutPage(page_index, width_mm, height_mm, [], []))

    for token in tokens:
        if token.text == "\n":
            new_line()
            continue
        token_width = _token_width(token, settings)
        if x_mm + token_width > usable_right and x_mm > settings.left_margin_mm + settings.offset_x_mm:
            new_line()
        pages[-1].runs.append(LayoutRun(token.text, x_mm, baseline_y, token_width, settings.font_size_mm * token.scale, (token.source_start, token.source_end), token.kind, settings.ink_color))
        x_mm += token_width
    return pages
