import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=ROOT_DIR / ".env")

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data"
TEMPLATES_PATH = BASE_DIR / "templates"
STATIC_PATH = BASE_DIR / "static"

ORS_API_KEY = os.getenv("ORS_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
