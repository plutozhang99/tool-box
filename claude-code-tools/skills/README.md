# Claude Code Skills

自定义 Claude Code skills，全部通过 symlink 全局安装，修改源文件即时生效。

## 上游仓库

| 来源 | 仓库 | 说明 |
|------|------|------|
| 自定义 | [plutozhang99/tool-box](https://github.com/plutozhang99/tool-box) | 本仓库，4 个原创 skill |
| 第三方 | [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) | 156 个 skill，Anthropic 黑客松获奖项目 |

## 安装

```bash
# 1. clone 两个仓库
git clone git@github.com:plutozhang99/tool-box.git ~/Documents/tool-box/tool-box
git clone https://github.com/affaan-m/everything-claude-code ~/Documents/tool-box/everything-claude-code

# 2. 安装自定义 skills（逐个 symlink）
ln -sf ~/Documents/tool-box/claude-code-tools/skills/plan-project ~/.claude/skills/plan-project
ln -sf ~/Documents/tool-box/claude-code-tools/skills/execute-phase ~/.claude/skills/execute-phase
ln -sf ~/Documents/tool-box/claude-code-tools/skills/functional-coverage ~/.claude/skills/functional-coverage
ln -sf ~/Documents/tool-box/claude-code-tools/skills/design-picker ~/.claude/skills/design-picker

# 3. 批量安装 everything-claude-code 的所有 skills
for dir in ~/Documents/tool-box/everything-claude-code/skills/*/; do
  ln -sf "$dir" ~/.claude/skills/"$(basename "$dir")"
done

# 4. 更新
cd ~/Documents/tool-box/tool-box && git pull
cd ~/Documents/tool-box/everything-claude-code && git pull
```

---

## 自定义 Skills（本仓库原创）

### `/plan-project`

**触发方式：** `/plan-project {path}` 或 "plan project"、"start project"、"new project"

对话式项目规划 skill。读取 `{path}` 处的 spec/PRD（或纯口头描述），与用户头脑风暴后，把工作拆分成细粒度的 phase（Phase N → Tx.x），写入 `docs/plans/PLAN-<name>.md`，每个 phase 和 task 前面带 `[ ]` checkbox，架构与隐性决策记录在 PLAN 内。**写完即停，不写代码、不调用 sub-agent。**执行交给 `/execute-phase`。

**核心机制：**
- 完全对话驱动，不允许跳过用户确认
- Phase 粒度由对话保证，不强加数值阈值
- 写完后明确告知用户 "Run `/execute-phase` when ready"

**示例：**
```
/plan-project ./specs/my-app.md
```

---

### `/execute-phase`

**触发方式：** 仅手动触发（带 `disable-model-invocation: true`，避免 Claude 误启动）。`/execute-phase` 或 "execute phase"、"continue plan"。

读取 `docs/plans/PLAN-*.md`，执行**一个 phase 即停**。启动时与用户确认要做哪个 phase + 关键决策点 → 用户拍板 → auto-advance 跑完所有 task → phase 末三路 opus review（code/security/functional 并行）→ 用户挑要修的 finding → 修复 → 勾选 PLAN.md 的 checkbox → 归档 PROGRESS.md → 停。

**核心机制：**
- 模型分工 — coding 用 Sonnet（官方"best coding model"）；phase-end review 用 Opus 三路并行；commit/doc 用 Haiku
- Review 时机改在 **phase 末**（不再每个 task 后跑），并行的 3 个 reviewer 共享 system-prompt 前缀以命中 prompt cache
- 用户挑选 fix：CRITICAL/HIGH 修完做定向 re-review，MEDIUM/LOW 修完只跑 lint+build+test 自检
- `docs/progress/PROGRESS.md` 仅作 phase 内会话恢复缓冲（精简到 ~20 行，每次更新 ≤ 2 个 Edit）
- PLAN.md checkbox 从 `[ ]` → `[x]`，归档时把 phase 内的隐性决策回填到 PLAN.md 的对应 block
- 一个 phase 跑完即停，下一个 phase 由用户重新调用

**示例：**
```
/execute-phase           # 自动找下一个未勾选的 phase
/execute-phase 2         # 指定 phase
/execute-phase 2.1       # 只做某个子任务
```

---

### `/functional-coverage`

**触发方式：** `/functional-coverage` 或 "functional coverage"、"feature coverage check"

只读 review agent，检查需求文档中的所有功能是否都已实现并有测试覆盖。是 `start-project` 工作流三路 review 的组成部分，也可单独使用。

**工作流程：**
1. 解析任务规格，提取所有需求、验收标准和边界情况
2. 用 Grep/Glob/Read 在代码库中搜索实现证据（只读，不修改任何文件）
3. 检查测试是否存在且有实际断言
4. 输出带 PASS/FAIL 结论的结构化报告

**结论规则：**
- `PASS` — 所有需求已实现且有测试
- `FAIL` — 任何缺失、不完整或无测试的项目（阻塞任务完成）

**示例：**
```
/functional-coverage
Task spec: ./specs/auth-feature.md
Changed files: src/auth/
```

---

### `/design-picker`

**触发方式：** `/design-picker` 或 "design picker"、"DESIGN.md"、"pick a design"

从 [getdesign.md](https://getdesign.md) 获取品牌设计规范并写入项目根目录的 `DESIGN.md`。安装后 Claude 在编写任何 UI 代码前都会先读取该文件，输出符合品牌风格的界面。

**可用品牌（60+）：**

| 分类 | 品牌 |
|------|------|
| AI & LLM | `claude` `vercel` `cursor` `ollama` `mistral.ai` `elevenlabs` `replicate` `runwayml` `cohere` `x.ai` `minimax` `together.ai` `voltagent` `opencode.ai` |
| 开发工具 | `expo` `lovable` `raycast` `superhuman` `warp` |
| 后端 / 数据库 | `supabase` `stripe` `mongodb` `posthog` `sentry` `clickhouse` `sanity` `hashicorp` `composio` `resend` |
| 效率 / SaaS | `linear.app` `notion` `figma` `framer` `miro` `airtable` `webflow` `cal` `mintlify` `intercom` `zapier` |
| 金融科技 | `stripe` `revolut` `coinbase` `kraken` `wise` |
| 媒体 / 科技 | `apple` `spotify` `nvidia` `spacex` `uber` `pinterest` `ibm` |
| 汽车 | `tesla` `bmw` `ferrari` `lamborghini` `renault` |
| 其他 | `airbnb` `clay` |

**示例：**
```
/design-picker
# Claude 列出所有品牌 → 你选 "linear.app"
# Claude 从 https://getdesign.md/linear.app/design-md 抓取内容
# 写入 ./DESIGN.md
# 读取并内化设计规范
```

混合两个品牌：
```
/design-picker — 用 Vercel 布局 + Stripe 配色
```

---

## 新增 Skill

1. 创建 `skills/<skill-name>/SKILL.md`，包含 YAML frontmatter（`name`、`description`、`triggers`）
2. 添加 symlink：`ln -sf $(pwd)/skills/<skill-name> ~/.claude/skills/<skill-name>`
3. 在本 README 中添加说明条目
