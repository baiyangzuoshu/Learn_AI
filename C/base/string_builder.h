#ifndef C_AGENT_STRING_BUILDER_H
#define C_AGENT_STRING_BUILDER_H

#include <stddef.h>

typedef struct StringBuilder StringBuilder;

StringBuilder *string_builder_create(void);
void string_builder_destroy(StringBuilder *builder);
void string_builder_clear(StringBuilder *builder);

size_t string_builder_length(const StringBuilder *builder);
size_t string_builder_capacity(const StringBuilder *builder);
const char *string_builder_data(const StringBuilder *builder);

int string_builder_append(StringBuilder *builder, const char *text);
int string_builder_append_n(StringBuilder *builder, const char *text, size_t length);
int string_builder_append_char(StringBuilder *builder, char value);
int string_builder_append_format(StringBuilder *builder, const char *format, ...);

#endif
