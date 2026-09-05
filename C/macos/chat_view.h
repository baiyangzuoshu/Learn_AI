#import <Cocoa/Cocoa.h>

@interface ChatView : NSView

- (void)appendSystemMessage:(NSString *)text;
- (void)appendUserMessage:(NSString *)text;
- (void)appendAssistantMessage:(NSString *)text;

@end
