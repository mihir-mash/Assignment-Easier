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
