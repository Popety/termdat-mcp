#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import {
  search,
  getEntryAllLanguages,
  listCollections,
  listClassifications,
} from './client.js'

const langSchema = z.enum(['DE', 'FR', 'IT', 'EN', 'RM'])

const server = new McpServer({
  name: 'termdat',
  version: '0.1.0',
})

server.tool(
  'termdat_search',
  `Search the Swiss Federal Chancellery's TERMDAT terminology database.

Use for cadastre, land-registry, notarial, federal-administrative, tenancy,
construction, and zoning vocabulary — official Swiss multilingual terms.
Returns up to 'maxEntries' candidates with their official translations,
source citations (federal-law references), and domain classification.

SEARCH STRATEGY — failed searches almost always come from query style, not
missing data. Before concluding "not in TERMDAT", try in this order:
  1. Start with the abbreviation ('IUS', 'COS', 'OFRF'). Short, robust,
     language-agnostic.
  2. Prefer a 2-word FR or IT query over a long DE compound. Lucene's
     analyzer may not split 'Geschossflächenziffer' into matchable
     tokens; 'indice utilisation' always does.
  3. For cadastre/zoning/surveying lookups, pin collectionIds to
     [948, 11514] (MOF98 + AMVER25) immediately — searching globally
     drowns hits in unrelated 'ius cogens' / legal matches.
  4. If the name-search returns empty, retry with fieldDefinition=true
     and fieldContext=true before giving up. The concept may be defined
     under a different headword.
  5. Pivot via the FR or IT abbreviation when a DE compound fails, then
     read the DE block from languageDetails of the returned entry.

PRE-IVHB CAVEAT — Swiss building-area abbreviations were standardised by
IVHB around 2010. TERMDAT entries pre-date that, so a modern abbreviation
(aGSF, GFZ, BMZ) may be absent even when the concept is present under the
older long name. Search by the long FR term or the FR abbreviation (IUS,
IBUS, COS), then map to the modern IVHB DE abbreviation manually.

ONE ENTRY, MULTIPLE SEQUENCES — a single TERMDAT entry can bundle related
concepts in different 'sequence' numbers (e.g. entry 96311 mixes
Ausnützungsziffer and Baumassenziffer across seq 1 / 2 / 3 of the DE
block). Always iterate all languageDetails entries — don't just trust
the first hit.

Lucene query syntax: 'Bund' (exact), 'Schweiz*' (begins with), '*amt'
(ends with), '*term*' (contains), 'Bund~' (fuzzy).

By default only the 'name', 'abbreviation', 'phraseology', and 'terminus'
fields are searched. Set fieldDefinition=true to also match in definitions.

EXAMPLES:
  termdat_search(query="IUS", inLanguage="FR", outLanguage="DE",
                 collectionIds=[948])
    → entry 96311 (Ausnützungsziffer / IUS / indice di sfruttamento
                   / plot ratio)

  termdat_search(query="Überbau*", inLanguage="DE", outLanguage="FR",
                 collectionIds=[948])
    → entry 96345 (Überbauungsziffer / ÜZ / coefficient d'occupation
                   / COS)

  termdat_search(query="Grundbuch", inLanguage="DE", outLanguage="FR")
    → entry 3089 (Federal Office for Land Registry and Real Estate Law)`,
  {
    query: z
      .string()
      .min(1)
      .describe('Term to search. Lucene syntax supported.'),
    inLanguage: langSchema.describe('Language of the query.'),
    outLanguage: langSchema
      .optional()
      .describe(
        'Translation pair language. If omitted, only inLanguage is returned.',
      ),
    collectionIds: z
      .array(z.number().int())
      .optional()
      .describe(
        "Restrict to specific collections. Common ids for popety.io: 11514 (AMVER25 cadastral surveying), 90 (ABR24 federal-decree abbreviations), 101 (ADFB23 federal-administration org units), 10399 (ARB17 employment law), 153 (ASY25 asylum law), 160 (AUS25 foreign-nationals law). Use termdat_list_collections to discover more.",
      ),
    classificationIds: z.array(z.number().int()).optional(),
    maxEntries: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('Default 25, max 1000.'),
    fieldDefinition: z
      .boolean()
      .optional()
      .describe('Also search in definitions. Default false.'),
    fieldNote: z
      .boolean()
      .optional()
      .describe('Also search in notes. Default false.'),
    fieldContext: z
      .boolean()
      .optional()
      .describe('Also search in context fields. Default false.'),
  },
  async (args) => {
    const entries = await search({
      query: args.query,
      inLanguage: args.inLanguage,
      outLanguage: args.outLanguage,
      collectionIds: args.collectionIds,
      classificationIds: args.classificationIds,
      maxEntries: args.maxEntries,
      fields: {
        definition: args.fieldDefinition,
        note: args.fieldNote,
        context: args.fieldContext,
      },
    })
    return {
      content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
    }
  },
)

