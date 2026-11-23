// A superset's own name and its rest between rounds (#292). Carried on every member of the group
// (`sgName`, `sgRest` on a routine exercise, so on an entry's `target` once a session starts):
// a reorder, a member taken out or the routine copied into a session keeps them without a second
// structure to keep in step. The first member that has a value speaks for the group.
export const SG_NAME_MAX = 40

const fieldsOf = (item, onTarget) => (onTarget ? item?.target : item) || {}

/** { name, rest } of the group of `unit` (indices into `list`); `onTarget` for session entries. */
export function supersetMeta(list, unit, { onTarget = false } = {}) {
  let name = '', rest = 0
  for (const idx of unit || []) {
    const f = fieldsOf(list?.[idx], onTarget)
    if (!name && typeof f.sgName === 'string' && f.sgName.trim()) name = f.sgName.trim().slice(0, SG_NAME_MAX)
    if (!rest && Number(f.sgRest) > 0) rest = Math.round(Number(f.sgRest))
  }
  return { name, rest }
}

/** Writes name and rest onto every member of group `sg` in a routine's `ex`; empty clears. */
export function setSupersetMeta(ex, sg, { name = '', rest = 0 } = {}) {
  const clean = String(name || '').trim().slice(0, SG_NAME_MAX)
  const sec = Number(rest) > 0 ? Math.round(Number(rest)) : 0
  for (const e of ex || []) {
    if (!e || !sg || e.sg !== sg) continue
    if (clean) e.sgName = clean; else delete e.sgName
    if (sec) e.sgRest = sec; else delete e.sgRest
  }
  return ex
}

/** A member that joined or left a group: it takes the group's meta, or drops what it carried. */
export function syncSupersetMeta(ex) {
  const groups = new Map()
  for (const e of ex || []) {
    if (!e?.sg) { if (e) { delete e.sgName; delete e.sgRest; delete e.sgCircuit }; continue }
    const g = groups.get(e.sg) || { name: '', rest: 0, circuit: null }
    if (!g.name && e.sgName) g.name = e.sgName
    if (!g.rest && Number(e.sgRest) > 0) g.rest = Number(e.sgRest)
    // A circuit (lib/circuit.js) follows its members the same way: one that joins takes it.
    if (!g.circuit && e.sgCircuit && typeof e.sgCircuit === 'object') g.circuit = e.sgCircuit
    groups.set(e.sg, g)
  }
  for (const [sg, g] of groups) {
    setSupersetMeta(ex, sg, g)
    for (const e of ex) if (e?.sg === sg) { if (g.circuit) e.sgCircuit = { ...g.circuit }; else delete e.sgCircuit }
  }
  return ex
}

/**
 * Superset labels a description gives, one per exercise ("A" on a bench press and a row), as
 * groups: exercises next to each other with the same label are one superset. For the MCP write
 * tools (routine-write.js, log-workout.js), where the model names groups instead of linking slots.
 * A label is a string (trimmed); '' or null means not in a superset; undefined means not said (an
 * edit keeps the slot's own). → { groups: [k | null | undefined per exercise], problems }, k
 * counting the supersets from 0 in order. A label split by another exercise, or worn by one
 * exercise alone, is a problem: the app's superset is a run of two or more neighbours.
 */
export function supersetGroups(labels, field = 'exercises') {
  const problems = []
  const groups = []
  const seen = new Map() // label → { k, last index, count }
  let prev = null
  ;(labels || []).forEach((raw, i) => {
    if (raw === undefined) { groups.push(undefined); prev = null; return }
    const label = typeof raw === 'string' ? raw.trim().slice(0, SG_NAME_MAX) : raw == null ? '' : String(raw).trim().slice(0, SG_NAME_MAX)
    if (!label) { groups.push(null); prev = null; return }
    const g = seen.get(label)
    if (g && prev !== label) {
      problems.push({ field: `${field}[${i}].superset`, problem: `the exercises of superset "${label}" must be next to each other` })
      groups.push(null)
      prev = null
      return
    }
    if (!g) seen.set(label, { k: seen.size, first: i, count: 1 })
    else g.count++
    groups.push(seen.get(label).k)
    prev = label
  })
  for (const [label, g] of seen) {
    if (g.count < 2) problems.push({ field: `${field}[${g.first}].superset`, problem: `superset "${label}" has one exercise; give the same label to the exercise next to it, or leave the label out` })
  }
  return { groups, problems }
}
