#include "shell_tool.h"

#include "string_builder.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>

static char *shell_quote(const char *value) {
    size_t length = 2;
    for (const char *cursor = value; *cursor; cursor++) length += *cursor == '\'' ? 4 : 1;
    char *quoted = malloc(length + 1);
    if (!quoted) return NULL;
    size_t offset = 0;
    quoted[offset++] = '\'';
    for (const char *cursor = value; *cursor; cursor++) {
        if (*cursor == '\'') {
            memcpy(quoted + offset, "'\\''", 4);
            offset += 4;
        } else {
            quoted[offset++] = *cursor;
        }
    }
    quoted[offset++] = '\'';
    quoted[offset] = '\0';
    return quoted;
}

int shell_tool_init(ShellTool *tool, const char *workspace) {
    memset(tool, 0, sizeof(*tool));
    tool->workspace = strdup(workspace);
    return tool->workspace ? 0 : -1;
}

void shell_tool_free(ShellTool *tool) {
    free(tool->workspace);
    memset(tool, 0, sizeof(*tool));
}

int shell_tool_execute(const char *arguments_json, char *output, size_t output_capacity, void *context) {
    ShellTool *tool = context;
    JsonValue *arguments = json_parse(arguments_json ? arguments_json : "{}");
    JsonValue *command = json_object_get(arguments, "command");
    const char *command_text = json_string_value(command);
    if (!command_text || !command_text[0]) {
        snprintf(output, output_capacity, "Error: command is required");
        json_destroy(arguments);
        return -1;
    }

    char *quoted_workspace = shell_quote(tool->workspace);
    if (!quoted_workspace) {
        snprintf(output, output_capacity, "Error: out of memory");
        json_destroy(arguments);
        return -1;
    }
    StringBuilder *command_builder = string_builder_create();
    if (!command_builder ||
        string_builder_append_format(command_builder, "cd %s && %s 2>&1", quoted_workspace,
                                     command_text) != 0) {
        string_builder_destroy(command_builder);
        free(quoted_workspace);
        json_destroy(arguments);
        snprintf(output, output_capacity, "Error: out of memory");
        return -1;
    }

    FILE *pipe = popen(string_builder_data(command_builder), "r");
    string_builder_destroy(command_builder);
    free(quoted_workspace);
    json_destroy(arguments);
    if (!pipe) {
        snprintf(output, output_capacity, "Error: failed to start shell");
        return -1;
    }

    size_t length = 0;
    while (length + 1 < output_capacity && fgets(output + length, (int)(output_capacity - length), pipe)) {
        length = strlen(output);
    }
    output[length] = '\0';
    int status = pclose(pipe);
    if (length == 0) {
        if (WIFEXITED(status)) snprintf(output, output_capacity, "(exit %d)", WEXITSTATUS(status));
        else snprintf(output, output_capacity, "(shell terminated)");
    } else if (WIFEXITED(status) && WEXITSTATUS(status) != 0 && length + 32 < output_capacity) {
        snprintf(output + length, output_capacity - length, "\n(exit %d)", WEXITSTATUS(status));
    }
    return 0;
}

ToolDefinition shell_tool_definition(ShellTool *tool) {
    static const char *parameters =
        "{\"type\":\"object\",\"properties\":{\"command\":{\"type\":\"string\"}},"
        "\"required\":[\"command\"],\"additionalProperties\":false}";
    ToolDefinition definition = {
        .name = "bash",
        .description = "Run a shell command in the current workspace",
        .parameters_json = parameters,
        .execute = shell_tool_execute,
        .context = tool,
    };
    return definition;
}
