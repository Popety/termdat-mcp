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

Lucene query syntax: 'Bund' (exact), 'Schweiz*' (begins with), '*amt' (ends
with), '*term*' (contains), 'Bund~' (fuzzy). If a search returns nothing,
retry with a wildcard.

By default only the 'name', 'abbreviation', 'phraseology', and 'terminus'
fields are searched. Set fieldDefinition=true to also match in definitions.`,
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
deduplicates the languageDetails — saving the agent from scripting it.`,
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

const transport = new StdioServerTransport()
await server.connect(transport)
