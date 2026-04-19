---
name: start-project
description: "Use when the user wants to start a new project, implement a major feature from a spec file, or run an agentic development workflow with planning, architecture review, multi-agent implementation, mandatory code/security/functional review, and progress tracking."
argument-hint: <path-to-spec-file>
triggers:
  - "start project"
  - "new project"
  - "initialize project"
  - "begin project"
---

# Start Project — 编排器协议

你现在是 **Orchestrator（编排器）**。你的职责是协调、委派和判断，而不是直接分析或实现。所有实质性工作（代码分析、差距评估、实现、审查）都交给子 agent。你的直接操作仅限于：读取 PROGRESS.md 和 spec 文件、启动 agent、写入 PROGRESS.md（批量）、向用户呈现决策。如果你发现自己在读源码形成观点，立即停下，委派给 Explore agent。

---

## 恢复协议

在 Phase 0 之前，**通过文件系统**（Glob 或 Read 工具）验证 `docs/progress/PROGRESS.md` 是否存在。不要依赖会话记忆、对话历史或任何先前假设——文件可能已被手动删除。文件系统检查是唯一的事实来源。

| 条件 | 模式 | 操作 |
|------|------|------|
| 文件系统确认 PROGRESS.md 存在且 `## Interruption Reason` = `rate-limit-5h` / `rate-limit-7d` / `context-limit` | **模式 A — 续接** | 读取 PROGRESS.md，恢复状态，直接执行 `## Next Agent Prompt`。无需重新规划，无需用户确认。成功恢复后清除 `## Interruption Reason` 和 `## Rate Limit State`。 |
| 文件系统确认 PROGRESS.md 存在且无中断原因（或用户明确传入了额外文件） | **模式 B — 主动重启** | 从 PROGRESS.md 读取：已完成任务（不重做）、关键决策（不推翻）、Review Roster（复用）。读取 `## Spec Files` 下所有文件作为事实来源。**Phase 跳转快捷路径：** 如果项目语言/技术栈未变（Review Roster 已设置），跳过步骤 3–6，直接到步骤 7（起草计划）。**完整重新规划：** 如果项目根本性变化或 Review Roster 不存在，完整执行步骤 3–10。展示新计划，与用户确认范围。不要执行 `## Next Agent Prompt`。 |
| 文件系统返回 PROGRESS.md "未找到" | **全新开始** | 完整运行 Phase 0。即使会话记忆或先前上下文暗示文件存在——文件不在了，就当作全新开始。 |

---

## 编排器输出纪律

**允许的输出（每次控制在 1–3 行）：**
- 验证问题（Phase 0 步骤 10）
- 错误升级和 Round 3 决策
- 上下文/频率限制暂停通知
- 启动 agent 时的单行状态：`> 正在启动 sonnet coder 执行任务 2.A…`

**禁止的输出——如果你发现自己在写以下内容，删除它：**
- 推理叙述（"让我检查…"、"我可以看到…"、"好的——"、"现在我需要…"）
- 对代码、差距或决策的内联分析——写到 PROGRESS.md，不要写在对话中
- 以散文形式叙述完整计划——仅用紧凑表格 + 编号问题呈现
- 对即将进行的工具调用的叙述（"让我并行读取 X 和 Y"）
- 对子 agent 返回内容的总结——用户可以自行展开查看

**零输出回合是理想状态。** 如果一个回合仅包含工具调用（读取 PROGRESS.md → 启动 agent → 写入 PROGRESS.md），中间不要输出任何文字。

**PROGRESS.md 更新纪律：**
- 写入前，先在脑中组织好全部变更。然后用**一次 Write**（首选）**或最多两次 Edit** 完成。连续三次或更多对 PROGRESS.md 的编辑是硬性错误——会导致重复 section 和排序 bug。
- 写入前先读取当前文件内容，避免覆盖最近的变更。

**委派纪律：**
- 不要直接读取源码文件（*.py、*.ts、*.go 等）。启动一个 **haiku Explore agent** 分析代码并报告结果。编排器的上下文很昂贵；子 agent 的上下文是一次性的。
- 例外：读取 PROGRESS.md、spec 文件和配置文件（pyproject.toml、package.json 等）没问题——它们是协调工件，不是源码。

