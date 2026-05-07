const BASE_URL = 'https://api.termdat.bk.admin.ch/v2'

export type LangCode = 'DE' | 'FR' | 'IT' | 'EN' | 'RM'

export interface LanguageDetail {
  id: number
  languageIsoCode: LangCode
  sequence: number
  name?: string | null
  nameSource?: string | null
  abbreviation?: string | null
  abbreviationSource?: string | null
  definition?: string | null
  definitionSource?: string | null
  note?: string | null
  noteSource?: string | null
  context?: string | null
  contextSource?: string | null
  phraseology?: string | null
  phraseologySource?: string | null
}

export interface Domain {
  id: number
  text: string
}

export interface Subject {
  id: number
  text: string
  domains: Domain[]
}

export interface Coded {
  id?: number
  code: string
  text: string
}

export interface Entry {
  id: number
  url?: string
  status?: { code: string; text: string }
  reliability?: { code: string; text: string }
  office?: Coded
  collection?: Coded
  classification?: Coded
  subject?: Subject[]
  languageDetails: LanguageDetail[]
  hits?: string[]
}

export interface Summary {
  id: number
  code: string
  text: string
}

export interface SearchOptions {
  query: string
  inLanguage: LangCode
  outLanguage?: LangCode
  collectionIds?: number[]
  classificationIds?: number[]
  maxEntries?: number
  fields?: {
    terminus?: boolean
    name?: boolean
    abbreviation?: boolean
    phraseology?: boolean
    definition?: boolean
    note?: boolean
    context?: boolean
    source?: boolean
    metadata?: boolean
    country?: boolean
    comment?: boolean
  }
  returnType?: 'Detail' | 'Summary'
}

type ParamValue = string | number | boolean | string[] | number[] | undefined

function buildQuery(params: Record<string, ParamValue>): string {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) usp.append(key, String(item))
    } else {
      usp.set(key, String(value))
    }
  }
  return usp.toString()
}

async function get<T>(path: string, query: string): Promise<T> {
  const url = `${BASE_URL}${path}?${query}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`TERMDAT ${res.status} ${res.statusText} for ${url}`)
  }
  return res.json() as Promise<T>
}

export async function search(opts: SearchOptions): Promise<Entry[]> {
  const f = opts.fields ?? {}
  return get<Entry[]>(
    '/Search',
    buildQuery({
      SearchTerm: opts.query,
      InLanguageCode: opts.inLanguage,
      OutLanguageCode: opts.outLanguage,
      CollectionIds: opts.collectionIds,
      ClassificationIds: opts.classificationIds,
      MaxEntryCount: opts.maxEntries,
      ReturnType: opts.returnType ?? 'Detail',
      'Field.Terminus': f.terminus,
      'Field.Name': f.name,
      'Field.Abbreviation': f.abbreviation,
      'Field.Phraseology': f.phraseology,
      'Field.Definition': f.definition,
      'Field.Note': f.note,
      'Field.Context': f.context,
      'Field.Source': f.source,
      'Field.Metadata': f.metadata,
      'Field.Country': f.country,
      'Field.Comment': f.comment,
    }),
  )
}

export async function getEntries(
  entryIds: number[],
  inLanguage: LangCode,
  outLanguage?: LangCode,
): Promise<Entry[]> {
  return get<Entry[]>(
    '/Entry',
    buildQuery({
      EntryIds: entryIds,
      InLanguageCode: inLanguage,
      OutLanguageCode: outLanguage,
    }),
  )
}

const ALL_POPETY_LANGS: LangCode[] = ['DE', 'FR', 'IT', 'EN']

export async function getEntryAllLanguages(
  entryId: number,
  pivotLanguage: LangCode = 'DE',
): Promise<Entry> {
  const others = ALL_POPETY_LANGS.filter((l) => l !== pivotLanguage)
  const responses = await Promise.all(
    others.map((out) => getEntries([entryId], pivotLanguage, out)),
  )

  const first = responses[0]?.[0]
  if (!first) throw new Error(`TERMDAT entry ${entryId} not found`)

  const merged = new Map<LangCode, LanguageDetail>()
  for (const response of responses) {
    for (const detail of response[0]?.languageDetails ?? []) {
      merged.set(detail.languageIsoCode, detail)
    }
  }

  return { ...first, languageDetails: Array.from(merged.values()) }
}

export async function listCollections(language: LangCode): Promise<Summary[]> {
  return get<Summary[]>('/Collection', buildQuery({ languageCode: language }))
}

export async function listClassifications(language: LangCode): Promise<Summary[]> {
  return get<Summary[]>('/Classification', buildQuery({ languageCode: language }))
}
