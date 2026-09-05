#import <Cocoa/Cocoa.h>

#import "chat_view.h"
#import "secret_store.h"

static void showError(NSString *message) {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.alertStyle = NSAlertStyleWarning;
    alert.messageText = @"无法完成操作";
    alert.informativeText = message;
    [alert addButtonWithTitle:@"好"];
    [alert runModal];
}

@interface PasteableSecureTextField : NSSecureTextField
@end

@implementation PasteableSecureTextField

- (void)paste:(id)sender {
    (void)sender;
    NSString *value = [[NSPasteboard generalPasteboard] stringForType:NSPasteboardTypeString];
    if (value.length > 0) self.stringValue = value;
}

- (BOOL)performKeyEquivalent:(NSEvent *)event {
    NSEventModifierFlags modifiers = event.modifierFlags & NSEventModifierFlagDeviceIndependentFlagsMask;
    BOOL isPaste = (modifiers & NSEventModifierFlagCommand) != 0 &&
        [event.charactersIgnoringModifiers.lowercaseString isEqualToString:@"v"];
    if (isPaste) {
        [self paste:self];
        return YES;
    }
    return [super performKeyEquivalent:event];
}

@end

@interface ChatWindowController : NSObject <NSWindowDelegate>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) ChatView *chatView;
@property(nonatomic, strong) NSTextField *inputField;
@property(nonatomic, strong) NSTextField *workspaceLabel;
@property(nonatomic, strong) NSTextField *statusLabel;
@property(nonatomic, strong) NSButton *sendButton;
@property(nonatomic, strong) NSTask *task;
@property(nonatomic) BOOL closing;
@property(nonatomic, copy) NSString *sessionKey;
@property(nonatomic) NSUInteger secretGeneration;
@property(nonatomic) BOOL secretLoadFinished;
@property(nonatomic) NSUInteger pendingSecretWrites;
@property(nonatomic, copy) NSString *workspacePath;
@end

@implementation ChatWindowController

- (instancetype)init {
    self = [super init];
    if (self) {
        self.workspacePath = NSHomeDirectory();
        [self buildWindow];
        [self loadStoredKeyInBackground];
    }
    return self;
}