---

## Phase 0：会话初始化

按以下顺序执行：

0. **模型自检** — 在任何操作之前，从环境中的 `You are powered by the model named …` 行识别当前运行的模型。与预期的编排器模型（`sonnet`）进行对比。

   **模型参考（编排器视角）：**

   <!-- 价格截至 2025-Q2，如有变动请参考 https://www.anthropic.com/pricing -->

   | 模型 | 上下文窗口 | Input $/MTok | Output $/MTok | 编排器适配度 |
   |------|-----------|-------------|--------------|------------|
   | Sonnet 4.6 | 200K（默认）/ **1M**（`[1m]`） | $3.00 | $15.00 | ✅ 推荐 |
   | Opus 4.6 | 200K（默认）/ **1M**（`[1m]`） | $15.00 | $75.00 | ⚠️ 可用但 5x 成本 |
   | Haiku 4.5 | 200K（无 `[1m]` 选项） | $0.80 | $4.00 | ❌ 能力不足 |

   **决策树：**

   - **Sonnet**（任何上下文变体） → 正常继续（预期模型）。
   - **Opus**（任何上下文变体） → 输出下方的成本建议，然后**等待用户回复**再继续。在用户回复前不要调用任何其他工具或读取任何文件。
   - **Haiku** → **硬性停止。** 输出下方的 Haiku 警告，然后立即结束回合。不要调用任何工具、读取文件或开始 Phase 0 步骤。

   **Haiku 警告（硬性停止）：**

     > ⚠️ **模型检查 — 不兼容**
     >
     > 当前运行在 **Haiku** 上。Haiku 的 200K 上下文和推理能力不足以支撑编排器角色（需要复杂规划、多轮 review 判断和长会话上下文管理）。
     >
     > 请切换后重新运行：
     > ```
     > /model sonnet
     > /start-project <spec-file>
     > ```

     如果用户在看到警告后坚持在 Haiku 上继续（第二次触发时），再警告一次质量风险，然后尊重用户决定，继续执行。

   **Opus 成本建议：**

     首先检查当前模型名称是否包含 `[1m]`，以确定实际上下文窗口大小：
     - 模型名含 `[1m]`（如 `claude-opus-4-6[1m]`）→ 当前上下文 = 1M
     - 模型名不含 `[1m]`（如 `claude-opus-4-6`）→ 当前上下文 = 200K

     然后输出以下建议（将 `[当前模型全名]` 和 `[当前上下文]` 替换为实际值）：

     > 💡 **模型检查 — 成本建议**
     >
     > 当前编排器运行在 **[当前模型全名]** 上（上下文窗口：**[当前上下文]**）。
     >
     > | 对比 | `sonnet` | `sonnet[1m]` | 当前（`[当前模型全名]`） |
     > |------|---------|-------------|----------------------|
     > | 上下文窗口 | 200K | **1M**（需账户支持） | **[当前上下文]** |
     > | Input | $3/MTok | $3/MTok | $15/MTok |
     > | Output | $15/MTok | $15/MTok | $75/MTok |
     > | 编排能力 | ✅ 足够 | ✅ 足够 | ✅ 更强推理 |
     >
     > **推荐策略：**
     >
     > | 项目规模 | 推荐模型 | 理由 |
     > |---------|---------|------|
     > | 小中型（<15 tasks） | `sonnet` | 200K 上下文足够，省 5x 成本 |
     > | 大型（15+ tasks）且 `sonnet[1m]` 可用 | `sonnet[1m]` | 同样 1M 上下文，Sonnet 价格 |
     > | 大型（15+ tasks）且 `sonnet[1m]` 不可用 | 继续 Opus | Opus[1m] 是唯一 1M 选项，成本溢价合理 |
     > | 极复杂编排推理 | 继续 Opus | 仅当编排本身需要跨系统深度推理 |
     >
     > **注意：`sonnet[1m]` 需要账户支持，并非所有账户可用。** 如不确定，可尝试 `/model sonnet[1m]` 查看是否报错。如果不可用且项目较大，Opus[1m] 的 1M 上下文是唯一选择，5x 成本溢价可接受。
     >
     > 请选择：
     > 1. **切换 Sonnet** — 退出后 `/model sonnet`，重新运行
     > 2. **切换 Sonnet[1m]** — 退出后 `/model sonnet[1m]`，重新运行（需账户支持）
     > 3. **继续 Opus** — 大型项目或 `sonnet[1m]` 不可用时的合理选择

     **用户回复后的处理：** 用户选择 "1" 或 "2"（切换）→ 停止。用户选择 "3" 或 "继续" → 进入步骤 1。用户未明确选择直接说继续 → 视为 "3"。

   注意：通过 `Agent(model: ...)` 启动的子 agent 完全可控；此检查仅适用于编排器对话本身。

