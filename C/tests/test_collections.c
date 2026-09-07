#include "list.h"
#include "hash_map.h"
#include "priority_queue.h"
#include "queue.h"
#include "ring_buffer.h"
#include "stack.h"
#include "string_builder.h"
#include "vector.h"

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int *new_int(int value) {
    int *item = malloc(sizeof(*item));
    assert(item);
    *item = value;
    return item;
}

static void assert_popped_int(void *value, int expected) {
    assert(value);
    assert(*(int *)value == expected);
    free(value);
}

static void test_list(void) {
    List *list = list_create(free);
    assert(list && list_is_empty(list));
    assert(list_push_back(list, new_int(2)) == 0);
    assert(list_push_front(list, new_int(1)) == 0);
    assert(list_push_back(list, new_int(3)) == 0);
    assert(list_size(list) == 3);
    assert(*(int *)list_front(list) == 1);
    assert(*(int *)list_back(list) == 3);
    assert(*(int *)list_get(list, 1) == 2);
    assert(list_get(list, 3) == NULL);
    assert_popped_int(list_pop_front(list), 1);
    assert_popped_int(list_pop_back(list), 3);
    assert_popped_int(list_pop_front(list), 2);
    assert(list_is_empty(list));
    list_destroy(list);
}

static void test_queue(void) {
    Queue *queue = queue_create(free);
    assert(queue);
    assert(queue_enqueue(queue, new_int(1)) == 0);
    assert(queue_enqueue(queue, new_int(2)) == 0);
    assert(*(int *)queue_peek(queue) == 1);
    assert_popped_int(queue_dequeue(queue), 1);
    assert_popped_int(queue_dequeue(queue), 2);
    assert(queue_dequeue(queue) == NULL);
    assert(queue_is_empty(queue));
    queue_destroy(queue);
}

static void test_stack(void) {
    Stack *stack = stack_create(free);
    assert(stack);
    assert(stack_push(stack, new_int(1)) == 0);
    assert(stack_push(stack, new_int(2)) == 0);
    assert(*(int *)stack_peek(stack) == 2);
    assert_popped_int(stack_pop(stack), 2);
    assert_popped_int(stack_pop(stack), 1);
    assert(stack_pop(stack) == NULL);
    assert(stack_is_empty(stack));
    stack_destroy(stack);
}

static void test_vector(void) {
    Vector *vector = vector_create(free);
    assert(vector);
    assert(vector_reserve(vector, 32) == 0);
    assert(vector_capacity(vector) >= 32);
    assert(vector_push_back(vector, new_int(1)) == 0);
    assert(vector_push_back(vector, new_int(2)) == 0);
    assert(*(int *)vector_front(vector) == 1);
    assert(*(int *)vector_back(vector) == 2);
    assert(vector_swap(vector, 0, 1) == 0);
    assert(*(int *)vector_get(vector, 0) == 2);
    assert_popped_int(vector_pop_back(vector), 1);
    assert_popped_int(vector_pop_back(vector), 2);
    assert(vector_is_empty(vector));
    vector_destroy(vector);
}

static void test_hash_map(void) {
    HashMap *map = hash_map_create(2, free);
    assert(map && hash_map_is_empty(map));
    assert(hash_map_set(map, "one", new_int(1)) == 0);
    assert(hash_map_set(map, "two", new_int(2)) == 0);
    assert(hash_map_set(map, "one", new_int(10)) == 0);
    assert(hash_map_size(map) == 2);
    assert(hash_map_contains(map, "one"));
    assert(*(int *)hash_map_get(map, "one") == 10);
    assert_popped_int(hash_map_remove(map, "two"), 2);
    assert(!hash_map_contains(map, "two"));
    for (int i = 0; i < 32; i++) {
        char key[32];
        snprintf(key, sizeof(key), "key-%d", i);
        assert(hash_map_set(map, key, new_int(i)) == 0);
    }
    assert(*(int *)hash_map_get(map, "key-31") == 31);
    hash_map_destroy(map);
}

static void test_string_builder(void) {
    StringBuilder *builder = string_builder_create();
    assert(builder);
    assert(string_builder_append(builder, "agent") == 0);
    assert(string_builder_append_char(builder, ' ') == 0);
    assert(string_builder_append_n(builder, "loop", 4) == 0);
    assert(string_builder_append_format(builder, " #%d", 1) == 0);
    assert(strcmp(string_builder_data(builder), "agent loop #1") == 0);
    assert(string_builder_length(builder) == strlen("agent loop #1"));
    string_builder_clear(builder);
    assert(string_builder_length(builder) == 0);
    assert(strcmp(string_builder_data(builder), "") == 0);
    string_builder_destroy(builder);
}

static void test_ring_buffer(void) {
    RingBuffer *buffer = ring_buffer_create(2, free);
    assert(buffer && ring_buffer_is_empty(buffer));
    assert(ring_buffer_push(buffer, new_int(1)) == 0);
    assert(ring_buffer_push(buffer, new_int(2)) == 0);
    assert(ring_buffer_is_full(buffer));
    int *rejected = new_int(3);
    assert(ring_buffer_push(buffer, rejected) != 0);
    free(rejected);
    assert_popped_int(ring_buffer_pop(buffer), 1);
    assert(ring_buffer_push(buffer, new_int(3)) == 0);
    assert_popped_int(ring_buffer_pop(buffer), 2);
    assert_popped_int(ring_buffer_pop(buffer), 3);
    assert(ring_buffer_pop(buffer) == NULL);
    ring_buffer_destroy(buffer);
}

static int compare_ints(const void *first, const void *second) {
    int left = *(const int *)first;
    int right = *(const int *)second;
    return (left > right) - (left < right);
}

static void test_priority_queue(void) {
    PriorityQueue *queue = priority_queue_create(compare_ints, free);
    assert(queue);
    assert(priority_queue_push(queue, new_int(30)) == 0);
    assert(priority_queue_push(queue, new_int(10)) == 0);
    assert(priority_queue_push(queue, new_int(20)) == 0);
    assert(*(int *)priority_queue_peek(queue) == 10);
    assert_popped_int(priority_queue_pop(queue), 10);
    assert_popped_int(priority_queue_pop(queue), 20);
    assert_popped_int(priority_queue_pop(queue), 30);
    assert(priority_queue_pop(queue) == NULL);
    priority_queue_destroy(queue);
}

int main(void) {
    test_list();
    test_queue();
    test_stack();
    test_vector();
    test_hash_map();
    test_string_builder();
    test_ring_buffer();
    test_priority_queue();
    puts("collections tests passed: list queue stack vector hash-map string-builder ring-buffer priority-queue");
    return 0;
}
