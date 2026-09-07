#include "list.h"

#include <stdlib.h>

typedef struct ListNode {
    void *value;
    struct ListNode *next;
} ListNode;

struct List {
    ListNode *head;
    ListNode *tail;
    size_t size;
    CollectionFreeFn free_value;
};

static ListNode *node_create(void *value) {
    ListNode *node = malloc(sizeof(*node));
    if (!node) return NULL;
    node->value = value;
    node->next = NULL;
    return node;
}

List *list_create(CollectionFreeFn free_value) {
    List *list = calloc(1, sizeof(*list));
    if (!list) return NULL;
    list->free_value = free_value;
    return list;
}

void list_clear(List *list) {
    if (!list) return;
    ListNode *node = list->head;
    while (node) {
        ListNode *next = node->next;
        if (list->free_value) list->free_value(node->value);
        free(node);
        node = next;
    }
    list->head = NULL;
    list->tail = NULL;
    list->size = 0;
}

void list_destroy(List *list) {
    if (!list) return;
    list_clear(list);
    free(list);
}

size_t list_size(const List *list) {
    return list ? list->size : 0;
}

bool list_is_empty(const List *list) {
    return list_size(list) == 0;
}

int list_push_front(List *list, void *value) {
    if (!list) return -1;
    ListNode *node = node_create(value);
    if (!node) return -1;
    node->next = list->head;
    list->head = node;
    if (!list->tail) list->tail = node;
    list->size++;
    return 0;
}

int list_push_back(List *list, void *value) {
    if (!list) return -1;
    ListNode *node = node_create(value);
    if (!node) return -1;
    if (list->tail) list->tail->next = node;
    else list->head = node;
    list->tail = node;
    list->size++;
    return 0;
}

void *list_pop_front(List *list) {
    if (!list || !list->head) return NULL;
    ListNode *node = list->head;
    void *value = node->value;
    list->head = node->next;
    if (!list->head) list->tail = NULL;
    list->size--;
    free(node);
    return value;
}

void *list_pop_back(List *list) {
    if (!list || !list->tail) return NULL;
    ListNode *previous = NULL;
    ListNode *node = list->head;
    while (node->next) {
        previous = node;
        node = node->next;
    }
    if (previous) previous->next = NULL;
    else list->head = NULL;
    list->tail = previous;
    list->size--;
    void *value = node->value;
    free(node);
    return value;
}

void *list_front(const List *list) {
    return list && list->head ? list->head->value : NULL;
}

void *list_back(const List *list) {
    return list && list->tail ? list->tail->value : NULL;
}

void *list_get(const List *list, size_t index) {
    if (!list || index >= list->size) return NULL;
    ListNode *node = list->head;
    for (size_t i = 0; i < index; i++) node = node->next;
    return node->value;
}
