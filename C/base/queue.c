#include "queue.h"

#include <stdlib.h>

struct Queue {
    List *items;
};

Queue *queue_create(CollectionFreeFn free_value) {
    Queue *queue = calloc(1, sizeof(*queue));
    if (!queue) return NULL;
    queue->items = list_create(free_value);
    if (!queue->items) {
        free(queue);
        return NULL;
    }
    return queue;
}

void queue_clear(Queue *queue) {
    if (queue) list_clear(queue->items);
}

void queue_destroy(Queue *queue) {
    if (!queue) return;
    list_destroy(queue->items);
    free(queue);
}

size_t queue_size(const Queue *queue) {
    return queue ? list_size(queue->items) : 0;
}

bool queue_is_empty(const Queue *queue) {
    return queue_size(queue) == 0;
}

int queue_enqueue(Queue *queue, void *value) {
    return queue ? list_push_back(queue->items, value) : -1;
}

void *queue_dequeue(Queue *queue) {
    return queue ? list_pop_front(queue->items) : NULL;
}

void *queue_peek(const Queue *queue) {
    return queue ? list_front(queue->items) : NULL;
}
