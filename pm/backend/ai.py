"""AI module for OpenRouter API integration."""
import os
from openai import OpenAI
import logging

logger = logging.getLogger(__name__)

# Initialize OpenAI client with OpenRouter base URL
def get_ai_client():
    """Initialize and return OpenAI client configured for OpenRouter."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable not set")
    
    return OpenAI(
        api_key=api_key,
        base_url="https://openrouter.io/api/v1"
    )


async def call_ai(prompt: str, timeout: int = 15) -> str:
    """
    Call the AI model with the given prompt.
    
    Args:
        prompt: The prompt to send to the AI
        timeout: Timeout in seconds (default: 15)
    
    Returns:
        The AI response text
    
    Raises:
        ValueError: If API key is missing or response is invalid
        TimeoutError: If request times out
        Exception: For other API errors
    """
    try:
        client = get_ai_client()
    except ValueError as e:
        logger.error(f"AI initialization error: {e}")
        raise
    
    if not prompt or not prompt.strip():
        raise ValueError("Prompt cannot be empty")
    
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "user", "content": prompt}
            ],
            timeout=timeout
        )
        
        # Validate response
        if not response.choices or len(response.choices) == 0:
            raise ValueError("AI returned no response choices")
        
        message_content = response.choices[0].message.content
        if not message_content or not message_content.strip():
            raise ValueError("AI returned empty response")
        
        logger.info("AI call successful")
        return message_content
        
    except TimeoutError:
        logger.error(f"AI request timed out after {timeout}s")
        raise TimeoutError(f"AI request timed out after {timeout}s")
    except ValueError as e:
        logger.error(f"AI validation error: {e}")
        raise
    except Exception as e:
        logger.error(f"AI API error: {type(e).__name__}: {e}")
        # Print more details for debugging
        print(f"DEBUG: AI API error details: {type(e).__name__}: {e}")
        if hasattr(e, 'response'):
            print(f"DEBUG: Response status: {e.response.status_code if hasattr(e.response, 'status_code') else 'N/A'}")
            print(f"DEBUG: Response body: {e.response.text if hasattr(e.response, 'text') else 'N/A'}")
        raise
