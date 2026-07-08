"""Example module demonstrating basic Python functions with type hints and docstrings."""


def greet(name: str) -> None:
    """Print a greeting to the user.

    Args:
        name: The name of the person to greet.
    """
    print(f"Hello, {name}!")


def add(a: int, b: int) -> int:
    """Add two integers together.

    Args:
        a: The first integer.
        b: The second integer.

    Returns:
        The sum of a and b.
    """
    return a + b


def main() -> None:
    """Run the main program logic.

    Prompts the user for their name, greets them, and demonstrates the add function.
    """
    name = input("Enter your name: ")
    greet(name)
    result = add(3, 5)
    print(f"3 + 5 = {result}")


if __name__ == "__main__":
    main()
