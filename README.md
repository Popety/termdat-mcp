# termdat-mcp

MCP server exposing the Swiss Federal Chancellery's [TERMDAT](https://www.termdat.bk.admin.ch/) terminology database. Provides authoritative DE / FR / IT / EN / RM translations for Swiss federal vocabulary — cadastre, land registry, property law, notarial deeds, federal administrative bodies, tenancy, zoning, construction, asylum and foreign-nationals law, and more.

## What it does

TERMDAT is the official Swiss federal terminology authority, curated by the Federal Chancellery. It powers federal-administration translations and contains entries cited from federal law (e.g. `Grundbuchverordnung, Art. 6 Abs. 1 (SR 211.432.1)`).

For Swiss PropTech, GovTech, or legal-adjacent projects, it is the source of truth for cross-language vocabulary. This MCP server gives LLM agents a first-class tool to query it, instead of reconstructing curl recipes or relying on machine translation that drifts from federal usage.

The upstream API is public, anonymous, and stable, but quirky in two ways this server smooths over:

- The `/Search` and `/Entry` endpoints only return one `InLanguageCode` + one `OutLanguageCode` per call. To collect all four languages you have to fan out and merge. `termdat_get_entry_all_languages` does that for you.
- Field-level search toggles (`Field.Definition`, `Field.Note`, `Field.Context`) are off by default. The tool schema documents which are useful when.

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

The server runs over stdio and has no auth, no env vars, and no state. Any MCP client that can spawn a stdio process can use it.

## Connect to an MCP client

Pick your client. All examples assume either `node /absolute/path/to/termdat-mcp/dist/index.js` (from-source) or `termdat-mcp` (after global install).

### Claude Code

Easiest — one command:

```bash
claude mcp add termdat -- node /absolute/path/to/termdat-mcp/dist/index.js
# or, after global install:
claude mcp add termdat -- termdat-mcp
```

Or add it manually to a project's `.mcp.json` (committed, shared with teammates):

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

For user-level (all projects), use `claude mcp add --scope user`.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop after editing.

### OpenAI Codex CLI

Codex uses TOML. Edit `~/.codex/config.toml`:

```toml
[mcp_servers.termdat]
command = "node"
args = ["/absolute/path/to/termdat-mcp/dist/index.js"]
```

### Cursor

Project-scoped `.cursor/mcp.json` (or user-scoped `~/.cursor/mcp.json`):

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

### VS Code (GitHub Copilot / Agent mode)

Project-scoped `.vscode/mcp.json`:

```json
{
  "servers": {
    "termdat": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/termdat-mcp/dist/index.js"]
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

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

### Continue

`~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: termdat
    command: node
    args:
      - /absolute/path/to/termdat-mcp/dist/index.js
