# Huawei 0.3.3 更新准备（2026-10-30）

最初范围为同步上游并准备更新，统计／录像和多角色只出方案；随后用户明确要求直接更新 Huawei。
已于 2026-10-30 15:39 启用最终候选；没有设置自动切换任务。此前准备阶段的检查记录保留如下。

## 源码与客户端

上游固定为正式 tag `v0.3.3`，提交 `f07b8965`。
组织 fork 的候选分支为 `codex/upstream-0.3.3`，游戏源码合并提交
`6576615a3bdb7ae4c025af4fe1e2ccfc16d4fff2`。保留真人／LLM 来源、轨迹采集、录制说明、代理头像与前端加载支持。
合并时优先保留上游的新版本感知 loader、渲染恢复和名片／皮肤行为，并合并 delta hello 与 controller 字段；
两条重叠的 stats v2→v3 迁移合为一条，重新规范化 lockfile，移除自动合并造成的重复键。

共享 Core 候选 `0.2.0-alpha.4` 固定提交 `6eae6865467e5df4b363ac6ee84f2314ecda4a17`，
也推送在 Core 的 `codex/upstream-0.3.3` 分支。支持应用 0.3.0–0.3.3、原生协议 v1、默认玩法版本的 vanilla 内容。
历史版本的内容清单明确拒绝；没有用默认数据假装兼容历史玩法。

配套客户端本地候选：Codex `0.2.0-alpha.6`、DSH `0.1.4`，均固定上述 Core 并已构建、检查与打包。
宿主工作区已有未提交的 skill／打包改动，未把它们混入自动提交；DSH README 按其仓库要求保持不变。
没有发布 GitHub Release／npm，也没有改写已安装的插件缓存。切换服务端以前应先协调客户端更新，旧插件会拒绝 0.3.3。

## Huawei 候选

- 当前线上目录仍为 `/opt/stronghold/releases/c3a4bd70`，应用 0.3.1。
- 最终候选目录 `/opt/stronghold/releases/0.3.3-47cdf5f4`，源码修订 `47cdf5f447241aae581e6d56c78827b177a942cd`（含同步后的 CI 适配）。
- 候选源码及构建载荷含 2,391 个 SHA-256 校验文件；规范归档
  `/opt/stronghold/releases/0.3.3-47cdf5f4-portable.tar.gz`，SHA-256
  `2c13a3d02119054c8a3808c65f132cdf65abaa0d2d239d10d5d53967ced431be`。
- `huawei-payload-manifest.json` 记录上游／fork 身份、每个文件摘要及备案页覆盖。
- 生产依赖锁的 97 个条目逐项等同原站，复用已安装的 Linux 依赖；保留旧 hashed 前端资源以便回退。
- 新入口 `main-Q3ADZNQ5.js`，CSS `styles-ac039c790211bba4.css`；保留线上
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
  import checker 仍打印此前记录的三个 `nodeData.js` Node-only 边界条目，但退出成功。
- 所有四个语言包严格检查通过：各 2,348 个 msgid 全覆盖。
- Core 原有 10 项测试和 package contract 通过；Codex 原有 2 项测试和 package contract 通过；DSH 构建／package contract 通过。
- 在 Huawei 以 `stronghold` 用户于 `127.0.0.1:33033` 启动独立预览；Node 24.22.1、health 0.3.3、公告插件载入。
- 新版 Core 经 SSH 回环转发完成真实 Huawei 预览握手、全部公开表摘要校验和隔离 Worker 加载；
  HTTP 入口为 200，包含新构建和原备案信息。没有创建或干预线上对局。

本地未再次执行整套耗时测试；最终修订的远端全矩阵 CI 已完成并通过（见文末）。没有完成 0.3.3 的整局浏览器／MCP 棋力评测，也没有宣称此次更新修复了此前 silent 接管原因。
ArkGuardRL 的固定训练引擎、权重和历史评测本次未迁移或重跑；服务端规则升级不能直接解释为模型提升，
新版与旧版对局须标注各自内容身份后再比较。

## 手动启用与回滚

候选启用脚本：`/opt/stronghold/releases/activate-0.3.3-47cdf5f4.py`。
本次只运行其无参数只读检查模式；修改分支仅完成语法检查，尚未执行生产切换演练。

