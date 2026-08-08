"""
One-off live OpenAI smoke test (run manually, never in CI).

Makes ONE minimal chat.completions call through the production
openai_service code path and asserts:
  - authentication works (no 401/403)
  - the model responds with text
  - response parsing (choices[0].message.content) works
  - the API key is never printed or included in the returned content

Run from backend/:  python scripts/live_openai_smoke.py
"""

from __future__ import annotations

import sys

from config import OPENAI_API_KEY
from services import openai_service


def main() -> int:
    if not OPENAI_API_KEY:
        print("SKIP: OPENAI_API_KEY is not configured.")
        return 0

    try:
        out = openai_service.chat(
            message="Reply with exactly the single word: OK",
            role="director",
            system_instruction="You are a test harness.",
            model_name=None,
        )
    except openai_service.OpenAIError as exc:
        print(f"FAIL: OpenAIError: {exc} (status_code={exc.status_code})")
        return 1

    text = str(out).strip()
    if not text:
        print("FAIL: empty response text.")
        return 1

    if OPENAI_API_KEY in text:
        print("FAIL: API key leaked into response content.")
        return 1
    if OPENAI_API_KEY in repr(out):
        print("FAIL: API key leaked into returned object.")
        return 1

    print(f"OK: model responded ({len(text)} chars): {text[:60]!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
