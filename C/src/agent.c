#include "agent.h"

#include "queue.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char *copy_string(const char *value) {
    return value ? strdup(value) : NULL;
}

static int set_error(char *error, size_t capacity, const char *message) {
    if (error && capacity) snprintf(error, capacity, "%s", message);
    return -1;
}

int agent_init(Agent *agent, const char *api_key, const char *base_url, const char *model, const char *workspace,
               AgentOptions options) {
    memset(agent, 0, sizeof(*agent));
    agent->provider.api_key = api_key;
    agent->provider.base_url = base_url;
    agent->provider.model = model;
    agent->workspace = copy_string(workspace);
    agent->options = options;
    if (!agent->workspace || shell_tool_init(&agent->shell_tool, workspace) != 0) {
        agent_free(agent);
        return -1;
    }
    if (message_list_init(&agent->messages) != 0 || tool_registry_init(&agent->tools) != 0) {
        agent_free(agent);
        return -1;
    }
    static const char *prompt_format =
        "You are a coding agent working in %s. Use the bash tool to inspect and modify this workspace. "
        "Keep going until the user's task is complete. Return only the useful final response; do not expose "
        "internal reasoning or planning. Use concise Markdown with short headings, lists, tables, and code "
        "blocks only when they improve readability. Do not include raw tool output or incidental command "
        "errors unless they directly support the answer.";
    size_t prompt_length = strlen(workspace) + strlen(prompt_format) + 1;
    char *prompt = malloc(prompt_length);
    if (!prompt) {
        agent_free(agent);
        return -1;
    }
    snprintf(prompt, prompt_length, prompt_format, workspace);
    int setup_failed = message_list_push_text(&agent->messages, MESSAGE_SYSTEM, prompt) != 0 ||
                       tool_registry_add(&agent->tools, shell_tool_definition(&agent->shell_tool)) != 0;
    free(prompt);
    if (setup_failed) {
        agent_free(agent);
        return -1;
    }
    return 0;
}

void agent_free(Agent *agent) {
    if (!agent) return;
    message_list_free(&agent->messages);
    tool_registry_free(&agent->tools);
    shell_tool_free(&agent->shell_tool);
    free(agent->workspace);
    memset(agent, 0, sizeof(*agent));
}

int agent_loop_run(Agent *agent, const char *query, AgentEventFn on_event, void *event_context, char **answer,
                   char *error, size_t error_capacity) {
    if (!agent || !query || !answer) return set_error(error, error_capacity, "invalid agent arguments");
    *answer = NULL;
    if (message_list_push_text(&agent->messages, MESSAGE_USER, query) != 0) {
        return set_error(error, error_capacity, "failed to append user message");
    }

    for (size_t iteration = 1; iteration <= agent->options.max_iterations; iteration++) {
        Message assistant;
        message_init(&assistant, MESSAGE_ASSISTANT);
        if (deepseek_chat_completion(&agent->provider, &agent->messages, &agent->tools, &assistant, error,
                                     error_capacity) != 0) {
            message_free(&assistant);
            return -1;
        }
        if (message_list_push_move(&agent->messages, &assistant) != 0) {
            message_free(&assistant);
            return set_error(error, error_capacity, "failed to append assistant message");
        }

        const Message *stored_assistant = message_list_get(&agent->messages, message_list_count(&agent->messages) - 1);
        if (stored_assistant->tool_call_count == 0) {
            *answer = copy_string(stored_assistant->content ? stored_assistant->content : "");
            return *answer ? 0 : set_error(error, error_capacity, "failed to copy final answer");
        }

        Queue *pending_calls = queue_create(NULL);
        if (!pending_calls) return set_error(error, error_capacity, "failed to create tool call queue");
        for (size_t call_index = 0; call_index < stored_assistant->tool_call_count; call_index++) {
            if (queue_enqueue(pending_calls, &stored_assistant->tool_calls[call_index]) != 0) {
                queue_destroy(pending_calls);
                return set_error(error, error_capacity, "failed to queue tool call");
            }
        }
        while (!queue_is_empty(pending_calls)) {
            ToolCall *call = queue_dequeue(pending_calls);
            const ToolDefinition *tool = tool_registry_find(&agent->tools, call->name);
            char *tool_output = malloc(agent->options.max_tool_output + 1);
            if (!tool_output) {
                queue_destroy(pending_calls);
                return set_error(error, error_capacity, "failed to allocate tool output");
            }
            if (!tool) {
                snprintf(tool_output, agent->options.max_tool_output + 1, "Error: unknown tool '%s'", call->name);
            } else {
                tool->execute(call->arguments, tool_output, agent->options.max_tool_output + 1, tool->context);
            }
            if (on_event) {
                AgentEvent event = {
                    .tool_name = call->name,
                    .input_json = call->arguments,
                    .output = tool_output,
                    .iteration = iteration,
                };
                on_event(&event, event_context);
            }
            int append_result = message_list_push_tool(&agent->messages, call->id, tool_output);
            free(tool_output);
            if (append_result != 0) {
                queue_destroy(pending_calls);
                return set_error(error, error_capacity, "failed to append tool result");
            }
        }
        queue_destroy(pending_calls);
    }
    return set_error(error, error_capacity, "agent loop reached its iteration limit");
}
