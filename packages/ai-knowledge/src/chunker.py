"""
CRQ AI-Knowledge — Heading-aware markdown chunker.

Splits markdown documents on heading boundaries, keeping heading hierarchy
as section metadata.  Falls back to token-based windowed chunking for long
prose blocks.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Tunables ──────────────────────────────────────────────────
MAX_CHUNK_CHARS = 2048       # ~512 tokens × 4 chars/token
OVERLAP_CHARS = 256          # ~64 tokens overlap


@dataclass
class Chunk:
    """A single chunk of knowledge text with metadata."""
    content: str
    source: str              # relative path inside knowledge/
    section: str | None = None
    framework: str | None = None


def _infer_framework(source_path: str) -> str | None:
    """Infer the compliance framework name from the source file path."""
    framework_map: dict[str, str] = {
        "nist_csf": "NIST CSF",
        "iso_27001": "ISO 27001",
        "rbi_cyber_security": "RBI Cyber Security",
        "pci_dss": "PCI DSS",
        "fair_model": "FAIR",
    }
    stem = Path(source_path).stem
    return framework_map.get(stem)


def _split_on_headings(text: str) -> list[tuple[str | None, str]]:
    """
    Split markdown text on headings.

    Returns a list of (heading_text, body_text) tuples.
    The first entry may have heading_text=None if content precedes the
    first heading.
    """
    # Match lines that start with 1-4 # characters
    heading_pattern = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)

    sections: list[tuple[str | None, str]] = []
    last_end = 0
    last_heading: str | None = None

    for match in heading_pattern.finditer(text):
        # Capture the body text between the previous heading and this one
        body = text[last_end:match.start()].strip()
        if body or last_heading is not None:
            sections.append((last_heading, body))

        last_heading = match.group(2).strip()
        last_end = match.end()

    # Capture trailing text after the last heading
    trailing = text[last_end:].strip()
    if trailing or last_heading is not None:
        sections.append((last_heading, trailing))

    # If no headings found, return the whole text as one section
    if not sections:
        sections.append((None, text.strip()))

    return sections


def _window_chunk(text: str, section: str | None = None) -> list[tuple[str | None, str]]:
    """Split a long text block into overlapping windows."""
    if len(text) <= MAX_CHUNK_CHARS:
        return [(section, text)]

    chunks: list[tuple[str | None, str]] = []
    start = 0
    part = 1
    while start < len(text):
        end = start + MAX_CHUNK_CHARS
        chunk_text = text[start:end]
        label = f"{section} (part {part})" if section else f"(part {part})"
        chunks.append((label, chunk_text))
        start = end - OVERLAP_CHARS
        part += 1
    return chunks


def chunk_markdown(text: str, source: str) -> list[Chunk]:
    """
    Chunk a markdown document into retrieval-ready pieces.

    1. Split on headings to preserve logical sections.
    2. If any section exceeds MAX_CHUNK_CHARS, apply windowed sub-chunking.
    3. Attach source path and inferred framework metadata.

    Parameters
    ----------
    text : str
        Raw markdown content.
    source : str
        Relative path of the file inside ``knowledge/``.

    Returns
    -------
    list[Chunk]
    """
    framework = _infer_framework(source)
    sections = _split_on_headings(text)
    chunks: list[Chunk] = []

    for heading, body in sections:
        if not body:
            continue

        # Prepend heading to body so the chunk is self-contained
        full_text = f"## {heading}\n\n{body}" if heading else body

        if len(full_text) <= MAX_CHUNK_CHARS:
            chunks.append(Chunk(
                content=full_text,
                source=source,
                section=heading,
                framework=framework,
            ))
        else:
            # Sub-chunk long sections
            for sub_heading, sub_body in _window_chunk(full_text, heading):
                chunks.append(Chunk(
                    content=sub_body,
                    source=source,
                    section=sub_heading,
                    framework=framework,
                ))

    logger.debug("Chunked %s → %d chunks", source, len(chunks))
    return chunks


def chunk_file(filepath: Path, knowledge_root: Path) -> list[Chunk]:
    """Read a markdown file and return its chunks."""
    text = filepath.read_text(encoding="utf-8")
    relative = filepath.relative_to(knowledge_root).as_posix()
    return chunk_markdown(text, source=relative)
