# Greebles

Josh's phone-first idle creature game for the playzodark.io game center (IdleForge).
Started as an HTML spike (`pixel-vector-bell/stillwork-spike`, `rove/`), rebuilt here in TypeScript + React.

Story: you are an explorer stranded on a strange planet. **Greebles** are one short, goblin-like species
with morphs (Ash, Tide, Scrap, ...) and a caste (Dig / Trawl / Skirmish). Robots patrol the planet and are
enemies only — they never join the bag. Combining is **graft**. Currency is **scrap**.

- Rules live in `src/sim/` (pure TS, seeded RNG) and are tested with Vitest: `npm test`.
- `npm run build` makes `dist/`.
- `node scripts/ship-to-hub.mjs <IdleForge checkout>` copies the build into `wwwroot/games/greebles/`.
- Hub save bridge: `gr:hello` / `gr:load` / `gr:save` / `gr:flush` (see `src/save/hub.ts`).
