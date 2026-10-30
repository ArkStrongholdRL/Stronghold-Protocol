# Huawei 0.3.3 更新准备（2026-10-30）

本次授权范围：同步上游并准备更新；统计／录像和多角色只出方案。没有切换线上服务，没有设置自动切换任务。

## 源码与客户端

上游固定为正式 tag `v0.3.3`，提交 `f07b8965`。
组织 fork 的候选分支为 `codex/upstream-0.3.3`，游戏源码合并提交
`6576615a3bdb7ae4c025af4fe1e2ccfc16d4fff2`。保留真人／LLM 来源、轨迹采集、录制说明、代理头像与前端加载支持。
合并时优先保留上游的新版本感知 loader、渲染恢复和名片／皮肤行为，并合并 delta hello 与 controller 字段；
两条重叠的 stats v2→v3 迁移合为一条，重新规范化 lockfile，移除自动合并造成的重复键。

共享 Core 候选 `0.2.0-alpha.4` 固定提交 `d34d855cbe4c4a7ef54c2d2a5cb0dd5bbbe0a29c`，
也推送在 Core 的 `codex/upstream-0.3.3` 分支。支持应用 0.3.0–0.3.3、原生协议 v1、默认玩法版本的 vanilla 内容。
历史版本的内容清单明确拒绝；没有用默认数据假装兼容历史玩法。

配套客户端本地候选：Codex `0.2.0-alpha.6`、DSH `0.1.4`，均固定上述 Core 并已构建、检查与打包。
宿主工作区已有未提交的 skill／打包改动，未把它们混入自动提交；DSH README 按其仓库要求保持不变。
没有发布 GitHub Release／npm，也没有改写已安装的插件缓存。切换服务端以前应先协调客户端更新，旧插件会拒绝 0.3.3。

## Huawei 候选

- 当前线上目录仍为 `/opt/stronghold/releases/c3a4bd70`，应用 0.3.1。
- 候选目录 `/opt/stronghold/releases/0.3.3-6576615a`。
- 候选源码及构建载荷含 2,390 个 SHA-256 校验文件；规范归档
  `/opt/stronghold/releases/0.3.3-6576615a-portable.tar.gz`，SHA-256
  `aa1d22eafd2b4e53b8f2146f8202b313e4ef6ba2f1b45ad3b7b3e0e43e62b1a5`。
- `huawei-payload-manifest.json` 记录上游／fork 身份、每个文件摘要及备案页覆盖。
- 生产依赖锁的 97 个条目逐项等同原站，复用已安装的 Linux 依赖；保留旧 hashed 前端资源以便回退。
- 新入口 `main-Q3ADZNQ5.js`，CSS `styles-53ee6de2e64a4f2c.css`；保留线上
  `蜀ICP备2026065700号` 页脚、server-notices 公告和既有录制路径。
- 候选内容身份：`03648f6f4b030841ce4f4bd601d134b8f60cd8dac56f24703843288ec85e82d3`。
  本地与 Huawei 的 sim/shared 字节、玩法数据、插件和 settings 相同。
- 按上游正式发行规则，候选运行树移除 development-only external AI 文件并含 `server/release-without-llm`。
  普通玩家 `/ws` LLM 插件不走这条服主 AI 路径，因此仍可连接。

跨平台传输曾带入 macOS AppleDouble 元数据，预览内容身份比较发现后已清理；最终归档使用 Python tarfile，
不携带 xattrs／AppleDouble。候选进程重新启动后与本地内容身份一致。

## 已完成验证

- 定向协议／网络／大厅／客户端／录制来源／文档：770 项通过。
- 补充 stats、身份握手、状态 delta、sim loader、历史版本大厅：106 项通过。
- CI guards：28 项通过。
- 原有 288 个 golden 场景全部匹配，无自行更新 golden。
- smoke、lint、import checker 和 typecheck 通过。Lint 为 0 errors / 145 warnings；
  import checker 仍打印此前记录的三个 `nodeData.js` Node-only 注记，但退出成功。
- 所有四个语言包严格检查通过：各 2,348 个 msgid 全覆盖。
- Core 原有 10 项测试和 package contract 通过；Codex 原有 2 项测试和 package contract 通过；DSH 构建／package contract 通过。
- 在 Huawei 以 `stronghold` 用户于 `127.0.0.1:33033` 启动独立预览；Node 24.22.1、health 0.3.3、公告插件载入。
- 新版 Core 经 SSH 回环转发完成真实 Huawei 预览握手、全部公开表摘要校验和隔离 Worker 加载；
  HTTP 入口为 200，包含新构建和原备案信息。没有创建或干预线上对局。

没有运行整套耗时测试，没有完成 0.3.3 的整局浏览器／MCP 棋力评测，也没有宣称此次更新修复了此前 silent 接管原因。
ArkGuardRL 的固定训练引擎、权重和历史评测本次未迁移或重跑；服务端规则升级不能直接解释为模型提升，
新版与旧版对局须标注各自内容身份后再比较。

## 手动启用与回滚

候选启用脚本：`/opt/stronghold/releases/activate-0.3.3-6576615a.py`。
本次只运行其无参数只读检查模式；修改分支仅完成语法检查，尚未执行生产切换演练。

```sh
# 只读复核；不会启用或安排更新
ssh huawei 'python3 /opt/stronghold/releases/activate-0.3.3-6576615a.py'
# 获准维护并清空连接／对局后，才手动执行
ssh huawei 'python3 /opt/stronghold/releases/activate-0.3.3-6576615a.py --activate'
# 启用后需要回滚时，同样先等维护窗口和空闲
ssh huawei 'python3 /opt/stronghold/releases/activate-0.3.3-6576615a.py --rollback'
```

脚本验证载荷摘要、旧 current、其他更新 timer 和两次空闲快照，要求 matches=0 且 sockets=0；
备份原环境，更新 `SP_TRAJECTORY_REVISION`，原子切换 current 并重启。健康／内容身份失败时恢复旧目录和环境。
凭据备份仅保存在 root 的 0600 文件，不输出环境内容。线上当前轨迹的 source revision 标签旧于实际运行源码，
因此准备脚本特意修正新部署标签，避免新数据继续沿用旧修订号。

空闲检查不是服务器的原子入场闸门，检查与重启间仍可能有新连接；实际启用时应安排维护窗口，
并在入口暂停接入后执行。脚本没有自动封网或重配 Caddy，没有启用无人值守更新。

正式启用后还需核对公网 HTTPS/WSS、首页备案、公告和一局新版客户端端到端行为，再结束维护窗口。

## 同步后的 CI 适配

首轮全矩阵 CI 暴露五处新旧契约差异：LLM 标签未按界面缩放、轨迹写入循环未标明已有字节上限、
默认房间 fixture 未含已存在的 controller 元数据、旧服务 worker 测试误把独立 runtime 缓存也当成只读导入缓存，
以及隔离 FX 单元测试未 mock 与场景无关的 Pillow 格式检查。
本次修正 CSS 缩放与循环说明，更新既有测试／fixture；不改游戏规则、不新增测试文件、不改 golden。
默认房间 fixture 只增加 `controller: {kind: unknown, client: null}`，默认版本、版本清单和内容哈希公式保持原期望。
