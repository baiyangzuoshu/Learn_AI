"""Unit tests for demo_pkg.utils."""

import pytest
from demo_pkg.utils import factorial, is_palindrome, reverse_string


class TestFactorial:
    """Tests for the factorial function."""

    def test_factorial_zero(self) -> None:
        assert factorial(0) == 1

    def test_factorial_one(self) -> None:
        assert factorial(1) == 1

    def test_factorial_small(self) -> None:
        assert factorial(5) == 120

    def test_factorial_large(self) -> None:
        assert factorial(10) == 3_628_800

    def test_factorial_negative(self) -> None:
        with pytest.raises(ValueError):
            factorial(-1)


class TestIsPalindrome:
    """Tests for the is_palindrome function."""

    def test_simple_palindrome(self) -> None:
        assert is_palindrome("racecar") is True

    def test_case_insensitive(self) -> None:
        assert is_palindrome("Racecar") is True

    def test_ignores_spaces(self) -> None:
        assert is_palindrome("a man a plan a canal panama") is True

    def test_not_a_palindrome(self) -> None:
        assert is_palindrome("hello") is False

    def test_empty_string(self) -> None:
        assert is_palindrome("") is True


class TestReverseString:
    """Tests for the reverse_string function."""

    def test_reverse_regular(self) -> None:
        assert reverse_string("abc") == "cba"

    def test_reverse_palindrome(self) -> None:
        assert reverse_string("racecar") == "racecar"

    def test_reverse_empty(self) -> None:
        assert reverse_string("") == ""

    def test_reverse_with_spaces(self) -> None:
        assert reverse_string("hello world") == "dlrow olleh"