- (void)buildWindow {
    NSRect frame = NSMakeRect(0, 0, 780, 580);
    self.window = [[NSWindow alloc] initWithContentRect:frame
                                               styleMask:(NSWindowStyleMaskTitled |
                                                          NSWindowStyleMaskClosable |
                                                          NSWindowStyleMaskMiniaturizable |
                                                          NSWindowStyleMaskResizable)
                                                 backing:NSBackingStoreBuffered
                                                   defer:NO];
    self.window.title = @"AI Agent C";
    self.window.minSize = NSMakeSize(620, 440);
    self.window.delegate = self;

    NSView *content = self.window.contentView;
    NSTextField *title = [NSTextField labelWithString:@"AI Agent C · 第 1 课"];
    title.font = [NSFont boldSystemFontOfSize:18];
    NSTextField *description = [NSTextField labelWithString:
        @"打开应用不会连接 DeepSeek。只有发送消息时，应用才会请求 API Key。"];
    description.textColor = [NSColor secondaryLabelColor];

    self.chatView = [[ChatView alloc] initWithFrame:NSZeroRect];
    self.chatView.translatesAutoresizingMaskIntoConstraints = NO;

    self.workspaceLabel = [NSTextField labelWithString:@""];
    self.workspaceLabel.lineBreakMode = NSLineBreakByTruncatingMiddle;
    self.workspaceLabel.toolTip = self.workspacePath;
    self.workspaceLabel.translatesAutoresizingMaskIntoConstraints = NO;
    NSButton *workspaceButton = [NSButton buttonWithTitle:@"选择目录"
                                                    target:self
                                                    action:@selector(chooseWorkspace:)];
    NSStackView *workspaceRow = [NSStackView stackViewWithViews:@[self.workspaceLabel, workspaceButton]];
    workspaceRow.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    workspaceRow.spacing = 10;
    workspaceRow.alignment = NSLayoutAttributeCenterY;

    self.inputField = [[NSTextField alloc] initWithFrame:NSZeroRect];
    self.inputField.placeholderString = @"输入你的任务，例如：查看当前目录有哪些文件";
    self.inputField.translatesAutoresizingMaskIntoConstraints = NO;
    [self.inputField setTarget:self];
    [self.inputField setAction:@selector(sendMessage:)];

    self.sendButton = [NSButton buttonWithTitle:@"发送" target:self action:@selector(sendMessage:)];
    self.sendButton.keyEquivalent = @"\r";
    NSButton *settingsButton = [NSButton buttonWithTitle:@"设置 Key" target:self action:@selector(showSettings:)];

    NSStackView *actions = [NSStackView stackViewWithViews:@[self.inputField, settingsButton, self.sendButton]];
    actions.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    actions.spacing = 10;
    actions.alignment = NSLayoutAttributeCenterY;

    self.statusLabel = [NSTextField labelWithString:
        @"就绪 · 尚未连接 DeepSeek"];
    self.statusLabel.textColor = [NSColor secondaryLabelColor];

    NSStackView *stack = [NSStackView stackViewWithViews:@[
        title, description, workspaceRow, self.chatView, actions, self.statusLabel
    ]];
    stack.orientation = NSUserInterfaceLayoutOrientationVertical;
    stack.alignment = NSLayoutAttributeLeading;
    stack.spacing = 12;
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    [content addSubview:stack];

    [NSLayoutConstraint activateConstraints:@[
        [stack.leadingAnchor constraintEqualToAnchor:content.leadingAnchor constant:24],
        [stack.trailingAnchor constraintEqualToAnchor:content.trailingAnchor constant:-24],
        [stack.topAnchor constraintEqualToAnchor:content.topAnchor constant:22],
        [stack.bottomAnchor constraintEqualToAnchor:content.bottomAnchor constant:-20],
        [workspaceRow.widthAnchor constraintEqualToConstant:732],
        [self.workspaceLabel.widthAnchor constraintEqualToConstant:620],
        [self.chatView.widthAnchor constraintEqualToConstant:732],
        [self.chatView.heightAnchor constraintGreaterThanOrEqualToConstant:320],
        [self.inputField.widthAnchor constraintGreaterThanOrEqualToConstant:420],
        [self.inputField.heightAnchor constraintEqualToConstant:28],
    ]];

    [self updateWorkspaceLabel];
    [self.chatView appendSystemMessage:@"AI Agent C 已启动 · 输入任务后点击“发送”开始对话"];
}

- (void)updateWorkspaceLabel {
    self.workspaceLabel.stringValue = [NSString stringWithFormat:@"工作目录：%@", self.workspacePath];
    self.workspaceLabel.toolTip = self.workspacePath;
}

- (void)chooseWorkspace:(id)sender {
    (void)sender;
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.title = @"选择 Agent 工作目录";
    panel.prompt = @"选择";
    panel.canChooseFiles = NO;
    panel.canChooseDirectories = YES;
    panel.allowsMultipleSelection = NO;
    panel.directoryURL = [NSURL fileURLWithPath:self.workspacePath isDirectory:YES];
    if ([panel runModal] != NSModalResponseOK || panel.URL.path.length == 0) return;

    self.workspacePath = panel.URL.path;
    [self updateWorkspaceLabel];
    self.statusLabel.stringValue = @"目录已选择 · 尚未连接 DeepSeek";
}

- (void)appendUserMessage:(NSString *)text {
    [self.chatView appendUserMessage:text];
}

- (void)appendAssistantMessage:(NSString *)text {
    [self.chatView appendAssistantMessage:text];
}

- (void)setBusy:(BOOL)busy {
    self.sendButton.enabled = !busy && self.secretLoadFinished;
    self.inputField.enabled = !busy;
    self.statusLabel.stringValue = busy ? @"正在处理……" : @"就绪 · 可以继续发送任务";
}

