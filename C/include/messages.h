#ifndef C_AGENT_MESSAGES_H
#define C_AGENT_MESSAGES_H

#include "vector.h"

#include <stddef.h>

typedef enum {
    MESSAGE_SYSTEM,
    MESSAGE_USER,
    MESSAGE_ASSISTANT,
    MESSAGE_TOOL,
} MessageRole;

typedef struct {
    char *id;
    char *name;
    char *arguments;
} ToolCall;

typedef struct {
    MessageRole role;
    char *content;
    char *tool_call_id;
    ToolCall *tool_calls;
    size_t tool_call_count;
} Message;

typedef struct {
    Vector *items;
} MessageList;

void message_init(Message *message, MessageRole role);
void message_free(Message *message);
int message_list_init(MessageList *list);
void message_list_free(MessageList *list);
size_t message_list_count(const MessageList *list);
const Message *message_list_get(const MessageList *list, size_t index);

int message_set_content(Message *message, const char *content);
int message_set_tool_call_id(Message *message, const char *id);
int message_add_tool_call(Message *message, const char *id, const char *name, const char *arguments);
int message_list_push_move(MessageList *list, Message *message);
int message_list_push_text(MessageList *list, MessageRole role, const char *content);
int message_list_push_tool(MessageList *list, const char *call_id, const char *content);

const char *message_role_name(MessageRole role);

#endif
