'use client'

import React, { useActionState, useRef } from 'react'
import { useTranslations } from 'next-intl'

import { MemberMediaPicker } from '@/modules/media/api'
import { EmojiInsertButton } from '@/modules/rich-editor/api'

import {
  acceptGroupInviteAction,
  addGroupDocumentAction,
  announceGroupPostAction,
  approveGroupJoinAction,
  assignGroupRankAction,
  createGroupAction,
  createGroupRankAction,
  createGroupWallPostAction,
  declineGroupJoinAction,
  deleteGroupAction,
  inviteToGroupAction,
  joinGroupAction,
  removeGroupMemberAction,
  setGroupFormDefinitionAction,
  setGroupMemberRoleAction,
  transferGroupAction,
  type SocialGroupActionState,
} from '../actions'
import type {
  GroupCategoryRecord,
  GroupMemberRecord,
  GroupVisibility,
} from '../groups'
import type { GroupDocumentRecord, GroupRankRecord } from '../group-tools'

const initial: SocialGroupActionState = {}

export function CreateGroupForm({
  categories,
  defaultVisibility = 'open',
}: {
  categories: GroupCategoryRecord[]
  defaultVisibility?: GroupVisibility
}) {
  const t = useTranslations('product:social')
  const [open, setOpen] = React.useState(false)
  const [state, action, pending] = useActionState(createGroupAction, initial)
  return (
    <div className="sf-social-directory-create">
      <button
        type="button"
        className="sf-social-directory-create-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? t('close') : t('createGroup')}
      </button>
      {open ? (
        <form action={action} className="sf-social-create-group">
          <label className="settings-field">
            <span>Name</span>
            <input type="text" name="name" maxLength={120} required disabled={pending} />
          </label>
          <label className="settings-field">
            <span>Category</span>
            <select name="categoryId" required disabled={pending} defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Visibility</span>
            <select name="visibility" defaultValue={defaultVisibility} disabled={pending}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Description</span>
            <textarea name="description" rows={2} maxLength={2000} disabled={pending} />
          </label>
          <label className="settings-field">
            <span>Join form id (optional, closed groups)</span>
            <input
              type="text"
              name="formDefinitionId"
              maxLength={120}
              disabled={pending}
              placeholder="Forms definition id"
            />
          </label>
          <div className="sf-social-directory-create-actions">
            <button
              type="submit"
              className="sf-social-directory-create-submit"
              disabled={pending}
            >
              {pending ? t('creatingGroup') : t('createGroupSubmit')}
            </button>
          </div>
          {state.error ? (
            <p className="sf-social-inline-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok && state.slug ? (
            <p className="sf-social-inline-ok">{t('groupCreated')}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}

export function JoinGroupButton({
  groupId,
  visibility,
}: {
  groupId: string
  visibility: GroupVisibility
}) {
  const t = useTranslations('product:social')
  const [state, action, pending] = useActionState(joinGroupAction, initial)
  return (
    <form action={action} className="sf-social-join-group">
      <input type="hidden" name="groupId" value={groupId} />
      <button type="submit" className="sf-social-btn sf-social-btn-primary" disabled={pending}>
        {pending
          ? t('working')
          : visibility === 'closed'
            ? t('requestToJoin')
            : t('joinGroup')}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function AcceptGroupInviteButton({ groupId }: { groupId: string }) {
  const t = useTranslations('product:social')
  const [state, action, pending] = useActionState(acceptGroupInviteAction, initial)
  return (
    <form action={action} className="sf-social-accept-invite">
      <input type="hidden" name="groupId" value={groupId} />
      <button type="submit" className="sf-social-btn sf-social-btn-primary" disabled={pending}>
        {pending ? t('acceptingInvite') : t('acceptInvite')}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function PendingJoinRequestsList({
  groupId,
  requests,
}: {
  groupId: string
  requests: GroupMemberRecord[]
}) {
  const t = useTranslations('product:social')
  if (requests.length === 0) {
    return <p className="layout-muted">{t('noPendingJoinRequests')}</p>
  }
  return (
    <ul className="sf-social-pending-joins">
      {requests.map((row) => (
        <li key={row.id} className="sf-social-control-row">
          <span>{row.userId}</span>
          <ApproveGroupJoinButton groupId={groupId} targetUserId={row.userId} />
          <DeclineGroupJoinButton groupId={groupId} targetUserId={row.userId} />
        </li>
      ))}
    </ul>
  )
}

export function ApproveGroupJoinButton({
  groupId,
  targetUserId,
}: {
  groupId: string
  targetUserId: string
}) {
  const t = useTranslations('product:social')
  const [state, action, pending] = useActionState(approveGroupJoinAction, initial)
  return (
    <form action={action} className="sf-social-approve-join">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <button type="submit" className="sf-social-btn sf-social-btn-primary" disabled={pending}>
        {pending ? t('approvingJoinRequest') : t('approveJoinRequest')}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function DeclineGroupJoinButton({
  groupId,
  targetUserId,
}: {
  groupId: string
  targetUserId: string
}) {
  const t = useTranslations('product:social')
  const [state, action, pending] = useActionState(declineGroupJoinAction, initial)
  return (
    <form action={action} className="sf-social-decline-join">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? t('decliningJoinRequest') : t('declineJoinRequest')}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function InviteToGroupForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(inviteToGroupAction, initial)
  return (
    <form action={action} className="sf-social-invite-group sf-social-control-row">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="settings-field">
        <span>Member user id</span>
        <input
          type="text"
          name="inviteeUserId"
          required
          disabled={pending}
          placeholder="User id"
        />
      </label>
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Inviting…' : 'Invite'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function GroupWallComposer({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(createGroupWallPostAction, initial)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  return (
    <form action={action} className="sf-social-composer sf-social-group-composer">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="settings-field">
        <span>Post to the wall</span>
        <textarea
          ref={bodyRef}
          name="body"
          rows={3}
          maxLength={8000}
          placeholder="Write a post…"
          disabled={pending}
        />
      </label>
      <div className="sf-social-control-row">
        <EmojiInsertButton disabled={pending} targetRef={bodyRef} />
        <button type="submit" className="sf-social-btn sf-social-btn-primary" disabled={pending}>
          {pending ? 'Posting…' : 'Post'}
        </button>
      </div>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function CreateGroupRankForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(createGroupRankAction, initial)
  return (
    <form action={action} className="sf-social-create-rank">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="settings-field">
        <span>Rank name</span>
        <input type="text" name="name" maxLength={80} required disabled={pending} />
      </label>
      <label className="settings-field settings-flag">
        <span>Can announce</span>
        <input type="checkbox" name="canAnnounce" disabled={pending} />
      </label>
      <label className="settings-field settings-flag">
        <span>Can manage documents</span>
        <input type="checkbox" name="canManageDocuments" disabled={pending} />
      </label>
      <label className="settings-field settings-flag">
        <span>Can manage calendar</span>
        <input type="checkbox" name="canManageCalendar" disabled={pending} />
      </label>
      <label className="settings-field settings-flag">
        <span>Can manage members</span>
        <input type="checkbox" name="canManageMembers" disabled={pending} />
      </label>
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Saving…' : 'Add rank'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function AssignGroupRankForm({
  groupId,
  members,
  ranks,
}: {
  groupId: string
  members: GroupMemberRecord[]
  ranks: GroupRankRecord[]
}) {
  const [state, action, pending] = useActionState(assignGroupRankAction, initial)
  const assignable = members.filter((row) => row.role === 'member')
  if (assignable.length === 0 || ranks.length === 0) return null
  return (
    <form action={action} className="sf-social-assign-rank sf-social-control-row">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="settings-field">
        <span>Member</span>
        <select name="targetUserId" required disabled={pending} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {assignable.map((row) => (
            <option key={row.id} value={row.userId}>
              {row.userId}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Rank</span>
        <select name="rankId" required disabled={pending} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {ranks.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Saving…' : 'Assign'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function SetGroupMemberRoleForm({
  groupId,
  members,
}: {
  groupId: string
  members: GroupMemberRecord[]
}) {
  const [state, action, pending] = useActionState(setGroupMemberRoleAction, initial)
  const candidates = members.filter((row) => row.role !== 'owner')
  if (candidates.length === 0) return null
  return (
    <form action={action} className="sf-social-set-role sf-social-control-row">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="settings-field">
        <span>Member</span>
        <select name="targetUserId" required disabled={pending} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {candidates.map((row) => (
            <option key={row.id} value={row.userId}>
              {row.userId} ({row.role})
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Role</span>
        <select name="role" defaultValue="admin" disabled={pending}>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
      </label>
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Saving…' : 'Set role'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function RemoveGroupMemberForm({
  groupId,
  members,
  actorUserId,
}: {
  groupId: string
  members: GroupMemberRecord[]
  actorUserId: string
}) {
  const [state, action, pending] = useActionState(removeGroupMemberAction, initial)
  const removable = members.filter((row) => row.userId !== actorUserId)
  if (removable.length === 0) return null
  return (
    <form action={action} className="sf-social-remove-member sf-social-control-row">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="settings-field">
        <span>Remove member</span>
        <select name="targetUserId" required disabled={pending} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {removable.map((row) => (
            <option key={row.id} value={row.userId}>
              {row.userId} ({row.role})
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function AddGroupDocumentForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(addGroupDocumentAction, initial)
  const [mediaId, setMediaId] = React.useState('')
  return (
    <form action={action} className="sf-social-add-document">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      <label className="settings-field">
        <span>Title</span>
        <input type="text" name="title" maxLength={200} disabled={pending} />
      </label>
      <div className="settings-field settings-field-wide">
        <span>File</span>
        <MemberMediaPicker
          label="Choose file"
          value={mediaId}
          onChange={setMediaId}
          context="social-group-document"
          chrome="public"
          shape="wide"
          disabled={pending}
          hint="File stays in Media."
        />
      </div>
      <button type="submit" className="sf-social-btn" disabled={pending || !mediaId}>
        {pending ? 'Adding…' : 'Add document'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function GroupDocumentsList({ documents }: { documents: GroupDocumentRecord[] }) {
  if (documents.length === 0) {
    return <p className="layout-muted">No documents yet.</p>
  }
  return (
    <ul className="sf-social-group-documents">
      {documents.map((doc) => (
        <li key={doc.id}>
          <a href={`/api/media/${encodeURIComponent(doc.mediaId)}`} target="_blank" rel="noreferrer">
            {doc.title || doc.mediaId}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function AnnounceGroupPostButton({
  groupId,
  postId,
}: {
  groupId: string
  postId: string
}) {
  const [state, action, pending] = useActionState(announceGroupPostAction, initial)
  return (
    <form action={action} className="sf-social-announce-post">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Pinning…' : 'Announce'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function SetGroupFormDefinitionForm({
  groupId,
  formDefinitionId,
}: {
  groupId: string
  formDefinitionId: string | null
}) {
  const [state, action, pending] = useActionState(setGroupFormDefinitionAction, initial)
  return (
    <form action={action} className="sf-social-set-form sf-social-control-row">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="settings-field">
        <span>Join form id</span>
        <input
          type="text"
          name="formDefinitionId"
          defaultValue={formDefinitionId ?? ''}
          maxLength={120}
          disabled={pending}
          placeholder="Forms definition id"
        />
      </label>
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Saving…' : 'Save form'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function TransferGroupForm({
  groupId,
  members,
  ownerUserId,
}: {
  groupId: string
  members: GroupMemberRecord[]
  ownerUserId: string
}) {
  const [state, action, pending] = useActionState(transferGroupAction, initial)
  const candidates = members.filter((row) => row.userId !== ownerUserId)
  if (candidates.length === 0) return null
  return (
    <form action={action} className="sf-social-transfer-group sf-social-control-row">
      <input type="hidden" name="groupId" value={groupId} />
      <label className="settings-field">
        <span>New owner</span>
        <select name="newOwnerUserId" required disabled={pending} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {candidates.map((row) => (
            <option key={row.id} value={row.userId}>
              {row.userId}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Transferring…' : 'Transfer'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function DeleteGroupButton({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(deleteGroupAction, initial)
  return (
    <form action={action} className="sf-social-delete-group">
      <input type="hidden" name="groupId" value={groupId} />
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Deleting…' : 'Delete group'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
