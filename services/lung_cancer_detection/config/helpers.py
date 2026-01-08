# ====== Standard Library Imports ======
from dotenv import load_dotenv
from typing import Any
import pathlib
import sys
import os

# ====== Third-Party Library Imports ======
from loggerplusplus import loggerplusplus
from loggerplusplus import formats as lpp_formats


# ───────────────────── helper ──────────────────────────────────
def safe_load_envs():
    """Load .env and global.env from the project root, with detailed logging."""
    loggerplusplus.add(
        sink=sys.stdout,
        level="DEBUG",
        format=lpp_formats.ShortFormat(),
    )
    env_logger = loggerplusplus.bind(identifier="ENV_LOADER")

    path = "/.env"
    success = load_dotenv(path)
    if success:
        env_logger.info(f"✅ Loaded environment file: {path}")
    else:
        success = load_dotenv(".env")
        env_logger.info(f"ℹ️ Environment file not found: {path}")

    loggerplusplus.remove()
    return success


def env(key: str, *, default: Any = None, cast: Any = str):
    """Tiny helper to read ENV with optional cast & default."""
    val = os.getenv(key, default)
    if val is None:
        raise RuntimeError(f"missing required env var {key}")
    if cast == bool and isinstance(val, str):
        return val.strip().lower() not in {"false", "False", "0", "no", ""}
    return cast(val)


# ========= Fancy MetaClass for Pretty Display =========
class ConfigMeta(type):
    """Metaclass to provide pretty printing and helpers on the config class."""

    def to_dict(cls) -> dict:
        """Return all UPPERCASE, non-callable attributes as a dict."""
        return {
            k: v
            for k, v in cls.__dict__.items()
            if k.isupper() and not callable(v)
        }

    def _mask_if_secret(cls, key: str, value):
        """Mask potentially sensitive values (like keys, tokens...)."""
        if value is None:
            return None

        key_upper = key.upper()
        if any(x in key_upper for x in ("SECRET", "API_KEY")):
            s = str(value)
            if len(s) <= 6:
                return "***hidden***"
            return f"{s[:3]}…{s[-2:]} (hidden)"
        return value

    def _grouped_items(cls):
        """Group config items by prefix before first underscore."""
        items = cls.to_dict()
        groups = {}
        for k, v in items.items():
            prefix = k.split("_", 1)[0]  # e.g. QDRANT_URL -> QDRANT
            groups.setdefault(prefix, []).append((k, v))
        return groups

    def __repr__(cls) -> str:
        """Pretty multi-line representation of the configuration."""
        lines = [
            "\n",
            "╔════════════════════════════════════════════╗",
            "║              RUNTIME CONFIG                ║",
            "╚════════════════════════════════════════════╝"
        ]

        groups = cls._grouped_items()
        # Sort groups by name for deterministic output
        for prefix in sorted(groups.keys()):
            lines.append("")  # blank line
            lines.append(f"▶ {prefix}")
            items = groups[prefix]
            max_key_len = max(len(k) for k, _ in items)
            for key, value in sorted(items, key=lambda kv: kv[0]):
                display_value = cls._mask_if_secret(key, value)

                # Make paths nicer to read
                if isinstance(display_value, pathlib.Path):
                    display_value = str(display_value.resolve())

                lines.append(
                    f"    {key.ljust(max_key_len)} = {display_value!r}"
                )

        return "\n".join(lines)
