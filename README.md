# dsh-plugin-model-switcher

DSH plugin for switching models and reasoning effort levels via keyboard shortcuts.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` / `Cmd+Shift+M` | Cycle through models in the current provider |
| `Ctrl+Shift+R` / `Cmd+Shift+R` | Cycle through reasoning efforts (off → low → high → max → off) |

A toast notification confirms each switch in the bottom-right corner.

## How it works

**Host** (`src/index.ts`):
- Reads the current model selection from `agentDefaultModel`
- Cycles through models via `llm.listModels()` or reasoning efforts via `llm.resolveModelInfo()`
- Persists the new selection via `agentDefaultModel.saveSelection()`

**Client** (`src/client/index.ts`):
- Registers a toast overlay in the `shell.overlay` slot
- Listens for `Ctrl/Cmd+Shift+M` and `Ctrl/Cmd+Shift+R` on the document (capture phase)
- Calls the Host handlers via `host.call()` and updates the model selector UI via `modelDirectories.directoryFor(sessionId).select()`

## Installation

```bash
dsh plugin --profile web add https://github.com/Mrlilili/dsh-plugin-model-switcher.git
```

Then restart DSH.

## License

MIT