- (NSString *)storedKey {
    if (self.sessionKey.length > 0) return self.sessionKey;
    NSString *environmentKey = [NSProcessInfo processInfo].environment[@"DEEPSEEK_API_KEY"];
    if (environmentKey.length > 0) {
        self.sessionKey = environmentKey;
        return self.sessionKey;
    }
    return nil;
}

- (void)loadStoredKeyInBackground {
    self.secretLoadFinished = NO;
    self.sendButton.enabled = NO;
    self.statusLabel.stringValue = @"正在读取已保存的 Key……";
    if ([self storedKey]) {
        self.secretLoadFinished = YES;
        self.sendButton.enabled = YES;
        self.statusLabel.stringValue = @"就绪 · Key 已载入，尚未连接 DeepSeek";
        return;
    }
    NSUInteger generation = self.secretGeneration;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        NSString *key = AIAgentSecretStoreCopyKey();
        dispatch_async(dispatch_get_main_queue(), ^{
            if (generation == self.secretGeneration && self.sessionKey.length == 0 && key.length > 0) {
                self.sessionKey = key;
            }
            self.secretLoadFinished = YES;
            self.sendButton.enabled = self.task == nil;
            if (!self.task) {
                self.statusLabel.stringValue = self.sessionKey.length > 0
                    ? @"就绪 · Key 已载入，尚未连接 DeepSeek"
                    : @"就绪 · 尚未设置 Key";
            }
        });
    });
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        if (self.secretLoadFinished) return;
        self.secretLoadFinished = YES;
        self.sendButton.enabled = self.task == nil;
        if (!self.task) self.statusLabel.stringValue = @"就绪 · 尚未设置 Key";
    });
}

- (void)saveKeyInBackground:(NSString *)key generation:(NSUInteger)generation {
    self.pendingSecretWrites++;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        NSString *error = nil;
        BOOL saved = AIAgentSecretStoreSaveKey(key, &error);
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.pendingSecretWrites > 0) self.pendingSecretWrites--;
            if (generation == self.secretGeneration && !self.closing) {
                if (saved) {
                    if (!self.task) self.statusLabel.stringValue = @"Key 已保存 · 尚未连接 DeepSeek";
                } else {
                    showError(error ? error : @"保存 Key 失败；本次运行仍可继续使用。");
                }
            }
            [self finishClosingIfPossible];
        });
    });
}

- (void)deleteKeyInBackground:(NSUInteger)generation {
    self.pendingSecretWrites++;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        NSString *error = nil;
        BOOL deleted = AIAgentSecretStoreDeleteKey(&error);
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.pendingSecretWrites > 0) self.pendingSecretWrites--;
            if (generation == self.secretGeneration && !deleted && !self.closing) {
                showError(error ? error : @"清除已保存的 Key 失败。");
            }
            [self finishClosingIfPossible];
        });
    });
}

- (void)finishClosingIfPossible {
    if (self.closing && self.task == nil && self.pendingSecretWrites == 0) [NSApp terminate:nil];
}

- (NSString *)promptForKey:(BOOL)required {
    NSString *existingKey = [self storedKey];
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = required ? @"发送消息前需要 DeepSeek API Key" : @"DeepSeek API Key 设置";
    alert.informativeText = required
        ? @"应用现在才会使用 Key。保存后，下次打开应用仍可继续使用。"
        : @"Key 会保存到当前用户的应用 data 目录，下次打开应用无需重新设置。";

    PasteableSecureTextField *field = [[PasteableSecureTextField alloc] initWithFrame:NSMakeRect(0, 0, 340, 28)];
    field.placeholderString = existingKey ? @"输入新的 Key；留空保留当前 Key" : @"输入 DeepSeek API Key（sk-...）";
    alert.accessoryView = field;
    alert.window.initialFirstResponder = field;
    [alert addButtonWithTitle:@"保存"];
    if (existingKey) [alert addButtonWithTitle:@"清除 Key"];
    [alert addButtonWithTitle:@"取消"];

    [NSApp activateIgnoringOtherApps:YES];
    [alert.window makeKeyAndOrderFront:nil];
    NSModalResponse response = [alert runModal];
    if (response == NSAlertFirstButtonReturn) {
        NSString *value = [field.stringValue stringByTrimmingCharactersInSet:
            [NSCharacterSet whitespaceAndNewlineCharacterSet]];
        if (value.length == 0) {
            if (existingKey) return existingKey;
            showError(@"请输入 DeepSeek API Key。");
            return nil;
        }
        self.sessionKey = value;
        NSUInteger generation = ++self.secretGeneration;
        [self saveKeyInBackground:value generation:generation];
        return self.sessionKey;
    }
    if (existingKey && response == NSAlertSecondButtonReturn) {
        self.sessionKey = nil;
        NSUInteger generation = ++self.secretGeneration;
        [self deleteKeyInBackground:generation];
    }
    return nil;
}

