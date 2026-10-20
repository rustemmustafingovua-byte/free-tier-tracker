<div align="center">

<img src="docs/social-preview.png" alt="free-tier-tracker" width="100%">

# free-tier-tracker

**Know your free quota before it runs out.**

[![CI](https://github.com/rustemmustafingovua-byte/free-tier-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/rustemmustafingovua-byte/free-tier-tracker/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/free-tier-tracker?color=cb3837&logo=npm)](https://www.npmjs.com/package/free-tier-tracker)
[![license](https://img.shields.io/badge/license-MIT-8b949e?logo=opensourceinitiative)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-3c873a?logo=node.js)](https://nodejs.org)
[![paid](https://img.shields.io/badge/USDC-0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E-2775ca?logo=ethereum)](https://base.org)

[**Docs**](https://rustemmustafingovua-byte.github.io/free-tier-tracker/) · [Issues](https://github.com/rustemmustafingovua-byte/free-tier-tracker/issues) · [Discussions](https://github.com/rustemmustafingovua-byte/free-tier-tracker/discussions)

</div>

---

Free tiers do not warn you: the model just answers 402 in the middle of a run. free-tier-tracker keeps a local ledger of what each provider has left, learns from the failures you already hit, and tells the agent to stop using a provider that is done for the day.

## Install

```bash
npm i -g free-tier-tracker
```

## What it does

| | |
|---|---|
| **A local ledger per provider** | tokens used, failures, exhaustion |
| **Learns from real failures** | recognises 402 / 429 / quota messages |
| **Warnings before exhaustion** | the agent is told which provider to avoid |
| **A pool probe** | watch checks the APInex pool in one request |


## Usage

```bash
free-tier-tracker status
free-tier-tracker note "Free 10M tokens used"
free-tier-tracker watch
```

## Part of a portfolio

| Project | What it does |
|---|---|
| [`opencode-free-stack`](https://github.com/rustemmustafingovua-byte/opencode-free-stack) | route to free models, fall back automatically |
| [`free-web-mcp`](https://github.com/rustemmustafingovua-byte/free-web-mcp) | web search for agents, zero credits |
| [`agent-x402`](https://github.com/rustemmustafingovua-byte/agent-x402) | pay per API call in USDC with a spend policy |

## Donate

MIT, forever. USDC on Base:

```
0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E
```

## License

MIT © rustemmustafingovua-byte
