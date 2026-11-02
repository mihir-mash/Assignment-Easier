from io import BytesIO
import math
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

FONT_PATH = Path(__file__).resolve().parents[3] / 'frontend/public/fonts/demo.ttf'
pdfmetrics.registerFont(TTFont('InkMatchDemo',str(FONT_PATH)))


def render_pdf(layout: dict) -> bytes:
    buffer = BytesIO()
    document = canvas.Canvas(buffer,invariant=True)
    document.setTitle('InkMatch ink-only export')
    for page in layout['pages']:
        document.setPageSize((page['width_mm']*mm,page['height_mm']*mm))
        for run in page['runs']:
            document.saveState()
            document.translate(run['x_mm']*mm,(page['height_mm']-run['baseline_y_mm'])*mm)
            document.transform(1,0,math.tan(math.radians(run['slant_deg'])),1,0,0)
            document.setFillColor(run['ink_color'])
            document.setFont('InkMatchDemo',run['font_size_mm']*mm)
            document.drawString(0,0,run['draw_text'])
            document.restoreState()
        document.showPage()
    document.save()
    return buffer.getvalue()


def render_calibration_pdf(width_mm: float, height_mm: float, offset_x_mm: float = 0, offset_y_mm: float = 0) -> bytes:
    """Draw a 100 mm reference cross and page-center target, ink only."""
    buffer = BytesIO()
    document = canvas.Canvas(buffer, invariant=True, pagesize=(width_mm * mm, height_mm * mm))
    document.setTitle("InkMatch printer calibration sheet")
    document.setStrokeColorRGB(.12, .2, .16)
    document.setFillColorRGB(.12, .2, .16)
    document.setLineWidth(.25 * mm)

    def cross(x_mm: float, y_mm: float, arm_mm: float = 4) -> None:
        x_mm += offset_x_mm
        y_mm += offset_y_mm
        document.line((x_mm-arm_mm)*mm, (height_mm-y_mm)*mm, (x_mm+arm_mm)*mm, (height_mm-y_mm)*mm)
        document.line(x_mm*mm, (height_mm-y_mm-arm_mm)*mm, x_mm*mm, (height_mm-y_mm+arm_mm)*mm)

    center_x, center_y = width_mm / 2, height_mm / 2
    cross(center_x, center_y)
    document.setFont("Helvetica", 9)
    document.drawCentredString(center_x*mm, (height_mm-center_y-12)*mm, "InkMatch calibration: measure cross center")
    if width_mm >= 125 and height_mm >= 130:
        start_x, start_y = center_x-50, center_y + min(20, height_mm/8)
        for index in range(11):
            x_mm = start_x + index*10 + offset_x_mm
            y_mm = start_y + offset_y_mm
            document.line(x_mm*mm, (height_mm-y_mm)*mm, x_mm*mm, (height_mm-y_mm-2 if index % 5 else height_mm-y_mm-4)*mm)
        document.line((start_x+offset_x_mm)*mm, (height_mm-start_y-offset_y_mm)*mm, (start_x+100+offset_x_mm)*mm, (height_mm-start_y-offset_y_mm)*mm)
        document.drawString((start_x+offset_x_mm)*mm, (height_mm-start_y-offset_y_mm-12)*mm, "100 mm reference. Print at Actual Size / 100%.")
    else:
        document.drawCentredString(center_x*mm, (height_mm-center_y-12)*mm, "Print at Actual Size / 100%.")
    document.showPage()
    document.save()
    return buffer.getvalue()
