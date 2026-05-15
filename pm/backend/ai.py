import logging
import os
from openai import OpenAI

logger = logging.getLogger(__name__)


def get_ai_client():
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable not set")
    return OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")


async def call_ai(prompt: str, timeout: int = 15) -> str:
    if not prompt or not prompt.strip():
        raise ValueError("Prompt cannot be empty")

    client = get_ai_client()
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            timeout=timeout,
        )
    except TimeoutError:
        logger.error(f"AI request timed out after {timeout}s")
        raise TimeoutError(f"AI request timed out after {timeout}s")
    except Exception as e:
        logger.error(f"AI API error: {type(e).__name__}: {e}")
        raise

    if not response.choices:
        raise ValueError("AI returned no response choices")
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise ValueError("AI returned empty response")
    return content
