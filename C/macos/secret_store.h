#import <Foundation/Foundation.h>

NSString *AIAgentSecretStoreCopyKey(void);
BOOL AIAgentSecretStoreSaveKey(NSString *key, NSString **errorMessage);
BOOL AIAgentSecretStoreDeleteKey(NSString **errorMessage);
NSString *AIAgentSecretStoreDataDirectory(void);
