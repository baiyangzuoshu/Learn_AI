#include "tool.h"

#include <stdlib.h>
#include <string.h>

int tool_registry_init(ToolRegistry *registry) {
    memset(registry, 0, sizeof(*registry));
    registry->ordered = vector_create(free);
    registry->by_name = hash_map_create(0, NULL);
    if (!registry->ordered || !registry->by_name) {
        tool_registry_free(registry);
        return -1;
    }
    return 0;
}

void tool_registry_free(ToolRegistry *registry) {
    if (!registry) return;
    vector_destroy(registry->ordered);
    hash_map_destroy(registry->by_name);
    memset(registry, 0, sizeof(*registry));
}

int tool_registry_add(ToolRegistry *registry, ToolDefinition definition) {
    if (!registry || !registry->ordered || !registry->by_name || !definition.name || !definition.description ||
        !definition.parameters_json || !definition.execute || hash_map_contains(registry->by_name, definition.name)) {
        return -1;
    }
    ToolDefinition *stored = malloc(sizeof(*stored));
    if (!stored) return -1;
    *stored = definition;
    if (vector_push_back(registry->ordered, stored) != 0) {
        free(stored);
        return -1;
    }
    if (hash_map_set(registry->by_name, definition.name, stored) != 0) {
        (void)vector_pop_back(registry->ordered);
        free(stored);
        return -1;
    }
    return 0;
}

const ToolDefinition *tool_registry_find(const ToolRegistry *registry, const char *name) {
    return registry && name ? hash_map_get(registry->by_name, name) : NULL;
}

size_t tool_registry_count(const ToolRegistry *registry) {
    return registry ? vector_size(registry->ordered) : 0;
}

const ToolDefinition *tool_registry_at(const ToolRegistry *registry, size_t index) {
    return registry ? vector_get(registry->ordered, index) : NULL;
}

JsonValue *tool_registry_to_json(const ToolRegistry *registry) {
    JsonValue *tools = json_array_create();
    if (!tools) return NULL;
    for (size_t i = 0; i < tool_registry_count(registry); i++) {
        const ToolDefinition *definition = tool_registry_at(registry, i);
        JsonValue *parameters = json_parse(definition->parameters_json);
        JsonValue *tool = json_object_create();
        JsonValue *function = json_object_create();
        if (!parameters || !tool || !function) {
            json_destroy(parameters);
            json_destroy(tool);
            json_destroy(function);
            json_destroy(tools);
            return NULL;
        }
        if (json_object_set_string(tool, "type", "function") != 0 ||
            json_object_set_string(function, "name", definition->name) != 0 ||
            json_object_set_string(function, "description", definition->description) != 0 ||
            json_object_set(function, "parameters", parameters) != 0) {
            json_destroy(parameters);
            json_destroy(function);
            json_destroy(tool);
            json_destroy(tools);
            return NULL;
        }
        parameters = NULL;
        if (json_object_set(tool, "function", function) != 0) {
            json_destroy(function);
            json_destroy(tool);
            json_destroy(tools);
            return NULL;
        }
        function = NULL;
        if (json_array_append(tools, tool) != 0) {
            json_destroy(tool);
            json_destroy(tools);
            return NULL;
        }
    }
    return tools;
}
