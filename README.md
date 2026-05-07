# termdat-mcp

MCP server exposing the Swiss Federal Chancellery's [TERMDAT](https://www.termdat.bk.admin.ch/) terminology database. Provides authoritative DE / FR / IT / EN / RM translations for Swiss federal vocabulary — cadastre, land registry, property law, notarial deeds, federal administrative bodies, tenancy, zoning, and more.

## Why

TERMDAT is the Swiss federal terminology authority. For Swiss PropTech, GovTech, or legal-adjacent projects, it's the source of truth for cross-language vocabulary. This MCP server exposes it as a first-class tool so agents can call into it instead of reconstructing curl recipes.

The upstream API is public, anonymous, and stable, but quirky in two ways this server smooths over:

- The `/Search` and `/Entry` endpoints only return one `InLanguageCode` + one `OutLanguageCode` per call. To collect all four languages you have to fan out and merge. `termdat_get_entry_all_languages` does that for you.
- Field-level search toggles (`Field.Definition`, `Field.Note`, etc.) are off by default. The tool schema documents which are useful when.

## Install

From source:

```bash
git clone https://github.com/tclement/termdat-mcp.git
cd termdat-mcp
npm install
npm run build
```

Or once published:

```bash
npm install -g termdat-mcp
```

## Configure

### Claude Code

Add to your project's `.mcp.json` (or user-level config):

```json
{
  "mcpServers": {
    "termdat": {
      "command": "node",
      "args": ["/absolute/path/to/termdat-mcp/dist/index.js"]
    }
  }
}
```

After global install:

```json
{
  "mcpServers": {
    "termdat": {
      "command": "termdat-mcp"
    }
  }
}
```

### Claude Desktop

Same shape, in `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS).

## Tools

### `termdat_search`

Search TERMDAT. Lucene syntax for the query (`*`, `?`, `~`).

| Param | Type | Notes |
|---|---|---|
| `query` | string | Lucene |
| `inLanguage` | `DE`/`FR`/`IT`/`EN`/`RM` | Required |
| `outLanguage` | same enum | Optional translation pair |
| `collectionIds` | number[] | Scope to specific collections |
| `classificationIds` | number[] | Scope to classifications |
| `maxEntries` | int 1–1000 | Default 25 |
| `fieldDefinition` | bool | Also search in definitions |
| `fieldNote` | bool | Also search in notes |
| `fieldContext` | bool | Also search in context |

### `termdat_get_entry_all_languages`

Fetch one entry with all four DE/FR/IT/EN translations in a single response. Internally parallelizes three `/Entry` calls.

### `termdat_list_collections`

List all ~139 collections. Useful to scope searches (e.g. AMVER25 = cadastral surveying = id 11514, ASY25 = asylum law = id 153).

### `termdat_list_classifications`

List classifications.

## Common collection ids

| Code | id | Domain |
|---|---|---|
| AMVER25 | 11514 | Official cadastral surveying |
| ABR24 | 90 | Federal-decree title abbreviations |
| ADFB23 | 101 | Federal Administration org-unit names |
| ARB17 | 10399 | Employment law |
| ASY25 | 153 | Swiss asylum law |
| AUS25 | 160 | Swiss foreign-nationals law |

Use `termdat_list_collections` to discover the rest.

## Develop

```bash
npm install
npm run smoke    # hits the live API to verify the client
npm run build    # tsc → dist/
npm run dev      # tsx src/index.ts (stdio server, useful with MCP Inspector)
```

To test the running server:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT
