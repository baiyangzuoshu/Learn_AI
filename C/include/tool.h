#ifndef C_AGENT_TOOL_H
#define C_AGENT_TOOL_H

#include "hash_map.h"
#include "json.h"
#include "vector.h"

#include <stddef.h>

typedef int (*ToolExecuteFn)(const char *arguments_json, char *output, size_t output_capacity, void *context);

typedef struct {
    const char *name;
    const char *description;
    const char *parameters_json;
    ToolExecuteFn execute;
    void *context;
} ToolDefinition;

typedef struct {
    Vector *ordered;
    HashMap *by_name;
} ToolRegistry;

int tool_registry_init(ToolRegistry *registry);
void tool_registry_free(ToolRegistry *registry);
int tool_registry_add(ToolRegistry *registry, ToolDefinition definition);
const ToolDefinition *tool_registry_find(const ToolRegistry *registry, const char *name);
size_t tool_registry_count(const ToolRegistry *registry);
const ToolDefinition *tool_registry_at(const ToolRegistry *registry, size_t index);

JsonValue *tool_registry_to_json(const ToolRegistry *registry);

#endif
