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
MATRIX_HEADER = [
    "fact_id",
    "year",
    "date",
    "category",
    "claim",
    "value",
    "unit",
    "source_grade",
    "source_url",
    "verification_status",
    "data_indicators",
    "target_files",
]
VISUALIZATION_HEADER = ["series", "period", "value", "unit", "method", "source"]
SOURCE_STATUS_HEADER = ["source_url", "status", "checked_on", "source_grade", "fact_count"]
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


def validate_matrix(path: Path) -> list[str]:
    errors: list[str] = []
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))
    if not rows or rows[0] != MATRIX_HEADER:
        return [f"{path}: header must be {MATRIX_HEADER}"]
    fact_ids: set[str] = set()
    for line_number, row in enumerate(rows[1:], start=2):
        if len(row) != len(MATRIX_HEADER):
            errors.append(f"{path}:{line_number}: expected 12 columns, got {len(row)}")
            continue
        fact_id, year, observed_date, category, claim, value, unit, grade, source, status, data_indicators, targets = row
        if fact_id in fact_ids:
            errors.append(f"{path}:{line_number}: duplicate fact_id {fact_id}")
        fact_ids.add(fact_id)
        if not re.fullmatch(r"F202[2-6]-\d{3}", fact_id):
            errors.append(f"{path}:{line_number}: invalid fact_id {fact_id}")
        if year not in {"2022", "2023", "2024", "2025", "2026"}:
            errors.append(f"{path}:{line_number}: unsupported year {year}")
        try:
            observed = parse_year(observed_date)
            if observed > CUTOFF:
                errors.append(f"{path}:{line_number}: date after cutoff {observed_date}")
        except ValueError as exc:
            errors.append(f"{path}:{line_number}: {exc}")
        if not category or not claim or not value or not unit:
            errors.append(f"{path}:{line_number}: claim fields cannot be empty")
        if grade not in {"A", "B", "C"}:
            errors.append(f"{path}:{line_number}: source grade must be A, B, or C")
        parsed = urlparse(source)
        if parsed.scheme != "https" or not parsed.netloc:
            errors.append(f"{path}:{line_number}: source must be an HTTPS URL")
        if status not in {"spot-checked", "source-linked", "self-reported"}:
            errors.append(f"{path}:{line_number}: unsupported verification status {status}")
        if not data_indicators.strip():
            errors.append(f"{path}:{line_number}: data_indicators cannot be empty")
        for target in targets.split(";"):
            target_path = ROOT / target
            if not target_path.exists():
                errors.append(f"{path}:{line_number}: missing target file {target}")
            elif not target.endswith(".csv"):
                marker = f"<!-- fact-matrix:"
                if marker not in target_path.read_text(encoding="utf-8") or fact_id not in target_path.read_text(encoding="utf-8"):
                    errors.append(f"{path}:{line_number}: target file {target} lacks fact-matrix marker for {fact_id}")
    return errors


def load_data_index() -> tuple[dict[str, tuple[str, dict[str, str], Path]], list[str]]:
    """Load every snapshot row by its stable indicator for matrix cross-checks."""
    index: dict[str, tuple[str, dict[str, str], Path]] = {}
    errors: list[str] = []
    for path in sorted((ROOT / "data").glob("*_snapshot.csv")):
        year = path.name[:4]
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for line_number, row in enumerate(reader, start=2):
                indicator = row.get("indicator", "").strip()
                if not indicator:
                    continue
                if indicator in index:
                    errors.append(f"{path}:{line_number}: duplicate data indicator {indicator}")
                index[indicator] = (year, row, path)
    return index, errors


def validate_matrix_data_coverage(path: Path, data_index: dict[str, tuple[str, dict[str, str], Path]]) -> list[str]:
    """Ensure every snapshot row is explicitly mapped to a matrix fact."""
    errors: list[str] = []
    covered: set[str] = set()
    with path.open(newline="", encoding="utf-8") as handle:
        for line_number, row in enumerate(csv.DictReader(handle), start=2):
            indicators = [item.strip() for item in row["data_indicators"].split(";") if item.strip()]
            for indicator in indicators:
                if indicator in covered:
                    errors.append(f"{path}:{line_number}: data indicator mapped more than once: {indicator}")
                covered.add(indicator)
                if indicator not in data_index:
                    errors.append(f"{path}:{line_number}: unknown data indicator {indicator}")
                    continue
                _year, data_row, data_path = data_index[indicator]
                if row["source_url"] != data_row["source"]:
                    errors.append(f"{path}:{line_number}: source mismatch for {indicator}")
                if row["date"] != data_row["date"]:
                    errors.append(f"{path}:{line_number}: date mismatch for {indicator}")
                if len(indicators) == 1 and row["value"] != data_row["value"]:
                    errors.append(f"{path}:{line_number}: value mismatch for {indicator}")
                if len(indicators) == 1 and row["unit"] not in data_row["unit"] and data_row["unit"] not in row["unit"]:
                    errors.append(f"{path}:{line_number}: unit mismatch for {indicator}")
                expected_target = ROOT / "data" / f"{data_path.name[:4]}_snapshot.csv"
                if str(expected_target.relative_to(ROOT)) not in row["target_files"].split(";"):
                    errors.append(f"{path}:{line_number}: missing snapshot target for {indicator}")
    missing = sorted(set(data_index) - covered)
    errors.extend(f"{path}: data row is not mapped in fact matrix: {indicator}" for indicator in missing)
    return errors


