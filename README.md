# LeetCode Assist

A Chrome extension (Manifest V3) that runs a 30-day LeetCode bootcamp on the NeetCode 150
roadmap: daily plan, spaced reviews, timers, notes and a side panel next to LeetCode.
See [docs/SPEC.md](docs/SPEC.md) for the product and technical spec.

Built with WXT, React and TypeScript. Only facts about problems (title, difficulty, category,
link) are bundled; no explanations or solutions are copied.

## Development

```bash
npm install
npm run dev        # WXT dev mode (Chrome)
npm run build      # production build in .output/chrome-mv3
npm run zip        # store-ready zip
npm run test       # Vitest unit tests
npm run typecheck  # tsc --noEmit
```

## Layout

- `src/core/` – pure TypeScript (no browser APIs): types, dates, timer, review cycle, planner, state.
- `src/data/` – static NeetCode 150 list and the 30-day program (queue, benchmarks).
- `src/entrypoints/` – WXT entrypoints (dashboard, side panel, background).

## License

MIT
