import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  copySectionFromParent,
  mergeLayoutDocuments,
  mergeSectionAgainstParent,
} from './inherit-merge'
import type { LayoutDocument, LayoutSection } from './types'

const parent: LayoutDocument = {
  version: 3,
  sections: [
    {
      id: 'header',
      label: 'Header',
      order: 0,
      styles: { backgroundColor: '#111111', textColor: '#ffffff' },
      rows: [
        {
          id: 'h1',
          order: 0,
          slots: [
            {
              id: 'logo',
              moduleId: 'logo',
              width: 100,
              config: { title: 'Parent Logo' },
            },
          ],
        },
      ],
    },
    {
      id: 'navigation',
      label: 'Navigation',
      order: 1,
      rows: [{ id: 'n1', order: 0, slots: [{ id: 'menu', moduleId: 'menu', width: 100 }] }],
    },
    {
      id: 'main',
      label: 'Main',
      order: 2,
      styles: { backgroundColor: '#222222' },
      rows: [
        {
          id: 'm1',
          order: 0,
          slots: [{ id: 'pc', moduleId: 'page-content', width: 100 }],
        },
      ],
    },
    {
      id: 'footer',
      label: 'Footer',
      order: 3,
      styles: { backgroundColor: '#333333' },
      rows: [
        {
          id: 'f1',
          order: 0,
          slots: [{ id: 'copy', moduleId: 'copyright', width: 100 }],
        },
      ],
    },
  ],
}

describe('mergeLayoutDocuments', () => {
  it('inherits parent sections by absence and overrides by id (legacy local)', () => {
    const child: LayoutDocument = {
      version: 3,
      inheritFrom: 'parent',
      omitSectionIds: ['navigation'],
      sections: [
        {
          id: 'main',
          label: 'Offline main',
          order: 1,
          rows: [
            {
              id: 'om1',
              order: 0,
              slots: [{ id: 'pc', moduleId: 'page-content', width: 100 }],
            },
          ],
        },
      ],
    }
    const merged = mergeLayoutDocuments(parent, child)
    assert.deepEqual(
      merged.sections.map((s) => s.id),
      ['header', 'main', 'footer'],
    )
    assert.equal(merged.sections.find((s) => s.id === 'main')?.label, 'Offline main')
    assert.equal(merged.sections.find((s) => s.id === 'header')?.label, 'Header')
    assert.ok(!merged.sections.some((s) => s.id === 'navigation'))
  })

  it('inherit stub keeps parent rows and particles', () => {
    const child: LayoutDocument = {
      version: 3,
      inheritFrom: 'parent',
      sections: [
        {
          id: 'header',
          label: 'Header override label',
          inheritMode: 'inherit',
          order: 0,
          rows: [],
        },
      ],
    }
    const merged = mergeLayoutDocuments(parent, child)
    const header = merged.sections.find((s) => s.id === 'header')
    assert.ok(header)
    assert.equal(header.label, 'Header override label')
    assert.equal(header.rows[0]?.slots[0]?.id, 'logo')
    assert.equal(header.rows[0]?.slots[0]?.config?.title, 'Parent Logo')
    assert.equal(header.styles?.backgroundColor, '#111111')
  })

  it('stylesInheritMode local keeps child styles on inherited structure', () => {
    const child: LayoutDocument = {
      version: 3,
      inheritFrom: 'parent',
      sections: [
        {
          id: 'header',
          label: 'Header',
          inheritMode: 'inherit',
          stylesInheritMode: 'local',
          styles: { backgroundColor: '#abcdef' },
          order: 0,
          rows: [],
        },
      ],
    }
    const merged = mergeLayoutDocuments(parent, child)
    const header = merged.sections.find((s) => s.id === 'header')
    assert.equal(header?.styles?.backgroundColor, '#abcdef')
    assert.equal(header?.rows[0]?.slots[0]?.moduleId, 'logo')
  })

  it('local section can inherit a particle from parent by slot id', () => {
    const child: LayoutDocument = {
      version: 3,
      inheritFrom: 'parent',
      sections: [
        {
          id: 'header',
          label: 'Header',
          inheritMode: 'local',
          stylesInheritMode: 'local',
          order: 0,
          rows: [
            {
              id: 'h1',
              order: 0,
              slots: [
                {
                  id: 'logo',
                  moduleId: 'logo',
                  width: 100,
                  inheritMode: 'inherit',
                  config: { title: 'Should be ignored' },
                },
              ],
            },
          ],
        },
      ],
    }
    const merged = mergeLayoutDocuments(parent, child)
    const logo = merged.sections.find((s) => s.id === 'header')?.rows[0]?.slots[0]
    assert.equal(logo?.config?.title, 'Parent Logo')
    assert.equal(logo?.inheritMode, undefined)
  })

  it('copySectionFromParent marks local ownership', () => {
    const copied = copySectionFromParent(parent.sections[0]!)
    assert.equal(copied.inheritMode, 'local')
    assert.equal(copied.stylesInheritMode, 'local')
    assert.equal(copied.rows[0]?.slots[0]?.inheritMode, 'local')
    assert.equal(copied.rows[0]?.slots[0]?.config?.title, 'Parent Logo')
  })

  it('inherits page background until the child sets its own', () => {
    const withBody: LayoutDocument = {
      ...parent,
      styles: {
        body: { backgroundMediaId: 'bg1', backgroundImage: '/media/bg.webp' },
      },
    }
    const child: LayoutDocument = {
      version: 3,
      inheritFrom: 'base',
      sections: [],
    }
    const merged = mergeLayoutDocuments(withBody, child)
    assert.equal(merged.styles?.body?.backgroundMediaId, 'bg1')

    const optedOut: LayoutDocument = {
      version: 3,
      sections: [],
      styles: { body: { disabled: true } },
    }
    const blocked = mergeLayoutDocuments(withBody, optedOut)
    assert.equal(blocked.styles?.body?.disabled, true)
    assert.equal(blocked.styles?.body?.backgroundMediaId, undefined)
  })
})

describe('mergeSectionAgainstParent', () => {
  it('defaults present section without mode to local rows', () => {
    const parentSection = parent.sections.find((s) => s.id === 'main') as LayoutSection
    const child: LayoutSection = {
      id: 'main',
      label: 'Child main',
      order: 2,
      rows: [
        {
          id: 'x',
          order: 0,
          slots: [{ id: 'pc', moduleId: 'page-content', width: 50 }],
        },
      ],
    }
    const merged = mergeSectionAgainstParent(parentSection, child)
    assert.equal(merged.rows[0]?.slots[0]?.width, 50)
    assert.equal(merged.label, 'Child main')
  })
})
