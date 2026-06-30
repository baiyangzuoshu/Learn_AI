# 长链接游戏改造规划

本文档用于规划当前连连看客户端从“HTTP 主流程 + 局部 WebSocket 试接入”改造成“长链接驱动的服务端权威游戏”的路线。

目标不是一次性重写项目，而是先把网络、协议、状态归属和玩法边界整理清楚，再分阶段迁移，保证每一步都能验证。

## 当前状态

当前项目由三部分组成：

- `LinkUpClient/`：Cocos Creator 2.4.15 主客户端。
- `LinkUpEdit/`：Cocos Creator 3.8.7 关卡编辑和测试工程。
- `Server/`：TypeScript + `ws` 的本地 WebSocket 服务。

客户端当前仍以 HTTP 业务接口为主：

- 登录、关卡、奖励、道具、结算等主要通过 `HttpManager` 请求 `NetRequestCode`。
- 局内玩法当前走本地 `util.canConnectPath`、`BlockManager`、`HandlerTiles` 等客户端逻辑。
- `NetManager` 目前只保留底层 WebSocket request/push 能力。

服务端已经被简化为最小长链接骨架：

- `login`
- `game.enter_stage`，当前返回固定快照，暂未接入真实房间和棋盘生成

当前 `Server/proto/linkup.proto` 包含：

- `LoginRequest`
- `LoginResponse`
- `EnterStageRequest`
- `GameSnapshotResponse`
- `BlockData`
- `Packet`

这是一条更清晰的改造起点：先把连接、登录、协议生成和客户端 service 边界打稳，再逐步把固定 `enter_stage` 快照替换为真实单局状态，然后继续加 `linkup`、`refresh`、`result`。

## 主要问题

### 1. 网络边界混乱

`HttpManager` 和 `NetManager` 仍可能被业务层直接调用。比如：

- `UIRootUICtrl` 负责 SDK、HTTP 登录、WebSocket 连接。
- `UIMainUICtrl` 直接请求进入关卡、排行、奖励。
- `WorkFlow` 直接请求道具使用和分享奖励相关接口。
- 后续如果直接在 `GameTouch`、`WorkFlow` 里继续加长链接 route，会再次造成 UI、玩法和协议混杂。

结果是网络协议、UI 表现、玩法状态混在一起，后续扩展长链接会越来越难。

### 2. 权威状态不明确

当前客户端仍独立承担局内玩法：

- 棋盘生成。
- 连线判定。
- 死局判断。
- 坍塌计算。
- 刷新重排。
- 特殊块处理。

服务端现在还没有这些能力。后续要加回服务端时，应一次明确一个能力的权威归属，避免再出现客户端/服务端双写同一份规则。

### 3. 协议缺少长链接游戏需要的会话模型

现有协议是 request/reply 风格，缺少：

- `room_id`
- `seq`
- `last_seq`
- `snapshot`
- `delta`
- `resume`
- 明确错误码
- 服务端推送事件

这会影响断线重连、切后台恢复、多端异常恢复和操作幂等。

### 4. 客户端职责过重

`UIGameUICtrl`、`GameTouch`、`WorkFlow`、`GameManager` 都承担了过多职责：

- 输入处理。
- 规则判断。
- 网络请求。
- 状态推进。
- UI 展示。
- 动画播放。
- 埋点和结算。

长链接改造前需要先收口这些职责。

## 改造目标

最终目标是服务端权威的长链接单局游戏：

```text
玩家输入
  -> 客户端发送操作
  -> 服务端校验和推进状态
  -> 服务端返回/推送状态增量
  -> 客户端播放表现
```

### 服务端权威

服务端负责：

- 创建房间和单局。
- 保存棋盘状态。
- 连线合法性判定。
- 特殊块效果。
- 坍塌计算。
- 道具使用。
- 刷新重排。
- 胜利/死局判断。
- 单局结算。
- 重连恢复。

### 客户端表现

客户端负责：

- SDK 授权、宿主桥接、广告、分享、支付等平台能力。
- UI 展示。
- 点击/滑动输入采集。
- 根据服务端 delta 播放连线、消除、坍塌、特效、音效。
- 本地弱提示和加载态。
- 必要的预测表现，但不作为最终结果。

### 保留 HTTP 的范围

