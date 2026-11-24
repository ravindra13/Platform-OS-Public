from pydantic import BaseModel
from typing import List, Optional

class LayoutSection(BaseModel):
    title: str
    is_expanded: bool = True
    columns: int = 2
    fields: List[str] # References field API names

class PageLayoutDefinition(BaseModel):
    object_name: str
    layout_name: str
    sections: List[LayoutSection]
