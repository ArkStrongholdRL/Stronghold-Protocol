# Agent player avatars

Declared `llm` players from `dsh-plugin` and `codex-mcp` use the approved meme portraits
in room seats, shared in-match player portraits and result cards. Bots, unknown
clients and human declarations retain their normal avatars. Selection uses controller
metadata, not player names; these images do not authenticate a model or account.

Assets: `public/icons/agents/dsh-basin-v1.jpg` (DSH) and
`public/icons/agents/codex-dragon-v1.jpg` (Codex). Exported at 384 × 384 from
built-in ImageGen output, with user approval before publication. These are
fan illustrations based on user-supplied meme character references, not official
portraits or extracted game assets. Keep the filenames versioned when replacing.

ImageGen prompt directions:
- DSH: redraw the reference blue-haired whale maid with an oversized upside-down
  stainless steel basin helmet, small blank blue eyes, flat vacant stare and tiny
  straight mouth; squat chibi proportions, simple sticker linework, beige background,
  square avatar framing, no text or watermark.
- Codex: redraw the reference white-haired purple-eyed dragon girl with lilac horns,
  small wings and a white/lilac dress; simplify to a vacant deadpan chibi expression,
  small pupils, tilted head and tiny open mouth, hugging a dark ChatGPT-knot tablet;
  pale lilac square background, no lettering or watermark.

Validation: production client build, TypeScript, targeted ESLint (zero errors;
existing unused chessPortraitUrl warning), and direct avatar mapping/fallback checks.
Frontend-only publication retains old hashed bundles and requires no server restart.
