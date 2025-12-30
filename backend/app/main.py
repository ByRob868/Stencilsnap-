from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from stencil import make_stencil
from io import BytesIO
from fastapi.responses import StreamingResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/stencil")
async def create_stencil(file: UploadFile = File(...)):
    image_bytes = await file.read()
    result = make_stencil(image_bytes)
    return StreamingResponse(BytesIO(result), media_type="image/png")
