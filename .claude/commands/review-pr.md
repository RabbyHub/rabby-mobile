---
allowed-tools: Bash(gh pr diff:*),Bash(gh pr edit --add-reviewer:*),Bash(gh pr review --comment:*),Bash(gh pr view:*)
description: Review a pull request
---

Read and follow `skills/rabby-mobile-code-review/SKILL.md`, including its
mandatory performance Review gate and specialist routing. Then perform a
comprehensive code review using subagents for key areas:

- code-reviewer
- security-reviewer

Instruct each to read the canonical project Skill, use the applicable
performance Skills, and only provide actionable feedback. Once they finish,
validate and de-duplicate the feedback before publishing it.

Provide feedback using inline comments for specific issues.
Do not post top-level summaries, praise, LGTM, or empty reviews. Keep findings
concise. If the protected performance paths remain uncertain, use the
`@richardo2016x` escalation defined by the performance Review Skill.

---