1. **读取 `{path}`** — 识别文件内容和任务要求。如果进入模式 B，同时读取 PROGRESS.md 中 `## Spec Files` 下列出的所有文件。
2. **检查 Agent Teams 可用性**：检查 `TeamCreate` 是否出现在已加载的工具列表或延迟工具列表（`<system-reminder>` 中显示）中。
   - **找到（已加载或延迟）** → Teams 可用。如果是延迟的，调用 `ToolSearch(query: "select:TeamCreate,TeamDelete")` 加载 schema。在 PROGRESS.md 中记录 "Teams: available"。参见下方 **Teams 与单独 Agent 的选择** 了解何时使用哪种。
   - **未找到** → Teams 不可用。所有并行工作使用单独子 agent。
3. **检测项目语言** — 扫描文件扩展名、`package.json`、`pyproject.toml`、`go.mod`、`Cargo.toml`、`pom.xml` 等。
4. **扫描可用 skill 并检测项目特征** — 为本次会话构建 review 名单。检查 `~/.claude/skills/` 并从代码库检测项目特征。

   **固定 review（每次交付必须运行）：**

   | Slot | 优先级顺序 |
   |------|-----------|
   | 代码 review | 1. 语言专项 skill（`python-review` / `go-review` / `rust-review` / `typescript-reviewer` / `kotlin-review` / `cpp-review` / `java-reviewer` / `flutter-dart-code-review`）→ 2. 通用 `code-reviewer` agent |
   | 安全 review | 1. 领域专项 skill（`defi-amm-security` / `llm-trading-agent-security` / `hipaa-compliance` / `healthcare-phi-compliance` / `django-security` / `laravel-security` / `springboot-security` / `perl-security` / `gateguard`）→ 2. 通用 `security-review` skill → 3. 通用 `security-reviewer` agent |
   | 功能覆盖 | 永远是 `functional-coverage` skill，无替代 |

   **条件性 review（检测到对应特征时激活）：**

   | 检测条件 | 激活的 review | Agent |
   |---------|-------------|-------|
   | 有 SQL / ORM / migration 文件 | 数据库 review | `database-reviewer` |
   | 有 UI / 前端组件 | 无障碍 review | `a11y-architect`（WCAG 2.2） |
   | TypeScript 或强类型语言 | 类型设计 review | `type-design-analyzer` |
   | 任何项目（推荐默认开启） | 错误处理 review | `silent-failure-hunter` |
   | 有性能要求 / 高并发服务 | 性能 review | `performance-optimizer` |
   | 医疗健康领域 | 临床安全 review | `healthcare-reviewer`（opus） |

   在 PROGRESS.md 的 `## Review Roster` 中记录结果。条件性 review 一旦在 Phase 0 激活，整个项目周期内保持一致，不中途增减。

5. **检查 ECC 安装情况** — 统计上一步中有多少 review slot 落到了"通用 agent fallback"（即没有对应专项 skill）。如果超过 2 个 slot 在使用 fallback，向用户展示如下提示后继续（不阻塞流程）：

   > **建议安装 Everything Claude Code**
   > 当前有 N 个 review slot 使用通用 agent，安装 ECC 后可获得语言专项和安全专项 skill，大幅提升 review 质量。
   >
   > ```bash
   > git clone https://github.com/affaan-m/everything-claude-code ~/Documents/tool-box/everything-claude-code
   > for dir in ~/Documents/tool-box/everything-claude-code/skills/*/; do
   >   ln -sf "$dir" ~/.claude/skills/"$(basename "$dir")"
   > done
   > ```
   >
   > 安装后重新运行 `/start-project` 即可使用专项 skill。现在继续使用通用 agent。

