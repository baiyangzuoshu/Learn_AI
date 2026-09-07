#include "deepseek.h"

#include "http.h"
#include "string_builder.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static JsonValue *message_to_json(const Message *message) {
    JsonValue *json = json_object_create();
    if (!json) return NULL;
    if (json_object_set_string(json, "role", message_role_name(message->role)) != 0 ||
        (message->content ? json_object_set_string(json, "content", message->content)
                          : json_object_set_null(json, "content")) != 0 ||
        (message->tool_call_id && json_object_set_string(json, "tool_call_id", message->tool_call_id) != 0)) {
        json_destroy(json);
        return NULL;
    }

    if (message->tool_call_count) {
        JsonValue *calls = json_array_create();
        if (!calls) {
            json_destroy(json);
            return NULL;
        }
        for (size_t i = 0; i < message->tool_call_count; i++) {
            const ToolCall *call = &message->tool_calls[i];
            JsonValue *call_json = json_object_create();
            JsonValue *function = json_object_create();
            if (!call_json || !function ||
                json_object_set_string(call_json, "id", call->id ? call->id : "") != 0 ||
                json_object_set_string(call_json, "type", "function") != 0 ||
                json_object_set_string(function, "name", call->name ? call->name : "") != 0 ||
                json_object_set_string(function, "arguments", call->arguments ? call->arguments : "{}") != 0) {
                json_destroy(call_json);
                json_destroy(function);
                json_destroy(calls);
                json_destroy(json);
                return NULL;
            }
            if (json_object_set(call_json, "function", function) != 0) {
                json_destroy(function);
                json_destroy(call_json);
                json_destroy(calls);
                json_destroy(json);
                return NULL;
            }
            if (json_array_append(calls, call_json) != 0) {
                json_destroy(call_json);
                json_destroy(calls);
                json_destroy(json);
                return NULL;
            }
        }
        if (json_object_set(json, "tool_calls", calls) != 0) {
            json_destroy(calls);
            json_destroy(json);
            return NULL;
        }
    }
    return json;
}

static JsonValue *request_to_json(const DeepSeekConfig *config, const MessageList *messages,
                                  const ToolRegistry *tools) {
    JsonValue *root = json_object_create();
    JsonValue *message_array = json_array_create();
    if (!root || !message_array || json_object_set_string(root, "model", config->model) != 0) {
        json_destroy(root);
        json_destroy(message_array);
        return NULL;
    }
    for (size_t i = 0; i < message_list_count(messages); i++) {
        const Message *stored_message = message_list_get(messages, i);
        JsonValue *message = stored_message ? message_to_json(stored_message) : NULL;
        if (!message || json_array_append(message_array, message) != 0) {
            json_destroy(message);
            json_destroy(root);
            json_destroy(message_array);
            return NULL;
        }
    }
    if (json_object_set(root, "messages", message_array) != 0) {
        json_destroy(message_array);
        json_destroy(root);
        return NULL;
    }
    if (tools && tool_registry_count(tools)) {
        JsonValue *tool_json = tool_registry_to_json(tools);
        if (!tool_json || json_object_set(root, "tools", tool_json) != 0) {
            json_destroy(tool_json);
            json_destroy(root);
            return NULL;
        }
    }
    return root;
}

static int parse_assistant(const JsonValue *root, Message *assistant, char *error, size_t error_capacity) {
    JsonValue *choices = json_object_get(root, "choices");
    JsonValue *choice = json_array_get(choices, 0);
    JsonValue *message = json_object_get(choice, "message");
    if (!json_is_object(message)) {
        snprintf(error, error_capacity, "model returned no assistant message");
        return -1;
    }

    JsonValue *content = json_object_get(message, "content");
    JsonValue *calls = json_object_get(message, "tool_calls");
    message_init(assistant, MESSAGE_ASSISTANT);
    const char *content_text = json_string_value(content);
    if (content_text && message_set_content(assistant, content_text) != 0) goto allocation_error;

    for (size_t i = 0; i < json_array_size(calls); i++) {
        JsonValue *call = json_array_get(calls, i);
        JsonValue *function = json_object_get(call, "function");
        JsonValue *id = json_object_get(call, "id");
        JsonValue *name = json_object_get(function, "name");
        JsonValue *arguments = json_object_get(function, "arguments");
        const char *id_text = json_string_value(id);
        const char *name_text = json_string_value(name);
        const char *arguments_text = json_string_value(arguments);
        if (!name_text || !arguments_text ||
            message_add_tool_call(assistant, id_text ? id_text : "", name_text, arguments_text) != 0) {
            goto allocation_error;
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
    JsonValue *request = request_to_json(config, messages, tools);
    if (!request) {
        snprintf(error, error_capacity, "failed to build DeepSeek request");
        return -1;
    }
    char *body = json_stringify(request);
    json_destroy(request);
    if (!body) {
        snprintf(error, error_capacity, "failed to encode DeepSeek request");
        return -1;
    }

    size_t base_length = strlen(config->base_url);
    if (base_length == 0) {
        free(body);
        snprintf(error, error_capacity, "DeepSeek base URL is empty");
        return -1;
    }
    StringBuilder *url_builder = string_builder_create();
    if (!url_builder || string_builder_append(url_builder, config->base_url) != 0 ||
        (config->base_url[base_length - 1] != '/' && string_builder_append_char(url_builder, '/') != 0) ||
        string_builder_append(url_builder, "chat/completions") != 0) {
        string_builder_destroy(url_builder);
        free(body);
        snprintf(error, error_capacity, "out of memory while building DeepSeek URL");
        return -1;
    }
    char *url = strdup(string_builder_data(url_builder));
    string_builder_destroy(url_builder);
    if (!url) {
        free(body);
        snprintf(error, error_capacity, "out of memory while copying DeepSeek URL");
        return -1;
    }

    HttpResponse response;
    int http_result = http_post_json(url, config->api_key, body, &response, error, error_capacity);
    free(url);
    free(body);
    if (http_result != 0) return -1;

    JsonValue *root = json_parse(response.body ? response.body : "");
    if (!root) {
        snprintf(error, error_capacity, "DeepSeek returned invalid JSON (HTTP %ld)", response.status_code);
        http_response_free(&response);
        return -1;
    }
    if (response.status_code < 200 || response.status_code >= 300) {
        JsonValue *api_error = json_object_get(root, "error");
        JsonValue *message = json_object_get(api_error, "message");
        const char *message_text = json_string_value(message);
        snprintf(error, error_capacity, "DeepSeek HTTP %ld: %s", response.status_code,
                 message_text ? message_text : "request failed");
        json_destroy(root);
        http_response_free(&response);
        return -1;
    }
    int parse_result = parse_assistant(root, assistant, error, error_capacity);
    json_destroy(root);
    http_response_free(&response);
    return parse_result;
}
