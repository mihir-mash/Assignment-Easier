import base64
from io import BytesIO
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.paper.processing import detect_corners,rectify,encode_image,line_suggestions
from tests.paper_fixture import paper_scene


def photo_fixture() -> tuple[np.ndarray,np.ndarray]:
    return paper_scene()


def test_detects_sheet_with_surroundings_and_rectifies_to_physical_ratio() -> None:
    image,expected=photo_fixture()
    detected=detect_corners(image)
    assert detected['confidence']=='suggested'
    normalized=np.array(detected['corners'])
    assert np.max(np.abs(normalized-expected/np.array([1099,899])))<.03
    cropped=rectify(image,detected['corners'],210,297)
    assert cropped.shape[:2]==(1485,1050)
    # Edges sample the actual sheet, rather than the green desk.
    assert np.mean(cropped[15:-15,15:-15])>220
    assert np.mean(cropped[30:60,30:60])>215


def test_uncertain_detection_and_invalid_manual_corners() -> None:
    image=np.full((400,400,3),100,np.uint8)
    assert detect_corners(image)['confidence']=='uncertain'
    with pytest.raises(ValueError,match='non-crossing'):
        rectify(image,[(.1,.1),(.9,.9),(.9,.1),(.1,.9)],210,297)
    with pytest.raises(ValueError):
        rectify(image,[(-.1,0),(1,0),(1,1),(0,1)],210,297)


def test_crop_api_validates_content_and_does_not_implicitly_confirm() -> None:
    client=TestClient(app)
    assert client.post('/api/v1/paper/detect',json={'image':'data:image/png;base64,YmFk'}).status_code==422
    image,corners=photo_fixture()
    data=encode_image(image)
    payload={'image':data,'corners':(corners/np.array([1099,899])).tolist(),'width_mm':160,'height_mm':220}
    result=client.post('/api/v1/paper/crop',json=payload)
    assert result.status_code==200
    assert result.json()['width_px']/result.json()['height_px']==pytest.approx(160/220)
    assert result.json()['image'].startswith('data:image/png;base64,')
    payload['width_mm']=0
    assert client.post('/api/v1/paper/crop',json=payload).status_code==422


def test_line_analysis_is_separate_from_boundary_detection() -> None:
    image=np.full((1000,700,3),255,np.uint8)
    for y in range(200,900,50):cv2.line(image,(40,y),(660,y),(100,100,100),2)
    result=line_suggestions(image,210,300)
    assert len(result['baseline_ys_mm'])==14
    assert result['line_spacing_mm']==pytest.approx(15,abs=.4)
