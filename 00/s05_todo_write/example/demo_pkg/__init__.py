"""demo_pkg — A small demonstration Python package.

This package provides basic utility functions for mathematical
and string operations. It is intended as a teaching example
for package structure and testing.
"""

from .utils import (
    factorial,
    is_palindrome,
    reverse_string,
)

__all__ = [
    "factorial",
    "is_palindrome",
    "reverse_string",
]
