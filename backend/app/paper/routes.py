from fastapi import APIRouter,HTTPException
from pydantic import BaseModel,Field,ConfigDict
from app.paper.processing import decode_image,detect_corners,rectify,encode_image,line_suggestions

router = APIRouter(prefix='/api/v1/paper')


class ImageRequest(BaseModel):
    model_config = ConfigDict(extra='forbid',allow_inf_nan=False)
    image: str = Field(max_length=14_000_000)


class CropRequest(ImageRequest):
    corners: list[tuple[float,float]] = Field(min_length=4,max_length=4)
    width_mm: float = Field(ge=50,le=1000)
    height_mm: float = Field(ge=50,le=1000)


class LinesRequest(ImageRequest):
    width_mm: float = Field(ge=50,le=1000)
    height_mm: float = Field(ge=50,le=1000)


@router.post('/detect')
def detect(request: ImageRequest) -> dict:
    try:
        return detect_corners(decode_image(request.image))
    except ValueError as error:
        raise HTTPException(422,str(error)) from error


@router.post('/crop')
def crop(request: CropRequest) -> dict:
    try:
        image = rectify(decode_image(request.image),request.corners,request.width_mm,request.height_mm)
        return {'image':encode_image(image),'width_px':image.shape[1],'height_px':image.shape[0]}
    except ValueError as error:
        raise HTTPException(422,str(error)) from error


@router.post('/lines')
def lines(request: LinesRequest) -> dict:
    try:
        return line_suggestions(decode_image(request.image),request.width_mm,request.height_mm)
    except ValueError as error:
        raise HTTPException(422,str(error)) from error
