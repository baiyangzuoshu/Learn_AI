#ifndef C_AGENT_HTTP_H
#define C_AGENT_HTTP_H

#include <stddef.h>

typedef struct {
    long status_code;
    char *body;
    size_t body_length;
} HttpResponse;

int http_post_json(const char *url, const char *api_key, const char *body, HttpResponse *response, char *error,
                   size_t error_capacity);
void http_response_free(HttpResponse *response);

#endif
