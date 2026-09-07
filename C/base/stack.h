#ifndef C_AGENT_STACK_H
#define C_AGENT_STACK_H

#include "list.h"

#include <stdbool.h>
#include <stddef.h>

typedef struct Stack Stack;

Stack *stack_create(CollectionFreeFn free_value);
void stack_destroy(Stack *stack);
void stack_clear(Stack *stack);

size_t stack_size(const Stack *stack);
bool stack_is_empty(const Stack *stack);

int stack_push(Stack *stack, void *value);
void *stack_pop(Stack *stack);
void *stack_peek(const Stack *stack);

#endif