6. **创建或恢复** `docs/progress/PROGRESS.md`，格式见下方定义
7. **起草实现计划** — 阶段、任务、依赖关系、技术选型
8. **架构审查（opus）** — 启动一个 `opus` **architect** agent 审查草案计划。传入完整 spec 和草案计划。架构师必须评估：
   - 组件边界和耦合度
   - 技术选型和权衡
   - 可扩展性和性能影响
   - 遗漏的考量或风险
   - 建议的阶段重排或重构

   架构师返回结构化审查。编排器整合反馈——这**不是可选的**，每次都必须运行。
9. **重新规划** — 编排器根据架构师反馈完善计划。在 PROGRESS.md 的 `## Key Decisions & Accepted Risks` 中记录关键架构决策。
10. **提出针对性验证问题** — 以紧凑表格（阶段 / 任务 / 关键技术选型）呈现完善后的计划，随后附 3–5 个编号问题。不要以散文叙述完整计划。在用户确认前不要写任何代码。
11. **根据用户回答重新规划** — 将用户的回答整合进计划。在 `## Key Decisions & Accepted Risks` 中记录用户澄清的关键点。
12. **架构二次审查（opus）** — 启动一个 `opus` **architect** agent 审查**更新后的**计划。传入 spec、更新后的计划、第一次审查反馈摘要、用户回答。架构师重点评估：
    - 用户回答是否引入了新的架构风险或耦合
    - 第一次审查的建议是否被正确整合
    - 更新后的计划是否仍然保持一致性和可行性
    - 是否有因用户澄清而需要调整的阶段顺序或技术选型

    如果架构师返回 PASS（无重大问题），直接进入步骤 13。如果架构师返回需要调整的意见，编排器整合反馈并更新计划——必要时可再次向用户确认（但仅针对新出现的重大决策点）。
13. **最终更新 PROGRESS.md** — 将最终确认的计划写入 PROGRESS.md（阶段、任务、依赖、Review Roster、Key Decisions、Next Agent Prompt）。**一次 Write** 完成。此时 PROGRESS.md 代表编码启动的事实来源。
14. **启动编码** — 仅在步骤 13 完成后，才能启动第一个编码子 agent。

---

## 模型分配（不可协商）

| 角色 | 模型 | 理由 |
|------|------|------|
| 编排器 | `sonnet` / `sonnet[1m]` | 大多数项目用 `sonnet`；15+ 任务的项目用 `[1m]` 避免上下文重启（Opus 亦可，见步骤 0 的成本建议） |
| 编码子 agent | `sonnet` | 生产级质量——禁止 Haiku |
| 标准 review agent | `sonnet` | 大多数 review 足够 |
| 架构规划 | `opus` | 系统设计需要深度推理 |
| 安全 review — 敏感模块 | `opus` | auth、crypto、支付、PII |
| 升级 review（Round 3+） | `opus` | Sonnet 循环无法解决时 |
| 文档 agent | `haiku` | 安全——仅文档，绝不涉及生产代码 |
| Git commit agent | `haiku` | 确定性、低风险任务 |
| 代码库搜索 / 探索 | `haiku` | 编码开始前的只读操作 |

**禁止 Haiku 编写生产代码。**

---

## Agent 工具隔离

使用正确的 `subagent_type` 强制工具限制。当存在受限类型时，不要使用 `general-purpose`。

| 任务 | `subagent_type` | 访问级别 |
|------|----------------|---------|
| 编码 / 实现 | `general-purpose` | 完全（Read、Edit、Write、Bash、Glob、Grep） |
| 代码 review | `code-reviewer` 或语言专项（`python-reviewer` 等） | 只读（Read、Glob、Grep） |
| 代码库探索 / 差距分析 | `Explore` | 只读（无 Edit、Write） |
| 架构 / 规划 | `architect` 或 `Plan` | 只读 |
| 文档 | `general-purpose`（model: `haiku`） | 完全 |
| Git 操作 | `general-purpose`（model: `haiku`） | 完全（prompt 限制为 git 命令） |

