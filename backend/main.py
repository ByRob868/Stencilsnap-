from fastapi import FastAPI, File, UploadFile, Query
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
from PIL import Image
import io
from skimage.morphology import skeletonize

app = FastAPI(title="StencilSnap API")

# CORS voor je Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later strakker zetten
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PURPLE = (140, 90, 255)  # StencilSnap paars (RGB)


def clamp(v, a, b):
    return max(a, min(b, v))


def pil_to_bgr(pil_img: Image.Image) -> np.ndarray:
    rgb = np.array(pil_img.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    return bgr


def bgr_to_png_bytes(bgr: np.ndarray) -> bytes:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    buf = io.BytesIO()
    pil.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def add_halftone_shading(gray: np.ndarray, strength: float) -> np.ndarray:
    """
    gray: 0..255
    returns: mask 0/255 (waar shading moet komen)
    """
    if strength <= 0:
        return np.zeros_like(gray)

    # compress highlights zodat shading alleen in donkere zones komt
    g = gray.astype(np.float32) / 255.0
    g = np.power(g, 0.75)  # midtones iets omlaag -> meer controle
    inv = 1.0 - g  # donker = hoog

    # halftone via downsample + threshold terug
    h, w = gray.shape
    block = int(clamp(10 - strength * 6, 4, 10))  # strength 0..1
    small = cv2.resize(inv, (w // block, h // block), interpolation=cv2.INTER_AREA)
    # hard threshold op small -> stippen
    thresh = 0.55
    dots = (small > thresh).astype(np.uint8) * 255
    dots = cv2.resize(dots, (w, h), interpolation=cv2.INTER_NEAREST)

    # soften + cleanup
    dots = cv2.GaussianBlur(dots, (3, 3), 0)
    dots = (dots > 80).astype(np.uint8) * 255
    return dots


def high_quality_stencil(bgr: np.ndarray, line_weight: int, detail: int) -> np.ndarray:
    """
    Core stencil pipeline.
    - line_weight: 1..8
    - detail: 1..8  (meer detail = meer lijnen + meer shading)
    """
    line_weight = clamp(int(line_weight), 1, 8)
    detail = clamp(int(detail), 1, 8)

    # normalize size (voorkomt rare artifacts)
    h, w = bgr.shape[:2]
    max_side = max(h, w)
    scale = 1400 / max_side if max_side > 1400 else 1.0
    if scale != 1.0:
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # grayscale
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # denoise + contrast
    # Bilateral houdt edges scherp
    den = cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    con = clahe.apply(den)

    # unsharp (detail opvoeren)
    blur = cv2.GaussianBlur(con, (0, 0), 1.0)
    sharp = cv2.addWeighted(con, 1.35, blur, -0.35, 0)

    # EDGES (Canny) - detail bepaalt gevoeligheid
    # detail laag = minder edges, detail hoog = meer edges
    t1 = int(40 + (8 - detail) * 6)   # detail hoog => lager threshold => meer edges
    t2 = int(120 + (8 - detail) * 8)
    edges = cv2.Canny(sharp, t1, t2)

    # adaptive threshold (solid lines)
    # detail hoog => kleinere block => meer lokaal detail
    block = int(clamp(31 - detail * 2, 15, 31))
    if block % 2 == 0:
        block += 1
    th = cv2.adaptiveThreshold(
        sharp, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=block,
        C=2
    )
    # th is wit/zwart; we willen lijnen = zwart
    th_inv = 255 - th

    # combine: edges + threshold (lijnen)
    combo = cv2.bitwise_or(edges, th_inv)

    # cleanup: remove speckles
    kernel = np.ones((3, 3), np.uint8)
    combo = cv2.morphologyEx(combo, cv2.MORPH_OPEN, kernel, iterations=1)
    combo = cv2.morphologyEx(combo, cv2.MORPH_CLOSE, kernel, iterations=1)

    # skeletonize -> consistente lijnen, daarna dikte toevoegen
    sk = (combo > 0).astype(np.uint8)
    sk = skeletonize(sk).astype(np.uint8) * 255

    # line weight dilation
    k = int(clamp(line_weight, 1, 8))
    dil_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    lines = cv2.dilate(sk, dil_kernel, iterations=1)

    # shading (halftone) – alleen bij detail hoger
    shade_strength = clamp((detail - 2) / 6.0, 0.0, 1.0)  # detail 1-2 = none
    shade = add_halftone_shading(sharp, shade_strength)

    # final ink mask (lijnen + subtiele shade)
    ink = cv2.bitwise_or(lines, shade)

    # maak background wit, ink = zwart
    # we draaien naar "ink = 1" mask
    ink_mask = (ink > 0).astype(np.uint8)

    # render paars op wit
    out = np.ones((bgr.shape[0], bgr.shape[1], 3), dtype=np.uint8) * 255
    out[ink_mask == 1] = (PURPLE[2], PURPLE[1], PURPLE[0])  # BGR
    return out


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/stencil")
async def stencil(
    file: UploadFile = File(...),
    lineWeight: int = Query(3, ge=1, le=8),
    detail: int = Query(4, ge=1, le=8),
):
    data = await file.read()
    pil = Image.open(io.BytesIO(data)).convert("RGB")
    bgr = pil_to_bgr(pil)

    out = high_quality_stencil(bgr, lineWeight=lineWeight, detail=detail)
    png = bgr_to_png_bytes(out)
    return Response(content=png, media_type="image/png")