短期内可以保留 HTTP 做这些事情：

- SDK 后的账号登录。
- 与现有正式后端强绑定的奖励、分享、支付、排行接口。
- 兼容旧流程的兜底。

中长期应把单局内玩法相关操作迁到长链接：

- 进入关卡。
- 连线。
- 道具。
- 刷新。
- 退出。
- 结算。

## 目标架构

```text
SDK/宿主层
  SDKAdapter
  HLDDZSDKManager
  AppHLDDZSDKManager
  WebHLDDZSDKManager

客户端应用层
  UIRootUICtrl
  UIMainUICtrl
  UIGameUICtrl
  UIController

客户端长链接业务层
  GameSocketService
  GameSessionStore
  GameDeltaApplier

客户端底层网络层
  NetManager
  protocol.ts

服务端长链接层
  gateway.ts
  future Room/GameEngine/MapLoader
  protocol.ts
```

建议新增客户端模块：

- `assets/Scripts/GameSocketService.ts`
- `assets/Scripts/Net/GameSessionStore.ts`
- `assets/Scripts/Net/GameProtocolTypes.ts`，如果生成协议类型不够好用。
- `assets/Scripts/Game/GameDeltaApplier.ts`

`NetManager` 只保留底层能力：

- connect
- disconnect
- request
- send
- onPush
- reconnect
- heartbeat

业务层不再直接拼 route。

## 协议规划

当前可以继续使用 `Server/proto/linkup.proto`，但需要重整 route 和消息结构。

### 基础字段

所有游戏请求建议携带：

```proto
message RequestMeta {
  uint32 request_id = 1;
  string room_id = 2;
  uint32 client_seq = 3;
}
```

所有响应建议携带：

```proto
message ResponseMeta {
  int32 code = 1;
  string msg = 2;
  string room_id = 3;
  uint32 server_seq = 4;
  int64 server_time = 5;
}
```

### 核心消息

```proto
message GameSnapshot {
  string room_id = 1;
  int32 stage_id = 2;
  int32 width = 3;
  int32 height = 4;
  int32 dirction = 5;
  repeated BlockData blocks = 6;
  repeated ItemCount items = 7;
  GameStatus status = 8;
  uint32 server_seq = 9;
}

message GameDelta {
  uint32 server_seq = 1;
  repeated BlockData removed = 2;
  repeated BlockMove moves = 3;
  repeated BlockData changed = 4;
  repeated GameEffect effects = 5;
  GameStatus status = 6;
  bool is_win = 7;
  bool is_deadlock = 8;
}
```

### Route 建议

```text
auth.login
game.enter_stage
game.resume
game.linkup
game.use_item
game.refresh
game.exit
game.result
system.heartbeat
```

### 重连恢复

客户端断线后：

1. `NetManager` 重连。
2. `GameSocketService.resume(roomId, lastSeq)`。
3. 服务端如果有连续 delta，则补发 delta。
4. 服务端如果无法补 delta，则返回完整 `GameSnapshot`。
5. 客户端用 snapshot 重建棋盘表现。

## 客户端改造路线

### 阶段 0：冻结目标和加文档

目标：

- 明确服务端权威方向。
- 记录现有边界和迁移路线。

验收：

- 本文档存在并作为后续改造依据。
- `AGENTS.md` 中保留项目结构和注意点。

### 阶段 1：建立最小长链接 service

状态：已完成。

目标：

- 新增 `GameSocketService`。
- 先只封装 `connect` 和 `login`。
- `UIRootUICtrl` 或 Web/dev 登录流程不直接触碰底层 `NetManager.request("login", ...)`。
- gameplay route 暂不接入，局内仍保持本地玩法。

建议接口：

```ts
class GameSocketService {
  connect(): Promise<void>;
  login(session: string, openid: string, name: string, avatar: string): Promise<LoginResult>;
}
```

验收：

- 行为与当前版本一致。
- `Server` 能通过 `npm run build`。
- 客户端能通过 `GameSocketService.login` 打通一条请求/回包链路。
- 局内 UI 和玩法不变。
- 不在 `GameTouch`、`WorkFlow`、`UIGameUICtrl` 中新增直接 route 字符串。

### 阶段 2：新增 enter_stage 和单局快照模型

