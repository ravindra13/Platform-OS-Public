import os
import asyncio

import sys

# Explicitly register the GTK3 DLL directory on Windows
if sys.platform == "win32":
    gtk_path = r"C:\Program Files\GTK2-Runtime Win64\bin"
    if os.path.exists(gtk_path):
        os.add_dll_directory(gtk_path)
        
from weasyprint import HTML

class PdfAdapter:
    """Isolates third-party HTML-to-PDF logic and file storage from the core engine."""
    def __init__(self, storage_path: str = "/tmp/flow_engine_storage"):
        self.storage_path = storage_path
        os.makedirs(self.storage_path, exist_ok=True)

    async def generate_and_save(self, html_content: str, file_id: str) -> str:
        """Converts HTML to PDF and saves it, returning the file path/URL."""
        try:
            # WeasyPrint's write_pdf is synchronous; run it in a thread to prevent blocking
            pdf_bytes = await asyncio.to_thread(HTML(string=html_content).write_pdf)
            
            file_path = os.path.join(self.storage_path, f"{file_id}.pdf")
            
            with open(file_path, "wb") as f:
                f.write(pdf_bytes)
                
            return file_path
        except Exception as e:
            print(f"[PdfAdapter] Generation failed: {e}")
            return None