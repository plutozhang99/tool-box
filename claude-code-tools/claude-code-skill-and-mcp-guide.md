# Claude Code Skill & MCP 完全指南

---

## 目录

1. [Skill 是什么](#1-skill-是什么)
2. [MCP 是什么](#2-mcp-是什么)
3. [Skill vs MCP 对比](#3-skill-vs-mcp-对比)
4. [如何编写 Skill](#4-如何编写-skill)
5. [如何编写 MCP Server](#5-如何编写-mcp-server)
6. [复杂 Skill 的设计模式](#6-复杂-skill-的设计模式)
7. [Powerforge 深度解析](#7-powerforge-深度解析)
8. [实战：编写一个编排类 Skill](#8-实战编写一个编排类-skill)
9. [实例分析：Context7 MCP 实现流程](#9-实例分析context7-mcp-实现流程)

---

## 1. Skill 是什么

Skill 是 Claude Code 的扩展机制，本质是一个 **带 YAML frontmatter 的 Markdown 文件**。它教 Claude 在特定场景下该遵循什么工作流、知识和步骤。

- 不包含可执行代码
- Claude 是"运行时"，读懂指令后按描述执行
- 可以通过 `/skill-name` 手动调用，也可以被 Claude 自动匹配调用

### 文件结构

```
~/.claude/skills/my-skill/
└── SKILL.md          # 必须，主指令文件
├── reference.md      # 可选，补充参考资料
├── examples.md       # 可选，使用示例
└── scripts/          # 可选，辅助脚本
    └── helper.py
```

### 作用域

| 路径 | 作用域 |
|------|--------|
| `~/.claude/skills/<name>/SKILL.md` | 全局，所有项目可用 |
| `.claude/skills/<name>/SKILL.md` | 仅当前项目 |
| Enterprise managed settings | 组织级别 |

---

## 2. MCP 是什么

MCP（Model Context Protocol）是一个开放协议，让 Claude Code 能连接**外部工具和服务**（数据库、API、Slack 等）。MCP Server 是一个独立进程，通过标准化协议向 Claude 暴露可调用的 tools/resources。

- 需要编写代码（TypeScript/Python）
- 作为独立进程运行
- Claude 自动发现并调用 MCP Server 暴露的 tools

### 三种运行方式

| 方式 | 说明 | 配置示例 |
|------|------|----------|
| **stdio** | 本地子进程（最常见） | `"command": "node", "args": ["./server.js"]` |
| **HTTP** | 远程 HTTP 服务 | `"url": "http://localhost:3000/mcp"` |
| **SSE** | 云端 Server-Sent Events | `"url": "https://mcp.example.com/sse"` |

### 配置文件

MCP Server 在 `.mcp.json` 中声明：

```json
{
  "mcpServers": {
    "my-db": {
      "command": "node",
      "args": ["./mcp-server.js"],
      "env": { "DATABASE_URL": "postgresql://..." }
    },
    "remote-service": {
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

| 配置路径 | 作用域 |
|----------|--------|
| `.claude/.mcp.json` | 当前项目 |
| `~/.claude/.mcp.json` | 全局所有项目 |

---

## 3. Skill vs MCP 对比

| 维度 | **Skill** | **MCP Server** |
|------|-----------|----------------|
| 本质 | Markdown 指令文件 | 外部进程/服务 |
| 给 Claude 的是 | 工作流 / 知识 / 步骤 | 可调用的工具能力 |
| 编写语言 | YAML + Markdown | TypeScript / Python + SDK |
| 上手难度 | 5 分钟 | 需要编程 |
| 典型用途 | 部署流程、代码规范、review 清单 | 查数据库、调 API、发消息 |
| 调用方式 | `/name` 手动 或 Claude 自动匹配 | Claude 自动发现并调用 |
| 运行位置 | Claude 上下文内 | 独立进程 |

**一句话总结：** Skill 教 Claude **怎么做**，MCP 让 Claude **能做到**。两者配合使用效果最佳。

---

## 4. 如何编写 Skill

### 4.1 最小示例

```bash
mkdir -p ~/.claude/skills/my-skill
```

`~/.claude/skills/my-skill/SKILL.md`:

```yaml
---
name: my-skill
description: 简短描述什么时候该用这个 skill
---

# My Skill

这里写 Claude 应该遵循的指令和步骤...
```

### 4.2 Frontmatter 字段

| 字段 | 作用 | 示例 |
|------|------|------|
| `name` | 名称，也是 `/slash-command` | `deploy` |
| `description` | Claude 据此判断是否自动调用 | `"Deploy app to production"` |
| `disable-model-invocation` | 设为 `true` 则只能手动 `/name` 调用 | `true` |
| `user-invocable` | 设为 `false` 则只有 Claude 能调用 | `false` |
| `context` | 设为 `fork` 在隔离子 agent 中运行 | `fork` |
| `agent` | 指定子 agent 类型 | `Explore` |
| `allowed-tools` | 激活时自动授权的工具列表 | `["Read", "Bash"]` |
| `paths` | Glob 模式，限制在匹配文件时才激活 | `["src/**/*.ts"]` |

### 4.3 动态 Shell 注入

用 `!`\`command\`` 语法在 skill 加载时执行 shell 命令并注入结果：

```yaml
---
name: pr-summary
description: Summarize a pull request
---

## PR Information
- Current branch: !`git branch --show-current`
- Diff: !`gh pr diff`
- Recent commits: !`git log --oneline -5`

根据以上信息总结这个 PR...
```

### 4.4 使用 $ARGUMENTS

`$ARGUMENTS` 会被替换为用户在 `/skill-name` 后面输入的参数：

```yaml
---
name: deploy
description: Deploy to a target environment
---

Deploy the application to $ARGUMENTS:

1. Run tests
2. Build
3. Push to target
```

调用：`/deploy staging`，`$ARGUMENTS` 变为 `staging`。

### 4.5 子 Agent 隔离执行

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:
1. Find relevant files
2. Read and analyze
3. Summarize findings
```

`context: fork` 让 skill 在隔离的子 agent 中运行，不污染主上下文。

---

## 5. 如何编写 MCP Server

### 5.1 Node.js / TypeScript 示例

```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-server",
  version: "1.0.0"
});

// 注册一个 tool
server.tool(
  "query_database",
  "Execute a SQL query against the database",
  { sql: z.string().describe("The SQL query to execute") },
  async ({ sql }) => {
    const result = await db.query(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// 注册一个 resource
server.resource(
  "config",
  "app://config",
  async () => ({
    contents: [{ uri: "app://config", text: JSON.stringify(config) }]
  })
);

// 启动 stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 5.2 Python 示例

```bash
pip install mcp
```

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server

server = Server("my-server")

@server.tool()
async def query_database(sql: str) -> str:
    """Execute a SQL query against the database"""
    result = await db.execute(sql)
    return json.dumps(result)

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write)

asyncio.run(main())
```

### 5.3 配置到 Claude Code

在项目根目录或 `~/.claude/` 创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["./path/to/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/mydb"
      }
    }
  }
}
```

### 5.4 MCP Server 的三种能力

| 能力 | 说明 | 用法 |
|------|------|------|
| **Tools** | Claude 可调用的函数 | `server.tool("name", schema, handler)` |
| **Resources** | Claude 可读取的数据 | `server.resource("name", "uri", handler)` |
| **Prompts** | 可复用的提示模板 | `server.prompt("name", handler)` |

---

## 6. 复杂 Skill 的设计模式

复杂 skill 不需要代码，它的"复杂"体现在**指令设计模式**上。Claude 是"运行时"，读懂 Markdown 指令后按描述执行。

### 6.1 路由器模式（Router）

根据用户意图分发到不同的 skill 组合。

**代表：** `powerforge`

```markdown
## Phase Router

### Design — "build X", "plan X"
1. skill-a:brainstorming
2. skill-b:/plan

### Debugging — "something's broken"
1. skill-a:systematic-debugging
2. skill-b:async-reasoning
```

Claude 判断用户意图属于哪个阶段，然后按路由表执行对应 skill 组合。

### 6.2 流水线模式（Pipeline）

固定阶段顺序执行，每阶段输出作为下一阶段输入。

**代表：** `blueprint`

```markdown
## 5-Phase Pipeline

1. **Research** — 读代码、收集上下文、写发现到文件
2. **Design** — 基于 Phase 1 拆分为单 PR 大小的步骤
3. **Draft** — 写自包含的 Markdown 计划文件到 plans/
4. **Review** — 委托强模型子 agent 做对抗性审查
5. **Register** — 保存计划、更新索引、呈现给用户
```

### 6.3 编排器模式（Orchestrator）

动态发现可用资源，并行调度多个 Agent。

**代表：** `team-builder`

```markdown
## Step 1: Discover Available Agents
Glob agent directories, extract name and description from each .md file

## Step 2: Present Domain Menu
Show categorized agent list, let user pick

## Step 3: Spawn Agents in Parallel
Use the Agent tool to run selected agents concurrently

## Step 4: Synthesize Results
Collect outputs, highlight agreements and conflicts
```

### 6.4 模式库模式（Pattern Catalog）

提供多种架构模式，由 Claude 根据场景选择。

**代表：** `autonomous-loops`

```markdown
## Loop Pattern Spectrum

| Pattern           | Complexity | Best For                   |
|-------------------|-----------|----------------------------|
| Sequential Pipeline | Low     | 脚本化工作流                 |
| NanoClaw REPL      | Low      | 交互式持久会话               |
| Infinite Loop      | Medium   | 并行内容生成                 |
| Continuous PR Loop | Medium   | 多天迭代项目                 |
| RFC-Driven DAG     | High     | 大型 feature、多单元并行      |

## Decision Matrix
Is the task a single focused change?
├─ Yes → Sequential Pipeline
└─ No → Is there a written spec/RFC?
         ├─ Yes → Ralphinho (DAG)
         └─ No → Continuous Claude
```

### 6.5 核心指令技巧总结

| 技巧 | 作用 | 示例 |
|------|------|------|
| **阶段性指令** | 定义执行顺序 | `## Phase 1: ... ## Phase 2: ...` |
| **条件路由** | 分支逻辑 | `### If single-file → skip planning` |
| **工具编排** | 调用内置 Agent tool | `Spawn agents in parallel using Agent tool` |
| **Shell 注入** | 注入实时数据 | `` !`git log --oneline -5` `` |
| **交叉引用** | 调用其他 skill | `superpowers:brainstorming` |
| **子 agent 指导** | 告诉被编排的 agent 该做什么 | `## For Subagents` |
| **反模式清单** | 告诉 Claude 不该做什么 | `## When NOT to Use` |

---

## 7. Powerforge 深度解析

Powerforge 是一个**路由器型 skill**，组合了三个底层 skill：

| Skill | 角色 | 提供什么 |
|-------|------|---------|
| `superpowers` | HOW（方法论） | TDD、验证、系统化调试、brainstorming、code review |
| `zforge` | WHAT（工作流） | 结构化计划、阶段模板、编排、异步状态设计 |
| `distributed-architect` | WHERE（边界分析） | 分布式系统组件边界正确性 |

### 阶段路由表

```
用户意图                    → 调用组合
───────────────────────────────────────────────────────
"build X", "plan X"        → superpowers:brainstorming → zforge:/plan
"start building"           → zforge:/feature-orchestrate
                             + 每阶段: superpowers:TDD + verification
                             + 阶段间: superpowers:code-review
"实现完成"                   → zforge:/review → superpowers:code-review
                             → distributed-architect:dist-check
"something's broken"       → superpowers:systematic-debugging
                             + zforge:async-reasoning (如涉及异步)
"let's merge"              → superpowers:finishing-a-development-branch
```

### 子 Agent 感知

Powerforge 有一个关键段落处理**被编排的子 agent**：

```markdown
## For Subagents

If you're a phase agent spawned by an orchestrator:
- You're in phase 2 (Execution)
- Apply TDD and verification to your phase's checklist
- You don't need to invoke brainstorming, /plan, or /review
```

当 `zforge:/feature-orchestrate` 生成多个子 agent 时，每个子 agent 也会加载 powerforge。这段指令告诉子 agent："你只需关注执行阶段，不要重复做设计和 review"，避免了递归调用和重复工作。

### 设计要点

1. **Powerforge 本身零实现** — 纯路由，不包含 brainstorming/TDD/debugging 的具体方法
2. **顺序有意义** — "不要跳过 brainstorming 直接做 /plan"是明确写在指令里的
3. **条件追加** — `distributed-architect:dist-check` 只在变更跨组件边界时才触发
4. **退出条件清晰** — `## When NOT to Use` 避免对简单任务过度使用流程

---

## 8. 实战：编写一个编排类 Skill

以下是一个完整的编排类 skill 骨架，你可以基于此修改：

```yaml
---
name: my-orchestrator
description: >-
  根据任务类型编排多个 skill 的执行顺序。
  当用户开始一个跨设计、实现、测试的任务时触发。
  TRIGGER when: 用户要开发一个完整 feature。
  DO NOT TRIGGER when: 单文件修改或用户说"直接做"。
---

# My Orchestrator — Skill 组合路由器

## Plugin Roles

- **research-skill** = 调研（收集信息和上下文）
- **impl-skill** = 实现（写代码、写测试）
- **review-skill** = 审查（代码质量、安全性）

## Phase Router

根据用户意图判断阶段，然后按对应组合执行。

### 1. 规划阶段 — "计划 X", "设计 X", "我想做 X"

1. `research-skill:gather-context` — 收集代码库上下文
2. `impl-skill:/plan` — 生成结构化实施计划到 `plans/`

先调研再规划。不要跳过调研直接做计划——未验证的假设会在后续阶段累积。

### 2. 实现阶段 — "开始做", "执行计划"

每个实现模块应用：
- `impl-skill:tdd` — RED-GREEN-REFACTOR
- `impl-skill:verify` — 完成前提供证据（测试输出、curl 响应等）

模块间应用：
- `review-skill:spec-check` — 检查是否符合规格

### 3. 审查阶段 — 实现完成后

按顺序执行：
1. `review-skill:code-review` — 代码质量审查
2. `review-skill:security-check` — 安全性审查

### 4. 收尾阶段 — "完成了", "创建 PR"

1. 运行完整测试套件
2. 生成变更摘要
3. 创建 PR

## For Subagents

如果你是被编排器生成的子 agent：
- 你处于阶段 2（实现阶段）
- 对你负责的模块 checklist 应用 TDD 和验证
- 不需要做规划和审查——编排器会处理阶段切换

## When NOT to Use

- 单文件修改、快速修复、简单问答
- 用户明确说跳过流程（"直接做", "不用 TDD"）
- CLAUDE.md 中的用户指令始终优先于 skill 指导
```

---

## 9. 实例分析：Context7 MCP 实现流程

Context7 是一个由 Upstash 开发的 MCP Server，用于在 Claude Code 中实时查询编程库的最新文档。它是理解 MCP 工作原理的绝佳实例。

### 9.1 架构概览

```
Claude Code
    │
    ├─ MCP Protocol (stdio)
    │
    ▼
@upstash/context7-mcp (本地 Node.js 进程，npx 启动)
    │
    ├─ Tool 1: resolve-library-id  ──→  Context7 云端 API
    │                                        │
    │                                        ▼
    │                                   库索引 + 排名
    │                                        │
    │                                        ▼
    │                                   返回 library ID
    │
    └─ Tool 2: query-docs  ───────────→  Context7 云端 API
                                             │
                                             ▼
                                        文档检索 + 代码片段
                                             │
                                             ▼
                                        返回相关文档
```

### 9.2 启动配置

Context7 通过 plugin 或 `.mcp.json` 配置：

```json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp@latest"]
  }
}
```

- Claude Code 启动时通过 `npx` 拉起 `@upstash/context7-mcp` 作为**本地子进程**
- 通过 **stdio**（stdin/stdout）与 Claude Code 通信
- **无需 API key**，免费使用

### 9.3 暴露的两个 Tool

Context7 MCP Server 向 Claude 暴露了两个 tool，形成一个**两步调用链**：

#### Tool 1: `resolve-library-id` — 把人类语言转成机器 ID

**输入参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `libraryName` | string（必填） | 库名，如 `"next.js"`、`"react"` |
| `query` | string（必填） | 用户的问题，用于按相关性排序结果 |

**返回内容：**

- **Library ID** — Context7 兼容标识符（格式：`/org/project`，如 `/vercel/next.js`）
- **Name** — 库名
- **Description** — 简短描述
- **Code Snippets** — 可用代码示例数量
- **Source Reputation** — 权威性指标（High / Medium / Low / Unknown）
- **Benchmark Score** — 质量指标（满分 100）
- **Versions** — 可用版本列表（格式：`/org/project/version`）

**选择逻辑：** 名称匹配度 > 描述相关性 > 文档覆盖度 > 源信誉度 > 基准分数

#### Tool 2: `query-docs` — 用 ID 查文档

**输入参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `libraryId` | string（必填） | Step 1 返回的 ID，如 `/vercel/next.js` |
| `query` | string（必填） | 具体问题，如 `"How to set up authentication with JWT"` |

**返回内容：** 与查询最相关的文档片段 + 代码示例

**限制：** 每个问题每个 tool 最多调用 3 次。

### 9.4 实际调用流程示例

当用户问 "Next.js 的 App Router 怎么用" 时：

```
1. Claude 判断需要查文档
   → 决定调用 Context7 MCP

2. 调用 resolve-library-id({
     libraryName: "next.js",
     query: "App Router usage"
   })
   → 返回:
     { id: "/vercel/next.js",
       reputation: "High",
       snippets: 1200+,
       versions: ["/vercel/next.js/v14.3.0-canary.87", ...] }

3. 调用 query-docs({
     libraryId: "/vercel/next.js",
     query: "How to use App Router, file-based routing, layouts"
   })
   → 返回: 最新的 App Router 文档片段和代码示例

4. Claude 基于返回的文档内容回答用户
```

### 9.5 关键设计决策

| 决策 | 原因 |
|------|------|
| **两步而非一步** | 库名有歧义（"react" 可能是 React、React Native、React Router），先解析再查询避免查错库 |
| **每个问题最多调用 3 次** | 控制 token 消耗和延迟，强制 Claude 用已有结果而非反复查询 |
| **query 参数用于排序** | 同一个库的文档很多，用问题做语义匹配只返回最相关的部分 |
| **支持版本号** | `/org/project/version` 格式可以查特定版本的文档，避免版本混淆 |
| **免费无 key** | 降低使用门槛，Upstash 通过云端 API 集中管理文档索引 |
| **stdio 而非 HTTP** | 作为本地子进程运行，无需部署服务器，启动即用 |

### 9.6 云端数据源推测

Context7 的云端 API 背后的工作：

1. **爬取** — 从主流库的官方文档仓库（GitHub docs/）抓取内容
2. **切片** — 将文档拆成片段 + 提取代码示例
3. **建索引** — 语义搜索索引（推测使用 Upstash 自家的 Vector 向量数据库）
4. **评分** — 基于 Source Reputation 和 Benchmark Score 排序可信度
5. **版本管理** — 为不同版本维护独立的文档索引

### 9.7 与其他文档查询方式的对比

| 维度 | **Context7** | **Web Search** | **直接读源码** |
|------|-------------|----------------|---------------|
| 数据源 | 从源码仓库预提取 | 搜索引擎索引 | 本地/远程仓库 |
| 结构化 | 文档片段 + 代码示例，直接可用 | 网页 HTML，需解析 | 原始文件，需理解 |
| 版本感知 | 支持指定版本 | 可能混合多版本 | 取决于 checkout 的分支 |
| 延迟 | 快（预索引） | 慢（爬取 + 解析） | 取决于仓库大小 |
| 覆盖范围 | 仅编程库文档 | 任何内容 | 仅该仓库 |
| 准确性 | 高（官方源） | 不确定 | 最高（第一手） |

### 9.8 在 Claude Code 中的集成点

Context7 在当前环境中有两个入口：

1. **MCP Server（自动）** — 通过 plugin 配置（`external_plugins/context7/.mcp.json`）自动启动，Claude 判断需要查文档时自动调用
2. **`/docs` Skill（手动）** — `~/.claude/skills/` 中的 docs skill 封装了调用流程，输入 `/docs react hooks` 会自动走 resolve → query 两步

### 9.9 从 Context7 学到的 MCP 设计模式

Context7 展示了几个值得借鉴的 MCP Server 设计模式：

1. **两步式 Tool 设计** — 先解析（resolve）再查询（query），避免歧义，提高准确性
2. **调用次数限制** — 在 tool description 中声明 "最多调用 3 次"，控制 token 和成本
3. **语义排序参数** — query 参数不仅用于搜索，还用于对结果进行相关性排序
4. **零配置启动** — 无需 API key，`npx -y` 自动安装运行，最大化开箱即用体验
5. **版本化资源标识** — `/org/project/version` 格式简洁且层次清晰

---

## 附录：常见 Skill 速查

| Skill | 类型 | 用途 |
|-------|------|------|
| `powerforge` | 路由器 | 根据开发阶段编排 superpowers + zforge + distributed-architect |
| `blueprint` | 流水线 | 把一行目标拆成多步可执行计划 |
| `team-builder` | 编排器 | 交互式选择并并行调度 agent 团队 |
| `autonomous-loops` | 模式库 | 自主循环架构参考 |
| `tdd-workflow` | 方法论 | 强制 TDD 工作流 |
| `security-review` | 检查清单 | 安全审查清单和模式 |
| `mcp-server-patterns` | 参考文档 | 编写 MCP Server 的模式和示例 |
