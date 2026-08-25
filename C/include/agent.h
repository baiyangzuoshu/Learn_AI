#ifndef C_AGENT_AGENT_H
#define C_AGENT_AGENT_H

#include "deepseek.h"
#include "messages.h"
#include "shell_tool.h"
#include "tool.h"

#include <stddef.h>

typedef struct {
    size_t max_iterations;
    size_t max_tool_output;
} AgentOptions;

typedef struct {
    const char *tool_name;
    const char *input_json;
    const char *output;
    size_t iteration;
} AgentEvent;

typedef void (*AgentEventFn)(const AgentEvent *event, void *context);

typedef struct {
    DeepSeekConfig provider;
    char *workspace;
    AgentOptions options;
    MessageList messages;
    ToolRegistry tools;
    ShellTool shell_tool;
} Agent;

int agent_init(Agent *agent, const char *api_key, const char *base_url, const char *model, const char *workspace,
               AgentOptions options);
void agent_free(Agent *agent);
int agent_loop_run(Agent *agent, const char *query, AgentEventFn on_event, void *event_context, char **answer,
                   char *error, size_t error_capacity);

#endif