```

### Zed

`~/.config/zed/settings.json` (under `context_servers`):

```json
{
  "context_servers": {
    "termdat": {
      "command": {
        "path": "node",
        "args": ["/absolute/path/to/termdat-mcp/dist/index.js"]
      }
    }
  }
}
```

### Gemini CLI

`~/.gemini/settings.json` (or project `.gemini/settings.json`):

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

### Verify the connection

In any client, ask the agent: *"List the TERMDAT collections."* — it should call `termdat_list_collections` and return ~139 entries (AMVER25, ABR24, etc.). Or run the upstream-side smoke test directly:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Tools

### `termdat_search`

Search TERMDAT. Lucene syntax (`*`, `?`, `~`).

| Param | Type | Notes |
|---|---|---|
| `query` | string | Lucene syntax: `Bund` exact, `Schweiz*` prefix, `*amt` suffix, `*term*` contains, `Bund~` fuzzy |
| `inLanguage` | `DE`/`FR`/`IT`/`EN`/`RM` | Required |
| `outLanguage` | same enum | Optional translation pair |
| `collectionIds` | number[] | Scope to specific collections |
| `classificationIds` | number[] | Scope to classifications |
| `maxEntries` | int 1–1000 | Default 25 |
| `fieldDefinition` | bool | Also search in definitions |
| `fieldNote` | bool | Also search in notes |
| `fieldContext` | bool | Also search in context |

Note: the canonical headword may not be the everyday term. For example, `Parzelle` returns nothing — the entry lives under `Grundstück`. If a search returns empty, broaden with a wildcard or try the synonym.

### `termdat_get_entry_all_languages`

Fetch one entry with all four DE/FR/IT/EN translations in a single response. Internally parallelizes three `/Entry` calls and merges `languageDetails`.

### `termdat_list_collections`

List all ~139 collections. Useful to scope searches (e.g. AMVER25 = cadastral surveying = id 11514, MIET17 = tenancy law = id 10397).

### `termdat_list_classifications`

List the ~23 top-level domain classifications (BAUW construction, RECH law, VERW public administration, etc.).

## Prompts

The server also ships three [MCP prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts), surfaced as user-facing slash commands or templates depending on the client. Each one bakes in the right tool sequence (search → wildcard retry on empty → fetch all languages → present) so users don't have to remember the steps.

### `translate-i18n-key`

Produce a Swiss-federal i18n entry for the given term, in JSON with a citation line ready for the commit message.

| Arg | Required | Notes |
|---|---|---|
| `term` | yes | The word to translate. Any language. |
| `key` | no | i18n key for the JSON output. Defaults to a snake_case slug of `term`. |
| `context` | no | Domain hint (e.g. `cadastre`, `tenancy`) to disambiguate when several entries match. |

Example invocation in Claude Code: `/termdat:translate-i18n-key term="easement" key="easement"` — the agent calls `termdat_search`, picks the cadastre/property match, fetches all four languages, and emits:

```json
{
  "easement": {
    "de": "Dienstbarkeit",
    "fr": "servitude",
    "it": "servitù",
    "en": "easement"
  }
}
```

followed by `(easement: termdat:<id>)`.

### `lookup-term`

Show the full multilingual TERMDAT entry — names, definition, federal-law citation, collection, and source URL. For research/legal work, not i18n.

| Arg | Required | Notes |
|---|---|---|
| `term` | yes | The word to look up. |
| `language` | no | `DE` / `FR` / `IT` / `EN` / `RM`. Default `DE`. |
| `context` | no | Domain hint to scope the search. |

### `reverse-lookup-term`

Take a term in any language and locate the canonical Swiss-federal headword. Critically, **flags whether your input is the official headword or a synonym** — common usage often differs from the federal canonical form (e.g. `Parzelle` → `Grundstück`, `papier-valeur hypothécaire` → `cédule hypothécaire`).

| Arg | Required | Notes |
|---|---|---|
| `term` | yes | Term as you have it. |
| `sourceLanguage` | yes | `DE` / `FR` / `IT` / `EN` / `RM`. |

## Usage examples

The agent decides which tool to call based on your prompt. Some examples that route well:

**Cross-language lookup of a domain term**

> "Give me the official Swiss DE/FR/IT/EN translation for *land registry office*, with the federal-law citation."

The agent calls `termdat_search` with `query: "Grundbuch"`, `inLanguage: "DE"`, then `termdat_get_entry_all_languages` on the returned id. Result: entry 3089 — *Eidgenössisches Amt für Grundbuch- und Bodenrecht* / *Office fédéral chargé du droit du registre foncier et du droit foncier* / *Ufficio federale per il diritto del registro fondiario* / *Federal Office for Land Registry and Real Estate Law*, cited from `Grundbuchverordnung, Art. 6 Abs. 1 (SR 211.432.1)`.

**Scoped search inside a single collection**

> "Find all TERMDAT entries in the cadastral-surveying collection that contain the word *Mutation*."

The agent calls `termdat_list_collections` (or uses the known id 11514 for AMVER25), then `termdat_search` with `collectionIds: [11514]`, `query: "Mutation*"`, `inLanguage: "DE"`.

**Adding i18n keys for a Swiss real-estate app**

> "I need to add a translation key for *easement* in our app's i18n files. Use the official Swiss federal terminology."

The agent calls `termdat_search` with `query: "Dienstbarkeit"`, `inLanguage: "DE"`, `outLanguage: "FR"`, then fetches all four languages, and proposes:

```json
{
  "easement": {
    "de": "Dienstbarkeit",
    "fr": "servitude",
    "it": "servitù",
    "en": "easement"
  }
}
```

with the TERMDAT entry id cited in the commit message.

**Domain reverse-lookup**

> "What does *cédule hypothécaire* officially mean in German? Give me the federal-law definition."

The agent calls `termdat_search` with `query: "cédule hypothécaire"`, `inLanguage: "FR"`, `outLanguage: "DE"`, then `termdat_get_entry_all_languages` for the source citation and full definition.

## Common collection ids

| Code | id | Domain |
|---|---|---|
| AMVER25 | 11514 | Official cadastral surveying |
| MOF98 | 948 | Swiss official cadastral surveying (legacy) |
| GRF19 | 10333 | Land register |
| OEREB16 | 10383 | PLR-cadastre |
| MIET17 | 10397 | Tenancy law |
| SACH18 | 10334 | Property law |
| ORV19 | 10336 | Code of Obligations |
| ORVER17 | 10368 | Code of Obligations (contracts) |
| RAUM18 | 10416 | Spatial planning |
| BAU17 | 10391 | Construction |
| BBL08 | 207 | Real estate management |
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

To poke the running server interactively:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT
