"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ApiTask, ApiProjectMember, ApiComment, TaskStatus, Role } from "@/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/types";

type Props = {
  task: ApiTask;
  projectId: string;
  members: ApiProjectMember[];
  userRole: Role;
  onClose: () => void;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskDetail({ task, projectId, members, userRole, onClose }: Props) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assigneeId, setAssigneeId] = useState<string>(task.assigneeId ?? "");
  const [error, setError] = useState<string | null>(null);

  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  const canComment = userRole === "admin" || userRole === "member";

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", task.id],
    queryFn: () => apiFetch<{ comments: ApiComment[] }>(`/api/tasks/${task.id}/comments`),
  });

  const comments = commentsData?.comments ?? [];

  const updateTask = useMutation({
    mutationFn: (input: Partial<ApiTask>) =>
      apiFetch<{ task: ApiTask }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "save failed"),
  });

  const deleteTask = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>(`/api/tasks/${task.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "delete failed"),
  });

  const postComment = useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ comment: ApiComment }>(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setCommentBody("");
      setCommentError(null);
      queryClient.invalidateQueries({ queryKey: ["comments", task.id] });
    },
    onError: (err) => setCommentError(err instanceof Error ? err.message : "failed to post comment"),
  });

  function onSave() {
    setError(null);
    updateTask.mutate({
      title,
      description,
      status,
      assigneeId: assigneeId || null,
    });
  }

  function onSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = commentBody.trim();
    if (!trimmed) return;
    setCommentError(null);
    postComment.mutate(trimmed);
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">edit task</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-muted">title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block mb-3">
          <span className="text-xs text-muted">description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-xs text-muted">status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-muted">assignee</span>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">unassigned</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 mb-6">
          <button
            onClick={() => deleteTask.mutate()}
            disabled={deleteTask.isPending}
            className="text-sm text-red-400 hover:text-red-300"
          >
            delete task
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-md border border-border hover:border-muted"
            >
              cancel
            </button>
            <button
              onClick={onSave}
              disabled={updateTask.isPending}
              className="text-sm px-4 py-2 rounded-md bg-accent text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {updateTask.isPending ? "saving…" : "save"}
            </button>
          </div>
        </div>

        {/* ── Comments ── */}
        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-medium mb-3">
            comments
            {comments.length > 0 && (
              <span className="ml-1 text-xs text-muted">({comments.length})</span>
            )}
          </h3>

          {commentsLoading && (
            <p className="text-xs text-muted mb-3">loading comments…</p>
          )}

          {comments.length === 0 && !commentsLoading && (
            <p className="text-xs text-muted mb-3">no comments yet</p>
          )}

          {comments.length > 0 && (
            <ul
              className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-1"
              aria-label="comments"
            >
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="bg-bg border border-border rounded-md px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs">{c.user.name}</span>
                    <span className="text-xs text-muted">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          {canComment ? (
            <form onSubmit={onSubmitComment} className="flex flex-col gap-2">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="add a comment…"
                rows={2}
                aria-label="new comment"
                className="block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
              />
              {commentError && (
                <p className="text-xs text-red-400" role="alert">
                  {commentError}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={postComment.isPending || !commentBody.trim()}
                  className="text-sm px-4 py-2 rounded-md bg-accent text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {postComment.isPending ? "posting…" : "post comment"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-muted italic">viewers cannot post comments</p>
          )}
        </div>
      </div>
    </div>
  );
}
