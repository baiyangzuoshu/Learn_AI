#include "vector.h"

#include <stdint.h>
#include <stdlib.h>

struct Vector {
    void **items;
    size_t size;
    size_t capacity;
    CollectionFreeFn free_value;
};

static int vector_grow(Vector *vector, size_t required) {
    if (required <= vector->capacity) return 0;
    size_t next_capacity = vector->capacity ? vector->capacity : 8;
    while (next_capacity < required) {
        if (next_capacity > SIZE_MAX / 2) {
            next_capacity = required;
            break;
        }
        next_capacity *= 2;
    }
    if (next_capacity > SIZE_MAX / sizeof(*vector->items)) return -1;
    void **items = realloc(vector->items, next_capacity * sizeof(*items));
    if (!items) return -1;
    vector->items = items;
    vector->capacity = next_capacity;
    return 0;
}

Vector *vector_create(CollectionFreeFn free_value) {
    Vector *vector = calloc(1, sizeof(*vector));
    if (vector) vector->free_value = free_value;
    return vector;
}

void vector_clear(Vector *vector) {
    if (!vector) return;
    if (vector->free_value) {
        for (size_t i = 0; i < vector->size; i++) vector->free_value(vector->items[i]);
    }
    vector->size = 0;
}

void vector_destroy(Vector *vector) {
    if (!vector) return;
    vector_clear(vector);
    free(vector->items);
    free(vector);
}

size_t vector_size(const Vector *vector) {
    return vector ? vector->size : 0;
}

size_t vector_capacity(const Vector *vector) {
    return vector ? vector->capacity : 0;
}

bool vector_is_empty(const Vector *vector) {
    return vector_size(vector) == 0;
}

int vector_reserve(Vector *vector, size_t capacity) {
    return vector ? vector_grow(vector, capacity) : -1;
}

int vector_push_back(Vector *vector, void *value) {
    if (!vector || vector->size == SIZE_MAX) return -1;
    if (vector_grow(vector, vector->size + 1) != 0) return -1;
    vector->items[vector->size++] = value;
    return 0;
}

void *vector_pop_back(Vector *vector) {
    if (!vector || vector->size == 0) return NULL;
    return vector->items[--vector->size];
}

void *vector_front(const Vector *vector) {
    return vector_get(vector, 0);
}

void *vector_back(const Vector *vector) {
    return vector && vector->size ? vector->items[vector->size - 1] : NULL;
}

void *vector_get(const Vector *vector, size_t index) {
    return vector && index < vector->size ? vector->items[index] : NULL;
}

int vector_swap(Vector *vector, size_t first, size_t second) {
    if (!vector || first >= vector->size || second >= vector->size) return -1;
    void *value = vector->items[first];
    vector->items[first] = vector->items[second];
    vector->items[second] = value;
    return 0;
}
