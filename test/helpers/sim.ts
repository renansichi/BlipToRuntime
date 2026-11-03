import { createContext, runInContext } from 'node:vm'

// Simulador de cenarios para TESTES ISOLADOS (F3-07). Executa o documento
// Kayros emitido com entradas e respostas HTTP EXPLICITAS: chamada sem fixture
// e erro, nunca "sucesso generico". Interpreta so o subconjunto de blocos que o
// conversor emite. Vive em test/ porque executa o JS dos scripts de origem
// (node:vm), o que o codigo do conversor nunca faz.

interface Doc {
  groups: { id: string; title: string; blocks: Block[] }[]
  edges: { id: string; from: Record<string, string>; to: { groupId: string; blockId?: string } }[]
  events: { id: string; type: string; outgoingEdgeId?: string }[]
  variables: { id: string; name: string }[]
}
interface Block {
  id: string
  type: string
  options?: Record<string, any>
  items?: { id: string; content?: any; outgoingEdgeId?: string }[]
  outgoingEdgeId?: string
}

export interface HttpFixture {
  method?: string
  /** Trecho que a URL (ja interpolada) deve conter. */
  urlIncludes: string
  status: number
  body?: unknown
}
export type Step = string | { timeout: true } | { flowResponse: unknown }
export interface Scenario {
  id: string
  title: string
  startAt?: string
  /** Inicia em um grupo pelo id (teste diferencial). */
  startGroupId?: string
  /** Resposta HTTP automatica (SO para teste diferencial entre duas emissoes do mesmo fluxo). */
  httpAuto?: (method: string, url: string) => { status: number; body?: unknown }
  /** Limite de passos antes de desistir (padrao 20000). */
  maxSteps?: number
  /** Encerra ao entrar no N-esimo estado da trilha (comparavel entre emissoes diferentes do mesmo fluxo). */
  maxTrail?: number
  vars?: Record<string, string>
  resources?: Record<string, string>
  input: Step[]
  http: HttpFixture[]
  stopAt?: string
}
export interface Trace {
  groups: string[]
  messages: { action: string; text: string; buttons?: string[] }[]
  http: { method: string; url: string; body?: string }[]
  events: { name: string; payload: Record<string, string> }[]
  links: { typebotId: string }[]
  end: { kind: 'suspended' | 'stopAt' | 'ended' | 'link' | 'queue' | 'flow-end' | 'error'; detail?: string }
  vars: Record<string, string>
  visitedBlocks: Set<string>
  missingResources: Set<string>
}

// Relogio fixo: scripts que gravam data/hora ficam deterministicos entre execucoes comparaveis.
const FIXED_NOW = 1_700_000_000_000
class FixedDate extends Date {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(FIXED_NOW)
    else super(...(args as [number]))
  }
  static override now(): number {
    return FIXED_NOW
  }
}

const base = (t: string) => t.split(' · ')[0] as string
const PH = /\{\{([^{}]*)\}\}/g

