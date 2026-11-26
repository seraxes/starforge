import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyRowContainerPatch,
  lineContainerMode,
  packSectionsIntoLines,
  syncRowContainers,
} from './row-container'
import type { LayoutRowContainer } from './types'

const seq = () => {
  let n = 0
  return () => `rowc-${++n}`
}

describe('packSectionsIntoLines', () => {
  it('keeps a full-width section on its own line', () => {
    const lines = packSectionsIntoLines([
      { id: 'a', width: 100 },
      { id: 'b', width: 40 },
    ])
    assert.deepEqual(
      lines.map((line) => line.sections.map((section) => section.id)),
      [['a'], ['b']],
    )
  })

  it('groups partial widths that share one line', () => {
    const lines = packSectionsIntoLines([
      { id: 'left', width: 20 },
      { id: 'main', width: 60 },
      { id: 'right', width: 20 },
      { id: 'footer', width: 100 },
    ])
    assert.deepEqual(
      lines.map((line) => line.sections.map((section) => section.id)),
      [['left', 'main', 'right'], ['footer']],
    )
  })

  it('starts a new line when the next width would pass 100', () => {
    const lines = packSectionsIntoLines([
      { id: 'a', width: 60 },
      { id: 'b', width: 50 },
      { id: 'c', width: 40 },
      { id: 'd', width: 40 },
    ])
    assert.deepEqual(
      lines.map((line) => line.sections.map((section) => section.id)),
      [['a'], ['b', 'c'], ['d']],
    )
  })
})

describe('syncRowContainers', () => {
  it('creates a container for a new side-by-side line and copies a shared mode', () => {
    const containers = syncRowContainers(
      [
        { id: 'left', width: 20, containerMode: 'boxed' },
        { id: 'right', width: 80, containerMode: 'boxed' },
      ],
      undefined,
      { createMissing: true, createId: seq() },
    )
    assert.equal(containers?.length, 1)
    assert.deepEqual(containers?.[0]?.sectionIds, ['left', 'right'])
    assert.equal(containers?.[0]?.label, 'Container')
    assert.equal(containers?.[0]?.containerMode, 'boxed')
    assert.equal(containers?.[0]?.id, 'rowc-1')
  })

  it('keeps settings when a member leaves and drops the container when the line dissolves', () => {
    const saved: LayoutRowContainer[] = [
      {
        id: 'rowc-1',
        label: 'Band',
        sectionIds: ['left', 'main', 'right'],
        containerMode: 'full',
        styles: { backgroundColor: '#111111' },
      },
    ]
    const kept = syncRowContainers(
      [
        { id: 'left', width: 40 },
        { id: 'main', width: 60 },
      ],
      saved,
      { createMissing: true, createId: seq() },
    )
    assert.equal(kept?.length, 1)
    assert.equal(kept?.[0]?.id, 'rowc-1')
    assert.equal(kept?.[0]?.label, 'Band')
    assert.equal(kept?.[0]?.styles?.backgroundColor, '#111111')
    assert.deepEqual(kept?.[0]?.sectionIds, ['left', 'main'])

    const dropped = syncRowContainers([{ id: 'left', width: 100 }], saved, {
      createMissing: true,
      createId: seq(),
    })
    assert.equal(dropped, undefined)
  })
})

describe('applyRowContainerPatch', () => {
  const sections = [
    { id: 'left', width: 20 },
    { id: 'main', width: 60 },
    { id: 'right', width: 20 },
  ]

  it('saves basic settings onto the row container', () => {
    const result = applyRowContainerPatch(sections, undefined, {
      sectionIds: ['left', 'main', 'right'],
      patch: { label: 'Columns', containerMode: 'boxed', backgroundColor: '#abcdef' },
    }, seq())
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.containers[0]?.label, 'Columns')
    assert.equal(result.containers[0]?.containerMode, 'boxed')
    assert.equal(result.containers[0]?.styles?.backgroundColor, '#abcdef')
    assert.equal(result.containers[0]?.id, 'rowc-1')
  })

  it('rejects a container when the sections are not on one line', () => {
    const result = applyRowContainerPatch(
      [{ id: 'only', width: 100 }],
      undefined,
      { sectionIds: ['only'], patch: { label: 'Nope' } },
      seq(),
    )
    assert.deepEqual(result, {
      ok: false,
      error: 'These sections are not side by side on one row.',
    })
  })

  it('rejects an empty container name', () => {
    const result = applyRowContainerPatch(
      sections,
      undefined,
      { sectionIds: ['left', 'main', 'right'], patch: { label: '   ' } },
      seq(),
    )
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error, 'Container name is required.')
  })
})

describe('lineContainerMode', () => {
  it('uses the saved container mode and ignores member modes', () => {
    assert.equal(
      lineContainerMode(
        { id: 'rowc-1', label: 'Container', sectionIds: ['a', 'b'], containerMode: 'full' },
        [{ containerMode: 'boxed' }, { containerMode: 'boxed' }],
      ),
      'full',
    )
  })

  it('falls back to a shared member mode when no container is stored yet', () => {
    assert.equal(
      lineContainerMode(undefined, [{ containerMode: 'boxed' }, { containerMode: 'boxed' }]),
      'boxed',
    )
    assert.equal(
      lineContainerMode(undefined, [{ containerMode: 'boxed' }, { containerMode: 'full' }]),
      undefined,
    )
  })
})
