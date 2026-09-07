#include "priority_queue.h"

#include "vector.h"

#include <stdlib.h>

struct PriorityQueue {
    Vector *items;
    PriorityCompareFn compare;
};

PriorityQueue *priority_queue_create(PriorityCompareFn compare, CollectionFreeFn free_value) {
    if (!compare) return NULL;
    PriorityQueue *queue = calloc(1, sizeof(*queue));
    if (!queue) return NULL;
    queue->items = vector_create(free_value);
    if (!queue->items) {
        free(queue);
        return NULL;
    }
    queue->compare = compare;
    return queue;
}

void priority_queue_clear(PriorityQueue *queue) {
    if (queue) vector_clear(queue->items);
}

void priority_queue_destroy(PriorityQueue *queue) {
    if (!queue) return;
    vector_destroy(queue->items);
    free(queue);
}

size_t priority_queue_size(const PriorityQueue *queue) {
    return queue ? vector_size(queue->items) : 0;
}

bool priority_queue_is_empty(const PriorityQueue *queue) {
    return priority_queue_size(queue) == 0;
}

int priority_queue_push(PriorityQueue *queue, void *value) {
    if (!queue || vector_push_back(queue->items, value) != 0) return -1;
    size_t child = vector_size(queue->items) - 1;
    while (child > 0) {
        size_t parent = (child - 1) / 2;
        if (queue->compare(vector_get(queue->items, child), vector_get(queue->items, parent)) >= 0) break;
        vector_swap(queue->items, child, parent);
        child = parent;
    }
    return 0;
}

void *priority_queue_pop(PriorityQueue *queue) {
    if (!queue || vector_is_empty(queue->items)) return NULL;
    size_t last = vector_size(queue->items) - 1;
    if (last > 0) vector_swap(queue->items, 0, last);
    void *value = vector_pop_back(queue->items);

    size_t parent = 0;
    while (true) {
        size_t left = parent * 2 + 1;
        size_t right = left + 1;
        size_t smallest = parent;
        if (left < vector_size(queue->items) &&
            queue->compare(vector_get(queue->items, left), vector_get(queue->items, smallest)) < 0) {
            smallest = left;
        }
        if (right < vector_size(queue->items) &&
            queue->compare(vector_get(queue->items, right), vector_get(queue->items, smallest)) < 0) {
            smallest = right;
        }
        if (smallest == parent) break;
        vector_swap(queue->items, parent, smallest);
        parent = smallest;
    }
    return value;
}

void *priority_queue_peek(const PriorityQueue *queue) {
    return queue ? vector_front(queue->items) : NULL;
}