- (void)showSettings:(id)sender {
    (void)sender;
    NSString *key = [self promptForKey:NO];
    self.statusLabel.stringValue = key ? @"Key 已设置 · 尚未连接 DeepSeek"
                                       : @"就绪 · 尚未连接 DeepSeek";
}

- (void)sendMessage:(id)sender {
    (void)sender;
    if (self.task) return;
    if (!self.secretLoadFinished) {
        self.statusLabel.stringValue = @"正在读取已保存的 Key，请稍候……";
        return;
    }
    NSString *query = [self.inputField.stringValue stringByTrimmingCharactersInSet:
        [NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (query.length == 0) return;

    NSString *key = [self storedKey];
    if (!key) key = [self promptForKey:YES];
    if (!key) return;

    [self appendUserMessage:query];
    self.inputField.stringValue = @"";
    [self setBusy:YES];

    NSString *agentPath = [[[NSBundle mainBundle] bundlePath]
        stringByAppendingPathComponent:@"Contents/Resources/agent-s01"];
    NSTask *task = [[NSTask alloc] init];
    task.executableURL = [NSURL fileURLWithPath:agentPath];
    task.arguments = @[query];
    task.currentDirectoryPath = self.workspacePath;
    NSMutableDictionary *environment = [[[NSProcessInfo processInfo] environment] mutableCopy];
    environment[@"DEEPSEEK_API_KEY"] = key;
    environment[@"AI_AGENT_QUIET_TOOLS"] = @"1";
    task.environment = environment;

    NSPipe *pipe = [NSPipe pipe];
    task.standardOutput = pipe;
    task.standardError = pipe;
    self.task = task;

    NSError *launchError = nil;
    if (![task launchAndReturnError:&launchError]) {
        self.task = nil;
        [self setBusy:NO];
        NSString *message = launchError.localizedDescription;
        showError(message ? message : @"无法启动 Agent。");
        return;
    }

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSData *data = [pipe.fileHandleForReading readDataToEndOfFile];
        NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        [task waitUntilExit];
        NSInteger exitCode = task.terminationStatus;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (output.length > 0) [self appendAssistantMessage:output];
            self.task = nil;
            [self setBusy:NO];
            if (exitCode != 0) self.statusLabel.stringValue = @"本次对话失败 · 请检查 Key 或网络连接";
            [self finishClosingIfPossible];
        });
    });
}

- (void)windowWillClose:(NSNotification *)notification {
    (void)notification;
    self.closing = YES;
    if (self.task && self.task.running) {
        [self.task terminate];
    }
    [self finishClosingIfPossible];
}

@end

@interface LauncherDelegate : NSObject <NSApplicationDelegate>
@property(nonatomic, strong) ChatWindowController *chat;
@end

@implementation LauncherDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    (void)notification;
    self.chat = [[ChatWindowController alloc] init];
    [self.chat.window center];
    [self.chat.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    (void)sender;
    return self.chat.task == nil && self.chat.pendingSecretWrites == 0;
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = [NSApplication sharedApplication];
        LauncherDelegate *delegate = [[LauncherDelegate alloc] init];
        application.delegate = delegate;
        [application run];
    }
    (void)argc;
    (void)argv;
    return 0;
}
