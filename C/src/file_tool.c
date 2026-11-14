#include "file_tool.h"

#include "string_builder.h"

#include <errno.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

static void set_output(char *output, size_t capacity, const char *message) {
    if (!output || capacity == 0) return;
    snprintf(output, capacity, "%s", message ? message : "");
}

static int is_safe_relative_path(const char *path) {
    if (!path || !path[0] || path[0] == '/') return 0;
    const char *cursor = path;
    while (*cursor) {
        const char *end = strchr(cursor, '/');
        size_t length = end ? (size_t)(end - cursor) : strlen(cursor);
        if (length == 2 && cursor[0] == '.' && cursor[1] == '.') return 0;
        cursor = end ? end + 1 : cursor + length;
        if (end && !*cursor) return 0;
    }
    return 1;
}

static int path_is_inside(const char *root, const char *path) {
    size_t root_length = strlen(root);
    if (root_length == 1 && root[0] == '/') return path[0] == '/';
    return strncmp(root, path, root_length) == 0 &&
           (path[root_length] == '\0' || path[root_length] == '/');
}

static char *join_path(const char *root, const char *relative) {
    size_t length = strlen(root) + strlen(relative) + 2;
    char *path = malloc(length);
    if (!path) return NULL;
    snprintf(path, length, "%s/%s", root, relative);
    return path;
}

static char *resolve_existing_path(const FileTools *tools, const char *relative) {
    if (!tools || !tools->workspace || !is_safe_relative_path(relative)) return NULL;
    char *candidate = join_path(tools->workspace, relative);
    if (!candidate) return NULL;
    char *resolved = realpath(candidate, NULL);
    free(candidate);
    if (!resolved || !path_is_inside(tools->workspace, resolved)) {
        free(resolved);
        return NULL;
    }
    struct stat info;
    if (stat(resolved, &info) != 0 || !S_ISREG(info.st_mode)) {
        free(resolved);
        return NULL;
    }
    return resolved;
}

static int verify_directory_inside(const FileTools *tools, const char *path) {
    char *resolved = realpath(path, NULL);
    int valid = resolved && path_is_inside(tools->workspace, resolved);
    free(resolved);
    return valid;
}

static int ensure_parent_directories(const FileTools *tools, char *path) {
    char *last_separator = strrchr(path, '/');
    if (!last_separator) return -1;
    *last_separator = '\0';
    size_t root_length = strlen(tools->workspace);
    if (strncmp(path, tools->workspace, root_length) != 0 ||
        (path[root_length] != '\0' && path[root_length] != '/')) {
        *last_separator = '/';
        return -1;
    }

    for (char *cursor = path + root_length; *cursor; cursor++) {
        if (*cursor != '/') continue;
        *cursor = '\0';
        if (mkdir(path, 0700) != 0 && errno != EEXIST) {
            *cursor = '/';
            *last_separator = '/';
            return -1;
        }
        if (!verify_directory_inside(tools, path)) {
            *cursor = '/';
            *last_separator = '/';
            return -1;
        }
        *cursor = '/';
    }
    if (mkdir(path, 0700) != 0 && errno != EEXIST) {
        *last_separator = '/';
        return -1;
    }
    int valid = verify_directory_inside(tools, path);
    *last_separator = '/';
    return valid ? 0 : -1;
}

static char *resolve_write_path(const FileTools *tools, const char *relative) {
    if (!tools || !tools->workspace || !is_safe_relative_path(relative)) return NULL;
    char *candidate = join_path(tools->workspace, relative);
    if (!candidate) return NULL;
    if (ensure_parent_directories(tools, candidate) != 0) {
        free(candidate);
        return NULL;
    }
    struct stat info;
    if (lstat(candidate, &info) == 0 && S_ISLNK(info.st_mode)) {
        char *resolved = realpath(candidate, NULL);
        int valid = resolved && path_is_inside(tools->workspace, resolved);
        free(resolved);
        if (!valid) {
            free(candidate);
            return NULL;
        }
    }
    return candidate;
}

