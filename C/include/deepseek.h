#ifndef C_AGENT_DEEPSEEK_H
#define C_AGENT_DEEPSEEK_H

#include "messages.h"
#include "tool.h"

#include <stddef.h>

typedef struct {
    const char *api_key;
    const char *base_url;
    const char *model;
} DeepSeekConfig;

int deepseek_chat_completion(const DeepSeekConfig *config, const MessageList *messages, const ToolRegistry *tools,
                             Message *assistant, char *error, size_t error_capacity);

#endif
