"""Copy the licensed demo font and generate its shared, unhinted advance metrics."""
import json
from pathlib import Path
import shutil

import reportlab
from reportlab.pdfbase.ttfonts import TTFont

root = Path(__file__).resolve().parents[1]
destination = root / 'frontend/public/fonts'
destination.mkdir(parents=True, exist_ok=True)
source = Path(reportlab.__file__).parent / 'fonts'
shutil.copyfile(source / 'VeraIt.ttf', destination / 'demo.ttf')
shutil.copyfile(source / 'bitstream-vera-license.txt', destination / 'LICENSE.txt')
font = TTFont('InkMatchDemo', str(destination / 'demo.ttf'))
metrics = {str(code): width / 1000 for code, width in font.face.charWidths.items()}
(root / 'shared').mkdir(exist_ok=True)
(root / 'shared/font-metrics.json').write_text(json.dumps(metrics, sort_keys=True), encoding='utf-8')