static const char *argument_string(JsonValue *arguments, const char *name) {
    return json_string_value(json_object_get(arguments, name));
}

static int read_file_contents(const char *path, char **contents, size_t *length) {
    *contents = NULL;
    *length = 0;
    FILE *file = fopen(path, "rb");
    if (!file) return -1;
    if (fseek(file, 0, SEEK_END) != 0) {
        fclose(file);
        return -1;
    }
    long file_length = ftell(file);
    if (file_length < 0 || (unsigned long)file_length > FILE_TOOL_MAX_INPUT) {
        fclose(file);
        return -1;
    }
    rewind(file);
    char *buffer = malloc((size_t)file_length + 1);
    if (!buffer) {
        fclose(file);
        return -1;
    }
    size_t actual = fread(buffer, 1, (size_t)file_length, file);
    int failed = ferror(file);
    fclose(file);
    if (failed || actual != (size_t)file_length) {
        free(buffer);
        return -1;
    }
    buffer[actual] = '\0';
    *contents = buffer;
    *length = actual;
    return 0;
}

static int write_file_contents(const char *path, const char *contents) {
    FILE *file = fopen(path, "wb");
    if (!file) return -1;
    size_t length = strlen(contents);
    int failed = fwrite(contents, 1, length, file) != length;
    if (fclose(file) != 0) failed = 1;
    return failed ? -1 : 0;
}

int file_tools_init(FileTools *tools, const char *workspace) {
    memset(tools, 0, sizeof(*tools));
    tools->workspace = realpath(workspace, NULL);
    if (!tools->workspace) tools->workspace = workspace ? strdup(workspace) : NULL;
    return tools->workspace ? 0 : -1;
}

void file_tools_free(FileTools *tools) {
    if (!tools) return;
    free(tools->workspace);
    memset(tools, 0, sizeof(*tools));
}

int file_read_execute(const char *arguments_json, char *output, size_t output_capacity, void *context) {
    FileTools *tools = context;
    JsonValue *arguments = json_parse(arguments_json ? arguments_json : "{}");
    const char *relative = argument_string(arguments, "path");
    char *path = resolve_existing_path(tools, relative);
    if (!path) {
        set_output(output, output_capacity, "Error: path must be an existing file inside the workspace");
        json_destroy(arguments);
        return -1;
    }

    JsonValue *limit_value = json_object_get(arguments, "limit");
    double limit_number = json_is_number(limit_value) ? json_number_value(limit_value) : 0;
    size_t line_limit = limit_number > 0 && limit_number <= (double)SIZE_MAX ? (size_t)limit_number : 0;
    FILE *file = fopen(path, "rb");
    free(path);
    if (!file) {
        set_output(output, output_capacity, "Error: failed to open file");
        json_destroy(arguments);
        return -1;
    }
    size_t length = 0, lines = 0;
    int character;
    while (output_capacity > 1 && length + 1 < output_capacity && (character = fgetc(file)) != EOF) {
        output[length++] = (char)character;
        if (character == '\n') {
            lines++;
            if (line_limit && lines >= line_limit) break;
        }
    }
    output[length] = '\0';
    fclose(file);
    json_destroy(arguments);
    return 0;
}

int file_write_execute(const char *arguments_json, char *output, size_t output_capacity, void *context) {
    FileTools *tools = context;
    JsonValue *arguments = json_parse(arguments_json ? arguments_json : "{}");
    const char *relative = argument_string(arguments, "path");
    const char *contents = argument_string(arguments, "content");
    if (!contents) contents = "";
    char *path = resolve_write_path(tools, relative);
    if (!path) {
        set_output(output, output_capacity, "Error: path must stay inside the workspace");
        json_destroy(arguments);
        return -1;
    }
    int result = write_file_contents(path, contents);
    if (result == 0) {
        snprintf(output, output_capacity, "Wrote %zu characters to %s", strlen(contents), relative);
    } else {
        set_output(output, output_capacity, "Error: failed to write file");
    }
    free(path);
    json_destroy(arguments);
    return result;
}

