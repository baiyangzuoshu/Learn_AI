#include "json.h"

#include <cjson/cJSON.h>
#include <limits.h>
#include <stdlib.h>

JsonValue *json_parse(const char *text) {
    return text ? cJSON_Parse(text) : NULL;
}

void json_destroy(JsonValue *value) {
    cJSON_Delete(value);
}

char *json_stringify(const JsonValue *value) {
    return value ? cJSON_PrintUnformatted(value) : NULL;
}

JsonValue *json_object_create(void) {
    return cJSON_CreateObject();
}

JsonValue *json_array_create(void) {
    return cJSON_CreateArray();
}

bool json_is_object(const JsonValue *value) {
    return value && cJSON_IsObject(value);
}

bool json_is_array(const JsonValue *value) {
    return value && cJSON_IsArray(value);
}

bool json_is_string(const JsonValue *value) {
    return value && cJSON_IsString(value);
}

bool json_is_number(const JsonValue *value) {
    return value && cJSON_IsNumber(value);
}

JsonValue *json_object_get(const JsonValue *object, const char *key) {
    return object && key ? cJSON_GetObjectItemCaseSensitive(object, key) : NULL;
}

const char *json_string_value(const JsonValue *value) {
    return json_is_string(value) ? value->valuestring : NULL;
}

double json_number_value(const JsonValue *value) {
    return json_is_number(value) ? value->valuedouble : 0;
}

size_t json_array_size(const JsonValue *array) {
    return json_is_array(array) ? (size_t)cJSON_GetArraySize(array) : 0;
}

JsonValue *json_array_get(const JsonValue *array, size_t index) {
    return json_is_array(array) && index <= INT_MAX ? cJSON_GetArrayItem(array, (int)index) : NULL;
}

int json_object_set_string(JsonValue *object, const char *key, const char *value) {
    return json_is_object(object) && key && value && cJSON_AddStringToObject(object, key, value) ? 0 : -1;
}

int json_object_set_null(JsonValue *object, const char *key) {
    return json_is_object(object) && key && cJSON_AddNullToObject(object, key) ? 0 : -1;
}

int json_object_set(JsonValue *object, const char *key, JsonValue *value) {
    if (!json_is_object(object) || !key || !value) return -1;
    return cJSON_AddItemToObject(object, key, value) ? 0 : -1;
}

int json_array_append(JsonValue *array, JsonValue *value) {
    if (!json_is_array(array) || !value) return -1;
    return cJSON_AddItemToArray(array, value) ? 0 : -1;
}
