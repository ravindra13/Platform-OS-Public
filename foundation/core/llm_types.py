# foundation/core/llm_types.py
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class ToolCall(BaseModel):
    id: str
    name: str
    arguments: str # Raw JSON string

class LLMResponse(BaseModel):
    content: Optional[str]
    tool_calls: List[ToolCall] = []