```sh
# 只读复核；不会启用或安排更新
ssh huawei 'python3 /opt/stronghold/releases/activate-0.3.3-47cdf5f4.py'
# 获准维护并清空连接／对局后，才手动执行
ssh huawei 'python3 /opt/stronghold/releases/activate-0.3.3-47cdf5f4.py --activate'
# 启用后需要回滚时，同样先等维护窗口和空闲
ssh huawei 'python3 /opt/stronghold/releases/activate-0.3.3-47cdf5f4.py --rollback'
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


## 素材补齐与最终候选

上游完整发行包 `Stronghold-Protocol-v0.3.3.zip` 经 GitHub 公布 SHA-256
`1bfc651096ff4c44b76296717bd605220b5204714722832140a3d407153cd2be` 校验。
候选美术位于独立的 `/var/lib/stronghold/art-033`，从旧素材复制后按摘要复用 8,937 个文件，
补齐／替换 22,671 个文件（差分 382.99 MiB），其中仅两个既有文件内容不同，为陷落雪祀的 PNG／atlas。
线上 `/var/lib/stronghold/art` 没有改写。

完整资源清单 `huawei-art-manifest.json` 校验 31,608 个文件；启用脚本还会重新逐文件校验，
不是只看源码包摘要。setup 检查显示 16,963 个美术／音频文件齐全，本地客户端美术 1,715 项、特效 9,439 项／4组；
第二期下半 986、上半 941、第一期下半 785、上半 771 条记录的覆盖均为零缺失。
原有地图／公告／备案均保留，新版默认开放的历史玩法也已补齐展示素材，但当前五工具仍拒绝历史版本对局。

最终启用脚本只做过只读检查；生产切换和自动回滚的修改分支没有执行。
先前 `6576615a` 候选与素材补齐前的记录保留供追溯，其启用脚本已标为 `.superseded`，应使用本页最终脚本。
素材／代码预检通过不等于新版整局棋力、录像或多角色已经验收。

首轮远端 CI 的五处失败已修正；对应 61 项本地回归、lint 与类型检查通过。
修正后的全矩阵运行见 https://github.com/ArkStrongholdRL/Stronghold-Protocol/actions/runs/41019764571 。
该运行已 completed / success：Ubuntu / Windows × Node 22 的 8 个测试分片、golden、tooling 和 Node 24 guards 全部通过。

最终独立预览也经浏览器加载：首页显示 0.3.3、公告、采集说明和原备案，无 console error；没有填写玩家代号或开局。
检查完成后关闭预览服务与 SSH 转发，生产服务未重启，current 仍为 c3a4bd70。

客户端最终包位于各宿主 `results/upstream-0.3.3-20261030-final-candidate/`：
Codex `ark-play-codex-0.2.0-alpha.6.zip`，SHA-256 `cad9c7bfe0ffb3f7a3b157bd2dd35ea88928e3c9f23d36c310515c06ea05fc72`；
DSH `dsh-ark-stronghold-0.1.4.zip`，SHA-256 `9f6257b8317cd30689b8fb0546244b583c33551e86caea75f9e3b1e2092e90ce`。
早先同版本 ZIP 是过程候选，以此目录与摘要为准。额外覆盖加入历史玩法后在 ready 之前拒绝，不自动准备不支持的房间。

最终 Core `6eae6865467e5df4b363ac6ee84f2314ecda4a17` 的 CI 也通过：
https://github.com/ArkStrongholdRL/ark-play-core/actions/runs/41020292270 。
本报告最终提交仅更新说明，不改变已验证／已打包的运行源码 `47cdf5f4`；文档提交跳过重复全矩阵 CI。


## 2026-10-30 15:39 已正式启用

用户在得知在线对局仍存在后，明确要求“直接更新”。启用脚本增加显式操作员开关
`--activate --interrupt-active`，仅此分支允许跳过空闲等待并记录当时的连接／对局数。
候选源码／素材逐文件校验、环境备份、原子 current 切换和失败回滚保持不变。
本次实际执行成功，`activation-033-status.json` 为 `activated`。

- 旧 KTUQ 对局按预期随服务重启结束，日志为 `disposed (shutdown)`。
- 当前 `/opt/stronghold/current` 指向 `/opt/stronghold/releases/0.3.3-47cdf5f4`。
- 公开 `https://ark.minyako.top/healthz` 返回 app 0.3.3、build `e548edffaffc`、预期内容身份。
- 公网首页引用 `main-Q3ADZNQ5.js`，仍含原备案信息；公告插件已加载。
- 新 Core 经公网证书验证 WSS 完成握手、12 张公开表摘要校验和 Worker 加载；检查未建房或开局。
- 原环境备份保留于 `/opt/stronghold/activation-033-environment.backup`，仅 root 可读；原目录可用于回滚。
- Codex `37011f5`、DSH `357ee5a` 已各推送 `codex/upstream-0.3.3` 发布准备分支，待 Node 22/24 CI。
  此阶段没有创建插件 tag／GitHub Release、没有 npm 发布，也没有改写已安装插件缓存。
