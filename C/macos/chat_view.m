#import "chat_view.h"

#import <WebKit/WebKit.h>

@interface ChatView () <WKNavigationDelegate>
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) NSMutableArray<NSDictionary<NSString *, NSString *> *> *pendingMessages;
@property(nonatomic) BOOL rendererReady;
@end

@implementation ChatView

- (instancetype)initWithFrame:(NSRect)frameRect {
    self = [super initWithFrame:frameRect];
    if (!self) return nil;

    self.pendingMessages = [NSMutableArray array];
    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    self.webView.navigationDelegate = self;
    self.webView.translatesAutoresizingMaskIntoConstraints = NO;
    self.webView.allowsMagnification = YES;
    [self addSubview:self.webView];
    [NSLayoutConstraint activateConstraints:@[
        [self.webView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
        [self.webView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
        [self.webView.topAnchor constraintEqualToAnchor:self.topAnchor],
        [self.webView.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
    ]];

    NSURL *rendererURL = [[NSBundle mainBundle] URLForResource:@"index"
                                                withExtension:@"html"
                                                 subdirectory:@"ChatRenderer"];
    if (rendererURL) {
        [self.webView loadFileURL:rendererURL allowingReadAccessToURL:rendererURL.URLByDeletingLastPathComponent];
    } else {
        [self.webView loadHTMLString:@"<html><body>聊天渲染器加载失败。</body></html>" baseURL:nil];
    }
    return self;
}

- (void)appendSystemMessage:(NSString *)text {
    [self enqueueRole:@"system" content:text];
}

- (void)appendUserMessage:(NSString *)text {
    [self enqueueRole:@"user" content:text];
}

- (void)appendAssistantMessage:(NSString *)text {
    [self enqueueRole:@"assistant" content:text];
}

- (void)enqueueRole:(NSString *)role content:(NSString *)content {
    NSDictionary<NSString *, NSString *> *message = @{
        @"role": role ? role : @"assistant",
        @"content": content ? content : @"",
    };
    if (!self.rendererReady) {
        [self.pendingMessages addObject:message];
        return;
    }
    [self renderMessage:message];
}

- (void)renderMessage:(NSDictionary<NSString *, NSString *> *)message {
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:message options:0 error:&error];
    if (!data || error) return;
    NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (json.length == 0) return;
    NSString *script = [NSString stringWithFormat:@"window.chatRenderer.appendMessage(%@);", json];
    [self.webView evaluateJavaScript:script completionHandler:nil];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    (void)webView;
    (void)navigation;
    self.rendererReady = YES;
    NSArray<NSDictionary<NSString *, NSString *> *> *messages = [self.pendingMessages copy];
    [self.pendingMessages removeAllObjects];
    for (NSDictionary<NSString *, NSString *> *message in messages) [self renderMessage:message];
}

- (void)webView:(WKWebView *)webView
    decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction
                   decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    (void)webView;
    NSURL *url = navigationAction.request.URL;
    if (navigationAction.navigationType == WKNavigationTypeLinkActivated &&
        ([url.scheme isEqualToString:@"http"] || [url.scheme isEqualToString:@"https"])) {
        [[NSWorkspace sharedWorkspace] openURL:url];
        decisionHandler(WKNavigationActionPolicyCancel);
        return;
    }
    decisionHandler(WKNavigationActionPolicyAllow);
}

@end
