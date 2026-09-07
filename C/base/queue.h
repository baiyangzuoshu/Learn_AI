#ifndef C_AGENT_QUEUE_H
#define C_AGENT_QUEUE_H

#include "list.h"

#include <stdbool.h>
#include <stddef.h>

typedef struct Queue Queue;

Queue *queue_create(CollectionFreeFn free_value);
void queue_destroy(Queue *queue);
void queue_clear(Queue *queue);

size_t queue_size(const Queue *queue);
bool queue_is_empty(const Queue *queue);

int queue_enqueue(Queue *queue, void *value);
void *queue_dequeue(Queue *queue);
void *queue_peek(const Queue *queue);

#endif
