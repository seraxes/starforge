'use client'

import React, { useState } from 'react'

import {
  MEDIA_CATEGORY_MAX_DEPTH,
  MEDIA_FORMS_CATEGORY_SLUG,
  type MediaCategoryNode,
} from '@/core/media/categories'

type Props = {
  tree: MediaCategoryNode[]
  activeId: string
  busy?: boolean
  onSelect: (id: string) => void
  onCreate: (input: { title: string; parentId: string | null }) => void
  onRename: (input: { id: string; title: string }) => void
  onDelete: (id: string) => void
}

function TreeNode({
  node,
  activeId,
  busy,
  depth,
  expanded,
  toggle,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  node: MediaCategoryNode
  activeId: string
  busy?: boolean
  depth: number
  expanded: Set<string>
  toggle: (id: string) => void
  onSelect: (id: string) => void
  onCreate: (input: { title: string; parentId: string | null }) => void
  onRename: (input: { id: string; title: string }) => void
  onDelete: (id: string) => void
}) {
  const current = activeId === node.id
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)
  const canNest = node.depth < MEDIA_CATEGORY_MAX_DEPTH
  const reserved = node.slug === MEDIA_FORMS_CATEGORY_SLUG

  return (
    <li>
      <div
        className={`sf-media-tree-row${current ? ' is-current' : ''}`}
        style={{ paddingLeft: `${0.35 + depth * 0.75}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="sf-media-tree-toggle"
            aria-expanded={isOpen}
            aria-label={isOpen ? `Collapse ${node.title}` : `Expand ${node.title}`}
            disabled={busy}
            onClick={() => toggle(node.id)}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="sf-media-tree-toggle is-leaf" aria-hidden="true" />
        )}
        <button
          type="button"
          className={`sf-media-folder-item${current ? ' is-current' : ''}`}
          disabled={busy}
          aria-current={current ? 'page' : undefined}
          onClick={() => onSelect(node.id)}
        >
          {node.title}
        </button>
        <div className="sf-media-tree-actions">
          {canNest ? (
            <button
              type="button"
              className="sf-media-tree-action"
              disabled={busy}
              title="New subfolder"
              aria-label={`New subfolder under ${node.title}`}
              onClick={() => {
                const title = window.prompt('New subfolder name')
                if (!title?.trim()) return
                onCreate({ title: title.trim(), parentId: node.id })
              }}
            >
              +
            </button>
          ) : null}
          <button
            type="button"
            className="sf-media-tree-action"
            disabled={busy}
            title="Rename"
            aria-label={`Rename ${node.title}`}
            onClick={() => {
              const title = window.prompt('Rename folder', node.title)
              if (!title?.trim() || title.trim() === node.title) return
              onRename({ id: node.id, title: title.trim() })
            }}
          >
            ✎
          </button>
          {!reserved ? (
            <button
              type="button"
              className="sf-media-tree-action"
              disabled={busy}
              title="Delete"
              aria-label={`Delete ${node.title}`}
              onClick={() => {
                if (!window.confirm(`Delete folder “${node.title}”? It must be empty.`)) return
                onDelete(node.id)
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      {hasChildren && isOpen ? (
        <ul className="sf-media-folder-list sf-media-tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              activeId={activeId}
              busy={busy}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              onSelect={onSelect}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * Nested Categories sidebar — expand/collapse + create/rename/delete.
 */
export function MediaCategoryTree({
  tree,
  activeId,
  busy,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const open = new Set<string>()
    const markAncestors = (nodes: MediaCategoryNode[], trail: string[]) => {
      for (const n of nodes) {
        if (n.id === activeId || n.children.some((c) => containsId(c, activeId))) {
          for (const id of trail) open.add(id)
          open.add(n.id)
        }
        if (n.children.length) markAncestors(n.children, [...trail, n.id])
      }
    }
    markAncestors(tree, [])
    return open
  })

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="sf-media-folder-nav" aria-label="Media folders">
      <h3 className="admin-settings-panel-title">Folders</h3>
      <ul className="sf-media-folder-list">
        <li>
          <div className={`sf-media-tree-row${activeId === 'all' ? ' is-current' : ''}`}>
            <span className="sf-media-tree-toggle is-leaf" aria-hidden="true" />
            <button
              type="button"
              className={`sf-media-folder-item${activeId === 'all' ? ' is-current' : ''}`}
              disabled={busy}
              aria-current={activeId === 'all' ? 'page' : undefined}
              onClick={() => onSelect('all')}
            >
              All media
            </button>
          </div>
        </li>
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            activeId={activeId}
            busy={busy}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            onSelect={onSelect}
            onCreate={onCreate}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </ul>
      <div className="sf-media-tree-create-root">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={() => {
            const title = window.prompt('New root folder name')
            if (!title?.trim()) return
            onCreate({ title: title.trim(), parentId: null })
          }}
        >
          New folder
        </button>
      </div>
    </aside>
  )
}

function containsId(node: MediaCategoryNode, id: string): boolean {
  if (node.id === id) return true
  return node.children.some((c) => containsId(c, id))
}
