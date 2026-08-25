#ifndef C_AGENT_SHELL_TOOL_H
#define C_AGENT_SHELL_TOOL_H

#include "tool.h"

#include <stddef.h>

#define SHELL_TOOL_MAX_OUTPUT 50000

typedef struct {
    char *workspace;
} ShellTool;

int shell_tool_init(ShellTool *tool, const char *workspace);
void shell_tool_free(ShellTool *tool);
int shell_tool_execute(const char *arguments_json, char *output, size_t output_capacity, void *context);
ToolDefinition shell_tool_definition(ShellTool *tool);

#endif