export function simulate(doc: Doc, sc: Scenario): Trace {
  const vars = new Map<string, string>(Object.entries(sc.vars ?? {}))
  const declared = new Set(doc.variables.map((v) => v.name))
  const byId = new Map(doc.variables.map((v) => [v.id, v.name]))
  const groups = new Map(doc.groups.map((g) => [g.id, g]))
  const edges = new Map(doc.edges.map((e) => [e.id, e]))
  const t: Trace = {
    groups: [], messages: [], http: [], events: [], links: [], end: { kind: 'flow-end' },
    vars: {}, visitedBlocks: new Set(), missingResources: new Set(),
  }
  const fixtures = [...sc.http]
  const inputs = [...sc.input]

  const interp = (s: string): string =>
    s.replace(PH, (_w, n: string) => {
      const name = n.trim()
      if (name.startsWith('resource.')) {
        const key = name.slice('resource.'.length)
        if (!(key in (sc.resources ?? {}))) t.missingResources.add(key)
        return sc.resources?.[key] ?? ''
      }
      return vars.get(name) ?? ''
    })

  const compare = (op: string, left: string, value: string): boolean => {
    const num = (x: string) => Number(x)
    switch (op) {
      case 'Is set': return left !== ''
      case 'Is empty': return left === ''
      case 'Equal to': return left === value
      case 'Not equal': return left !== value
      case 'Contains': return left.includes(value)
      case 'Does not contain': return !left.includes(value)
      case 'Starts with': return left.startsWith(value)
      case 'Ends with': return left.endsWith(value)
      case 'Matches regex': return new RegExp(value).test(left)
      case 'Does not match regex': return !new RegExp(value).test(left)
      case 'Greater than': return num(left) > num(value)
      case 'Greater or equal to': return num(left) >= num(value)
      case 'Less than': return num(left) < num(value)
      case 'Less or equal to': return num(left) <= num(value)
      default: throw new Error(`operador desconhecido: ${op}`)
    }
  }
  const holds = (content: any): boolean => {
    const comps: any[] = content?.comparisons ?? []
    const res = comps.map((c) => compare(c.comparisonOperator, vars.get(byId.get(c.variableId) ?? '') ?? '', c.value ?? ''))
    // Builder do Goatable: uma branch dispara quando TODAS as comparacoes passam; OR = varias branches (docs/aprendizados-builder-goatable.md).
    return res.length > 0 && res.every(Boolean)
  }

  // Um contexto por simulacao (criar um por bloco e caro); cada Code roda dentro de uma funcao,
  // entao `const`/`function` do script nao colidem entre blocos.
  const sandbox: Record<string, unknown> = {
    Math: Object.assign(Object.create(Math), { random: () => 0.37 }),
    JSON, String, Number, RegExp, Date: FixedDate, parseInt, parseFloat, isNaN,
  }
  const ctx = createContext(sandbox)
  const runCode = (src: string) => {
    // Placeholders de Code viram literais de texto (o Kayros os troca por valores/identificadores).
    const code = src.replace(PH, (_w, n: string) => {
      const name = n.trim()
      return JSON.stringify(name.startsWith('resource.') ? interp(`{{${name}}}`) : vars.get(name) ?? '')
    })
    const setVariable = (name: string, value: unknown) => {
      if (declared.has(name)) vars.set(name, value === undefined || value === null ? '' : String(value))
    }
    sandbox.setVariable = setVariable
    runInContext(`(function () {
${code}
})()`, ctx, { timeout: 2000 })
  }

  let pos: { g: string; i: number } | undefined
  const enter = (groupId: string, blockId?: string) => {
    const g = groups.get(groupId)
    if (!g) throw new Error(`grupo inexistente ${groupId}`)
    const title = base(g.title)
    if (t.groups[t.groups.length - 1] !== title) {
      t.groups.push(title)
      if (sc.maxTrail !== undefined && t.groups.length > sc.maxTrail) {
        pos = undefined
        trailLimit = true
        return
      }
    }
    pos = { g: groupId, i: blockId ? Math.max(0, g.blocks.findIndex((b) => b.id === blockId)) : 0 }
  }
  const follow = (edgeId: string) => {
    const e = edges.get(edgeId)
    if (!e) throw new Error(`aresta inexistente ${edgeId}`)
    enter(e.to.groupId, e.to.blockId)
  }
  const advance = (b: Block) => {
    if (b.outgoingEdgeId) follow(b.outgoingEdgeId)
    else (pos as { i: number }).i++
  }

  let pending: Block | undefined
  let trailLimit = false
  const finish = (kind: Trace['end']['kind'], detail?: string) => {
    t.end = detail === undefined ? { kind } : { kind, detail }
    t.vars = Object.fromEntries(vars)
  }

  // Ponto de partida: evento start, ou grupo informado (isolar o recorte).
  if (sc.startGroupId) {
    enter(sc.startGroupId)
  } else if (sc.startAt) {
    const g = doc.groups.find((x) => x.title === sc.startAt)
    if (!g) throw new Error(`startAt inexistente: ${sc.startAt}`)
    enter(g.id)
  } else {
    const first = typeof inputs[0] === 'string' ? (inputs.shift() as string) : ''
    vars.set('last_message', first)
    follow(doc.events.find((e) => e.type === 'start')?.outgoingEdgeId as string)
  }

  for (let steps = 0; steps < (sc.maxSteps ?? 20000); steps++) {
    if (trailLimit) return (finish('error', 'LIMITE_DE_TRILHA'), t)
    if (!pos) break
    const g = groups.get(pos.g) as Doc['groups'][number]
    if (sc.stopAt && base(g.title) === sc.stopAt && pos.i === 0 && t.groups.length > 1) return (finish('stopAt', sc.stopAt), t)
    const b = g.blocks[pos.i]
    if (!b) return (finish('flow-end', base(g.title)), t)
    t.visitedBlocks.add(b.id)
    try {
      switch (b.type) {
        case 'Set variable': {
          const o = b.options ?? {}
          if (o.isCode === true) {
            // Modo codigo: roda como um Code (retrato das variaveis na entrada; o retorno nao e usado: comportamento do alvo nao verificado).
            runCode(o.expressionToEvaluate ?? '')
            advance(b)
            break
          }
          const name = byId.get(o.variableId) as string
          vars.set(name, o.type === 'Empty' ? '' : interp(o.expressionToEvaluate ?? ''))
          advance(b)
          break
        }
        case 'Code':
          runCode(b.options?.content ?? '')
          advance(b)
          break
        case 'Condition': {
          const item = (b.items ?? []).find((it) => holds(it.content))
          if (item?.outgoingEdgeId) follow(item.outgoingEdgeId)
          else if (item) throw new Error('ramo sem aresta')
          else advance(b)
          break
        }
        case 'Webhook': {
          const w = b.options?.webhook
          const url = interp(w.url)
          const body = w.body === undefined ? undefined : interp(w.body)
          const method = String(w.method ?? 'GET')
          t.http.push(body === undefined ? { method, url } : { method, url, body })
          const i = fixtures.findIndex((f) => url.includes(f.urlIncludes) && (!f.method || f.method === method))
          if (i < 0 && !sc.httpAuto) return (finish('error', `FIXTURE_MISSING ${method} ${url}`), t)
          const f = i >= 0 ? (fixtures.splice(i, 1)[0] as HttpFixture) : ({ urlIncludes: '', ...(sc.httpAuto as NonNullable<Scenario['httpAuto']>)(method, url) } as HttpFixture)
          vars.set('api_status', String(f.status))
          vars.set('api_response', typeof f.body === 'string' ? f.body : f.body === undefined ? '' : JSON.stringify(f.body))
          vars.set('api_ok', String(f.status >= 200 && f.status < 300))
          advance(b)
          break
        }
        case 'journeyEvent': {
          const payload = Object.fromEntries((b.options?.payload ?? []).map((p: any) => [p.key, interp(p.value ?? '')]))
          t.events.push({ name: interp(b.options?.eventName ?? ''), payload })
          advance(b)
          break
        }
        case 'whatsapp-cloud': {
          const o = b.options ?? {}
          const text = interp(String(o.body ?? o.bodyText ?? o.payload ?? o.caption ?? ''))
          const buttons = [...(o.buttons ?? []), ...(o.sections ?? []).flatMap((s: any) => s.rows ?? [])].map((x: any) => interp(x.title))
          t.messages.push(buttons.length ? { action: o.action, text, buttons } : { action: o.action, text })
          if (o.awaitReply) {
            pending = b
            const next = inputs.shift()
            if (next === undefined) return (finish('suspended', base(g.title)), t)
            if (typeof next === 'object' && 'flowResponse' in next) {
              // Retorno estruturado de um WhatsApp Flow: grava flow_response (spec 7.6).
              const raw = JSON.stringify(next.flowResponse)
              vars.set('flow_response', raw)
              vars.set(byId.get(o.replyVariableId) as string, raw)
              vars.set('last_message', raw)
            } else if (typeof next === 'object') {
              // Sem resposta no prazo: o follow-up desvia para o evento followUp.
              const fu = doc.events.find((e) => e.type === 'followUp')
              if (!o.followUp?.isEnabled || !fu?.outgoingEdgeId) return (finish('error', 'TIMEOUT_SEM_FOLLOWUP'), t)
              follow(fu.outgoingEdgeId)
              break
            }
            if (typeof next === 'string') {
              vars.set(byId.get(o.replyVariableId) as string, next)
              vars.set('last_message', next)
            }
          }
          advance(b)
          break
        }
        case 'Typebot link':
          t.links.push({ typebotId: interp(b.options?.typebotId ?? '') })
          return (finish('link', interp(b.options?.typebotId ?? '')), t)
        case 'transferToQueue':
          return (finish('queue', b.options?.queueId), t)
        case 'endSession':
          return (finish('ended', b.options?.reason), t)
        case 'Jump':
          enter(b.options?.groupId, b.options?.blockId)
          break
        default:
          return (finish('error', `bloco sem simulacao: ${b.type}`), t)
      }
    } catch (e) {
      return (finish('error', (e as Error).message), t)
    }
  }
  void pending
  return (finish('error', 'LIMITE_DE_PASSOS'), t)
}
