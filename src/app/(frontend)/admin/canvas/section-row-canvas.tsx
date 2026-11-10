'use client'

/**
 * The one section / row / percent-slot canvas.
 * Layout uses it with a particle palette and layout chrome.
 * The Form builder uses it with a field palette and the field cog.
 * Do not fork a second drag stack.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  clampGridWidth,
  gridWidthPercent,
  LAYOUT_WIDTH_FULL,
  LAYOUT_WIDTH_MIN,
  mosaicParticleBarDropEdge,
  mosaicSectionDropEdge,
  resizeAdjacentPair,
} from '@/core/modules/grid'

import {
  DND_CANVAS_ROW,
  DND_CANVAS_SECTION,
  DND_CANVAS_SLOT,
  dataTransferHasAny,
  dataTransferHasType,
  encodeCanvasItemDrag,
  encodeCanvasRowDrag,
  insertIndex,
  moveIdInOrder,
  parseCanvasItemDrag,
  parseCanvasRowDrag,
  readPaletteValue,
  type CanvasItemDrag,
} from './section-row-drag'

export type CanvasItem = {
  id: string
  width: number
}

export type CanvasRowModel = {
  id: string
  items: CanvasItem[]
}

export type CanvasItemContext = {
  sectionId: string
  rowId: string
  percent: number
}

export type SectionDragBind = {
  isDragging: boolean
  dropPosition: 'before' | 'after' | null
  placeBeside: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (position: 'before' | 'after', placeBeside: boolean) => void
  onDrop: (position: 'before' | 'after', placeBeside: boolean) => void
}

/** Interactive chrome that must not start a bar drag. */
function isCanvasDragIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, a, button, label, .gantry-slot-actions, .gantry-settings-trigger, .gantry-bar-remove, .gantry-settings-layer, .gantry-resize-handle',
    ),
  )
}

/**
 * HTML5 drag image: clone of the real bar at ~50% opacity.
 * Removed after the browser snapshots it. Never throws.
 */
function setHalfOpacityDragImage(event: React.DragEvent<HTMLElement>) {
  try {
    const src = event.currentTarget
    const rect = src.getBoundingClientRect()
    const ghost = src.cloneNode(true) as HTMLElement
    ghost.setAttribute('aria-hidden', 'true')
    ghost.style.position = 'fixed'
    ghost.style.top = '-10000px'
    ghost.style.left = '-10000px'
    ghost.style.width = `${Math.max(rect.width, 1)}px`
    ghost.style.height = `${Math.max(rect.height, 1)}px`
    ghost.style.opacity = '0.5'
    ghost.style.pointerEvents = 'none'
    ghost.style.margin = '0'
    ghost.style.zIndex = '10000'
    ghost.removeAttribute('draggable')
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(
      ghost,
      Math.max(0, event.clientX - rect.left),
      Math.max(0, event.clientY - rect.top),
    )
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ghost.remove())
    })
  } catch {
    // Browser may reject custom drag images; native drag continues.
  }
}

function ResizeHandle({
  left,
  right,
  label,
  onResize,
}: {
  left: CanvasItem
  right: CanvasItem
  label: string
  onResize: (leftWidth: number, rightWidth: number, commit: boolean) => void
}) {
  const dragging = useRef(false)

  return (
    <div
      className="gantry-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const handle = event.currentTarget
        const rowEl = handle.closest('.gantry-row-slots') as HTMLElement | null
        const leftEl = handle.previousElementSibling as HTMLElement | null
        if (!rowEl || !leftEl) return
        dragging.current = true
        handle.setPointerCapture(event.pointerId)
        const pairSum = left.width + right.width
        const rowRect = rowEl.getBoundingClientRect()
        const pairLeft = leftEl.getBoundingClientRect().left - rowRect.left
        let lastLeft = left.width
        let lastRight = right.width

        const onMove = (moveEvent: PointerEvent) => {
          if (!dragging.current) return
          const x = moveEvent.clientX - rowRect.left
          const pairWidthPx = Math.max(1, (pairSum / LAYOUT_WIDTH_FULL) * rowRect.width)
          const localX = x - pairLeft
          const newLeftPercent = (localX / pairWidthPx) * pairSum
          const [lw, rw] = resizeAdjacentPair(left.width, right.width, newLeftPercent)
          lastLeft = lw
          lastRight = rw
          onResize(lw, rw, false)
        }

        const onUp = (upEvent: PointerEvent) => {
          dragging.current = false
          handle.releasePointerCapture(upEvent.pointerId)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          onResize(lastLeft, lastRight, true)
        }

        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      }}
    />
  )
}

