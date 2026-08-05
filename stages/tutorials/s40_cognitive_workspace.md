# s40：Production Agent Architecture Capstone

## 合并范围

收束 s21–s39：Runtime、协议、状态、Memory、评估、安全、认知、部署和运营。

## 学习重点

完整系统不是 20 个彼此独立的脚本，而是一个有界 Runtime 加可移除 Feature。Capstone
用六层验收判断是否具备迁移资格。

## 练习

1. 把每个 `CapstoneCheck` 对应到真实自动化测试。
2. 编写从课程行为到 `HarnessFeature` 的迁移设计。
3. 完成一个小范围生产迁移后复跑整个矩阵。

## 生产迁移

课程完成不等于上线；须通过类型检查、桌面构建和目标平台的真实运行验证。
