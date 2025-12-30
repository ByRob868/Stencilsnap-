import cv2
import numpy as np
from PIL import Image
from io import BytesIO

def make_stencil(image_bytes: bytes) -> bytes:
    img = Image.open(BytesIO(image_bytes)).convert("L")
    img = np.array(img)

    edges = cv2.Canny(img, 80, 160)
    edges = cv2.dilate(edges, None)

    # invert so lines are dark on white
    stencil = 255 - edges

    # convert to purple
    stencil_rgb = np.zeros((stencil.shape[0], stencil.shape[1], 3), dtype=np.uint8)
    stencil_rgb[..., 0] = 180  # R
    stencil_rgb[..., 1] = 80   # G
    stencil_rgb[..., 2] = 255  # B

    mask = stencil < 200
    stencil_rgb[~mask] = [255, 255, 255]

    out = Image.fromarray(stencil_rgb)
    buf = BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()
