"""Python adapter to the exact layout engine used offline in React."""
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]


def run_shared(payload: dict[str, object]) -> object:
    result = subprocess.run(['node', '--disable-warning=ExperimentalWarning', str(ROOT / 'shared/cli.ts')], input=json.dumps(payload), capture_output=True, text=True, encoding='utf-8', timeout=20, cwd=ROOT, check=True)
    return json.loads(result.stdout)


@dataclass(frozen=True)
class LayoutSettings:
    font_size_mm: float = 5.0
    letter_spacing_mm: float = .15
    word_spacing_mm: float = .6
    first_baseline_mm: float = 40.0
    line_spacing_mm: float = 8.0
    left_margin_mm: float = 20.0
    right_margin_mm: float = 20.0
    footer_margin_mm: float = 18.0
    header_margin_mm: float = 25.0
    equation_mode: bool = False
    ink_color: str = '#263832'
    slant_deg: float = 0.0
    offset_x_mm: float = 0.0
    offset_y_mm: float = 0.0


@dataclass(frozen=True)
class LayoutRun:
    text: str
    draw_text: str
    x_mm: float
    baseline_y_mm: float
    width_mm: float
    font_size_mm: float
    source_range: tuple[int, int]
    kind: str
    ink_color: str
    slant_deg: float


@dataclass(frozen=True)
class LayoutPage:
    page_index: int
    width_mm: float
    height_mm: float
    runs: list[LayoutRun]
    warnings: list[str]


def layout_result(source_text: str, settings: LayoutSettings, width_mm: float, height_mm: float) -> dict:
    return run_shared({'source_text':source_text,'width_mm':width_mm,'height_mm':height_mm,**asdict(settings)})


def layout_document(source_text: str, settings: LayoutSettings, width_mm: float = 210, height_mm: float = 297) -> list[LayoutPage]:
    result = layout_result(source_text,settings,width_mm,height_mm)
    return [LayoutPage(page['page_index'],page['width_mm'],page['height_mm'],[LayoutRun(**run) for run in page['runs']],result['warnings']) for page in result['pages']]