int file_edit_execute(const char *arguments_json, char *output, size_t output_capacity, void *context) {
    FileTools *tools = context;
    JsonValue *arguments = json_parse(arguments_json ? arguments_json : "{}");
    const char *relative = argument_string(arguments, "path");
    const char *old_text = argument_string(arguments, "old_text");
    const char *new_text = argument_string(arguments, "new_text");
    char *path = resolve_existing_path(tools, relative);
    if (!path || !old_text || !old_text[0] || !new_text) {
        set_output(output, output_capacity, "Error: path, old_text and new_text are required");
        free(path);
        json_destroy(arguments);
        return -1;
    }

    char *contents = NULL;
    size_t contents_length = 0;
    if (read_file_contents(path, &contents, &contents_length) != 0) {
        set_output(output, output_capacity, "Error: failed to read file");
        free(path);
        json_destroy(arguments);
        return -1;
    }
    const char *first = strstr(contents, old_text);
    size_t occurrences = 0;
    for (const char *cursor = first; cursor; cursor = strstr(cursor + 1, old_text)) occurrences++;
    if (!first) {
        set_output(output, output_capacity, "Error: old_text not found");
        free(contents);
        free(path);
        json_destroy(arguments);
        return -1;
    }
    if (occurrences > 1) {
        snprintf(output, output_capacity, "Error: old_text is not unique (%zu matches)", occurrences);
        free(contents);
        free(path);
        json_destroy(arguments);
        return -1;
    }

    StringBuilder *builder = string_builder_create();
    size_t prefix_length = (size_t)(first - contents);
    int build_failed = !builder || string_builder_append_n(builder, contents, prefix_length) != 0 ||
                       string_builder_append(builder, new_text) != 0 ||
                       string_builder_append(builder, first + strlen(old_text)) != 0;
    int write_failed = build_failed || write_file_contents(path, string_builder_data(builder)) != 0;
    if (write_failed) set_output(output, output_capacity, "Error: failed to edit file");
    else snprintf(output, output_capacity, "Edited %s", relative);
    string_builder_destroy(builder);
    free(contents);
    free(path);
    json_destroy(arguments);
    return write_failed ? -1 : 0;
}

ToolDefinition file_read_definition(FileTools *tools) {
    static const char *parameters =
        "{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\"},"
        "\"limit\":{\"type\":\"number\"}},\"required\":[\"path\"],"
        "\"additionalProperties\":false}";
    return (ToolDefinition){.name = "read_file", .description = "Read a UTF-8 text file inside the workspace",
                             .parameters_json = parameters, .execute = file_read_execute, .context = tools};
}

ToolDefinition file_write_definition(FileTools *tools) {
    static const char *parameters =
        "{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\"},"
        "\"content\":{\"type\":\"string\"}},\"required\":[\"path\",\"content\"],"
        "\"additionalProperties\":false}";
    return (ToolDefinition){.name = "write_file", .description = "Write a UTF-8 text file inside the workspace",
                             .parameters_json = parameters, .execute = file_write_execute, .context = tools};
}

ToolDefinition file_edit_definition(FileTools *tools) {
    static const char *parameters =
        "{\"type\":\"object\",\"properties\":{\"path\":{\"type\":\"string\"},"
        "\"old_text\":{\"type\":\"string\"},\"new_text\":{\"type\":\"string\"}},"
        "\"required\":[\"path\",\"old_text\",\"new_text\"],\"additionalProperties\":false}";
    return (ToolDefinition){.name = "edit_file",
                             .description = "Replace one unique text fragment in a workspace file",
                             .parameters_json = parameters, .execute = file_edit_execute, .context = tools};
}