def validate_visualization_series(path: Path, data_index: dict[str, tuple[str, dict[str, str], Path]]) -> list[str]:
    errors: list[str] = []
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        return [f"{path}: visualization series is empty"]
    if list(rows[0]) != VISUALIZATION_HEADER:
        return [f"{path}: header must be {VISUALIZATION_HEADER}"]
    expected_records = {}
    for year in range(2022, 2027):
        expected_records[str(year)] = sum(1 for _ in csv.DictReader((ROOT / "data" / f"{year}_snapshot.csv").open(encoding="utf-8")))
    expected_facts = {}
    with (ROOT / "sources" / "fact_matrix.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["verification_status"] == "spot-checked":
                expected_facts[row["year"]] = expected_facts.get(row["year"], 0) + 1
    for line_number, row in enumerate(rows, start=2):
        if any(not row.get(field, "").strip() for field in VISUALIZATION_HEADER):
            errors.append(f"{path}:{line_number}: visualization fields cannot be empty")
        if row.get("series") == "yearbook_record_count":
            if row["value"] != str(expected_records.get(row["period"], -1)):
                errors.append(f"{path}:{line_number}: record count does not match snapshot rows")
        if row.get("series") == "fact_matrix_verified_count":
            if row["value"] != str(expected_facts.get(row["period"], -1)):
                errors.append(f"{path}:{line_number}: matrix count does not match spot-checked facts")
    return errors


def validate_source_status(path: Path, matrix_path: Path) -> list[str]:
    errors: list[str] = []
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        return [f"{path}: source status ledger is empty"]
    if list(rows[0]) != SOURCE_STATUS_HEADER:
        return [f"{path}: header must be {SOURCE_STATUS_HEADER}"]
    urls = set()
    for line_number, row in enumerate(rows, start=2):
        url = row["source_url"]
        if url in urls:
            errors.append(f"{path}:{line_number}: duplicate source URL")
        urls.add(url)
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            errors.append(f"{path}:{line_number}: source must be an HTTPS URL")
        if row["status"] != "accessible":
            errors.append(f"{path}:{line_number}: unsupported source status {row['status']}")
        try:
            if parse_year(row["checked_on"]) > CUTOFF:
                errors.append(f"{path}:{line_number}: checked date after cutoff")
        except ValueError as exc:
            errors.append(f"{path}:{line_number}: {exc}")
        if row["source_grade"] not in {"A", "B", "C"}:
            errors.append(f"{path}:{line_number}: source grade must be A, B, or C")
        if not row["fact_count"].isdigit() or int(row["fact_count"]) < 1:
            errors.append(f"{path}:{line_number}: fact_count must be positive")
    with matrix_path.open(newline="", encoding="utf-8") as handle:
        matrix_urls = {row["source_url"] for row in csv.DictReader(handle)}
    if urls != matrix_urls:
        errors.append(f"{path}: URL set differs from fact matrix ({len(urls)} vs {len(matrix_urls)})")
    return errors


def main() -> int:
    errors: list[str] = []
    required = [
        ROOT / "README.md",
        ROOT / "sources" / "index.md",
        ROOT / "sources" / "fact_matrix.csv",
        ROOT / "sources" / "source_status.csv",
        ROOT / "CHANGELOG.md",
    ]
    required += [ROOT / "timeline" / f"{year}.md" for year in range(2022, 2027)]
    required += [ROOT / "technology" / f"{year}.md" for year in range(2022, 2027)]
    required += [ROOT / "data" / f"{year}_snapshot.csv" for year in range(2022, 2027)]
    for path in required:
        if not path.exists():
            errors.append(f"missing required file: {path}")
    snapshot_paths = sorted((ROOT / "data").glob("*_snapshot.csv"))
    for path in snapshot_paths:
        errors.extend(validate_csv(path))
    errors.extend(validate_matrix(ROOT / "sources" / "fact_matrix.csv"))
    data_index, data_index_errors = load_data_index()
    errors.extend(data_index_errors)
    errors.extend(validate_matrix_data_coverage(ROOT / "sources" / "fact_matrix.csv", data_index))
    errors.extend(validate_visualization_series(ROOT / "data" / "visualization_series.csv", data_index))
    errors.extend(validate_source_status(ROOT / "sources" / "source_status.csv", ROOT / "sources" / "fact_matrix.csv"))
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
    csv_count = len(snapshot_paths)
    matrix_count = sum(1 for _ in (ROOT / "sources" / "fact_matrix.csv").open(encoding="utf-8")) - 1
    data_count = len(data_index)
    print(f"OK: {csv_count} CSV snapshots, {data_count} data rows mapped to {matrix_count} matrix facts, {len(biographies)} biographies, cutoff={CUTOFF.isoformat()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
