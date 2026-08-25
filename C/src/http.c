#include "http.h"

#include <curl/curl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char *data;
    size_t length;
    size_t capacity;
} Buffer;

static size_t write_body(void *contents, size_t size, size_t count, void *user_data) {
    size_t bytes = size * count;
    Buffer *buffer = user_data;
    if (buffer->length + bytes + 1 > buffer->capacity) {
        size_t next_capacity = buffer->capacity ? buffer->capacity : 4096;
        while (next_capacity < buffer->length + bytes + 1) next_capacity *= 2;
        char *next = realloc(buffer->data, next_capacity);
        if (!next) return 0;
        buffer->data = next;
        buffer->capacity = next_capacity;
    }
    memcpy(buffer->data + buffer->length, contents, bytes);
    buffer->length += bytes;
    buffer->data[buffer->length] = '\0';
    return bytes;
}

int http_post_json(const char *url, const char *api_key, const char *body, HttpResponse *response, char *error,
                   size_t error_capacity) {
    memset(response, 0, sizeof(*response));
    if (error && error_capacity) error[0] = '\0';

    CURL *curl = curl_easy_init();
    if (!curl) {
        snprintf(error, error_capacity, "failed to initialize curl");
        return -1;
    }

    Buffer buffer = {0};
    struct curl_slist *headers = NULL;
    char authorization[1024];
    snprintf(authorization, sizeof(authorization), "Authorization: Bearer %s", api_key);
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, authorization);

    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_body);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &buffer);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 120L);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "learn-ai-c-agent/1.0");

    CURLcode result = curl_easy_perform(curl);
    if (result != CURLE_OK) snprintf(error, error_capacity, "HTTP request failed: %s", curl_easy_strerror(result));
    if (result == CURLE_OK) curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response->status_code);
    response->body = buffer.data;
    response->body_length = buffer.length;

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    if (result != CURLE_OK) {
        http_response_free(response);
        return -1;
    }
    return 0;
}

void http_response_free(HttpResponse *response) {
    free(response->body);
    memset(response, 0, sizeof(*response));
}