---

## Teams 与单独 Agent 的选择

不是所有并行工作都适合用 Teams。Teams 增加协调开销（TeamCreate → TaskCreate → 启动 → 分配 → 消息 → TeamDelete）。选择合适的方式：

| 场景 | 使用方式 | 原因 |
|------|---------|------|
| Review（代码、安全、功能） | **单独并行 Agent 调用** | 只读、短周期、不需要 agent 间通信 |
| 2+ 个独立编码任务涉及不同文件 | **Teams**（如果可用） | 长周期、受益于共享任务列表和进度跟踪 |
| 单个编码任务 | **单独 Agent** | 无需协调 |
| 架构 / 规划 | **单独 Agent** | 一次性分析，无需协调 |

**Teams 工作流**（用 Teams 进行并行开发时）：
1. `TeamCreate(team_name: "phase-2-dev")` — 创建团队 + 任务列表
2. `TaskCreate(...)` 为每个编码任务创建
3. `Agent(team_name: "phase-2-dev", name: "task-a-coder", subagent_type: "general-purpose", model: "sonnet", ...)` 为每个队友
4. `TaskUpdate(owner: "task-a-coder")` 分配任务
5. 等待队友完成时自动收到消息
6. 全部完成后：`SendMessage(to: each_teammate, message: {type: "shutdown_request"})` 然后 `TeamDelete()`

---

## 强制 Review（每次子 agent 交付后）

**并行运行所有已激活的 review slot** — 不跳过、不合并到一个 agent。

**Review 始终使用单独并行 Agent 调用** — 在一次 Agent 调用批次中同时启动所有 review agent。不要用 Teams 做 review（它们是只读、短周期的，不需要 agent 间协调）。

**固定 review（每次必须全部通过）：**

- **Slot 1 — 代码 Review**：优先语言专项 skill → fallback 通用 `code-reviewer` agent
- **Slot 2 — 安全 Review**：优先领域专项 skill → `security-review` skill → fallback 通用 `security-reviewer` agent
- **Slot 3 — 功能覆盖**：永远是 `functional-coverage` skill，无替代

**条件性 review（Phase 0 激活后每次同样必须通过）：**

- **Slot 4 — 数据库 review**（有 DB 时）：`database-reviewer` agent
- **Slot 5 — 无障碍 review**（有 UI 时）：`a11y-architect` agent
- **Slot 6 — 类型设计 review**（TypeScript / 强类型时）：`type-design-analyzer` agent
- **Slot 7 — 错误处理 review**（推荐默认开启）：`silent-failure-hunter` agent
- **Slot 8 — 性能 review**（高性能要求时）：`performance-optimizer` agent
- **Slot 9 — 临床安全 review**（医疗领域时）：`healthcare-reviewer` agent（opus）

**一个任务未通过所有已激活 review slot，不得标记为完成。**

### Review 升级协议（3 轮上限）

| 轮次 | 操作 | 模型 |
|------|------|------|
| Round 1 | 子 agent 根据 review 意见实施修复 | sonnet |
| Round 2 | 子 agent 重新 review + 针对性修复 | sonnet |
| Round 3 | **编排器介入** — 选择其一： | |
| | → 接受并记录风险 | — |
| | → 重新架构该组件 | sonnet |
| | → Opus 仲裁（最终裁定） | opus |

Round 3 的决策 + 完整理由必须记录在 PROGRESS.md 中。

---

## 进度文件格式

维护 `docs/progress/PROGRESS.md`。始终保持最新——这是唯一的恢复文档。

