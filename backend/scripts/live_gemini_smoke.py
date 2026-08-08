"""
One-off live Gemini smoke test (run manually, never in CI).

Makes ONE minimal Gemini generateContent call through the production
gemini_service code path and asserts:
  - authentication works (no 401/403)
  - the model responds with text
  - response parsing (candidates -> parts -> text) works
  - the API key is never printed or included in the returned content

Run from backend/:  python scripts/live_gemini_smoke.py
"""

from __future__ import annotations

import sys

from config import GEMINI_API_KEY
from services import gemini_service


def main() -> int:
    if not GEMINI_API_KEY:
        print("SKIP: GEMINI_API_KEY is not configured.")
        return 0

    try:
        out = gemini_service.generate_content(
            user_prompt="Reply with exactly the single word: OK",
            system_instruction="You are a test harness.",
            model_name="gemini-2.0-flash",
            temperature=0.0,
        )
    except gemini_service.GeminiError as exc:
        print(f"FAIL: GeminiError: {exc} (status_code={exc.status_code})")
        return 1

    text = str(out).strip()
    if not text:
        print("FAIL: empty response text.")
        return 1

    if GEMINI_API_KEY in text:
        print("FAIL: API key leaked into response content.")
        return 1
    if GEMINI_API_KEY in repr(out):
        print("FAIL: API key leaked into returned object.")
        return 1

    print(f"OK: model responded ({len(text)} chars): {text[:60]!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
