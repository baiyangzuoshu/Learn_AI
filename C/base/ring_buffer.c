#include "ring_buffer.h"

#include <stdlib.h>

struct RingBuffer {
    void **items;
    size_t capacity;
    size_t head;
    size_t size;
    CollectionFreeFn free_value;
};

RingBuffer *ring_buffer_create(size_t capacity, CollectionFreeFn free_value) {
    if (capacity == 0) return NULL;
    RingBuffer *buffer = calloc(1, sizeof(*buffer));
    if (!buffer) return NULL;
    buffer->items = calloc(capacity, sizeof(*buffer->items));
    if (!buffer->items) {
        free(buffer);
        return NULL;
    }
    buffer->capacity = capacity;
    buffer->free_value = free_value;
    return buffer;
}

void ring_buffer_clear(RingBuffer *buffer) {
    if (!buffer) return;
    if (buffer->free_value) {
        while (buffer->size > 0) {
            void *value = buffer->items[buffer->head];
            buffer->items[buffer->head] = NULL;
            buffer->head = (buffer->head + 1) % buffer->capacity;
            buffer->size--;
            buffer->free_value(value);
        }
        buffer->head = 0;
    } else {
        for (size_t i = 0; i < buffer->capacity; i++) buffer->items[i] = NULL;
        buffer->head = 0;
        buffer->size = 0;
    }
}

void ring_buffer_destroy(RingBuffer *buffer) {
    if (!buffer) return;
    ring_buffer_clear(buffer);
    free(buffer->items);
    free(buffer);
}

size_t ring_buffer_size(const RingBuffer *buffer) {
    return buffer ? buffer->size : 0;
}

size_t ring_buffer_capacity(const RingBuffer *buffer) {
    return buffer ? buffer->capacity : 0;
}

bool ring_buffer_is_empty(const RingBuffer *buffer) {
    return ring_buffer_size(buffer) == 0;
}

bool ring_buffer_is_full(const RingBuffer *buffer) {
    return buffer && buffer->size == buffer->capacity;
}

int ring_buffer_push(RingBuffer *buffer, void *value) {
    if (!buffer || ring_buffer_is_full(buffer)) return -1;
    size_t index = (buffer->head + buffer->size) % buffer->capacity;
    buffer->items[index] = value;
    buffer->size++;
    return 0;
}

void *ring_buffer_pop(RingBuffer *buffer) {
    if (!buffer || buffer->size == 0) return NULL;
    void *value = buffer->items[buffer->head];
    buffer->items[buffer->head] = NULL;
    buffer->head = (buffer->head + 1) % buffer->capacity;
    buffer->size--;
    return value;
}

void *ring_buffer_peek(const RingBuffer *buffer) {
    return buffer && buffer->size > 0 ? buffer->items[buffer->head] : NULL;
}
