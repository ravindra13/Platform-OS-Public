import os
from dotenv import load_dotenv

load_dotenv() # Add this line to read the .env file

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# backend/services/llm_engine.py
from openai import AsyncOpenAI

class LLMEngine:
    def __init__(self, api_key: str = GEMINI_API_KEY, default_model: str = "gemini-3.5-flash-lite"):
        if not api_key:
            raise ValueError("CRITICAL: LLMEngine requires a valid api_key.")

        # Point the standard OpenAI client to Google's Gemini endpoint
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        self.default_model = default_model

    async def chat(self, messages: list, tools: list, model_override: str = None):
        target_model = model_override or self.default_model

        try:
            response = await self.client.chat.completions.create(
                model=target_model,
                messages=messages,
                tools=tools,
                tool_choice="auto"
            )
            return response.choices[0].message

        except Exception as e:
            print(f"[LLM Engine Error] Failed calling {target_model}: {str(e)}")
            raise

    async def chat_stream(self, messages: list, tools: list = None, model_override: str = None):
        """Universal async chat completion supporting token-by-token streaming."""
        target_model = model_override or self.default_model

        try:
            stream = await self.client.chat.completions.create(
                model=target_model,
                messages=messages,
                tools=tools, # Tools can still be passed for function calling during a stream
                tool_choice="auto",
                stream=True
            )
            
            async for chunk in stream:
                # OpenAI spec yields deltas
                delta = chunk.choices[0].delta
                
                # If the AI is talking to the user, yield the text
                if delta.content:
                    yield delta.content
                    
                # Note: Handling tool calls in a stream requires assembling the JSON chunks,
                # which we will handle in the router.
                
        except Exception as e:
            print(f"[LLM Engine Error] Failed streaming {target_model}: {str(e)}")
            raise