状态：进行中。已完成 proto、服务端固定快照、客户端 `GameSocketService.enterStage()` 和进入游戏前试接；尚未用服务端 snapshot 初始化真实棋盘。

目标：

- 在 proto 中新增 `EnterStageRequest`、`GameSnapshot` 等消息。
- 服务端新增最小房间/单局状态。
- 客户端进入关卡时使用统一 `GameSnapshot` 初始化棋盘。
- `GameManager` 和 `MapManager` 不再保存多份相互冲突的权威数据。
- 服务端 `game.enter_stage` 返回字段和客户端当前 `PlayResponse` 所需数据对齐。

客户端需要梳理：

- `GameManager.gameMap`
- `GameManager.planMap`
- `MapManager.mapTitles`
- `GameCreate.onLoadMap`
- `UIGameUICtrl.initMap`

验收：

- 普通关卡能从 snapshot 进入。
- 客户端本地 HTTP 进入关卡仍可兼容。
- snapshot 能完整恢复棋盘显示。

### 阶段 3：服务端权威连线和胜负

目标：

- 正式局连线成功/失败完全以服务端返回为准。
- 客户端不再在正式路径调用 `util.canConnectPath` 决定结果。
- 本地判定只保留在 debug/offline fallback。

验收：

- 相同输入下，客户端只播放服务端返回的结果。
- 失败原因可转成 UI 提示。
- 胜利和死局由服务端返回。

### 阶段 4：服务端权威坍塌

目标：

- 服务端返回完整 `moves`。
- 客户端根据 `moves` 播放移动，不再自行计算正式局坍塌。

需要补齐服务端：

- `Down`
- `Up`
- `Left`
- `Right`
- `UpDown`
- `LeftRight`
- `RightLeft`
- `DownUp`
- `Rotate`
- `DoubleRotate`
- `Rotate3`
- `Rotate4`

验收：

- 所有关卡方向都可以完成一次完整消除和坍塌。
- 客户端表现棋盘和服务端 grid 一致。
- 增加至少一个服务端纯逻辑测试覆盖每类坍塌方向。

### 阶段 5：服务端权威特殊块

目标：

- 特殊块效果由服务端产出 delta。
- 客户端只播放 `effects`。

需要覆盖：

- Green
- Grass
- Ice / Ice2 / Ice3
- Rocket
- Wooden
- Magnet
- Stone
- Placeholder
- Random1-4

验收：

- 特殊块消除、解锁、阻挡、移动限制与旧客户端一致。
- 服务端测试覆盖每种特殊块至少一个场景。

### 阶段 6：服务端权威道具和刷新

目标：

- `match`
- `refresh`
- `clean`

都通过 `game.use_item` 或 `game.refresh` 进入服务端。

客户端 `WorkFlow` 只负责：

- 点击按钮。
- 发请求。
- 根据成功/失败展示 UI。
- 根据 delta 播动画。

验收：

- 道具数量扣减一致。
- 刷新后棋盘与服务端一致。
- 死局刷新/提示逻辑不再由客户端自行推进正式状态。

### 阶段 7：结算和重连

目标：

- 单局结果由服务端产生。
- 客户端切后台、断线、重连后可以恢复局内棋盘。

验收：

- 断线重连后继续同一局。
- 重连后服务端和客户端棋盘一致。
- 重复发送同一操作不会重复消除。
- 结算不会重复发奖。

## 服务端改造路线

### 阶段 1：协议和房间模型

注意：当前 `Server` 只有 `gateway.ts` 和 `protocol.ts`。这一阶段才开始重新引入房间模型。

需要补充：

- `roomId`
- `playerId`
- `stageId`
- `status`
- `serverSeq`
- `createdAt`
- `updatedAt`
- `lastActionAt`

`Room` 应提供：

- `createGame`
- `applyAction`
- `getSnapshot`
- `getDeltasAfter(seq)`
- `close`

### 阶段 2：测试先行补玩法

服务端应优先加纯逻辑测试，不依赖 WebSocket：

- path finder
- block generator
- collapse engine
- game engine linkup
- special block effects
- refresh/use item

### 阶段 3：再接 gateway

`gateway.ts` 只做：

- 解包。
- 鉴权。
- 找房间。
- 调用 service/engine。
- 回包/推送。

