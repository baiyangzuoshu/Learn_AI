CC ?= cc
CFLAGS ?= -std=c11 -Wall -Wextra -Wpedantic -D_POSIX_C_SOURCE=200809L
CURL_CFLAGS ?= $(shell curl-config --cflags 2>/dev/null)
CURL_LIBS ?= $(shell curl-config --libs 2>/dev/null || echo -lcurl)
CJSON_CFLAGS ?= $(shell pkg-config --cflags libcjson 2>/dev/null || echo -I/opt/homebrew/include)
CJSON_LIBS ?= $(shell pkg-config --libs libcjson 2>/dev/null || echo -L/opt/homebrew/lib -lcjson)

CPPFLAGS += -Iinclude -Ibase $(CURL_CFLAGS) $(CJSON_CFLAGS)
LDFLAGS += $(CURL_LIBS) $(CJSON_LIBS)
SOURCES := $(wildcard src/*.c)
OBJECTS := $(SOURCES:src/%.c=build/%.o)
BASE_SOURCES := $(wildcard base/*.c)
BASE_OBJECTS := $(BASE_SOURCES:base/%.c=build/base/%.o)
TARGET := build/agent-s01
COLLECTION_TEST := build/test-collections
COLLECTION_SOURCES := $(BASE_SOURCES)

MACOS_ARCH ?= $(shell uname -m)
MACOS_SDK ?= $(shell xcrun --sdk macosx --show-sdk-path 2>/dev/null)
MACOS_MIN_VERSION ?= 15.0
MACOS_BUILD_DIR := build/macos-$(MACOS_ARCH)
MACOS_TARGET := $(MACOS_BUILD_DIR)/agent-s01
MACOS_LAUNCHER := $(MACOS_BUILD_DIR)/ai-agent-launcher
MACOS_APP := dist/macos-$(MACOS_ARCH)/AI Agent.app
MACOS_OBJECTS := $(SOURCES:src/%.c=$(MACOS_BUILD_DIR)/%.o)
MACOS_BASE_OBJECTS := $(BASE_SOURCES:base/%.c=$(MACOS_BUILD_DIR)/base/%.o)
MACOS_CJSON_LIB := $(if $(wildcard /opt/homebrew/lib/libcjson.a),/opt/homebrew/lib/libcjson.a,$(CJSON_LIBS))
MACOS_CFLAGS := $(CFLAGS) -arch $(MACOS_ARCH) -mmacosx-version-min=$(MACOS_MIN_VERSION)
MACOS_CPPFLAGS := -Iinclude -Ibase -isysroot $(MACOS_SDK) $(CJSON_CFLAGS)
MACOS_LDFLAGS := -arch $(MACOS_ARCH) -isysroot $(MACOS_SDK) -mmacosx-version-min=$(MACOS_MIN_VERSION) -lcurl $(MACOS_CJSON_LIB)
MACOS_LAUNCHER_CFLAGS := $(CFLAGS) -D_DARWIN_C_SOURCE -arch $(MACOS_ARCH) -isysroot $(MACOS_SDK) -mmacosx-version-min=$(MACOS_MIN_VERSION) -fobjc-arc
MACOS_LAUNCHER_SOURCES := macos/launcher.m macos/secret_store.m macos/chat_view.m
MACOS_RENDERER_FILES := macos/renderer/index.html macos/renderer/styles.css macos/renderer/renderer.js

.PHONY: all clean check test run macos macos-app

all: $(TARGET)

$(TARGET): $(OBJECTS) $(BASE_OBJECTS) | build
	$(CC) $(CFLAGS) $(OBJECTS) $(BASE_OBJECTS) $(LDFLAGS) -o $@

build/%.o: src/%.c | build
	$(CC) $(CFLAGS) $(CPPFLAGS) -MMD -MP -c $< -o $@

build/base/%.o: base/%.c | build/base
	$(CC) $(CFLAGS) $(CPPFLAGS) -MMD -MP -c $< -o $@

build:
	mkdir -p build

build/base:
	mkdir -p build/base

-include $(OBJECTS:.o=.d) $(BASE_OBJECTS:.o=.d)

check: $(TARGET)
	@echo "C s01 build passed: $(TARGET)"

test: $(COLLECTION_TEST)
	$(COLLECTION_TEST)

$(COLLECTION_TEST): tests/test_collections.c $(COLLECTION_SOURCES) | build
	$(CC) $(CFLAGS) -Ibase $^ -o $@

run: $(TARGET)
	$(TARGET) $(QUERY)

macos: $(MACOS_TARGET)
	@mkdir -p dist/macos-$(MACOS_ARCH)
	@cp $(MACOS_TARGET) dist/macos-$(MACOS_ARCH)/agent-s01
	@echo "macOS $(MACOS_ARCH) binary: dist/macos-$(MACOS_ARCH)/agent-s01"

macos-app: macos $(MACOS_LAUNCHER) $(MACOS_RENDERER_FILES)
	@rm -rf "$(MACOS_APP)"
	@mkdir -p "$(MACOS_APP)/Contents/MacOS" "$(MACOS_APP)/Contents/Resources/ChatRenderer"
	@cp $(MACOS_TARGET) "$(MACOS_APP)/Contents/Resources/agent-s01"
	@cp $(MACOS_LAUNCHER) "$(MACOS_APP)/Contents/MacOS/ai-agent-launcher"
	@cp $(MACOS_RENDERER_FILES) "$(MACOS_APP)/Contents/Resources/ChatRenderer/"
	@cp macos/Info.plist "$(MACOS_APP)/Contents/Info.plist"
	@codesign --force --deep --sign - "$(MACOS_APP)"
	@echo "macOS app: $(MACOS_APP)"

$(MACOS_LAUNCHER): $(MACOS_LAUNCHER_SOURCES) | $(MACOS_BUILD_DIR)
	$(CC) $(MACOS_LAUNCHER_CFLAGS) -Imacos $(MACOS_LAUNCHER_SOURCES) -framework Cocoa -framework WebKit -o $@

$(MACOS_TARGET): $(MACOS_OBJECTS) $(MACOS_BASE_OBJECTS) | $(MACOS_BUILD_DIR)
	$(CC) $(MACOS_CFLAGS) $(MACOS_OBJECTS) $(MACOS_BASE_OBJECTS) $(MACOS_LDFLAGS) -o $@

$(MACOS_BUILD_DIR)/%.o: src/%.c | $(MACOS_BUILD_DIR)
	$(CC) $(MACOS_CFLAGS) $(MACOS_CPPFLAGS) -MMD -MP -c $< -o $@

$(MACOS_BUILD_DIR)/base/%.o: base/%.c | $(MACOS_BUILD_DIR)/base
	$(CC) $(MACOS_CFLAGS) $(MACOS_CPPFLAGS) -MMD -MP -c $< -o $@

$(MACOS_BUILD_DIR):
	mkdir -p $@

$(MACOS_BUILD_DIR)/base:
	mkdir -p $@

clean:
	rm -rf build
	rm -rf dist
