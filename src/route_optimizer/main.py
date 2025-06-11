from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from route_optimizer.api.routes import router as api_router
from route_optimizer.config import TEMPLATES_PATH, STATIC_PATH
from pathlib import Path

app = FastAPI()

templates = Jinja2Templates(directory=TEMPLATES_PATH)
app.templates = templates

app.mount("/static", StaticFiles(directory=STATIC_PATH), name="static")


app.include_router(api_router)
