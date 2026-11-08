# Musalingo

> The free, open source way to learn languages. Cheaper than chai.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mithulbuddi90-hash/musalingo)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Musalingo is a Duolingo-style language learning Progressive Web App (PWA) built with **vanilla JavaScript**, **no build step**, and **no framework**. It runs on a single Node/Express process, stores learning progress in Firebase, and generates AI-powered practice questions through the Gemini API.

**Beta target: November 14, 2026** — codename *"Vibreta"*.

## Features

- AI-generated lessons in 14+ languages
- 10 question types (multiple choice, listen, speak, spell, match pairs, and more)
- Chess training with Stockfish and an AI Coach
- Offline mode — cached lessons work without Wi-Fi
- Free forever. No forced ads.

## Quick start

```bash
git clone https://github.com/mithulbuddi90-hash/musalingo.git
cd musalingo/musamain
cp .env.example .env
# Edit .env with your keys
npm install
node server.js
```

## Configuration

Copy `.env.example` to `.env` and add the credentials for the services you use.
Never commit `.env` or service-account credentials.

## Deployment

The root `render.yaml` configures the Render web service. Add its environment
variables in the Render dashboard before deploying.
