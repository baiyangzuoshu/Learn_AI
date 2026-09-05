#import "secret_store.h"

#include <sys/stat.h>

static NSString *const AIAgentSecretFileName = @"deepseek.key";

NSString *AIAgentSecretStoreDataDirectory(void) {
    NSString *override = [NSProcessInfo processInfo].environment[@"AI_AGENT_DATA_DIR"];
    if (override.length > 0) return [override stringByStandardizingPath];

    NSArray<NSString *> *paths = NSSearchPathForDirectoriesInDomains(
        NSApplicationSupportDirectory, NSUserDomainMask, YES);
    NSString *applicationSupport = paths.firstObject;
    if (applicationSupport.length == 0) return nil;
    return [[applicationSupport stringByAppendingPathComponent:@"AI Agent C"]
        stringByAppendingPathComponent:@"data"];
}

static NSString *secretFilePath(void) {
    NSString *directory = AIAgentSecretStoreDataDirectory();
    return directory.length > 0 ? [directory stringByAppendingPathComponent:AIAgentSecretFileName] : nil;
}

static NSString *fileErrorMessage(NSError *error, NSString *fallback) {
    return error.localizedDescription.length > 0 ? error.localizedDescription : fallback;
}

NSString *AIAgentSecretStoreCopyKey(void) {
    NSString *path = secretFilePath();
    if (path.length == 0) return nil;

    NSError *error = nil;
    NSString *value = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:&error];
    if (!value) return nil;
    NSString *trimmed = [value stringByTrimmingCharactersInSet:
        [NSCharacterSet whitespaceAndNewlineCharacterSet]];
    return trimmed.length > 0 ? trimmed : nil;
}

BOOL AIAgentSecretStoreSaveKey(NSString *key, NSString **errorMessage) {
    if (errorMessage) *errorMessage = nil;
    NSString *trimmed = [key stringByTrimmingCharactersInSet:
        [NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (trimmed.length == 0) {
        if (errorMessage) *errorMessage = @"Key 不能为空。";
        return NO;
    }

    NSString *directory = AIAgentSecretStoreDataDirectory();
    NSString *path = secretFilePath();
    if (directory.length == 0 || path.length == 0) {
        if (errorMessage) *errorMessage = @"无法确定应用数据目录。";
        return NO;
    }

    NSFileManager *files = [NSFileManager defaultManager];
    NSError *error = nil;
    NSDictionary *directoryAttributes = @{NSFilePosixPermissions: @0700};
    if (![files createDirectoryAtPath:directory
          withIntermediateDirectories:YES
                           attributes:directoryAttributes
                                error:&error]) {
        if (errorMessage) *errorMessage = fileErrorMessage(error, @"无法创建应用数据目录。");
        return NO;
    }
    chmod(directory.fileSystemRepresentation, S_IRWXU);

    NSData *data = [trimmed dataUsingEncoding:NSUTF8StringEncoding];
    if (![data writeToFile:path options:NSDataWritingAtomic error:&error]) {
        if (errorMessage) *errorMessage = fileErrorMessage(error, @"无法保存 Key。");
        return NO;
    }
    if (chmod(path.fileSystemRepresentation, S_IRUSR | S_IWUSR) != 0) {
        [files removeItemAtPath:path error:nil];
        if (errorMessage) *errorMessage = @"无法设置 Key 文件权限。";
        return NO;
    }

    NSURL *directoryURL = [NSURL fileURLWithPath:directory isDirectory:YES];
    [directoryURL setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];
    return YES;
}

BOOL AIAgentSecretStoreDeleteKey(NSString **errorMessage) {
    if (errorMessage) *errorMessage = nil;
    NSString *path = secretFilePath();
    if (path.length == 0) return YES;

    NSFileManager *files = [NSFileManager defaultManager];
    if (![files fileExistsAtPath:path]) return YES;
    NSError *error = nil;
    if ([files removeItemAtPath:path error:&error]) return YES;
    if (errorMessage) *errorMessage = fileErrorMessage(error, @"无法删除已保存的 Key。");
    return NO;
}
