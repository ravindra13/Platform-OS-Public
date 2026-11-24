# api/ai/prompt_manager.py
from pathlib import Path

class PromptManager:
    # Resolves to: Platform OS/api/ai
    BASE_DIR = Path(__file__).resolve().parent

    @classmethod
    def load_builder_prompt(cls) -> str:
        prompt_path = cls.BASE_DIR / "prompts" / "module_builder_system.md"

        # Diagnostic safeguards
        if not prompt_path.exists():
            raise FileNotFoundError(f"System prompt missing at: {prompt_path}")

        # Simply read and return the text. No golden example injection needed.
        system_prompt = prompt_path.read_text(encoding="utf-8")
        
        return system_prompt


    @classmethod
    def load_admin_prompt(cls) -> str:
        prompt_path = cls.BASE_DIR / "prompts" / "admin_consultant_system.md"
        if not prompt_path.exists():
            raise FileNotFoundError(f"Admin prompt missing at: {prompt_path}")
        return prompt_path.read_text(encoding="utf-8")