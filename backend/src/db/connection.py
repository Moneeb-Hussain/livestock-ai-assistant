import os
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env.example"
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)