function CanvasSlot({
  sectionId,
  rowId,
  item,
  isDragging,
  dropEdge,
  className,
  title,
  dataAttrs,
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  sectionId: string
  rowId: string
  item: CanvasItem
  isDragging: boolean
  dropEdge: 'before' | 'after' | null
  className?: string
  title: string
  dataAttrs?: Record<string, string | undefined>
  children: React.ReactNode
  onDragStart: (payload: CanvasItemDrag) => void
  onDragEnd: () => void
  onDragOver: (edge: 'before' | 'after', placeBeside: boolean) => void
  onDrop: (payload: CanvasItemDrag) => void
}) {
  const percent = gridWidthPercent(item.width)
  const classNames = [
    'gantry-slot',
    'is-slot-grab',
    className ?? '',
    isDragging ? 'is-slot-dragging' : '',
    dropEdge === 'before' ? 'is-slot-drop-before' : '',
    dropEdge === 'after' ? 'is-slot-drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const extra: Record<string, string> = {}
  if (dataAttrs) {
    for (const [key, value] of Object.entries(dataAttrs)) {
      if (value != null) extra[key] = value
    }
  }

  return (
    <article
      className={classNames}
      data-sf-width={item.width}
      data-sf-slot={item.id}
      {...extra}
      draggable
      title={title}
      style={{
        flex: `${percent} 1 0`,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={(event) => {
        const el = event.currentTarget as HTMLElement
        el.draggable = !isCanvasDragIgnoredTarget(event.target)
      }}
      onMouseUp={(event) => {
        ;(event.currentTarget as HTMLElement).draggable = true
      }}
      onMouseLeave={(event) => {
        if (!isDragging) (event.currentTarget as HTMLElement).draggable = true
      }}
      onDragStart={(event) => {
        if (isCanvasDragIgnoredTarget(event.target)) {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).draggable = true
          return
        }
        const payload: CanvasItemDrag = { sectionId, rowId, itemId: item.id }
        event.dataTransfer.setData(DND_CANVAS_SLOT, encodeCanvasItemDrag(payload))
        event.dataTransfer.setData('text/plain', item.id)
        event.dataTransfer.effectAllowed = 'move'
        setHalfOpacityDragImage(event)
        onDragStart(payload)
      }}
      onDragEnd={(event) => {
        ;(event.currentTarget as HTMLElement).draggable = true
        onDragEnd()
      }}
      onDragOver={(event) => {
        if (!dataTransferHasType(event.dataTransfer, DND_CANVAS_SLOT)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        const rect = event.currentTarget.getBoundingClientRect()
        const edge = mosaicParticleBarDropEdge(event.clientX, event.clientY, rect)
        onDragOver(edge.position, edge.placeBeside)
      }}
      onDrop={(event) => {
        if (!dataTransferHasType(event.dataTransfer, DND_CANVAS_SLOT)) return
        event.preventDefault()
        event.stopPropagation()
        const payload = parseCanvasItemDrag(event.dataTransfer.getData(DND_CANVAS_SLOT))
        if (!payload) return
        onDrop(payload)
      }}
    >
      {children}
    </article>
  )
}

function CanvasDropRow({
  sectionId,
  row,
  paletteMimes,
  draggingItemId,
  itemDropHint,
  rowDropEdge,
  isDraggingRow,
  rowClassName,
  emptyRowClassName,
  slotsClassName,
  emptyMetaClassName,
  emptyMetaLabel,
  emptyZoneLabel,
  resizeLabel,
  renderItem,
  itemClassName,
  itemTitle,
  itemDataAttrs,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onReorderItems,
  onMoveItem,
  onStackItem,
  onPaletteDrop,
  onRemoveEmptyRow,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDrop,
  onResize,
  notice,
}: {
  sectionId: string
  row: CanvasRowModel
  paletteMimes: readonly string[]
  draggingItemId: string | null
  itemDropHint: { itemId: string; edge: 'before' | 'after' } | null
  rowDropEdge: 'before' | 'after' | null
  isDraggingRow: boolean
  rowClassName?: string
  emptyRowClassName?: string
  slotsClassName?: string
  emptyMetaClassName?: string
  emptyMetaLabel: string
  emptyZoneLabel: string
  resizeLabel: string
  renderItem: (item: CanvasItem, ctx: CanvasItemContext) => React.ReactNode
  itemClassName?: (item: CanvasItem, ctx: CanvasItemContext) => string
  itemTitle?: (item: CanvasItem, ctx: CanvasItemContext) => string
  itemDataAttrs?: (item: CanvasItem, ctx: CanvasItemContext) => Record<string, string | undefined>
  onItemDragStart: (payload: CanvasItemDrag) => void
  onItemDragEnd: () => void
  onItemDragOver: (itemId: string, edge: 'before' | 'after', placeBeside: boolean) => void
  onReorderItems: (orderedIds: string[]) => void
  onMoveItem: (source: CanvasItemDrag, index: number) => void
  onStackItem: (source: CanvasItemDrag, position: 'before' | 'after') => void
  onPaletteDrop: (mime: string, value: string) => void
  onRemoveEmptyRow: () => void
  onRowDragStart: () => void
  onRowDragEnd: () => void
  onRowDragOver: (edge: 'before' | 'after') => void
  onRowDrop: (edge: 'before' | 'after', source: CanvasRowDragSource) => void
  onResize: (leftId: string, rightId: string, leftWidth: number, rightWidth: number, commit: boolean) => void
  notice?: React.ReactNode
}) {
  const [dropActive, setDropActive] = useState(false)
  const [acceptingForeign, setAcceptingForeign] = useState(false)
  const items = row.items
  const isEmpty = items.length === 0

  const clearLocalDropUi = useCallback(() => {
    setAcceptingForeign(false)
    setDropActive(false)
  }, [])

  const finishItemDrag = useCallback(() => {
    clearLocalDropUi()
    onItemDragEnd()
  }, [clearLocalDropUi, onItemDragEnd])

  const handleItemDrop = useCallback(
    (targetItemId: string, payload: CanvasItemDrag) => {
      if (rowDropEdge) {
        finishItemDrag()
        onStackItem(payload, rowDropEdge)
        return
      }
      const edge = itemDropHint?.itemId === targetItemId ? itemDropHint.edge : 'after'
      const targetIndex = items.findIndex((item) => item.id === targetItemId)
      if (targetIndex < 0) {
        finishItemDrag()
        return
      }
      const fromIndex =
        payload.sectionId === sectionId && payload.rowId === row.id
          ? items.findIndex((item) => item.id === payload.itemId)
          : -1
      const dest = insertIndex(fromIndex, targetIndex, edge)
      if (dest == null) {
        finishItemDrag()
        return
      }
      if (fromIndex >= 0) {
        const next = moveIdInOrder(items, payload.itemId, dest, (item) => item.id)
        finishItemDrag()
        onReorderItems(next.map((item) => item.id))
        return
      }
      finishItemDrag()
      onMoveItem(payload, dest)
    },
    [
      finishItemDrag,
      itemDropHint,
      items,
      onMoveItem,
      onReorderItems,
      onStackItem,
      row.id,
      rowDropEdge,
      sectionId,
    ],
  )

  const rowClassNames = [
    'gantry-row',
    rowClassName ?? '',
    isEmpty ? (emptyRowClassName ?? '') : '',
    dropActive || acceptingForeign ? 'is-drop-target' : '',
    isDraggingRow ? 'is-row-dragging' : '',
    draggingItemId ? 'is-slot-dnd-active' : '',
    rowDropEdge === 'before' ? 'is-row-drop-before' : '',
    rowDropEdge === 'after' ? 'is-row-drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rowClassNames}
      data-sf-row={row.id}
      onDragOver={(event) => {
        if (
          !draggingItemId &&
          dataTransferHasType(event.dataTransfer, DND_CANVAS_ROW) &&
          !dataTransferHasType(event.dataTransfer, DND_CANVAS_SLOT)
        ) {
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'move'
          const rect = event.currentTarget.getBoundingClientRect()
          const mid = rect.top + rect.height / 2
          onRowDragOver(event.clientY < mid ? 'before' : 'after')
          return
        }
        if (dataTransferHasAny(event.dataTransfer, paletteMimes)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDropActive(true)
          return
        }
        if (dataTransferHasType(event.dataTransfer, DND_CANVAS_SLOT)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setAcceptingForeign(true)
          setDropActive(true)
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        clearLocalDropUi()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const slotPayload = parseCanvasItemDrag(event.dataTransfer.getData(DND_CANVAS_SLOT))
        if (slotPayload) {
          const sameRow = slotPayload.sectionId === sectionId && slotPayload.rowId === row.id
          const stackEdge = rowDropEdge
          finishItemDrag()
          if (stackEdge) {
            onStackItem(slotPayload, stackEdge)
            return
          }
          if (sameRow) return
          onMoveItem(slotPayload, items.length)
          return
        }
        const rowPayload = parseCanvasRowDrag(event.dataTransfer.getData(DND_CANVAS_ROW))
        if (rowPayload && rowPayload.sectionId === sectionId) {
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          const mid = rect.top + rect.height / 2
          onRowDrop(event.clientY < mid ? 'before' : 'after', {
            sectionId: rowPayload.sectionId,
            rowId: rowPayload.rowId,
          })
          return
        }
        const palette = readPaletteValue(event.dataTransfer, paletteMimes)
        clearLocalDropUi()
        if (!palette) return
        onPaletteDrop(palette.mime, palette.value)
      }}
    >
      {isEmpty ? (
        <div className={['gantry-row-meta', emptyMetaClassName ?? ''].filter(Boolean).join(' ')}>
          <span className="gantry-row-meta-label">{emptyMetaLabel}</span>
          <div className="gantry-row-actions">
            <button
              type="button"
              className="gantry-toolbar-btn secondary"
              title="Close empty drop row"
              onClick={onRemoveEmptyRow}
            >
              − row
            </button>
          </div>
        </div>
      ) : null}
      <div className={['gantry-row-slots', slotsClassName ?? ''].filter(Boolean).join(' ')}>
        {isEmpty ? (
          <div
            className="gantry-row-empty"
            draggable
            title="Drag empty row to reorder"
            onDragStart={(event) => {
              event.stopPropagation()
              const payload = { sectionId, rowId: row.id }
              event.dataTransfer.setData(DND_CANVAS_ROW, encodeCanvasRowDrag(payload))
              event.dataTransfer.setData('text/plain', row.id)
              event.dataTransfer.effectAllowed = 'move'
              setHalfOpacityDragImage(event)
              onRowDragStart()
            }}
            onDragEnd={(event) => {
              event.stopPropagation()
              onRowDragEnd()
            }}
          >
            {emptyZoneLabel}
          </div>
        ) : (
          items.map((item, index) => {
            const next = items[index + 1]
            const ctx: CanvasItemContext = {
              sectionId,
              rowId: row.id,
              percent: gridWidthPercent(item.width),
            }
            return (
              <React.Fragment key={item.id}>
                <CanvasSlot
                  sectionId={sectionId}
                  rowId={row.id}
                  item={item}
                  isDragging={draggingItemId === item.id}
                  dropEdge={
                    itemDropHint?.itemId === item.id && draggingItemId !== item.id
                      ? itemDropHint.edge
                      : null
                  }
                  className={itemClassName?.(item, ctx)}
                  title={
                    itemTitle?.(item, ctx) ??
                    'Drag this bar to move — blue line shows where it will land'
                  }
                  dataAttrs={itemDataAttrs?.(item, ctx)}
                  onDragStart={(payload) => {
                    setAcceptingForeign(false)
                    onItemDragStart(payload)
                  }}
                  onDragEnd={finishItemDrag}
                  onDragOver={(edge, placeBeside) => {
                    if (draggingItemId === item.id) return
                    setAcceptingForeign(placeBeside)
                    onItemDragOver(item.id, edge, placeBeside)
                  }}
                  onDrop={(payload) => handleItemDrop(item.id, payload)}
                >
                  {renderItem(item, ctx)}
                </CanvasSlot>
                {next ? (
                  <ResizeHandle
                    left={item}
                    right={next}
                    label={resizeLabel}
                    onResize={(leftWidth, rightWidth, commit) =>
                      onResize(item.id, next.id, leftWidth, rightWidth, commit)
                    }
                  />
                ) : null}
              </React.Fragment>
            )
          })
        )}
      </div>
      {notice}
    </div>
  )
}

type CanvasRowDragSource = {
  sectionId: string
  rowId: string
}

export function CanvasRows({
  sectionId,
  rows,
  paletteMimes,
  rowsLocked = false,
  addRowDisabled = false,
  rowClassName,
  emptyRowClassName,
  slotsClassName,
  emptyMetaClassName,
  emptyMetaLabel,
  emptyZoneLabel,
  resizeLabel = 'Resize columns',
  emptyMessage,
  rowsLockedNotice,
  renderItem,
  itemClassName,
  itemTitle,
  itemDataAttrs,
  renderAfterRow,
  onPaletteDrop,
  onReorderItems,
  onMoveItem,
  onStackItem,
  onReorderRows,
  onResize,
  onAddEmptyRow,
  onRemoveEmptyRow,
}: {
  sectionId: string
  rows: CanvasRowModel[]
  paletteMimes: readonly string[]
  rowsLocked?: boolean
  addRowDisabled?: boolean
  rowClassName?: string
  emptyRowClassName?: string
  slotsClassName?: string
  emptyMetaClassName?: string
  emptyMetaLabel: string
  emptyZoneLabel: string
  resizeLabel?: string
  emptyMessage?: React.ReactNode
  rowsLockedNotice?: React.ReactNode
  renderItem: (item: CanvasItem, ctx: CanvasItemContext) => React.ReactNode
  itemClassName?: (item: CanvasItem, ctx: CanvasItemContext) => string
  itemTitle?: (item: CanvasItem, ctx: CanvasItemContext) => string
  itemDataAttrs?: (item: CanvasItem, ctx: CanvasItemContext) => Record<string, string | undefined>
  renderAfterRow?: (rowId: string) => React.ReactNode
  onPaletteDrop: (mime: string, value: string, rowId: string) => void
  onReorderItems: (rowId: string, orderedIds: string[]) => void
  onMoveItem: (source: CanvasItemDrag, rowId: string, index: number) => void
  onStackItem: (source: CanvasItemDrag, rowId: string, position: 'before' | 'after') => void
  onReorderRows: (orderedIds: string[]) => void
  onResize: (
    rowId: string,
    leftId: string,
    rightId: string,
    leftWidth: number,
    rightWidth: number,
    commit: boolean,
  ) => void
  onAddEmptyRow: () => void
  onRemoveEmptyRow: (rowId: string) => void
}) {
  const [draggingItem, setDraggingItem] = useState<CanvasItemDrag | null>(null)
  const [itemDropHint, setItemDropHint] = useState<{
    rowId: string
    itemId: string
    edge: 'before' | 'after'
  } | null>(null)
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null)
  const [rowDropHint, setRowDropHint] = useState<{
    rowId: string
    edge: 'before' | 'after'
  } | null>(null)

  const clearItemDrag = useCallback(() => {
    setDraggingItem(null)
    setItemDropHint(null)
    setRowDropHint(null)
  }, [])

  const clearRowDrag = useCallback(() => {
    setDraggingRowId(null)
    setRowDropHint(null)
  }, [])

  const handleRowDrop = useCallback(
    (targetRowId: string, edge: 'before' | 'after', source: CanvasRowDragSource) => {
      if (source.sectionId !== sectionId) {
        clearRowDrag()
        return
      }
      const fromIndex = rows.findIndex((row) => row.id === source.rowId)
      const targetIndex = rows.findIndex((row) => row.id === targetRowId)
      const dest = insertIndex(fromIndex, targetIndex, edge)
      clearRowDrag()
      if (dest == null || fromIndex < 0) return
      const next = moveIdInOrder(rows, source.rowId, dest, (row) => row.id)
      onReorderRows(next.map((row) => row.id))
    },
    [clearRowDrag, onReorderRows, rows, sectionId],
  )

  const draggingItemId =
    draggingItem && draggingItem.sectionId === sectionId ? draggingItem.itemId : null

  return (
    <>
      {rows.length === 0 ? emptyMessage : null}
      {rows.map((row) => (
        <CanvasDropRow
          key={row.id}
          sectionId={sectionId}
          row={row}
          paletteMimes={paletteMimes}
          draggingItemId={draggingItemId}
          itemDropHint={
            itemDropHint?.rowId === row.id
              ? { itemId: itemDropHint.itemId, edge: itemDropHint.edge }
              : null
          }
          rowDropEdge={
            rowDropHint?.rowId === row.id && draggingRowId !== row.id ? rowDropHint.edge : null
          }
          isDraggingRow={draggingRowId === row.id}
          rowClassName={rowClassName}
          emptyRowClassName={emptyRowClassName}
          slotsClassName={slotsClassName}
          emptyMetaClassName={emptyMetaClassName}
          emptyMetaLabel={emptyMetaLabel}
          emptyZoneLabel={emptyZoneLabel}
          resizeLabel={resizeLabel}
          renderItem={renderItem}
          itemClassName={itemClassName}
          itemTitle={itemTitle}
          itemDataAttrs={itemDataAttrs}
          notice={renderAfterRow?.(row.id)}
          onItemDragStart={(payload) => {
            setDraggingItem(payload)
            setItemDropHint(null)
            setRowDropHint(null)
            setDraggingRowId(null)
          }}
          onItemDragEnd={clearItemDrag}
          onItemDragOver={(itemId, edge, placeBeside) => {
            if (placeBeside) {
              setRowDropHint(null)
              setItemDropHint({ rowId: row.id, itemId, edge })
              return
            }
            setItemDropHint(null)
            setRowDropHint({ rowId: row.id, edge })
          }}
          onReorderItems={(orderedIds) => onReorderItems(row.id, orderedIds)}
          onMoveItem={(source, index) => onMoveItem(source, row.id, index)}
          onStackItem={(source, position) => onStackItem(source, row.id, position)}
          onPaletteDrop={(mime, value) => onPaletteDrop(mime, value, row.id)}
          onRemoveEmptyRow={() => onRemoveEmptyRow(row.id)}
          onRowDragStart={() => {
            setDraggingRowId(row.id)
            setRowDropHint(null)
            setDraggingItem(null)
            setItemDropHint(null)
          }}
          onRowDragEnd={clearRowDrag}
          onRowDragOver={(edge) => {
            if (draggingRowId === row.id) return
            setItemDropHint(null)
            setRowDropHint({ rowId: row.id, edge })
          }}
          onRowDrop={(edge, source) => handleRowDrop(row.id, edge, source)}
          onResize={(leftId, rightId, leftWidth, rightWidth, commit) =>
            onResize(row.id, leftId, rightId, leftWidth, rightWidth, commit)
          }
        />
      ))}
      {rowsLocked ? (
        rowsLockedNotice
      ) : rows.length > 0 && rows[rows.length - 1]!.items.length === 0 ? null : (
        <div className="sf-form-row-end-actions gantry-row-end-actions">
          <button
            type="button"
            className="gantry-toolbar-btn secondary"
            title="Open an empty drop row at the end"
            disabled={addRowDisabled}
            onClick={onAddEmptyRow}
          >
            + row
          </button>
        </div>
      )}
    </>
  )
}

function SectionLabelInput({
  sectionId,
  label,
  disabled,
  required,
  onChange,
  onBlurCommit,
}: {
  sectionId: string
  label: string
  disabled?: boolean
  required?: boolean
  onChange?: (value: string) => void
  onBlurCommit?: (value: string) => void
}) {
  if (onChange) {
    return (
      <input
        type="text"
        className="gantry-inline-input gantry-section-name-input"
        value={label}
        disabled={disabled}
        required={required}
        title="Section display name"
        aria-label="Section name"
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlurCommit?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
    )
  }
  return (
    <input
      key={`section-label-${sectionId}-${label}`}
      type="text"
      className="gantry-inline-input gantry-section-name-input"
      defaultValue={label}
      disabled={disabled}
      required={required}
      title="Section display name"
      aria-label="Section name"
      onBlur={(event) => {
        const next = event.target.value.trim()
        if (!next) {
          event.target.value = label
          return
        }
        onBlurCommit?.(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          ;(event.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

function SectionWidthInput({
  sectionId,
  width,
  disabled,
  onChange,
  onBlurCommit,
}: {
  sectionId: string
  width: number
  disabled?: boolean
  onChange?: (value: number) => void
  onBlurCommit?: (value: number) => void
}) {
  if (onChange) {
    return (
      <input
        type="number"
        className="gantry-inline-input gantry-section-width-input"
        value={width}
        min={LAYOUT_WIDTH_MIN}
        max={LAYOUT_WIDTH_FULL}
        step={5}
        disabled={disabled}
        aria-label="Section width percent"
        onChange={(event) => onChange(clampGridWidth(event.target.value, LAYOUT_WIDTH_FULL))}
        onBlur={(event) => onBlurCommit?.(clampGridWidth(event.target.value, LAYOUT_WIDTH_FULL))}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
    )
  }
  return (
    <input
      key={`section-width-${sectionId}-${width}`}
      type="number"
      className="gantry-inline-input gantry-section-width-input"
      defaultValue={width}
      min={LAYOUT_WIDTH_MIN}
      max={LAYOUT_WIDTH_FULL}
      step={5}
      disabled={disabled}
      aria-label="Section width percent"
      onBlur={(event) => onBlurCommit?.(clampGridWidth(event.target.value, LAYOUT_WIDTH_FULL))}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          ;(event.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

export function CanvasSectionFrame({
  sectionId,
  label,
  width,
  className,
  drag,
  labelDisabled,
  labelRequired,
  widthTitle = 'Section mosaic width — two ~50% sections sit side by side',
  onLabelChange,
  onLabelBlur,
  onWidthChange,
  onWidthBlur,
  identityStart,
  headEnd,
  settings,
  afterHead,
  children,
}: {
  sectionId: string
  label: string
  width: number
  className?: string
  drag: SectionDragBind
  labelDisabled?: boolean
  labelRequired?: boolean
  widthTitle?: string
  onLabelChange?: (value: string) => void
  onLabelBlur?: (value: string) => void
  onWidthChange?: (value: number) => void
  onWidthBlur?: (value: number) => void
  identityStart?: React.ReactNode
  headEnd?: React.ReactNode
  settings?: React.ReactNode
  afterHead?: React.ReactNode
  children: React.ReactNode
}) {
  const sectionWidth = clampGridWidth(width, LAYOUT_WIDTH_FULL)
  const classNames = [
    'gantry-section',
    className ?? '',
    drag.isDragging ? 'is-section-dragging' : '',
    drag.dropPosition === 'before' ? 'is-section-drop-before' : '',
    drag.dropPosition === 'after' ? 'is-section-drop-after' : '',
    drag.placeBeside ? 'is-section-drop-inline' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={classNames}
      data-sf-section={sectionId}
      data-sf-width={sectionWidth}
      onDragOver={(event) => {
        if (!dataTransferHasType(event.dataTransfer, DND_CANVAS_SECTION)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        const edge = mosaicSectionDropEdge(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect(),
        )
        drag.onDragOver(edge.position, edge.placeBeside)
      }}
      onDrop={(event) => {
        if (!dataTransferHasType(event.dataTransfer, DND_CANVAS_SECTION)) return
        event.preventDefault()
        event.stopPropagation()
        const edge = mosaicSectionDropEdge(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect(),
        )
        drag.onDrop(edge.position, edge.placeBeside)
      }}
    >
      <header className="gantry-section-head">
        <div className="gantry-section-title">
          <button
            type="button"
            className="gantry-section-handle"
            draggable
            title="Drag: drop above/below to reorder, left/right to place beside"
            aria-label={`Drag to move section ${label}`}
            onDragStart={(event) => {
              event.stopPropagation()
              event.dataTransfer.setData(DND_CANVAS_SECTION, sectionId)
              event.dataTransfer.setData('text/plain', sectionId)
              event.dataTransfer.effectAllowed = 'move'
              drag.onDragStart()
            }}
            onDragEnd={drag.onDragEnd}
          >
            ⋮⋮
          </button>
          <div className="gantry-section-identity">
            {identityStart}
            <label className="gantry-inline-label gantry-section-name-label">
              <span className="sr-only">Section name</span>
              <SectionLabelInput
                sectionId={sectionId}
                label={label}
                disabled={labelDisabled}
                required={labelRequired}
                onChange={onLabelChange}
                onBlurCommit={onLabelBlur}
              />
            </label>
            <label className="gantry-inline-label gantry-section-width-label" title={widthTitle}>
              <span className="sr-only">Section width percent</span>
              <SectionWidthInput
                sectionId={sectionId}
                width={sectionWidth}
                disabled={labelDisabled}
                onChange={onWidthChange}
                onBlurCommit={onWidthBlur}
              />
              <span className="gantry-slot-pct" aria-hidden="true">
                %
              </span>
            </label>
          </div>
        </div>
        <div className="gantry-section-head-actions">
          {headEnd}
          {settings}
        </div>
      </header>
      {afterHead}
      {children}
    </li>
  )
}

/**
 * Section-list drag state. One list, one moving section, one drop hint.
 * The list parent applies the drop (order, paired widths, persist).
 */
export function useCanvasSectionListDrag(
  onDrop: (
    movingId: string,
    targetId: string,
    position: 'before' | 'after',
    placeBeside: boolean,
  ) => void,
) {
  const onDropRef = useRef(onDrop)
  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])
  const draggingRef = useRef<string | null>(null)
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<{
    sectionId: string
    position: 'before' | 'after'
    placeBeside: boolean
  } | null>(null)

  const clear = useCallback(() => {
    draggingRef.current = null
    setDraggingSectionId(null)
    setDropHint(null)
  }, [])

  const bind = useCallback(
    (sectionId: string): SectionDragBind => {
      const hinted = dropHint?.sectionId === sectionId && draggingSectionId !== sectionId
      return {
        isDragging: draggingSectionId === sectionId,
        dropPosition: hinted ? dropHint!.position : null,
        placeBeside: Boolean(hinted && dropHint?.placeBeside),
        onDragStart: () => {
          draggingRef.current = sectionId
          setDraggingSectionId(sectionId)
          setDropHint(null)
        },
        onDragEnd: clear,
        onDragOver: (position, placeBeside) => {
          const moving = draggingRef.current
          if (!moving || moving === sectionId) return
          setDropHint({ sectionId, position, placeBeside })
        },
        onDrop: (position, placeBeside) => {
          const moving = draggingRef.current
          clear()
          if (!moving || moving === sectionId) return
          onDropRef.current(moving, sectionId, position, placeBeside)
        },
      }
    },
    [clear, draggingSectionId, dropHint],
  )

  return { bind, draggingSectionId }
}
