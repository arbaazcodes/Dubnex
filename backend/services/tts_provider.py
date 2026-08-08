"""
TTS Provider Abstraction Layer

Provides a unified interface for TTS providers (Coqui TTS XTTS v2, etc.)
so the pipeline can work with any backend without ElevenLabs dependency.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional
import os


class TTSErrorKind(str, Enum):
    """Classification of TTS errors for retry logic."""
    RATE_LIMIT = "rate_limit"  # Not typically used for local TTS, but kept for interface compatibility
    RETRYABLE = "retryable"    # Transient errors (OOM, temp failures)
    FATAL = "fatal"            # Configuration, model loading, invalid input


class TTSError(Exception):
    """Typed TTS failure for segment workers / callers."""

    def __init__(
        self,
        message: str,
        *,
        kind: TTSErrorKind,
        retry_after: Optional[float] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(message)
        self.kind = kind
        self.retry_after = retry_after
        self.__cause__ = cause


@dataclass
class TTSProviderConfig:
    """Configuration for TTS providers."""
    model: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    device: str = "cpu"
    language: str = "en"
    speaker_wav: str = ""  # Optional reference speaker for voice cloning
    speed: float = 1.0
    concurrency: int = 1
    request_timeout_seconds: float = 300.0


class TTSProvider(ABC):
    """Abstract base class for TTS providers."""

    @abstractmethod
    def initialize(self, config: TTSProviderConfig) -> None:
        """Initialize the provider with configuration."""
        pass

    @abstractmethod
    def synthesize(
        self,
        text: str,
        output_path: str,
        language: Optional[str] = None,
        speaker_wav: Optional[str] = None,
        speed: Optional[float] = None,
    ) -> str:
        """
        Synthesize text to speech and save to output_path.

        Args:
            text: Text to synthesize
            output_path: Path to save the audio file
            language: Target language code (e.g., 'en', 'hi', 'es')
            speaker_wav: Optional reference audio for voice cloning
            speed: Speech speed multiplier (0.5-2.0)

        Returns:
            Path to the generated audio file

        Raises:
            TTSError: On synthesis failure with typed kind
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the provider is available and ready."""
        pass

    @abstractmethod
    def get_supported_languages(self) -> list[str]:
        """Get list of supported language codes."""
        pass

    @abstractmethod
    def get_default_voice(self) -> str:
        """Get the default voice identifier."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging/identification."""
        pass