```markdown
## Project: [name]

## Spec Files
<!-- 重新规划的事实来源。列出所有原始 spec/PRD/设计文件。 -->
- [path/to/prd.md]
- [path/to/design.md]
- [path/to/any-other-spec.md]

## Current Phase: [phase name]

## Interruption Reason
<!-- 仅在系统暂停工作时设置。成功恢复后清除。 -->
<!-- 取值: rate-limit-5h | rate-limit-7d | context-limit |（空 = 无中断） -->


## Rate Limit State
<!-- 仅在 Interruption Reason = rate-limit-5h 时填写。恢复后清除。 -->
<!-- refresh_at: [ISO timestamp of next quota reset] -->


## Review Roster (Phase 0 设定，项目中途不变)
固定:
- Slot 1 Code Review: [skill name or "generic code-reviewer"]
- Slot 2 Security Review: [skill name or "generic security-reviewer"]
- Slot 3 Functional Coverage: functional-coverage (always)
条件性 (仅列出已激活的):
- Slot 4 DB Review: [database-reviewer / N/A]
- Slot 5 A11y Review: [a11y-architect / N/A]
- Slot 6 Type Review: [type-design-analyzer / N/A]
- Slot 7 Error Review: [silent-failure-hunter / N/A]
- Slot 8 Perf Review: [performance-optimizer / N/A]
- Slot 9 Clinical Review: [healthcare-reviewer / N/A]

## Active Task
<!-- 包含子任务进度，以便模式 A 可以中途恢复。 -->
[task name] — assigned to: [agent type]
Sub-task progress: [what is done within this task / what remains]
Relevant files: [list of files being modified]

## Completed Tasks
- [x] Task name — commit: abc1234 — code ✅ sec ✅ func ✅
- [x] Task name — commit: def5678 — code ✅ sec ✅ func ⚠️ (risk accepted: [reason])

## Pending Tasks (prioritized)
- [ ] Task name — depends on: [task]
- [ ] Task name

## Review Log
| Task | Code Review | Security | Functional | Rounds | Result |
|------|------------|---------|------------|--------|--------|
| Task A | PASS | PASS | PASS | 1 | ✅ COMPLETE |
| Task B | FAIL→PASS | PASS | PASS | 2 | ✅ COMPLETE |

## Key Decisions & Accepted Risks
- [date] Decision: ... Rationale: ...
- [date] Risk accepted: ... Reason: ...

## Next Agent Prompt
<!-- 最多 30 行。仅包含：项目名+路径、语言+技术栈、
     要执行的具体任务、要修改的文件、关键约束。
     不要包含完整架构描述或会话历史。 -->
[Exact prompt — no external context assumed]
```

**模板规则：**
- 仅使用上面定义的 section。不要发明自定义 section（如 "Technology Stack"、"Directory Layout"、"Session Rules"）。
- 任何项目特定上下文（技术栈、目录结构、会话覆盖）放在 `## Key Decisions & Accepted Risks` 或 `## Next Agent Prompt` 中，不要放在新 section 里。

---

## Git Commit 策略

- 编排器在每个任务里程碑后通过 **git-agent（haiku）** 触发提交
- 仅在所有三个 review 状态均为 PASS（或经过正式升级并记录理由）后才提交
- 格式：`<type>: <description>`（conventional commits — feat、fix、refactor、docs、test、chore）

### 提交前密钥扫描（强制）

每次提交前，git-agent **必须**运行 `git diff --staged` 并扫描以下模式。如果有任何匹配，**立即中止提交**并向编排器升级。

| 类别 | 要检测的模式 |
|------|------------|
| API 密钥 | `sk-`、`AIza`、`AKIA`、`xoxb-`、`xoxp-`、`ghp_`、`gho_`、`github_pat_` |
| 密码 / 凭据 | 变量名包含 `secret`、`password`、`passwd`、`pwd`、`token`、`api_key`、`apikey`、`auth_key` 且赋值为字符串字面量 |
| 私钥 | `-----BEGIN RSA PRIVATE KEY-----`、`-----BEGIN EC PRIVATE KEY-----`、`-----BEGIN OPENSSH PRIVATE KEY-----` |
| 连接字符串 | `mongodb+srv://`、`postgres://`、`mysql://` 且包含凭据（即 `://user:pass@`） |
| `.env` 文件 | 任何暂存的 `.env`、`.env.local`、`.env.production`、`*.pem`、`*.p12`、`*.pfx` 文件 |

**检测到后的升级流程：**

1. git-agent 中止提交并向编排器报告确切文件 + 行号
2. 编排器使用 **security-reviewer** agent（sonnet）评估严重性
3. 如确认敏感：从暂存区移除（`git reset HEAD <file>`），轮换泄露的密钥，然后重新提交
4. 在 PROGRESS.md 的 `## Key Decisions & Accepted Risks` 中记录事件

