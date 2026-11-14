#ifndef C_AGENT_FILE_TOOL_H
#define C_AGENT_FILE_TOOL_H

#include "tool.h"

#include <stddef.h>

#define FILE_TOOL_MAX_OUTPUT 50000
#define FILE_TOOL_MAX_INPUT 10000000

typedef struct {
    char *workspace;
} FileTools;

int file_tools_init(FileTools *tools, const char *workspace);
void file_tools_free(FileTools *tools);

int file_read_execute(const char *arguments_json, char *output, size_t output_capacity, void *context);
int file_write_execute(const char *arguments_json, char *output, size_t output_capacity, void *context);
int file_edit_execute(const char *arguments_json, char *output, size_t output_capacity, void *context);

ToolDefinition file_read_definition(FileTools *tools);
ToolDefinition file_write_definition(FileTools *tools);
ToolDefinition file_edit_definition(FileTools *tools);

#endif