不要把玩法逻辑继续堆在 `gateway.ts`。

## 文件级改造建议

### 客户端

优先调整：

- `LinkUpClient/assets/Scripts/NetManager.ts`
- `LinkUpClient/assets/Scripts/Game/GameTouch.ts`
- `LinkUpClient/assets/Scripts/UI/UIGameUICtrl.ts`
- `LinkUpClient/assets/Scripts/Game/WorkFlow.ts`
- `LinkUpClient/assets/Scripts/Manager/GameManager.ts`
- `LinkUpClient/assets/Scripts/Manager/MapManager.ts`
- `LinkUpClient/assets/Scripts/Game/GameCreate.ts`

新增：

- `LinkUpClient/assets/Scripts/GameSocketService.ts`
- `LinkUpClient/assets/Scripts/Game/GameDeltaApplier.ts`

### 服务端

优先调整：

- `Server/proto/linkup.proto`
- `Server/src/gateway.ts`

建议新增：

- `Server/src/session.ts`
- `Server/src/room.ts`
- `Server/src/game/game-service.ts`
- `Server/src/game/game-engine.ts`
- `Server/src/game/delta.ts`
- `Server/src/game/path-finder.ts`
- `Server/src/game/collapse-engine.ts`
- `Server/src/data/map-loader.ts`
- `Server/src/game/__tests__/...`

## 第一阶段具体任务清单

第一阶段只做最小长链接链路，不改变游戏表现。

1. 新建 `GameSocketService`。
2. 在 service 内封装 `login` 的 encode/decode。
3. `NetManager` 保持底层 request/push 能力，不导出业务便捷函数。
4. 在 Web/dev 登录或启动链路中试接 `GameSocketService.login`，失败时不阻塞现有 HTTP 流程。
5. 局内玩法继续走客户端本地逻辑。
6. 增加 `GameSocketService` 的连接状态、错误日志和 route 常量。
7. 跑 `Server` 的 `npm run build`。

阶段 1 验收标准：

- 不连接 WebSocket 时，客户端仍能按现有 HTTP + 本地玩法运行。
- 连接 WebSocket 时，登录请求通过 `GameSocketService`。
- 业务代码不直接知道 proto encode/decode 或 route 字符串。
- 没有 UI 行为变化。

## 风险和处理策略

### 风险：服务端和客户端坐标不一致

处理：

- 统一约定 `x=列`、`y=行`。
- 协议字段全部使用 `{ x, y }`。
- 客户端 `MapManager.getBoard()` 和服务端 `grid[y][x]` 之间加转换测试。

### 风险：特殊块语义分散

处理：

- 先列出所有 `BlockIDs` 的服务端规则表。
- 每个特殊块一个最小测试场景。
- 客户端表现只消费 `effects`，不自行推断状态。

### 风险：旋转坍塌难以对齐

处理：

- 从客户端 `Collapse/*` 移植纯算法到服务端。
- 先写固定输入输出测试，再接到 `GameEngine`。

### 风险：正式 HTTP 后端仍承担奖励和账号

处理：

- 长链接先只管单局内玩法。
- 登录、支付、分享、发奖保留现有 HTTP/SDK。
- 等玩法链路稳定后再规划奖励和结算统一。

## 推荐执行顺序

1. 已完成阶段 1：客户端最小 `GameSocketService` 和 login 链路。
2. 已完成最小 `enterStage` 固定 snapshot 链路。
3. 补服务端纯逻辑测试框架。
4. 定义完整 snapshot/delta 协议。
5. 让 `enterStage` 返回真实 snapshot，并让客户端可选择用 snapshot 初始化棋盘。
6. 让 `linkup` 返回 delta 并由客户端应用。
7. 迁坍塌。
8. 迁特殊块。
9. 迁道具。
10. 做重连恢复。
11. 最后清理旧 HTTP 局内路径。

## 当前结论

不要马上大规模重写 `UIGameUICtrl` 或 `GameManager`。第一步应该是把长链接调用集中到一个 service，让业务代码停止直接触碰底层 WebSocket 和协议细节。

只要第一阶段完成，后面每迁一个玩法点，都可以在同一个入口做服务端权威化，不会继续把临时代码散到 UI、Manager 和 Game 组件里。
