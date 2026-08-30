import {
  CLASSES_JSON_KIND,
  CLASS_JSON_KIND,
  appendImportedClasses,
  exportClassesJson,
  importClassDataJson,
  normalizeClass,
} from '../src/localClassData.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const a = normalizeClass({
  name: 'Period 1',
  students: [{ id: 'stu_a', name: 'Ada' }, { id: 'stu_b', name: 'Bea' }],
  constraints: { neverApart: [['stu_a', 'stu_b']], alwaysTogether: [] },
  seatingAssignments: { '0-0': 'stu_a' },
  roomLayoutId: 'room_keep',
})

const allJson = exportClassesJson([a])
const parsedAll = JSON.parse(allJson)
assert(parsedAll.kind === CLASSES_JSON_KIND, 'all-classes kind')
assert(parsedAll.classes.length === 1, 'one class exported')
assert(!('roomLayouts' in parsedAll), 'class JSON should not embed rooms')

const oneJson = exportClassesJson([a], { single: true })
assert(JSON.parse(oneJson).kind === CLASS_JSON_KIND, 'single-class kind')

const { data, error } = importClassDataJson(allJson)
assert(!error, error || 'import ok')
assert(data.classes[0].name === 'Period 1', 'imported name')
assert(data.classes[0].students.length === 2, 'imported roster')
assert(data.classes[0].roomLayoutId === 'room_keep', 'keeps room id')

const v5 = JSON.stringify({
  version: 5,
  roomLayouts: [{ id: 'room_old', name: 'Lab', layout: { layout: 'custom', rows: 4, cols: 4, seatDefs: [], furniture: [], assignments: {} } }],
  classes: [{ name: 'Legacy', students: [{ name: 'Cara' }] }],
})
const legacy = importClassDataJson(v5)
assert(!legacy.error, legacy.error || 'v5 import')
assert(legacy.data.classes[0].name === 'Legacy', 'v5 class')
assert(legacy.data.roomLayouts[0].id === 'room_old', 'v5 rooms still parsed for Firestore upsert')

const merged = appendImportedClasses(data.classes, data.classes)
assert(merged.length === 2, 'append remaps colliding ids')
assert(merged[0].id !== merged[1].id, 'new class id')
assert(merged[0].students[0].id !== merged[1].students[0].id, 'new student ids')

console.log('class-json-qa: all assertions passed')
