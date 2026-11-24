# api/text_router.py
from datetime import datetime
from pathlib import Path
from typing import Optional
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/text", tags=["Text Storage"])

SAVE_DIR = Path("saved_texts")
SAVE_DIR.mkdir(exist_ok=True)


class TextSubmission(BaseModel):
    content: str = Field(..., min_length=1, max_length=100_000, description="Pasted text content")
    filename: Optional[str] = Field(default=None, description="Optional custom filename")


HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Save Text</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 720px;
      margin: 40px auto;
      padding: 0 16px;
      background: #f9fafb;
      color: #111827;
    }
    h2 { margin-bottom: 16px; }
    input, textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      margin-bottom: 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
    }
    textarea {
      min-height: 260px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      resize: vertical;
    }
    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    button {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    button:hover { background: #1d4ed8; }
    a {
      color: #2563eb;
      text-decoration: none;
      font-size: 14px;
    }
    a:hover { text-decoration: underline; }
    #status {
      margin-top: 14px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h2>Paste &amp; Save Text</h2>
  <input id="filename" type="text" placeholder="Optional filename (e.g., notes.txt)" />
  <textarea id="content" placeholder="Paste your text here..."></textarea>
  <div class="actions">
    <button onclick="saveText()">Save Text</button>
    <a href="/api/text/latest" target="_blank">View Latest File &rarr;</a>
  </div>
  <div id="status"></div>

  <script>
    async function saveText() {
      const statusEl = document.getElementById("status");
      const content = document.getElementById("content").value;
      const filenameVal = document.getElementById("filename").value.trim();

      if (!content.trim()) {
        statusEl.style.color = "#dc2626";
        statusEl.textContent = "Please paste some text before saving.";
        return;
      }

      statusEl.style.color = "#374151";
      statusEl.textContent = "Saving...";

      try {
        const res = await fetch("/api/text/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content,
            filename: filenameVal || null
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to save text");
        }

        statusEl.style.color = "#16a34a";
        statusEl.textContent = `Saved as "${data.filename}" (${data.bytes_written} bytes).`;
        document.getElementById("content").value = "";
      } catch (err) {
        statusEl.style.color = "#dc2626";
        statusEl.textContent = `Error: ${err.message}`;
      }
    }
  </script>
</body>
</html>
"""


@router.get("/save", response_class=HTMLResponse)
def text_paste_page():
    return HTML_PAGE


@router.post("/save")
def save_pasted_text(payload: TextSubmission):
    if payload.filename:
        safe_name = Path(payload.filename).name
        if not safe_name.endswith(".txt"):
            safe_name += ".txt"
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = f"paste_{timestamp}_{uuid.uuid4().hex[:6]}.txt"

    file_path = SAVE_DIR / safe_name

    try:
        file_path.write_text(payload.content, encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    return {
        "status": "saved",
        "filename": safe_name,
        "bytes_written": len(payload.content.encode("utf-8")),
    }


@router.get("/latest", response_class=PlainTextResponse)
def get_latest_file():
    files = [f for f in SAVE_DIR.glob("*.txt") if f.is_file()]
    if not files:
        raise HTTPException(
            status_code=404,
            detail="No saved files found (or Render container restarted).",
        )

    latest_file = max(files, key=lambda f: f.stat().st_mtime)
    return latest_file.read_text(encoding="utf-8")