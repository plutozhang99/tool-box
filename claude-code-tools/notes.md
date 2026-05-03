/statusline show model name, context percentage with progress bar, and usage quota with progress bar

---

# PRD / 产品需求相关 Skills 速查

## 最直接相关

- **everything-claude-code:prp-prd**
  交互式 PRD 生成器，problem-first、hypothesis-driven，来回对话式生成产品 spec。最贴合"写 PRD"。

- **everything-claude-code:product-capability**
  把 PRD 意图 / roadmap / 产品讨论，转换成"实现就绪"的 capability spec。适合交付工程侧那一步。

## 辅助相关

- **everything-claude-code:product-lens**
  产品视角的压测/诊断，验证"为什么要做"。适合 PRD 写之前或初稿之后做 sanity check。

- **compound-engineering:ce-brainstorm**
  对话式探索需求与方案。适合还没成型、想发散的阶段。

- **compound-engineering:ce-plan**
  把多步任务结构化成 plan（软件/研究/运营通用）。

- **everything-claude-code:prp-plan**
  基于 codebase 分析生成 feature implementation plan。偏工程 plan，不是 PRD。

- **compound-engineering:ce-doc-review**
  多 persona agents 并行 review 需求/plan 文档。写完 PRD 用来找盲点。

- **everything-claude-code:blueprint**
  一句话目标 -> 多 session / 多 agent 构建计划。

## 典型工作流

1. **发散期** → `ce-brainstorm`
2. **写 PRD** → `prp-prd`
3. **写完 review** → `ce-doc-review` / `product-lens`
4. **交付工程** → `product-capability` / `prp-plan`
