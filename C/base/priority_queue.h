#ifndef C_AGENT_PRIORITY_QUEUE_H
#define C_AGENT_PRIORITY_QUEUE_H

#include "list.h"

#include <stdbool.h>
#include <stddef.h>

typedef int (*PriorityCompareFn)(const void *first, const void *second);
typedef struct PriorityQueue PriorityQueue;

/* compare(first, second) < 0 means first has higher priority. */
PriorityQueue *priority_queue_create(PriorityCompareFn compare, CollectionFreeFn free_value);
void priority_queue_destroy(PriorityQueue *queue);
void priority_queue_clear(PriorityQueue *queue);

size_t priority_queue_size(const PriorityQueue *queue);
bool priority_queue_is_empty(const PriorityQueue *queue);

int priority_queue_push(PriorityQueue *queue, void *value);
void *priority_queue_pop(PriorityQueue *queue);
void *priority_queue_peek(const PriorityQueue *queue);

#endif
