import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  copySectionFromParent,
  mergeLayoutDocuments,
  mergeSectionAgainstParent,
  sectionPaintedFromSource,
  slotPaintedFromSource,
} from './inherit-merge'
import type { LayoutDocument, LayoutSection } from './types'

const parent: LayoutDocument = {
  version: 3,
  sections: [
    {
      id: 'header',
      label: 'Header',
      htmlId: 'g-header',
      cssClass: 'dark-header',
      containerMode: 'boxed',
      width: 80,
      order: 0,
      styles: { backgroundColor: '#111111', textColor: '#ffffff', padding: '1rem 1.5rem' },
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
    assert.equal(header.styles?.padding, '1rem 1.5rem')
    assert.equal(header.htmlId, 'g-header')
    assert.equal(header.cssClass, 'dark-header')
    assert.equal(header.containerMode, 'boxed')
    assert.equal(header.width, 80)
  })

  it('inherit stub does not keep local section settings', () => {
    const child: LayoutDocument = {
      version: 3,
      inheritFrom: 'parent',
      sections: [
        {
          id: 'header',
          label: 'Header',
          inheritMode: 'inherit',
          stylesInheritMode: 'inherit',
          order: 4,
          rows: [],
        },
      ],
    }
    const header = mergeLayoutDocuments(parent, child).sections.find((s) => s.id === 'header')
    assert.ok(header)
    assert.equal(header.label, 'Header')
    assert.equal(header.order, 4)
    assert.equal(header.htmlId, 'g-header')
    assert.equal(header.cssClass, 'dark-header')
    assert.equal(header.containerMode, 'boxed')
    assert.equal(header.width, 80)
    assert.equal(header.styles?.textColor, '#ffffff')
    assert.equal(header.rows[0]?.slots[0]?.moduleId, 'logo')
    assert.equal(header.rows[0]?.slots.length, 1)
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

  it('copySectionFromParent snapshots settings and particles as local', () => {
    const copied = copySectionFromParent(parent.sections[0]!)
    assert.equal(copied.inheritMode, 'local')
    assert.equal(copied.stylesInheritMode, 'local')
    assert.equal(copied.label, 'Header')
    assert.equal(copied.htmlId, 'g-header')
    assert.equal(copied.cssClass, 'dark-header')
    assert.equal(copied.containerMode, 'boxed')
    assert.equal(copied.width, 80)
    assert.equal(copied.styles?.backgroundColor, '#111111')
    assert.equal(copied.styles?.padding, '1rem 1.5rem')
    assert.equal(copied.rows[0]?.slots[0]?.inheritMode, 'local')
    assert.equal(copied.rows[0]?.slots[0]?.moduleId, 'logo')
    assert.equal(copied.rows[0]?.slots[0]?.config?.title, 'Parent Logo')
    assert.equal(copied.rows[0]?.slots[0]?.inheritFromSlotId, undefined)
  })

  it('paints section settings and particles from another layout', () => {
    const painted = sectionPaintedFromSource(
      {
        id: 'header',
        label: 'Renamed',
        inheritMode: 'inherit',
        inheritFromOutlineId: 'events',
        order: 3,
        rows: [],
      },
      parent.sections[0]!,
    )
    assert.equal(painted.label, 'Renamed')
    assert.equal(painted.order, 3)
    assert.equal(painted.htmlId, 'g-header')
    assert.equal(painted.containerMode, 'boxed')
    assert.equal(painted.styles?.backgroundColor, '#111111')
    assert.equal(painted.rows[0]?.slots[0]?.config?.title, 'Parent Logo')
    assert.equal(painted.inheritFromOutlineId, undefined)
    assert.equal(painted.inheritMode, undefined)
  })

  it('paints a particle from another layout and keeps this slot id', () => {
    const source = parent.sections[0]!.rows[0]!.slots[0]!
    const painted = slotPaintedFromSource(
      {
        id: 'header-logo',
        moduleId: 'logo',
        width: 40,
        order: 1,
        inheritMode: 'inherit',
        inheritFromOutlineId: 'events',
      },
      source,
    )
    assert.equal(painted.id, 'header-logo')
    assert.equal(painted.width, 40)
    assert.equal(painted.order, 1)
    assert.equal(painted.config?.title, 'Parent Logo')
    assert.equal(painted.inheritFromOutlineId, undefined)
    assert.equal(painted.inheritMode, undefined)
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

  it('inherits type until the child sets its own', () => {
    const withType: LayoutDocument = {
      ...parent,
      styles: {
        typography: { titleFont: 'georgia', linkColor: '#a85220', linkHoverColor: '#f2a66a' },
      },
    }
    const child: LayoutDocument = {
      version: 3,
      inheritFrom: 'base',
      sections: [],
    }
    const merged = mergeLayoutDocuments(withType, child)
    assert.equal(merged.styles?.typography?.titleFont, 'georgia')
    assert.equal(merged.styles?.typography?.linkHoverColor, '#f2a66a')

    const optedOut: LayoutDocument = {
      version: 3,
      sections: [],
      styles: { typography: { disabled: true } },
    }
    const blocked = mergeLayoutDocuments(withType, optedOut)
    assert.equal(blocked.styles?.typography?.disabled, true)
    assert.equal(blocked.styles?.typography?.titleFont, undefined)
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
