import logging

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.errors import AppError
from app.modules.chat.schemas import ChatMessage

logger = logging.getLogger(__name__)

# Gemini calls the assistant role "model" instead of "assistant".
_ROLE_MAP = {"user": "user", "assistant": "model"}


class LLMError(AppError):
    status_code = 502
    code = "llm_error"
    default_message = "The assistant could not answer right now. Please try again."


async def generate_reply(system_prompt: str, messages: list[ChatMessage]) -> str:
    """Send the conversation to Gemini and return its reply text.

    This is the only place in the app that talks to the LLM.
    """
    settings = get_settings()
    key_value = settings.LLM_API_KEY_VALUE
    client = genai.Client(**{"api_key": key_value})
    contents = [
        types.Content(
            role=_ROLE_MAP[message.role],
            parts=[types.Part(text=message.content)],
        )
        for message in messages
    ]
    try:
        response = await client.aio.models.generate_content(
            model=settings.LLM_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt
            ),
        )
    except Exception:
        logger.exception("Gemini request failed")
        raise LLMError() from None
    if not response.text:
        raise LLMError()
    return response.text
