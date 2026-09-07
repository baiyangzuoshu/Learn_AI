#ifndef C_AGENT_VECTOR_H
#define C_AGENT_VECTOR_H

#include "list.h"

#include <stdbool.h>
#include <stddef.h>

typedef struct Vector Vector;

Vector *vector_create(CollectionFreeFn free_value);
void vector_destroy(Vector *vector);
void vector_clear(Vector *vector);

size_t vector_size(const Vector *vector);
size_t vector_capacity(const Vector *vector);
bool vector_is_empty(const Vector *vector);
int vector_reserve(Vector *vector, size_t capacity);

int vector_push_back(Vector *vector, void *value);
void *vector_pop_back(Vector *vector);
void *vector_front(const Vector *vector);
void *vector_back(const Vector *vector);
void *vector_get(const Vector *vector, size_t index);
int vector_swap(Vector *vector, size_t first, size_t second);

#endif
