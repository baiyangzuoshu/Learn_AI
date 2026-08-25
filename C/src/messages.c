#include "messages.h"

#include <stdlib.h>
#include <string.h>

static char *copy_string(const char *value) {
    return value ? strdup(value) : NULL;
}

void message_init(Message *message, MessageRole role) {
    memset(message, 0, sizeof(*message));
    message->role = role;
}

void message_free(Message *message) {
    if (!message) return;
    free(message->content);
    free(message->tool_call_id);
    for (size_t i = 0; i < message->tool_call_count; i++) {
        free(message->tool_calls[i].id);
        free(message->tool_calls[i].name);
        free(message->tool_calls[i].arguments);
    }
    free(message->tool_calls);
    memset(message, 0, sizeof(*message));
}

void message_list_init(MessageList *list) {
    memset(list, 0, sizeof(*list));
}

void message_list_free(MessageList *list) {
    if (!list) return;
    for (size_t i = 0; i < list->count; i++) message_free(&list->items[i]);
    free(list->items);
    memset(list, 0, sizeof(*list));
}

int message_set_content(Message *message, const char *content) {
    char *copy = copy_string(content);
    if (content && !copy) return -1;
    free(message->content);
    message->content = copy;
    return 0;
}

int message_set_tool_call_id(Message *message, const char *id) {
    char *copy = copy_string(id);
    if (id && !copy) return -1;
    free(message->tool_call_id);
    message->tool_call_id = copy;
    return 0;
}

int message_add_tool_call(Message *message, const char *id, const char *name, const char *arguments) {
    ToolCall *next = realloc(message->tool_calls, (message->tool_call_count + 1) * sizeof(*next));
    if (!next) return -1;

    message->tool_calls = next;
    ToolCall *call = &next[message->tool_call_count];
    memset(call, 0, sizeof(*call));
    call->id = copy_string(id);
    call->name = copy_string(name);
    call->arguments = copy_string(arguments ? arguments : "{}");
    if ((id && !call->id) || (name && !call->name) || !call->arguments) {
        free(call->id);
        free(call->name);
        free(call->arguments);
        return -1;
    }
    message->tool_call_count++;
    return 0;
}

int message_list_push_move(MessageList *list, Message *message) {
    if (list->count == list->capacity) {
        size_t next_capacity = list->capacity ? list->capacity * 2 : 8;
        Message *next = realloc(list->items, next_capacity * sizeof(*next));
        if (!next) return -1;
        list->items = next;
        list->capacity = next_capacity;
    }
    list->items[list->count++] = *message;
    memset(message, 0, sizeof(*message));
    return 0;
}

int message_list_push_text(MessageList *list, MessageRole role, const char *content) {
    Message message;
    message_init(&message, role);
    if (message_set_content(&message, content) != 0 || message_list_push_move(list, &message) != 0) {
        message_free(&message);
        return -1;
    }
    return 0;
}

int message_list_push_tool(MessageList *list, const char *call_id, const char *content) {
    Message message;
    message_init(&message, MESSAGE_TOOL);
    if (message_set_tool_call_id(&message, call_id) != 0 || message_set_content(&message, content) != 0 ||
        message_list_push_move(list, &message) != 0) {
        message_free(&message);
        return -1;
    }
    return 0;
}

const char *message_role_name(MessageRole role) {
    switch (role) {
        case MESSAGE_SYSTEM: return "system";
        case MESSAGE_USER: return "user";
        case MESSAGE_ASSISTANT: return "assistant";
        case MESSAGE_TOOL: return "tool";
    }
    return "user";
}
