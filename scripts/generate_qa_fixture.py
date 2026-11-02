"""Generate a reproducible photograph-like test fixture, with desk and perspective."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import cv2
import numpy as np
from tests.paper_fixture import paper_scene

root=Path(__file__).resolve().parents[1]
output=root/'tmp/qa'
output.mkdir(parents=True,exist_ok=True)
image,_=paper_scene()
cv2.imwrite(str(output/'paper-on-desk.png'),image)
