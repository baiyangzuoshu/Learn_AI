#ifndef C_AGENT_LIST_H
#define C_AGENT_LIST_H

#include <stdbool.h>
#include <stddef.h>

typedef void (*CollectionFreeFn)(void *value);

typedef struct List List;

/* The list takes ownership of a value only after a push operation succeeds. */
List *list_create(CollectionFreeFn free_value);
void list_destroy(List *list);
void list_clear(List *list);

size_t list_size(const List *list);
bool list_is_empty(const List *list);

int list_push_front(List *list, void *value);
int list_push_back(List *list, void *value);
void *list_pop_front(List *list);
void *list_pop_back(List *list);

void *list_front(const List *list);
void *list_back(const List *list);
void *list_get(const List *list, size_t index);

#endif
