#include "tool.h"

#include <cjson/cJSON.h>
#include <stdlib.h>
#include <string.h>

void tool_registry_init(ToolRegistry *registry) {
    memset(registry, 0, sizeof(*registry));
}

void tool_registry_free(ToolRegistry *registry) {
    free(registry->items);
    memset(registry, 0, sizeof(*registry));
}

int tool_registry_add(ToolRegistry *registry, ToolDefinition definition) {
    if (!definition.name || !definition.description || !definition.parameters_json || !definition.execute) return -1;
    if (registry->count == registry->capacity) {
        size_t next_capacity = registry->capacity ? registry->capacity * 2 : 4;
        ToolDefinition *next = realloc(registry->items, next_capacity * sizeof(*next));
        if (!next) return -1;
        registry->items = next;
        registry->capacity = next_capacity;
    }
    registry->items[registry->count++] = definition;
    return 0;
}

const ToolDefinition *tool_registry_find(const ToolRegistry *registry, const char *name) {
    for (size_t i = 0; i < registry->count; i++) {
        if (strcmp(registry->items[i].name, name) == 0) return &registry->items[i];
    }
    return NULL;
}

struct cJSON *tool_registry_to_json(const ToolRegistry *registry) {
    cJSON *tools = cJSON_CreateArray();
    if (!tools) return NULL;
    for (size_t i = 0; i < registry->count; i++) {
        const ToolDefinition *definition = &registry->items[i];
        cJSON *parameters = cJSON_Parse(definition->parameters_json);
        cJSON *tool = cJSON_CreateObject();
        cJSON *function = cJSON_CreateObject();
        if (!parameters || !tool || !function) {
            cJSON_Delete(parameters);
            cJSON_Delete(tool);
            cJSON_Delete(function);
            cJSON_Delete(tools);
            return NULL;
        }
        cJSON_AddStringToObject(tool, "type", "function");
        cJSON_AddStringToObject(function, "name", definition->name);
        cJSON_AddStringToObject(function, "description", definition->description);
        cJSON_AddItemToObject(function, "parameters", parameters);
        cJSON_AddItemToObject(tool, "function", function);
        cJSON_AddItemToArray(tools, tool);
    }
    return tools;
}
