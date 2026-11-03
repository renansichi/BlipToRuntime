const fs = require('fs')
const rep = (file, pairs) => {
  let t = fs.readFileSync(file, 'utf8')
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(`nao achei em ${file}: ${a.slice(0, 80)}`); t = t.replace(a, b) }
  fs.writeFileSync(file, t)
}
fs.appendFileSync('src/emit/ids.ts', `
/** Chave de Recurso valida no Kayros OS: [A-Za-z0-9_.]+ com no maximo 100 caracteres. */
export const RESOURCE_KEY_PATTERN = /^[A-Za-z0-9_.]+$/
export const RESOURCE_KEY_MAX = 100

/** Trecho de chave de Recurso: sem acento, so [A-Za-z0-9_], minusculo. */
export function resourceSlug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'x'
  )
}

/** Garante o padrao do Kayros OS: caracteres invalidos viram "_" e chaves longas ganham hash no fim. */
export function toResourceKey(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9_.]/g, '_')
  if (clean.length <= RESOURCE_KEY_MAX) return clean
  const h = stableId('resource-key', raw).slice(0, 8)
  return \`\${clean.slice(0, RESOURCE_KEY_MAX - 9)}_\${h}\`
}
`)
rep('src/emit/translate.ts', [
  ["import type { EmitCtx } from './context.js'", "import type { EmitCtx } from './context.js'\nimport { toResourceKey } from './ids.js'"],
  ["      return { kind: 'resource', key: `blip.${ctx.bot}.${name}` }", "      return { kind: 'resource', key: toResourceKey(`blip.${ctx.bot}.${name}`) }"],
])
rep('src/emit/actions.ts', [
  ["import { slug } from './ids.js'", "import { resourceSlug, toResourceKey } from './ids.js'"],
  ["const target = alias?.targetImportedBotId ?? `{{resource.blip.link.${slug(address)}}}`", "const target = alias?.targetImportedBotId ?? `{{resource.${toResourceKey(`blip.link.${resourceSlug(address)}`)}}}`"],
  ["      if (SECRET_KEY.test(k) && value !== '' && !/^\{\{.*\}\}$/.test(value.trim())) {\n        const key = `blip.${ctx.bot}.${slug(k)}`", "      if (SECRET_KEY.test(k) && value !== '' && !value.includes('{{')) {\n        const key = toResourceKey(`blip.${ctx.bot}.${resourceSlug(k)}`)"],
  ["        value = `{{resource.${key}}}`\n      }\n      const t = translate(ctx, value, at)", "        value = `@@SECRET(${key})@@`\n      }\n      const t = translate(ctx, value, at)\n      t.text = t.text.replace(/@@SECRET\(([^)]+)\)@@/g, '{{resource.$1}}')"],
  ["      if (val === '' || /^\{\{.*\}\}$/.test(val.trim())) return whole\n      const key = `blip.${ctx.bot}.${slug(name)}${n++ ? `-${n}` : ''}`", "      if (val === '' || val.includes('{{')) return whole\n      const key = toResourceKey(`blip.${ctx.bot}.${resourceSlug(name)}${n++ ? `_${n}` : ''}`)"],
  ["      return `${pre1}{{resource.${key}}}${post}`", "      return `${pre1}@@SECRET(${key})@@${post}`"],
  ["  const bodyT = body === undefined ? undefined : translate(ctx, body, at)", "  const bodyT = body === undefined ? undefined : translate(ctx, body, at)\n  if (bodyT) bodyT.text = bodyT.text.replace(/@@SECRET\(([^)]+)\)@@/g, '{{resource.$1}}')"],
])
rep('src/validate/refs.ts', [
  ["        if (name === '' || name.startsWith('resource.') || name.startsWith('=')) continue", "        if (name.startsWith('resource.')) {\n          const key = name.slice('resource.'.length)\n          if (!/^[A-Za-z0-9_.]+$/.test(key) || key.length > 100) {\n            out.push(diagnostic('KAYROS_REFERENCE_INVALID', `Chave de Recurso invalida para o Kayros OS ([A-Za-z0-9_.], ate 100): ${key}`, ptr))\n          }\n          continue\n        }\n        if (name === '' || name.startsWith('=')) continue"],
])
rep('scripts/f5-status.ts', [["`blip.link.${x.address.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}`", "`${toResourceKey(`blip.link.${resourceSlug(x.address)}`)}`"], ["import { coverageTotals } from '../src/report/coverage.js'", "import { resourceSlug, toResourceKey } from '../src/emit/ids.js'\nimport { coverageTotals } from '../src/report/coverage.js'"]])
console.log('ok')