server.tool(
  'termdat_get_entry_all_languages',
  `Fetch a single TERMDAT entry by id with translations in DE, FR, IT, and EN
merged into one response. The upstream /Entry endpoint only returns one
in/out language pair per call, so this tool parallelizes 3 calls and
deduplicates the languageDetails — saving the agent from scripting it.

Note: a single entry may bundle related concepts across multiple 'sequence'
numbers per language (e.g. entry 96311 covers Ausnützungsziffer in seq 1,
Baumassenziffer in seq 2, etc.). Iterate all languageDetails entries —
don't just read the first hit.`,
  {
    entryId: z.number().int().describe('TERMDAT entry id (e.g. 3089).'),
    pivotLanguage: langSchema
      .optional()
      .describe(
        'Pivot language for metadata text (collection, status, domain). Default DE.',
      ),
  },
  async ({ entryId, pivotLanguage }) => {
    const entry = await getEntryAllLanguages(entryId, pivotLanguage ?? 'DE')
    return {
      content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
    }
  },
)

server.tool(
  'termdat_list_collections',
  `List all available TERMDAT collections (~139). Codes are language-
independent; texts are localized. Use the returned ids with termdat_search's
collectionIds parameter to scope a search.`,
  {
    language: langSchema.describe('Language for the human-readable text.'),
  },
  async ({ language }) => {
    const list = await listCollections(language)
    return {
      content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
    }
  },
)

server.tool(
  'termdat_list_classifications',
  'List TERMDAT classifications. Use ids with termdat_search\'s classificationIds parameter.',
  {
    language: langSchema,
  },
  async ({ language }) => {
    const list = await listClassifications(language)
    return {
      content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
    }
  },
)

server.prompt(
  'translate-i18n-key',
  `Translate a term into a Swiss-federal DE/FR/IT/EN i18n entry from TERMDAT,
with the official source citation ready to drop into a commit message.

Use this when adding or updating an i18n key for cadastre, land-registry,
notarial, federal-administrative, tenancy, construction, or zoning vocabulary.`,
  {
    term: z
      .string()
      .describe(
        'Term to translate (any language). The agent will detect the source language.',
      ),
    key: z
      .string()
      .optional()
      .describe(
        'Optional i18n key for the JSON output. Defaults to a snake_case slug of the term.',
      ),
    context: z
      .string()
      .optional()
      .describe(
        'Optional domain hint to disambiguate (e.g. "cadastre", "tenancy", "land registry"). Helps when multiple entries match.',
      ),
  },
  ({ term, key, context }) => {
    const keyLabel = key ?? '<snake_case_slug_of_term>'
    const lines = [
      `Look up "${term}" in TERMDAT and produce a Swiss-federal i18n entry.`,
      context ? `Domain hint: ${context}.` : null,
      '',
      'Steps:',
      `1. Call termdat_search with query="${term}" and the language you detect for "${term}".${context ? ` If a relevant collection exists for the "${context}" domain, scope the search with collectionIds (use termdat_list_collections first if needed).` : ''}`,
      `2. If results are empty, retry with a wildcard ("${term}*") — TERMDAT's canonical headword often differs from common usage (e.g. "Parzelle" lives under "Grundstück").`,
      `3. From the candidates, pick the entry that best matches "${term}"${context ? ` in the "${context}" domain` : ''}.`,
      '4. Call termdat_get_entry_all_languages with that entry id to get all four DE/FR/IT/EN names.',
      '5. Output a JSON i18n block:',
      '   ```json',
      '   {',
      `     "${keyLabel}": {`,
      '       "de": "...",',
      '       "fr": "...",',
      '       "it": "...",',
      '       "en": "..."',
      '     }',
      '   }',
      '   ```',
      `6. Below the JSON, output the citation line for the commit message: \`(${key ?? '<key>'}: termdat:<entryId>)\`.`,
      '7. Flag any caveats: entry status not "Validiert", missing federal-law source (only office-doc), or ambiguity between multiple plausible candidates.',
    ]
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: lines.filter((line): line is string => line !== null).join('\n'),
          },
        },
      ],
    }
  },
)

