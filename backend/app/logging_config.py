"""Configure structured logging for the application."""
from __future__ import annotations

import logging
import sys

try:
    from loguru import logger as loguru_logger
except ImportError:
    loguru_logger = None


def setup_logging() -> None:
    if loguru_logger is not None:
        loguru_logger.remove()
        loguru_logger.add(
            sys.stderr,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name} | {message}",
            level="INFO",
        )
        return

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stderr,
    )
