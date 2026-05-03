from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from backend.src.services.vision_service import analyze_image

app = FastAPI(title="Vision AI Service")


@app.get("/")
def root():
    return {"message": "Vision API is running"}


@app.post("/analyze-image")
async def analyze_image_api(
    file: UploadFile = File(...),
    message: str = Form(None)
):
    try:
        # 🔹 Validate file
        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded")

        # 🔹 Read image
        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty file")

        # 🔹 Call vision service
        result = analyze_image(image_bytes, message)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))