class LocalTTSProvider(TTSProvider):
    """Local TTS provider using Coqui TTS (XTTS v2)."""

    def __init__(self):
        self._tts = None
        self._config: Optional[TTSProviderConfig] = None
        self._initialized = False
        self._supported_languages = [
            "en", "es", "fr", "de", "it", "pt", "pl", "tr",
            "ru", "nl", "cs", "ar", "zh", "ja", "hu", "ko", "hi"
        ]
        # Map language codes to XTTS v2 language codes
        self._language_map = {
            "en": "en",
            "hi": "hi",
            "es": "es",
            "fr": "fr",
            "de": "de",
            "it": "it",
            "pt": "pt",
            "pl": "pl",
            "tr": "tr",
            "ru": "ru",
            "nl": "nl",
            "cs": "cs",
            "ar": "ar",
            "zh": "zh-cn",
            "ja": "ja",
            "hu": "hu",
            "ko": "ko",
        }

    @property
    def name(self) -> str:
        return "coqui"

    def initialize(self, config: TTSProviderConfig) -> None:
        """Initialize Coqui TTS with XTTS v2 model."""
        if self._initialized and self._config == config:
            return

        try:
            from TTS.api import TTS
        except ImportError as exc:
            raise TTSError(
                "Coqui TTS not installed. Run: pip install TTS",
                kind=TTSErrorKind.FATAL,
                cause=exc,
            )

        # Validate device
        import torch
        device = config.device
        if device == "cuda" and not torch.cuda.is_available():
            # Fallback to CPU if CUDA not available
            device = "cpu"

        try:
            # Initialize TTS with the model
            self._tts = TTS(
                model_name=config.model,
                progress_bar=True,
                gpu=(device == "cuda"),
            )
            self._config = config
            self._initialized = True
        except Exception as exc:
            raise TTSError(
                f"Failed to initialize Coqui TTS model '{config.model}': {exc}",
                kind=TTSErrorKind.FATAL,
                cause=exc,
            )

    def is_available(self) -> bool:
        return self._initialized and self._tts is not None

    def get_supported_languages(self) -> list[str]:
        return self._supported_languages

    def get_default_voice(self) -> str:
        return "default"

    def _map_language(self, language: str) -> str:
        """Map language code to XTTS v2 language code."""
        return self._language_map.get(language.lower(), "en")

    def synthesize(
        self,
        text: str,
        output_path: str,
        language: Optional[str] = None,
        speaker_wav: Optional[str] = None,
        speed: Optional[float] = None,
    ) -> str:
        """
        Synthesize text to speech using Coqui TTS XTTS v2.

        Args:
            text: Text to synthesize
            output_path: Path to save the audio file
            language: Target language code (e.g., 'en', 'hi', 'es')
            speaker_wav: Optional reference audio for voice cloning
            speed: Speech speed multiplier (0.5-2.0)

        Returns:
            Path to the generated audio file
        """
        if not self.is_available():
            raise TTSError(
                "TTS provider not initialized. Call initialize() first.",
                kind=TTSErrorKind.FATAL,
            )

        if not text or not text.strip():
            raise TTSError(
                "Empty text provided for synthesis",
                kind=TTSErrorKind.FATAL,
            )

        config = self._config
        if config is None:
            raise TTSError(
                "TTS provider not configured",
                kind=TTSErrorKind.FATAL,
            )

        # Use provided values or fall back to config defaults
        lang = language or config.language
        ref_wav = speaker_wav or config.speaker_wav
        spd = speed if speed is not None else config.speed

        # Validate and clamp speed
        spd = max(0.5, min(2.0, spd))

        # Map language code for XTTS
        xtts_lang = self._map_language(lang)

        # Prepare output directory
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        # Generate temporary WAV file (XTTS outputs WAV)
        temp_wav = f"{output_path}.tmp.wav"

        try:
            # Synthesize with XTTS v2
            # XTTS v2 supports: text, language, speaker_wav, speed
            self._tts.tts_to_file(
                text=text,
                file_path=temp_wav,
                language=xtts_lang,
                speaker_wav=ref_wav if ref_wav and os.path.exists(ref_wav) else None,
                speed=spd,
            )

            # Convert WAV to MP3 using ffmpeg
            import subprocess
            result = subprocess.run(
                [
                    "ffmpeg", "-y", "-i", temp_wav,
                    "-codec:a", "libmp3lame", "-b:a", "128k",
                    output_path
                ],
                capture_output=True,
                timeout=60,
            )

            if result.returncode != 0:
                raise TTSError(
                    f"FFmpeg conversion failed: {result.stderr.decode()}",
                    kind=TTSErrorKind.RETRYABLE,
                )

            # Clean up temp WAV
            if os.path.exists(temp_wav):
                os.remove(temp_wav)

            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                raise TTSError(
                    "Generated audio file is empty",
                    kind=TTSErrorKind.RETRYABLE,
                )

            return output_path

        except subprocess.TimeoutExpired:
            if os.path.exists(temp_wav):
                os.remove(temp_wav)
            raise TTSError(
                "TTS synthesis timed out",
                kind=TTSErrorKind.RETRYABLE,
            )
        except TTSError:
            if os.path.exists(temp_wav):
                os.remove(temp_wav)
            raise
        except Exception as exc:
            if os.path.exists(temp_wav):
                os.remove(temp_wav)
            # Check for CUDA OOM
            if "CUDA out of memory" in str(exc) or "out of memory" in str(exc).lower():
                raise TTSError(
                    f"GPU out of memory: {exc}",
                    kind=TTSErrorKind.RETRYABLE,
                    cause=exc,
                )
            raise TTSError(
                f"TTS synthesis failed: {exc}",
                kind=TTSErrorKind.FATAL,
                cause=exc,
            )


# Provider registry
_PROVIDER_REGISTRY: dict[str, type[TTSProvider]] = {
    "coqui": LocalTTSProvider,
}


def get_provider_class(provider_name: str) -> type[TTSProvider]:
    """Get provider class by name."""
    provider_class = _PROVIDER_REGISTRY.get(provider_name.lower())
    if provider_class is None:
        available = ", ".join(_PROVIDER_REGISTRY.keys())
        raise ValueError(
            f"Unknown TTS provider: '{provider_name}'. Available: {available}"
        )
    return provider_class


def create_provider(provider_name: str, config: TTSProviderConfig) -> TTSProvider:
    """Create and initialize a TTS provider instance."""
    provider_class = get_provider_class(provider_name)
    provider = provider_class()
    provider.initialize(config)
    return provider