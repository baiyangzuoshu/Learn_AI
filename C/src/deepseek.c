#include "deepseek.h"

#include "http.h"

#include <cjson/cJSON.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static cJSON *message_to_json(const Message *message) {
    cJSON *json = cJSON_CreateObject();
    if (!json) return NULL;
    cJSON_AddStringToObject(json, "role", message_role_name(message->role));
    if (message->content) cJSON_AddStringToObject(json, "content", message->content);
    else cJSON_AddNullToObject(json, "content");
    if (message->tool_call_id) cJSON_AddStringToObject(json, "tool_call_id", message->tool_call_id);

    if (message->tool_call_count) {
        cJSON *calls = cJSON_CreateArray();
        if (!calls) {
            cJSON_Delete(json);
            return NULL;
        }
        for (size_t i = 0; i < message->tool_call_count; i++) {
            const ToolCall *call = &message->tool_calls[i];
            cJSON *call_json = cJSON_CreateObject();
            cJSON *function = cJSON_CreateObject();
            if (!call_json || !function) {
                cJSON_Delete(call_json);
                cJSON_Delete(function);
                cJSON_Delete(calls);
                cJSON_Delete(json);
                return NULL;
            }
            cJSON_AddStringToObject(call_json, "id", call->id ? call->id : "");
            cJSON_AddStringToObject(call_json, "type", "function");
            cJSON_AddStringToObject(function, "name", call->name ? call->name : "");
            cJSON_AddStringToObject(function, "arguments", call->arguments ? call->arguments : "{}");
            cJSON_AddItemToObject(call_json, "function", function);
            cJSON_AddItemToArray(calls, call_json);
        }
        cJSON_AddItemToObject(json, "tool_calls", calls);
    }
    return json;
}

static cJSON *request_to_json(const DeepSeekConfig *config, const MessageList *messages, const ToolRegistry *tools) {
    cJSON *root = cJSON_CreateObject();
    cJSON *message_array = cJSON_CreateArray();
    if (!root || !message_array) {
        cJSON_Delete(root);
        cJSON_Delete(message_array);
        return NULL;
    }
    cJSON_AddStringToObject(root, "model", config->model);
    for (size_t i = 0; i < messages->count; i++) {
        cJSON *message = message_to_json(&messages->items[i]);
        if (!message) {
            cJSON_Delete(root);
            cJSON_Delete(message_array);
            return NULL;
        }
        cJSON_AddItemToArray(message_array, message);
    }
    cJSON_AddItemToObject(root, "messages", message_array);
    if (tools && tools->count) {
        cJSON *tool_json = tool_registry_to_json(tools);
        if (!tool_json) {
            cJSON_Delete(root);
            return NULL;
        }
        cJSON_AddItemToObject(root, "tools", tool_json);
    }
    return root;
}

static int parse_assistant(const cJSON *root, Message *assistant, char *error, size_t error_capacity) {
    const cJSON *choices = cJSON_GetObjectItemCaseSensitive(root, "choices");
    const cJSON *choice = cJSON_IsArray(choices) ? cJSON_GetArrayItem(choices, 0) : NULL;
    const cJSON *message = choice ? cJSON_GetObjectItemCaseSensitive(choice, "message") : NULL;
    if (!cJSON_IsObject(message)) {
        snprintf(error, error_capacity, "model returned no assistant message");
        return -1;
    }

    const cJSON *content = cJSON_GetObjectItemCaseSensitive(message, "content");
    const cJSON *calls = cJSON_GetObjectItemCaseSensitive(message, "tool_calls");
    message_init(assistant, MESSAGE_ASSISTANT);
    if (cJSON_IsString(content) && message_set_content(assistant, content->valuestring) != 0) goto allocation_error;

    if (cJSON_IsArray(calls)) {
        cJSON *call = NULL;
        cJSON_ArrayForEach(call, calls) {
            const cJSON *function = cJSON_GetObjectItemCaseSensitive(call, "function");
            const cJSON *id = cJSON_GetObjectItemCaseSensitive(call, "id");
            const cJSON *name = function ? cJSON_GetObjectItemCaseSensitive(function, "name") : NULL;
            const cJSON *arguments = function ? cJSON_GetObjectItemCaseSensitive(function, "arguments") : NULL;
            if (!cJSON_IsString(name) || !cJSON_IsString(arguments) ||
                message_add_tool_call(assistant, cJSON_IsString(id) ? id->valuestring : "", name->valuestring,
                                       arguments->valuestring) != 0) {
                goto allocation_error;
            }
        }
    }
    return 0;

allocation_error:
    message_free(assistant);
    snprintf(error, error_capacity, "out of memory while parsing assistant message");
    return -1;
}

int deepseek_chat_completion(const DeepSeekConfig *config, const MessageList *messages, const ToolRegistry *tools,
                             Message *assistant, char *error, size_t error_capacity) {
    if (!config || !config->api_key || !config->base_url || !config->model) {
        snprintf(error, error_capacity, "DeepSeek configuration is incomplete");
        return -1;
    }
    cJSON *request = request_to_json(config, messages, tools);
    if (!request) {
        snprintf(error, error_capacity, "failed to build DeepSeek request");
        return -1;
    }
    char *body = cJSON_PrintUnformatted(request);
    cJSON_Delete(request);
    if (!body) {
        snprintf(error, error_capacity, "failed to encode DeepSeek request");
        return -1;
    }

    size_t url_length = strlen(config->base_url) + strlen("/chat/completions") + 2;
    char *url = malloc(url_length);
    if (!url) {
        free(body);
        snprintf(error, error_capacity, "out of memory while building DeepSeek URL");
        return -1;
    }
    snprintf(url, url_length, "%s%s/chat/completions", config->base_url,
             config->base_url[strlen(config->base_url) - 1] == '/' ? "" : "/");

    HttpResponse response;
    int http_result = http_post_json(url, config->api_key, body, &response, error, error_capacity);
    free(url);
    free(body);
    if (http_result != 0) return -1;

    cJSON *root = cJSON_Parse(response.body ? response.body : "");
    if (!root) {
        snprintf(error, error_capacity, "DeepSeek returned invalid JSON (HTTP %ld)", response.status_code);
        http_response_free(&response);
        return -1;
    }
    if (response.status_code < 200 || response.status_code >= 300) {
        const cJSON *api_error = cJSON_GetObjectItemCaseSensitive(root, "error");
        const cJSON *message = api_error ? cJSON_GetObjectItemCaseSensitive(api_error, "message") : NULL;
        snprintf(error, error_capacity, "DeepSeek HTTP %ld: %s", response.status_code,
                 cJSON_IsString(message) ? message->valuestring : "request failed");
        cJSON_Delete(root);
        http_response_free(&response);
        return -1;
    }
    int parse_result = parse_assistant(root, assistant, error, error_capacity);
    cJSON_Delete(root);
    http_response_free(&response);
    return parse_result;
}
