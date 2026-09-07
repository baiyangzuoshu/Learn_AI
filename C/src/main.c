#include "agent.h"
#include "string_builder.h"

#include <curl/curl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void print_event(const AgentEvent *event, void *context) {
    (void)context;
    if (getenv("AI_AGENT_QUIET_TOOLS")) return;
    printf("\n[tool:%s iteration:%zu]\n%s\n", event->tool_name, event->iteration, event->output);
}

static int launched_from_finder(void) {
#ifdef __APPLE__
    return !isatty(STDIN_FILENO) && !isatty(STDOUT_FILENO);
#else
    return 0;
#endif
}

static void show_macos_message(const char *message) {
#ifdef __APPLE__
    char command[2048];
    snprintf(command, sizeof(command),
             "osascript -e 'display dialog \"%s\" with title \"AI Agent C\" buttons {\"好\"} "
             "default button \"好\"' >/dev/null 2>&1",
             message);
    (void)system(command);
#else
    (void)message;
#endif
}

static char *join_arguments(int argc, char **argv) {
    StringBuilder *builder = string_builder_create();
    if (!builder) return NULL;
    for (int i = 1; i < argc; i++) {
        if (i > 1 && string_builder_append_char(builder, ' ') != 0) {
            string_builder_destroy(builder);
            return NULL;
        }
        if (string_builder_append(builder, argv[i]) != 0) {
            string_builder_destroy(builder);
            return NULL;
        }
    }
    char *query = strdup(string_builder_data(builder));
    string_builder_destroy(builder);
    return query;
}

int main(int argc, char **argv) {
    const char *api_key = getenv("DEEPSEEK_API_KEY");
    const char *base_url = getenv("DEEPSEEK_BASE_URL");
    const char *model = getenv("DEEPSEEK_MODEL");
    if (launched_from_finder() && argc == 1) {
        show_macos_message("C 版第 1 课是命令行 Agent。请打开终端，设置 DEEPSEEK_API_KEY 后运行 C/dist/macos-arm64/agent-s01。"
                           "\n\n双击 .app 不会继承终端环境变量，也没有可输入任务的终端。\n\n"
                           "示例：export DEEPSEEK_API_KEY=你的 Key");
        return 0;
    }
    if (!api_key || !api_key[0]) {
        fprintf(stderr, "DEEPSEEK_API_KEY is required\n");
        return 1;
    }
    if (!base_url || !base_url[0]) base_url = "https://api.deepseek.com";
    if (!model || !model[0]) model = "deepseek-chat";

    char workspace[4096];
    if (!getcwd(workspace, sizeof(workspace))) {
        perror("getcwd");
        return 1;
    }
    char *query = argc > 1 ? join_arguments(argc, argv) : NULL;
    if (!query) {
        char buffer[4096];
        fputs("s01 >> ", stdout);
        fflush(stdout);
        if (!fgets(buffer, sizeof(buffer), stdin)) return 0;
        buffer[strcspn(buffer, "\n")] = '\0';
        query = strdup(buffer);
    }
    if (!query || !query[0]) {
        free(query);
        return 0;
    }

    curl_global_init(CURL_GLOBAL_DEFAULT);
    Agent agent;
    AgentOptions options = {.max_iterations = 20, .max_tool_output = SHELL_TOOL_MAX_OUTPUT};
    if (agent_init(&agent, api_key, base_url, model, workspace, options) != 0) {
        fprintf(stderr, "failed to initialize agent\n");
        curl_global_cleanup();
        free(query);
        return 1;
    }
    char *answer = NULL;
    char error[1024];
    int result = agent_loop_run(&agent, query, print_event, NULL, &answer, error, sizeof(error));
    if (result == 0) printf("\n%s\n", answer);
    else fprintf(stderr, "agent error: %s\n", error);
    free(answer);
    agent_free(&agent);
    curl_global_cleanup();
    free(query);
    return result == 0 ? 0 : 1;
}
