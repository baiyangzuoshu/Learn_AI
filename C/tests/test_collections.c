#include "file_tool.h"
#include "list.h"
#include "hash_map.h"
#include "json.h"
#include "messages.h"
#include "priority_queue.h"
#include "queue.h"
#include "ring_buffer.h"
#include "stack.h"
#include "string_builder.h"
#include "tool.h"
#include "vector.h"

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

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

static void test_json(void) {
    JsonValue *root = json_parse("{\"name\":\"agent\",\"items\":[\"one\",\"two\"],\"enabled\":true}");
    assert(root && json_is_object(root));
    assert(strcmp(json_string_value(json_object_get(root, "name")), "agent") == 0);

    JsonValue *items = json_object_get(root, "items");
    assert(items && json_is_array(items));
    assert(json_array_size(items) == 2);
    assert(strcmp(json_string_value(json_array_get(items, 1)), "two") == 0);

    JsonValue *extra = json_object_create();
    assert(extra);
    assert(json_object_set_string(extra, "status", "ready") == 0);
    assert(json_object_set(root, "extra", extra) == 0);

    char *encoded = json_stringify(root);
    assert(encoded);
    assert(strstr(encoded, "\"status\":\"ready\"") != NULL);
    free(encoded);
    json_destroy(root);
}

static void test_file_tools(void) {
    char workspace[512];
    snprintf(workspace, sizeof(workspace), "/tmp/c-agent-file-tools-%ld", (long)getpid());
    assert(mkdir(workspace, 0700) == 0);

    FileTools tools;
    assert(file_tools_init(&tools, workspace) == 0);
    ToolDefinition read_definition = file_read_definition(&tools);
    ToolDefinition write_definition = file_write_definition(&tools);
    ToolDefinition edit_definition = file_edit_definition(&tools);
    char output[512];

    assert(write_definition.execute(
               "{\"path\":\"notes/demo.txt\",\"content\":\"line one\\nline two\\n\"}", output,
               sizeof(output), write_definition.context) == 0);
    assert(strstr(output, "Wrote") != NULL);
    assert(read_definition.execute("{\"path\":\"notes/demo.txt\",\"limit\":1}", output, sizeof(output),
                                   read_definition.context) == 0);
    assert(strcmp(output, "line one\n") == 0);
    assert(edit_definition.execute(
               "{\"path\":\"notes/demo.txt\",\"old_text\":\"line two\",\"new_text\":\"updated\"}",
               output, sizeof(output), edit_definition.context) == 0);
    assert(read_definition.execute("{\"path\":\"notes/demo.txt\"}", output, sizeof(output),
                                   read_definition.context) == 0);
    assert(strcmp(output, "line one\nupdated\n") == 0);
    assert(read_definition.execute("{\"path\":\"../outside.txt\"}", output, sizeof(output),
                                   read_definition.context) != 0);

    char file_path[512];
    snprintf(file_path, sizeof(file_path), "%s/notes/demo.txt", workspace);
    unlink(file_path);
    char notes_path[512];
    snprintf(notes_path, sizeof(notes_path), "%s/notes", workspace);
    rmdir(notes_path);
    file_tools_free(&tools);
    rmdir(workspace);
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

static int test_tool_execute(const char *arguments_json, char *output, size_t output_capacity, void *context) {
    (void)arguments_json;
    (void)context;
    snprintf(output, output_capacity, "ok");
    return 0;
}

static void test_message_list_and_tool_registry(void) {
    MessageList messages;
    assert(message_list_init(&messages) == 0);
    assert(message_list_push_text(&messages, MESSAGE_USER, "hello") == 0);

    Message assistant;
    message_init(&assistant, MESSAGE_ASSISTANT);
    assert(message_set_content(&assistant, "working") == 0);
    assert(message_add_tool_call(&assistant, "call-1", "bash", "{}") == 0);
    assert(message_list_push_move(&messages, &assistant) == 0);
    assert(message_list_count(&messages) == 2);
    assert(strcmp(message_list_get(&messages, 0)->content, "hello") == 0);
    assert(message_list_get(&messages, 1)->tool_call_count == 1);
    message_list_free(&messages);

    ToolRegistry registry;
    assert(tool_registry_init(&registry) == 0);
    ToolDefinition definition = {
        .name = "test_tool",
        .description = "test",
        .parameters_json = "{\"type\":\"object\"}",
        .execute = test_tool_execute,
        .context = NULL,
    };
    assert(tool_registry_add(&registry, definition) == 0);
    assert(tool_registry_count(&registry) == 1);
    assert(tool_registry_find(&registry, "test_tool") != NULL);
    JsonValue *serialized = tool_registry_to_json(&registry);
    assert(serialized != NULL);
    json_destroy(serialized);
    tool_registry_free(&registry);
}

int main(void) {
    test_list();
    test_queue();
    test_stack();
    test_vector();
    test_hash_map();
    test_string_builder();
    test_json();
    test_file_tools();
    test_ring_buffer();
    test_priority_queue();
    test_message_list_and_tool_registry();
    puts("collections tests passed: base containers, MessageList, ToolRegistry");
    return 0;
}
