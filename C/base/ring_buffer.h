#ifndef C_AGENT_RING_BUFFER_H
#define C_AGENT_RING_BUFFER_H

#include "list.h"

#include <stdbool.h>
#include <stddef.h>

typedef struct RingBuffer RingBuffer;

RingBuffer *ring_buffer_create(size_t capacity, CollectionFreeFn free_value);
void ring_buffer_destroy(RingBuffer *buffer);
void ring_buffer_clear(RingBuffer *buffer);

size_t ring_buffer_size(const RingBuffer *buffer);
size_t ring_buffer_capacity(const RingBuffer *buffer);
bool ring_buffer_is_empty(const RingBuffer *buffer);
bool ring_buffer_is_full(const RingBuffer *buffer);

/* A full buffer rejects new values and leaves ownership with the caller. */
int ring_buffer_push(RingBuffer *buffer, void *value);
void *ring_buffer_pop(RingBuffer *buffer);
void *ring_buffer_peek(const RingBuffer *buffer);

#endif
