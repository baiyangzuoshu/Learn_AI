#ifndef C_AGENT_JSON_H
#define C_AGENT_JSON_H

#include <stdbool.h>
#include <stddef.h>

typedef struct cJSON JsonValue;

JsonValue *json_parse(const char *text);
void json_destroy(JsonValue *value);
char *json_stringify(const JsonValue *value);

JsonValue *json_object_create(void);
JsonValue *json_array_create(void);
bool json_is_object(const JsonValue *value);
bool json_is_array(const JsonValue *value);
bool json_is_string(const JsonValue *value);
bool json_is_number(const JsonValue *value);

JsonValue *json_object_get(const JsonValue *object, const char *key);
const char *json_string_value(const JsonValue *value);
double json_number_value(const JsonValue *value);
size_t json_array_size(const JsonValue *array);
JsonValue *json_array_get(const JsonValue *array, size_t index);

int json_object_set_string(JsonValue *object, const char *key, const char *value);
int json_object_set_null(JsonValue *object, const char *key);
int json_object_set(JsonValue *object, const char *key, JsonValue *value);
int json_array_append(JsonValue *array, JsonValue *value);

#endif
