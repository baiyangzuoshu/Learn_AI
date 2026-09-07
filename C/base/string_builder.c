#include "string_builder.h"

#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct StringBuilder {
    char *data;
    size_t length;
    size_t capacity;
};

static int ensure_capacity(StringBuilder *builder, size_t additional) {
    if (additional > SIZE_MAX - builder->length - 1) return -1;
    size_t required = builder->length + additional + 1;
    if (required <= builder->capacity) return 0;
    size_t next_capacity = builder->capacity ? builder->capacity : 32;
    while (next_capacity < required) {
        if (next_capacity > SIZE_MAX / 2) {
            next_capacity = required;
            break;
        }
        next_capacity *= 2;
    }
    char *data = realloc(builder->data, next_capacity);
    if (!data) return -1;
    builder->data = data;
    builder->capacity = next_capacity;
    return 0;
}

StringBuilder *string_builder_create(void) {
    StringBuilder *builder = calloc(1, sizeof(*builder));
    if (!builder) return NULL;
    if (ensure_capacity(builder, 0) != 0) {
        free(builder);
        return NULL;
    }
    builder->data[0] = '\0';
    return builder;
}

void string_builder_clear(StringBuilder *builder) {
    if (!builder) return;
    builder->length = 0;
    if (builder->data) builder->data[0] = '\0';
}

void string_builder_destroy(StringBuilder *builder) {
    if (!builder) return;
    free(builder->data);
    free(builder);
}

size_t string_builder_length(const StringBuilder *builder) {
    return builder ? builder->length : 0;
}

size_t string_builder_capacity(const StringBuilder *builder) {
    return builder ? builder->capacity : 0;
}

const char *string_builder_data(const StringBuilder *builder) {
    return builder && builder->data ? builder->data : "";
}

int string_builder_append_n(StringBuilder *builder, const char *text, size_t length) {
    if (!builder || (!text && length > 0)) return -1;
    if (ensure_capacity(builder, length) != 0) return -1;
    if (length > 0) memcpy(builder->data + builder->length, text, length);
    builder->length += length;
    builder->data[builder->length] = '\0';
    return 0;
}

int string_builder_append(StringBuilder *builder, const char *text) {
    return text ? string_builder_append_n(builder, text, strlen(text)) : -1;
}

int string_builder_append_char(StringBuilder *builder, char value) {
    return string_builder_append_n(builder, &value, 1);
}

int string_builder_append_format(StringBuilder *builder, const char *format, ...) {
    if (!builder || !format) return -1;
    va_list arguments;
    va_start(arguments, format);
    va_list measure;
    va_copy(measure, arguments);
    int required = vsnprintf(NULL, 0, format, measure);
    va_end(measure);
    if (required < 0 || ensure_capacity(builder, (size_t)required) != 0) {
        va_end(arguments);
        return -1;
    }
    int written = vsnprintf(builder->data + builder->length, builder->capacity - builder->length,
                            format, arguments);
    va_end(arguments);
    if (written < 0 || written != required) return -1;
    builder->length += (size_t)written;
    return 0;
}
