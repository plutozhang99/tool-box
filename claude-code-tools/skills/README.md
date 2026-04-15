# Claude Code Skills

自定义 Claude Code skills，全部通过 symlink 全局安装，修改源文件即时生效。

## 上游仓库

| 来源 | 仓库 | 说明 |
|------|------|------|
| 自定义 | [plutozhang99/tool-box](https://github.com/plutozhang99/tool-box) | 本仓库，3 个原创 skill |
| 第三方 | [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) | 156 个 skill，Anthropic 黑客松获奖项目 |

## 安装

```bash
# 1. clone 两个仓库
git clone git@github.com:plutozhang99/tool-box.git ~/Documents/tool-box/tool-box
git clone https://github.com/affaan-m/everything-claude-code ~/Documents/tool-box/everything-claude-code

# 2. 安装自定义 skills（逐个 symlink）
ln -sf ~/Documents/tool-box/claude-code-tools/skills/start-project ~/.claude/skills/start-project
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

### `/start-project`

**触发方式：** `/start-project {path}` 或 "start project"、"initialize project"

启动完整 CTO 编排模式。Claude 读取 `{path}` 处的需求文档，完成规划和用户确认后，自主编排 sub-agents 进行开发，强制执行三路 review 和 git 里程碑。

**核心机制：**
- 模型分工 — 生产代码统一用 Sonnet，架构/安全/升级决策用 Opus，文档/git/搜索用 Haiku
- 每次交付后强制三路并行 review：code-review + security-review + `/functional-coverage`
- 3 轮 review 上限 — Round 3 触发 CTO 介入（接受风险 / 重构 / Opus 仲裁）
- 每个 agent 类型有工具隔离和 `max_turns` 限制
- `docs/progress/PROGRESS.md` 实时进度文件，用于上下文恢复
- 支持 Agent Teams（需设置 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`）

**示例：**
```
/start-project ./specs/my-app.md
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
