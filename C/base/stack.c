#include "stack.h"

#include <stdlib.h>

struct Stack {
    List *items;
};

Stack *stack_create(CollectionFreeFn free_value) {
    Stack *stack = calloc(1, sizeof(*stack));
    if (!stack) return NULL;
    stack->items = list_create(free_value);
    if (!stack->items) {
        free(stack);
        return NULL;
    }
    return stack;
}

void stack_clear(Stack *stack) {
    if (stack) list_clear(stack->items);
}

void stack_destroy(Stack *stack) {
    if (!stack) return;
    list_destroy(stack->items);
    free(stack);
}

size_t stack_size(const Stack *stack) {
    return stack ? list_size(stack->items) : 0;
}

bool stack_is_empty(const Stack *stack) {
    return stack_size(stack) == 0;
}

int stack_push(Stack *stack, void *value) {
    return stack ? list_push_front(stack->items, value) : -1;
}

void *stack_pop(Stack *stack) {
    return stack ? list_pop_front(stack->items) : NULL;
}

void *stack_peek(const Stack *stack) {
    return stack ? list_front(stack->items) : NULL;
}