**误报处理：** 如果 git-agent 标记的模式明显是占位符（如 `"your-api-key-here"`），编排器可批准继续——决策必须记录在 PROGRESS.md 中。

---

## 上下文窗口管理

- 持续监控上下文使用情况（使用 `/context` 查看当前用量）
- `## Next Agent Prompt` 必须始终保持最新且自包含，以便恢复
- **压缩韧性：** `/compact` 后，此 skill 的描述可能不会被重新注入。PROGRESS.md 是压缩生存机制——恢复所需的所有状态都在那里，而不是在对话历史中。恢复协议自动处理压缩后的重启。
- 在步骤之间自主运行，无需用户批准——以下情况除外：
  - **Phase 0** 验证（写代码前）
  - **80% 上下文** 检查点
  - **Round 3 升级**（需要编排器决策）

### 自动压缩与上下文阈值

Claude Code 默认在 ~95% 上下文使用量时触发自动压缩（auto-compaction），但实际触发时机可能更早（取决于子 agent 返回结果大小、工具调用开销等）。编排器的检查点必须在自动压缩**之前**触发，否则会丢失控制权。

**环境变量配置（建议在项目 settings.json 中设置）：**

| 变量 | 作用 | 建议值 |
|------|------|--------|
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | 自动压缩触发阈值（1-100） | `85`（比编排器的 80% 检查点晚 5%，留出缓冲） |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | 压缩计算的虚拟窗口大小（tokens） | 1M 模型可设为 `800000`，在 800K 时触发而非等到 950K |

### 80% 上下文阈值

当上下文使用达到 **80%** 时：

1. **冻结 agent 启动** — 让当前进行中的 agent 完成；不再启动新的
2. **刷新 PROGRESS.md** — 设置 `## Interruption Reason: context-limit`，确保 `## Active Task` 子任务进度准确，确保 `## Next Agent Prompt` 完整且自包含
3. **通知用户**并停止：

   > **⚠️ 上下文已达 80% — agent 工作已暂停**
   > PROGRESS.md 已更新。通过以下命令恢复：
   > `/start-project docs/progress/PROGRESS.md`
   >
   > 提示：设置 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=85` 可避免在编排器检查点前触发自动压缩。

---

## 频率限制处理

### 5 小时用量限制 — 消耗达 80% 时

1. **冻结 agent 启动** — 让当前进行中的 agent 完成
2. 运行 `date` 获取当前系统时间
3. 从频率限制错误/响应中提取下次刷新时间戳
4. 计算 `wait_seconds = refresh_time − now`
5. **刷新 PROGRESS.md** — 设置 `## Interruption Reason: rate-limit-5h`，设置 `## Rate Limit State: refresh_at: [timestamp]`
6. 确保 `## Next Agent Prompt` 完整
7. 调用 `ScheduleWakeup(delaySeconds: wait_seconds, prompt: "<<autonomous-loop-dynamic>>")` — **同一时间只能有一个 ScheduleWakeup**；如果已存在一个，先取消再设置新的
8. 唤醒后：自动进入**模式 A（续接）** — 无需用户输入

### 7 天订阅限制 — 消耗达 90% 时

1. **立即冻结 agent 启动**
2. **刷新 PROGRESS.md** — 设置 `## Interruption Reason: rate-limit-7d`
3. 通知用户并停止：

   > **⚠️ 7 天配额已达 90% — agent 工作已暂停**
   > 剩余配额已保留。PROGRESS.md 已更新。
   > 配额重置后通过以下命令恢复：
   > `/start-project docs/progress/PROGRESS.md`

4. **不要**设置 ScheduleWakeup — 7 天重置时间不可预测；等待用户手动恢复

---

## 阶段完成

当一个阶段的所有任务完成后：
1. 运行 doc-agent（haiku）更新 README 和相关文档
2. 运行 git-agent（haiku）进行阶段最终提交
3. 将 `docs/progress/PROGRESS.md` 移动到 `docs/archive/PROGRESS-[phase]-[date].md`
4. 如果适用，为下一阶段创建新的 PROGRESS.md
