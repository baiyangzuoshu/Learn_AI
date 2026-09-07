#ifndef C_AGENT_HASH_MAP_H
#define C_AGENT_HASH_MAP_H

#include "list.h"

#include <stdbool.h>
#include <stddef.h>

typedef struct HashMap HashMap;

HashMap *hash_map_create(size_t initial_capacity, CollectionFreeFn free_value);
void hash_map_destroy(HashMap *map);
void hash_map_clear(HashMap *map);

size_t hash_map_size(const HashMap *map);
bool hash_map_is_empty(const HashMap *map);

/* set copies key and takes ownership of value after success. Replacing a key frees its old value. */
int hash_map_set(HashMap *map, const char *key, void *value);
void *hash_map_get(const HashMap *map, const char *key);
bool hash_map_contains(const HashMap *map, const char *key);
/* remove transfers the value to the caller; the key is always discarded. */
void *hash_map_remove(HashMap *map, const char *key);

#endif
