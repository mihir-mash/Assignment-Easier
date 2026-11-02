import cv2
import numpy as np


def paper_scene() -> tuple[np.ndarray,np.ndarray]:
    image=np.full((900,1100,3),(55,75,65),np.uint8)
    corners=np.array([[260,75],[840,120],[930,805],[170,830]],np.int32)
    sheet=np.full((850,600,3),245,np.uint8)
    for y in range(180,800,35):cv2.line(sheet,(45,y),(565,y),(170,180,190),1)
    # Perspective and mild uneven lighting over a separate desk scene.
    lighting=np.linspace(.90,1,600)[None,:,None]
    sheet=(sheet*lighting).astype(np.uint8)
    source=np.array([[0,0],[599,0],[599,849],[0,849]],np.float32)
    transform=cv2.getPerspectiveTransform(source,corners.astype(np.float32))
    warped=cv2.warpPerspective(sheet,transform,(1100,900))
    mask=np.zeros((900,1100),np.uint8)
    cv2.fillConvexPoly(mask,corners,255)
    image[mask>0]=warped[mask>0]
    cv2.circle(image,(80,100),40,(20,30,120),-1)
    return image,corners
