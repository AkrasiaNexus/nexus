# Vendored skills

Copied from upstream at a pinned commit, after a SkillSpector v2.12.0 static scan (`--no-llm`). Skills flagged by the scan were read by hand; every flag below was a false positive (defensive text, docs, local scripts). Each folder keeps its upstream LICENSE.

| Skill | Upstream @ commit | Scan |
|---|---|---|
| caveman | JuliusBrussee/caveman @ a192894723a8 | clean |
| planning-with-files | OthmanAdi/planning-with-files @ adcd0b0a0a63 | flagged, reviewed: false positive |
| api-and-interface-design | addyosmani/agent-skills @ 8c99fa36d900 | clean |
| deprecation-and-migration | addyosmani/agent-skills @ 8c99fa36d900 | clean |
| documentation-and-adrs | addyosmani/agent-skills @ 8c99fa36d900 | clean |
| idea-refine | addyosmani/agent-skills @ 8c99fa36d900 | clean |
| observability-and-instrumentation | addyosmani/agent-skills @ 8c99fa36d900 | clean |
| ask-matt | mattpocock/skills @ abeeaf95660b | clean |
| codebase-design | mattpocock/skills @ abeeaf95660b | clean |
| domain-modeling | mattpocock/skills @ abeeaf95660b | clean |
| grill-with-docs | mattpocock/skills @ abeeaf95660b | clean |
| implement | mattpocock/skills @ abeeaf95660b | clean |
| implement-spec | mattpocock/skills @ abeeaf95660b | clean |
| improve-codebase-architecture | mattpocock/skills @ abeeaf95660b | clean |
| pr | mattpocock/skills @ abeeaf95660b | clean |
| prototype | mattpocock/skills @ abeeaf95660b | clean |
| retro | mattpocock/skills @ abeeaf95660b | clean |
| setup-matt-pocock-skills | mattpocock/skills @ abeeaf95660b | clean |
| to-spec | mattpocock/skills @ abeeaf95660b | clean |
| triage | mattpocock/skills @ abeeaf95660b | clean |
| wayfinder | mattpocock/skills @ abeeaf95660b | clean |
| migrate-to-shoehorn | mattpocock/skills @ abeeaf95660b | clean |
| scaffold-exercises | mattpocock/skills @ abeeaf95660b | clean |
| setup-pre-commit | mattpocock/skills @ abeeaf95660b | clean |
| grill-me | mattpocock/skills @ abeeaf95660b | clean |
| grilling | mattpocock/skills @ abeeaf95660b | clean |
| handoff | mattpocock/skills @ abeeaf95660b | clean |
| teach | mattpocock/skills @ abeeaf95660b | clean |
| wait-what | mattpocock/skills @ abeeaf95660b | clean |
| writing-for-agents | mattpocock/skills @ abeeaf95660b | clean |
| academy-guide | anthropics/skills @ e4bb5d960d87 | clean |
| canvas-design | anthropics/skills @ e4bb5d960d87 | clean |
| doc-coauthoring | anthropics/skills @ e4bb5d960d87 | clean |
| internal-comms | anthropics/skills @ e4bb5d960d87 | clean |
| slack-gif-creator | anthropics/skills @ e4bb5d960d87 | clean |
| web-artifacts-builder | anthropics/skills @ e4bb5d960d87 | clean |
| dispatching-parallel-agents | obra/superpowers @ 22f0b463e7a5 | clean |
| finishing-a-development-branch | obra/superpowers @ 22f0b463e7a5 | clean |
| receiving-code-review | obra/superpowers @ 22f0b463e7a5 | clean |
| test-driven-development | obra/superpowers @ 22f0b463e7a5 | clean |
| using-git-worktrees | obra/superpowers @ 22f0b463e7a5 | clean |
| verification-before-completion | obra/superpowers @ 22f0b463e7a5 | clean |
| writing-plans | obra/superpowers @ 22f0b463e7a5 | clean |
| ci-cd-and-automation | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| constraint-driven-development | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| context-engineering | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| doubt-driven-development | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| git-workflow-and-versioning | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| security-and-hardening | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| shipping-and-launch | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| source-driven-development | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| spec-driven-development | addyosmani/agent-skills @ 8c99fa36d900 | flagged, reviewed: false positive |
| to-tickets | mattpocock/skills @ abeeaf95660b | flagged, reviewed: false positive |
| wizard | mattpocock/skills @ abeeaf95660b | flagged, reviewed: false positive |
| git-guardrails-claude-code | mattpocock/skills @ abeeaf95660b | flagged, reviewed: false positive |
| to-questionnaire | mattpocock/skills @ abeeaf95660b | flagged, reviewed: false positive |
| algorithmic-art | anthropics/skills @ e4bb5d960d87 | flagged, reviewed: false positive |
| discernment-nudge | anthropics/skills @ e4bb5d960d87 | flagged, reviewed: false positive |
| mcp-builder | anthropics/skills @ e4bb5d960d87 | flagged, reviewed: false positive |
| theme-factory | anthropics/skills @ e4bb5d960d87 | flagged, reviewed: false positive |
| webapp-testing | anthropics/skills @ e4bb5d960d87 | flagged, reviewed: false positive |
| diagnosing-superpowers | obra/superpowers @ 22f0b463e7a5 | flagged, reviewed: false positive |
| executing-plans | obra/superpowers @ 22f0b463e7a5 | flagged, reviewed: false positive |
| subagent-driven-development | obra/superpowers @ 22f0b463e7a5 | flagged, reviewed: false positive |
| systematic-debugging | obra/superpowers @ 22f0b463e7a5 | flagged, reviewed: false positive |
| javascript-testing-patterns | wshobson/agents (javascript-typescript) @ 42203085cfc5 | false positives only |
| modern-javascript-patterns | wshobson/agents (javascript-typescript) @ 42203085cfc5 | false positives only |
| nodejs-backend-patterns | wshobson/agents (javascript-typescript) @ 42203085cfc5 | false positives only |
| typescript-advanced-types | wshobson/agents (javascript-typescript) @ 42203085cfc5 | false positives only |
| agent: javascript-pro | wshobson/agents (javascript-typescript) @ 42203085cfc5 | false positives only |
| agent: typescript-pro | wshobson/agents (javascript-typescript) @ 42203085cfc5 | false positives only |
| command: /typescript-scaffold | wshobson/agents (javascript-typescript) @ 42203085cfc5 | false positives only |
| async-python-patterns | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-anti-patterns | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-background-jobs | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-code-style | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-configuration | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-design-patterns | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-error-handling | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-observability | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-packaging | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-performance-optimization | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-project-structure | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-resilience | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-resource-management | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-testing-patterns | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| python-type-safety | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| uv-package-manager | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| agent: django-pro | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| agent: fastapi-pro | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| agent: python-pro | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| command: /python-scaffold | wshobson/agents (python-development) @ 42203085cfc5 | false positives only |
| go-concurrency-patterns | wshobson/agents (systems-programming) @ 42203085cfc5 | false positives only |
| memory-safety-patterns | wshobson/agents (systems-programming) @ 42203085cfc5 | false positives only |
| rust-async-patterns | wshobson/agents (systems-programming) @ 42203085cfc5 | false positives only |
| agent: c-pro | wshobson/agents (systems-programming) @ 42203085cfc5 | false positives only |
| agent: cpp-pro | wshobson/agents (systems-programming) @ 42203085cfc5 | false positives only |
| agent: golang-pro | wshobson/agents (systems-programming) @ 42203085cfc5 | false positives only |
| agent: rust-pro | wshobson/agents (systems-programming) @ 42203085cfc5 | false positives only |
| command: /rust-project | wshobson/agents (systems-programming) @ 42203085cfc5 | false positives only |
| screen-reader-testing | wshobson/agents (accessibility-compliance) @ 42203085cfc5 | false positives only |
| wcag-audit-patterns | wshobson/agents (accessibility-compliance) @ 42203085cfc5 | false positives only |
| agent: ui-visual-validator | wshobson/agents (accessibility-compliance) @ 42203085cfc5 | false positives only |
| command: /accessibility-audit | wshobson/agents (accessibility-compliance) @ 42203085cfc5 | false positives only |
| agent: prt-code-reviewer | anthropics/claude-plugins-official (pr-review-toolkit) @ 1b9a8c736db2 | clean |
| agent: prt-code-simplifier | anthropics/claude-plugins-official (pr-review-toolkit) @ 1b9a8c736db2 | clean |
| agent: comment-analyzer | anthropics/claude-plugins-official (pr-review-toolkit) @ 1b9a8c736db2 | clean |
| agent: pr-test-analyzer | anthropics/claude-plugins-official (pr-review-toolkit) @ 1b9a8c736db2 | clean |
| agent: silent-failure-hunter | anthropics/claude-plugins-official (pr-review-toolkit) @ 1b9a8c736db2 | clean |
| agent: type-design-analyzer | anthropics/claude-plugins-official (pr-review-toolkit) @ 1b9a8c736db2 | clean |
| command: /review-pr | anthropics/claude-plugins-official (pr-review-toolkit) @ 1b9a8c736db2 | clean |
| taste-skill | Leonxlnx/taste-skill @ f6b76575f949 | flagged, reviewed: false positive |
| brand | nextlevelbuilder/ui-ux-pro-max-skill @ 2de1134dc4d1 | flagged, reviewed: false positive |
| design | nextlevelbuilder/ui-ux-pro-max-skill @ 2de1134dc4d1 | flagged, reviewed: false positive; logo/icon scripts call api.muapi.ai / api.uberllm.dev only with your key |
| design-system | nextlevelbuilder/ui-ux-pro-max-skill @ 2de1134dc4d1 | flagged, reviewed: false positive |
| ui-styling | nextlevelbuilder/ui-ux-pro-max-skill @ 2de1134dc4d1 | flagged, reviewed: false positive |
| ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill @ 2de1134dc4d1 | flagged, reviewed: false positive |
| claude-hud (status line, .claude/hud) | jarrodwatts/claude-hud @ bf23142cd2e3 | flagged, reviewed: credential-path guards and maintainer probes only; no network |
| MCP: headroom (headroom-ai[mcp]==0.44.0) | chopratejas/headroom @ e27f0d96cc30 | flagged, reviewed: proxy/settings code and opt-out telemetry; no malware. Telemetry and beacon forced off |
