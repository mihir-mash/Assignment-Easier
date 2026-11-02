import base64
from io import BytesIO
import warnings
import cv2
import numpy as np
from PIL import Image,ImageOps,UnidentifiedImageError


def decode_image(data_url: str) -> np.ndarray:
    try:
        header,content = data_url.split(',',1)
        if header not in ('data:image/jpeg;base64','data:image/png;base64'):
            raise ValueError('Choose a JPG, JPEG or PNG image.')
        raw = base64.b64decode(content,validate=True)
        if len(raw)>10*1024*1024:
            raise ValueError('Image exceeds 10 MB.')
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as image:
                if image.format not in ('JPEG','PNG'):
                    raise ValueError('Image contents must be JPEG or PNG.')
                if max(image.size)>8000 or image.width*image.height>24_000_000 or min(image.size)<100:
                    raise ValueError('Image dimensions must be at least 100 pixels, at most 8,000 per side and 24 megapixels.')
                return cv2.cvtColor(np.array(ImageOps.exif_transpose(image).convert('RGB')),cv2.COLOR_RGB2BGR)
    except (UnidentifiedImageError,OSError,Image.DecompressionBombError,Image.DecompressionBombWarning,base64.binascii.Error) as error:
        raise ValueError('Cannot read this image. Choose a valid JPG or PNG.') from error


def encode_image(image: np.ndarray) -> str:
    _,encoded = cv2.imencode('.png',image)
    return 'data:image/png;base64,'+base64.b64encode(encoded).decode('ascii')


def detect_corners(image: np.ndarray) -> dict:
    height,width = image.shape[:2]
    scale = min(1,1000/max(height,width))
    small = cv2.resize(image,None,fx=scale,fy=scale)
    gray = cv2.cvtColor(small,cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray,(5,5),0)
    edge = cv2.morphologyEx(cv2.Canny(blur,35,110),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    _,mask = cv2.threshold(blur,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    candidates = []
    for binary in (edge,mask):
        contours,_ = cv2.findContours(binary,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            area = cv2.contourArea(contour)
            fraction = area/(small.shape[0]*small.shape[1])
            if not .08<fraction<.96:
                continue
            polygon = cv2.approxPolyDP(contour,.02*cv2.arcLength(contour,True),True)
            if len(polygon)==4 and cv2.isContourConvex(polygon):
                points = polygon.reshape(4,2).astype(float)
                center = points.mean(axis=0)
                points = points[np.argsort(np.arctan2(points[:,1]-center[1],points[:,0]-center[0]))]
                points = np.roll(points,-np.argmin(points.sum(axis=1)),axis=0)
                candidates.append((area,points))
    if not candidates:
        return {'corners':[[.05,.05],[.95,.05],[.95,.95],[.05,.95]],'confidence':'uncertain','message':'No reliable sheet boundary found. Adjust all four corners before cropping.'}
    _,points = max(candidates,key=lambda item:item[0])
    normalized = points/np.array([small.shape[1]-1,small.shape[0]-1])
    return {'corners':normalized.tolist(),'confidence':'suggested','message':'Suggested boundary only. Inspect each corner and confirm the crop.'}


def rectify(image: np.ndarray,corners: list[tuple[float,float]],width_mm: float,height_mm: float) -> np.ndarray:
    points = np.array(corners,dtype=np.float32)
    if points.shape!=(4,2) or not np.isfinite(points).all() or np.any(points<0) or np.any(points>1):
        raise ValueError('Select four corners inside the photo.')
    if not cv2.isContourConvex(points.reshape(4,1,2)) or cv2.contourArea(points)<.01:
        raise ValueError('Corners must form a non-crossing sheet in top-left, top-right, bottom-right, bottom-left order.')
    if cv2.contourArea(points,oriented=True)<=0:
        raise ValueError('Corners must follow clockwise order from top left.')
    height,width = image.shape[:2]
    source = points*np.array([width-1,height-1],dtype=np.float32)
    pixels_per_mm = min(5,2000/max(width_mm,height_mm))
    width_px,height_px = round(width_mm*pixels_per_mm),round(height_mm*pixels_per_mm)
    target = np.array([[0,0],[width_px-1,0],[width_px-1,height_px-1],[0,height_px-1]],np.float32)
    transform = cv2.getPerspectiveTransform(source.astype(np.float32),target)
    return cv2.warpPerspective(image,transform,(width_px,height_px),flags=cv2.INTER_CUBIC)


def line_suggestions(image: np.ndarray,width_mm: float,height_mm: float) -> dict:
    gray = cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    ink = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_MEAN_C,cv2.THRESH_BINARY_INV,31,12)
    horizontal = cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((1,max(30,gray.shape[1]//3)),np.uint8))
    rows = np.flatnonzero((horizontal>0).sum(axis=1)>gray.shape[1]*.35)
    groups = np.split(rows,np.where(np.diff(rows)>2)[0]+1) if len(rows) else []
    baselines = [float(group.mean()/gray.shape[0]*height_mm) for group in groups if len(group)]
    spacing = float(np.median(np.diff(baselines))) if len(baselines)>1 else None
    return {'baseline_ys_mm':baselines,'line_spacing_mm':spacing,'left_margin_mm':width_mm*.1,'right_margin_mm':width_mm*.1,'message':'Review suggestions before applying. Current manual settings remain unchanged.'}
