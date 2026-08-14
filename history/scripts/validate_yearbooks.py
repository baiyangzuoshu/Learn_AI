#!/usr/bin/env python3
"""Validate the AI yearbook's file layout, CSV snapshots, and cutoff rules."""

from __future__ import annotations

import csv
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
CUTOFF = date(2026, 8, 15)
CSV_HEADER = ["indicator", "value", "unit", "date", "source"]
DATE_RE = re.compile(r"^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$")


def parse_year(value: str) -> date:
    match = DATE_RE.fullmatch(value.strip())
    if not match:
        raise ValueError(f"invalid date: {value!r}")
    year, month, day = match.groups()
    return date(int(year), int(month or 1), int(day or 1))


def validate_csv(path: Path) -> list[str]:
    errors: list[str] = []
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))
    if not rows or rows[0] != CSV_HEADER:
        errors.append(f"{path}: header must be {CSV_HEADER}")
        return errors
    for line_number, row in enumerate(rows[1:], start=2):
        if len(row) != len(CSV_HEADER):
            errors.append(f"{path}:{line_number}: expected 5 columns, got {len(row)}")
            continue
        if not row[0].strip() or not row[1].strip() or not row[2].strip():
            errors.append(f"{path}:{line_number}: indicator/value/unit cannot be empty")
        try:
            observed = parse_year(row[3])
            if observed > CUTOFF:
                errors.append(f"{path}:{line_number}: date after cutoff {row[3]}")
        except ValueError as exc:
            errors.append(f"{path}:{line_number}: {exc}")
        parsed = urlparse(row[4])
        if parsed.scheme != "https" or not parsed.netloc:
            errors.append(f"{path}:{line_number}: source must be an HTTPS URL")
    return errors


def main() -> int:
    errors: list[str] = []
    required = [
        ROOT / "README.md",
        ROOT / "sources" / "index.md",
        ROOT / "CHANGELOG.md",
    ]
    required += [ROOT / "timeline" / f"{year}.md" for year in range(2022, 2027)]
    required += [ROOT / "technology" / f"{year}.md" for year in range(2022, 2027)]
    required += [ROOT / "data" / f"{year}_snapshot.csv" for year in range(2022, 2027)]
    for path in required:
        if not path.exists():
            errors.append(f"missing required file: {path}")
    for path in sorted((ROOT / "data").glob("*_snapshot.csv")):
        errors.extend(validate_csv(path))
    biographies = sorted(
        path
        for path in (ROOT / "biographies").glob("**/*.md")
        if path.name != "README.md"
    )
    for path in biographies:
        text = path.read_text(encoding="utf-8")
        if "2026" not in text:
            errors.append(f"{path}: missing 2026 coverage")
        if "2026" in text and "待续" in text:
            errors.append(f"{path}: stale 待续 marker remains after 2026 update")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    csv_count = len(list((ROOT / "data").glob("*_snapshot.csv")))
    print(f"OK: {csv_count} CSV snapshots, {len(biographies)} biographies, cutoff={CUTOFF.isoformat()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
