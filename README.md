<div align="center">

# Free Tier Tracker

[![CI](https://github.com/rustemmustafingovua-byte/free-tier-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/rustemmustafingovua-byte/free-tier-tracker/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/free-tier-tracker?color=cb3837&logo=npm)](https://www.npmjs.com/package/free-tier-tracker) [![license](https://img.shields.io/badge/license-MIT-8b949e?logo=opensourceinitiative)](./LICENSE)

</div>

---

**Know your free quota before it runs out. free-tier-tracker keeps a local ledger of what each provider has left and tells the agent to stop using a provider that is done for the day.**

---

⭐ **Star us on GitHub** if this project helps you build better agents!

---

## 🚀 Быстрый старт

```bash
git clone https://github.com/rustemmustafingovua-byte/free-tier-tracker
cd free-tier-tracker && npm install
free-tier-tracker status
```

---

## 🎯 Демо

```bash
free-tier-tracker status
free-tier-tracker refresh
free-tier-tracker watch
```

---

## 💰 Монетизация

- **Hosted tracker**: управляемый сервис с веб-дашбордом для команд
- **Custom providers**: добавление новых free-tier провайдеров под заказ
- **Enterprise integrations**: встраивание трекера в CI/CD и agent-платформы
- **Alerts & webhooks**: плагины для оповещений в Slack/Telegram/Discord

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-thing`)
3. Commit your changes (`git commit -m 'feat: add amazing thing'`)
4. Push to the branch (`git push origin feat/amazing-thing`)
5. Open a Pull Request

Bug reports and feature requests are welcome on the [Issues](https://github.com/rustemmustafingovua-byte/free-tier-tracker/issues) page.

MIT © rustemmustafingovua-byte

## Dashboard Export (`--export`)

Export the ledger to a single dashboard-friendly JSON file containing one JSON object per UTC day:

```bash
free-tier-tracker --export ./dashboard.json
```

### Export Schema

The exported file is a JSON array sorted by `day` (`YYYY-MM-DD`), with one object per day:

```json
[
  {
    "day": "2026-04-20",
    "totalTokensUsed": 250000,
    "exhaustedCount": 1,
    "providers": [
      {
        "provider": "apinex",
        "live": null,
        "tokensUsed": 250000,
        "dailyTokens": 10000000,
        "left": 9750000,
        "ratio": 0.975,
        "rpm": 10,
        "exhausted": false,
        "kinds": [],
        "warn": false
      }
    ]
  }
]
```
