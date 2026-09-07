#include "hash_map.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef enum {
    BUCKET_EMPTY,
    BUCKET_OCCUPIED,
    BUCKET_TOMBSTONE,
} BucketState;

typedef struct {
    char *key;
    void *value;
    BucketState state;
} Bucket;

struct HashMap {
    Bucket *buckets;
    size_t capacity;
    size_t size;
    size_t used;
    CollectionFreeFn free_value;
};

static size_t next_power_of_two(size_t value) {
    size_t capacity = 8;
    while (capacity < value) {
        if (capacity > SIZE_MAX / 2) return 0;
        capacity *= 2;
    }
    return capacity;
}

static size_t hash_key(const char *key) {
    size_t hash = (size_t)1469598103934665603ULL;
    for (const unsigned char *cursor = (const unsigned char *)key; *cursor; cursor++) {
        hash ^= *cursor;
        hash *= (size_t)1099511628211ULL;
    }
    return hash;
}

static char *copy_key(const char *key) {
    size_t length = strlen(key) + 1;
    char *copy = malloc(length);
    if (copy) memcpy(copy, key, length);
    return copy;
}

static size_t find_bucket(const HashMap *map, const char *key, bool *found) {
    size_t index = hash_key(key) & (map->capacity - 1);
    size_t first_tombstone = SIZE_MAX;
    for (size_t probes = 0; probes < map->capacity; probes++) {
        const Bucket *bucket = &map->buckets[index];
        if (bucket->state == BUCKET_EMPTY) {
            *found = false;
            return first_tombstone != SIZE_MAX ? first_tombstone : index;
        }
        if (bucket->state == BUCKET_OCCUPIED && strcmp(bucket->key, key) == 0) {
            *found = true;
            return index;
        }
        if (bucket->state == BUCKET_TOMBSTONE && first_tombstone == SIZE_MAX) first_tombstone = index;
        index = (index + 1) & (map->capacity - 1);
    }
    *found = false;
    return first_tombstone;
}

static int rehash(HashMap *map, size_t capacity) {
    Bucket *buckets = calloc(capacity, sizeof(*buckets));
    if (!buckets) return -1;
    Bucket *old_buckets = map->buckets;
    size_t old_capacity = map->capacity;
    map->buckets = buckets;
    map->capacity = capacity;
    map->used = map->size;
    for (size_t i = 0; i < old_capacity; i++) {
        Bucket *old = &old_buckets[i];
        if (old->state != BUCKET_OCCUPIED) continue;
        bool found = false;
        size_t index = find_bucket(map, old->key, &found);
        map->buckets[index] = *old;
    }
    free(old_buckets);
    return 0;
}

static int prepare_insert(HashMap *map) {
    if ((map->used + 1) * 10 < map->capacity * 7) return 0;
    if (map->size * 10 < map->capacity * 7) return rehash(map, map->capacity);
    if (map->capacity > SIZE_MAX / 2) return -1;
    return rehash(map, map->capacity * 2);
}

HashMap *hash_map_create(size_t initial_capacity, CollectionFreeFn free_value) {
    HashMap *map = calloc(1, sizeof(*map));
    if (!map) return NULL;
    map->capacity = next_power_of_two(initial_capacity);
    if (map->capacity == 0) {
        free(map);
        return NULL;
    }
    map->buckets = calloc(map->capacity, sizeof(*map->buckets));
    if (!map->buckets) {
        free(map);
        return NULL;
    }
    map->free_value = free_value;
    return map;
}

void hash_map_clear(HashMap *map) {
    if (!map) return;
    for (size_t i = 0; i < map->capacity; i++) {
        Bucket *bucket = &map->buckets[i];
        if (bucket->state == BUCKET_OCCUPIED) {
            free(bucket->key);
            if (map->free_value) map->free_value(bucket->value);
        }
    }
    memset(map->buckets, 0, map->capacity * sizeof(*map->buckets));
    map->size = 0;
    map->used = 0;
}

void hash_map_destroy(HashMap *map) {
    if (!map) return;
    hash_map_clear(map);
    free(map->buckets);
    free(map);
}

size_t hash_map_size(const HashMap *map) {
    return map ? map->size : 0;
}

bool hash_map_is_empty(const HashMap *map) {
    return hash_map_size(map) == 0;
}

int hash_map_set(HashMap *map, const char *key, void *value) {
    if (!map || !key) return -1;
    bool found = false;
    size_t index = find_bucket(map, key, &found);
    if (found) {
        if (map->buckets[index].value != value && map->free_value) map->free_value(map->buckets[index].value);
        map->buckets[index].value = value;
        return 0;
    }
    if (prepare_insert(map) != 0) return -1;
    index = find_bucket(map, key, &found);
    char *key_copy = copy_key(key);
    if (!key_copy) return -1;
    Bucket *bucket = &map->buckets[index];
    if (bucket->state == BUCKET_EMPTY) map->used++;
    bucket->key = key_copy;
    bucket->value = value;
    bucket->state = BUCKET_OCCUPIED;
    map->size++;
    return 0;
}

void *hash_map_get(const HashMap *map, const char *key) {
    if (!map || !key) return NULL;
    bool found = false;
    size_t index = find_bucket(map, key, &found);
    return found ? map->buckets[index].value : NULL;
}

bool hash_map_contains(const HashMap *map, const char *key) {
    if (!map || !key) return false;
    bool found = false;
    (void)find_bucket(map, key, &found);
    return found;
}

void *hash_map_remove(HashMap *map, const char *key) {
    if (!map || !key) return NULL;
    bool found = false;
    size_t index = find_bucket(map, key, &found);
    if (!found) return NULL;
    Bucket *bucket = &map->buckets[index];
    void *value = bucket->value;
    free(bucket->key);
    bucket->key = NULL;
    bucket->value = NULL;
    bucket->state = BUCKET_TOMBSTONE;
    map->size--;
    return value;
}
