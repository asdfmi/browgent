# Browgent

Browgent is a tool that automates repetitive tasks performed in a web browser. In addition to clicks and text inputs, it can incorporate AI-based generation and classification, allowing not just actions but also decisions and content creation to be automated. Each workflow runs with real-time visibility into progress, logs, and screenshots, so users can see exactly what’s happening as it executes. It can also capture data from web pages and store it as metrics, enabling statistical tracking and trend analysis of online information. Browgent goes beyond simple browser automation — it combines AI and data collection to intelligently automate entire browser-based workflows.

For deeper architecture, data model, API, and deployment details—including step-by-step execution flow—see the documentation hub at https://asdfmi.github.io/browgent/.

## Local Development

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Push the Prisma schema:
   ```bash
   pnpm --dir portal exec prisma db push --schema prisma/schema.prisma
   ```
3. Install Playwright Chromium (one-time):
   ```bash
   pnpm --dir runner exec playwright install --with-deps chromium
   ```
4. Run
   ```bash
   pnpm run dev
   ```