server.prompt(
  'lookup-term',
  `Show the full TERMDAT entry for a term in all four languages, with the
federal-law citation, definition, and source URL. Useful for legal or
research work where you need to cite the source — not just an i18n string.`,
  {
    term: z.string().describe('Term to look up.'),
    language: z
      .string()
      .optional()
      .describe('Language of the term: DE, FR, IT, EN, or RM. Default DE.'),
    context: z
      .string()
      .optional()
      .describe('Optional domain hint to scope the search.'),
  },
  ({ term, language, context }) => {
    const lang = (language ?? 'DE').toUpperCase()
    const lines = [
      `Look up "${term}" in TERMDAT and present the full multilingual entry.`,
      context ? `Domain hint: ${context}.` : null,
      '',
      'Steps:',
      `1. Call termdat_search with query="${term}", inLanguage="${lang}".${context ? ` Scope to the "${context}" domain via collectionIds when reasonable.` : ''}`,
      `2. If empty, retry with "${term}*".`,
      '3. For the best match, call termdat_get_entry_all_languages.',
      '4. Present:',
      '   - All four language names with their abbreviations (if any)',
      '   - The German definition and its source citation (e.g. "Grundbuchverordnung, Art. 6 Abs. 1 (SR 211.432.1)")',
      '   - The collection (e.g. "GRF19 — Land register terminology")',
      '   - The TERMDAT entry id and URL',
      '   - The status and reliability fields',
    ]
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: lines.filter((line): line is string => line !== null).join('\n'),
          },
        },
      ],
    }
  },
)

server.prompt(
  'reverse-lookup-term',
  `Find the canonical Swiss-federal entry for a term given in any language.
Tells you whether your input is the official headword or a synonym, and
shows the equivalents in the other three languages.`,
  {
    term: z
      .string()
      .describe(
        'Term as you have it (may be common usage, not the canonical Swiss-federal headword).',
      ),
    sourceLanguage: z
      .string()
      .describe('Language of the input term: DE, FR, IT, EN, or RM.'),
  },
  ({ term, sourceLanguage }) => {
    const lang = sourceLanguage.toUpperCase()
    const lines = [
      `I have the term "${term}" in ${lang}. Find the canonical Swiss-federal TERMDAT entry and show me the equivalents in the other three languages.`,
      '',
      'Steps:',
      `1. Call termdat_search with query="${term}", inLanguage="${lang}". The official Swiss term may not match my input exactly — common-usage terms often live under different headwords (e.g. "Parzelle" → "Grundstück", "papier-valeur hypothécaire" → "cédule hypothécaire").`,
      `2. If empty, retry with "${term}*", then "*${term}*".`,
      '3. For the best match, call termdat_get_entry_all_languages.',
      '4. Present:',
      `   - **Whether "${term}" is the canonical headword** in ${lang}, or a synonym / non-canonical variant. If non-canonical, name the canonical headword.`,
      '   - The canonical name in each of DE / FR / IT / EN',
      '   - One-line federal-law citation (the German `nameSource`)',
      '   - The TERMDAT entry id and URL',
    ]
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: lines.join('\n'),
          },
        },
      ],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
