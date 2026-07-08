"""Utility functions for demo_pkg."""


def factorial(n: int) -> int:
    """Compute the factorial of a non-negative integer n.

    Args:
        n: A non-negative integer.

    Returns:
        The factorial of n (n!).

    Raises:
        ValueError: If n is negative.
    """
    if n < 0:
        raise ValueError("factorial() requires a non-negative integer")
    if n == 0:
        return 1
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result


def is_palindrome(text: str) -> bool:
    """Check whether the given string is a palindrome.

    A palindrome reads the same forwards and backwards, ignoring case.

    Args:
        text: The string to check.

    Returns:
        True if text is a palindrome, False otherwise.
    """
    cleaned = text.lower().replace(" ", "")
    return cleaned == cleaned[::-1]


def reverse_string(text: str) -> str:
    """Return the reverse of the given string.

    Args:
        text: The string to reverse.

    Returns:
        The reversed string.
    """
    return text[::-1]
