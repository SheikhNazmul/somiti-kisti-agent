import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.core.config import get_settings
from app.core.errors import AppError
from app.modules.chat.schemas import ChatMessage

logger = logging.getLogger(__name__)

# Gemini calls the assistant role "model" instead of "assistant".
_ROLE_MAP = {"user": "user", "assistant": "model"}

# A tool runner takes a tool name and its arguments and returns plain data.
ToolRunner = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]

_MAX_TOOL_ROUNDS = 4

# The free models sometimes answer 503 (high demand); a short retry
# usually gets through, so try up to 3 times before giving up.
_MAX_ATTEMPTS = 3


class LLMError(AppError):
    status_code = 502
    code = "llm_error"
    default_message = "The assistant could not answer right now. Please try again."


async def generate_reply(
    system_prompt: str,
    messages: list[ChatMessage],
    tool_declarations: list[types.FunctionDeclaration] | None = None,
    tool_runner: ToolRunner | None = None,
) -> str:
    """Send the conversation to Gemini and return its reply text.

    When the model asks for a tool, the tool runner executes it and the
    result goes back to the model, which then answers. This is the only
    place in the app that talks to the LLM.
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
    config = types.GenerateContentConfig(system_instruction=system_prompt)
    if tool_declarations and tool_runner is not None:
        config.tools = [types.Tool(function_declarations=tool_declarations)]
    for _round in range(_MAX_TOOL_ROUNDS + 1):
        response = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                response = await client.aio.models.generate_content(
                    model=settings.LLM_MODEL,
                    contents=contents,
                    config=config,
                )
                break
            except genai_errors.ServerError:
                if attempt == _MAX_ATTEMPTS - 1:
                    logger.exception("Gemini request failed")
                    raise LLMError() from None
                await asyncio.sleep(2 * (attempt + 1))
            except Exception:
                logger.exception("Gemini request failed")
                raise LLMError() from None
        calls = response.function_calls or []
        if not calls or tool_runner is None:
            if not response.text:
                raise LLMError()
            return response.text
        contents.append(response.candidates[0].content)
        result_parts = []
        for call in calls:
            result = await tool_runner(call.name, dict(call.args or {}))
            result_parts.append(
                types.Part.from_function_response(
                    name=call.name, response={"result": result}
                )
            )
        contents.append(types.Content(role="function", parts=result_parts))
    raise LLMError()
