/**
 * Smoke test: runs each tool's underlying client function against the live
 * TERMDAT API. No MCP transport — just verifies the client and JSON shapes.
 *
 * Run: npm run smoke
 */
import {
  search,
  getEntryAllLanguages,
  listCollections,
} from '../src/client.js'

async function main(): Promise<void> {
  console.log('1. Search "Grundbuch" DE→FR ...')
  const hits = await search({
    query: 'Grundbuch',
    inLanguage: 'DE',
    outLanguage: 'FR',
    maxEntries: 1,
  })
  if (hits.length === 0) throw new Error('Expected at least one hit')
  const entry = hits[0]!
  console.log(`   id=${entry.id} collection=${entry.collection?.code}`)
  console.log(
    `   DE: ${entry.languageDetails.find((d) => d.languageIsoCode === 'DE')?.name}`,
  )
  console.log(
    `   FR: ${entry.languageDetails.find((d) => d.languageIsoCode === 'FR')?.name}`,
  )

  console.log(`\n2. Fetch entry ${entry.id} in all 4 languages ...`)
  const full = await getEntryAllLanguages(entry.id, 'DE')
  for (const lang of ['DE', 'FR', 'IT', 'EN'] as const) {
    const detail = full.languageDetails.find((d) => d.languageIsoCode === lang)
    console.log(`   ${lang}: ${detail?.name ?? '(none)'}`)
  }

  console.log('\n3. List collections (EN) ...')
  const collections = await listCollections('EN')
  console.log(`   ${collections.length} collections returned`)
  const cadastral = collections.find((c) => c.code === 'AMVER25')
  if (cadastral) {
    console.log(`   cadastral collection: id=${cadastral.id} text="${cadastral.text}"`)
  }

  console.log('\nSmoke OK.')
}

main().catch((err) => {
  console.error('Smoke FAILED:', err)
  process.exit(1)
})
