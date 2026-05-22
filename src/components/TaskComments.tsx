"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ApiComment, Role } from "@/types";

type Props = {
  taskId: string;
  currentUserRole: Role | null;
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskComments({ taskId, currentUserRole }: Props) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canPost = currentUserRole === "admin" || currentUserRole === "member";

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () =>
      apiFetch<{ comments: ApiComment[] }>(`/api/tasks/${taskId}/comments`),
  });

  const postComment = useMutation({
    mutationFn: (input: { body: string }) =>
      apiFetch<{ comment: ApiComment }>(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setBody("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "failed to post comment"),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    postComment.mutate({ body: trimmed });
  }

  const comments = data?.comments ?? [];

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="text-sm font-medium mb-3">comments</h3>

      {isLoading && (
        <p className="text-xs text-muted">loading comments…</p>
      )}

      {queryError && (
        <p className="text-xs text-red-400" role="alert">
          {queryError instanceof Error
            ? queryError.message
            : "failed to load comments"}
        </p>
      )}

      {!isLoading && !queryError && comments.length === 0 && (
        <p className="text-xs text-muted">no comments yet</p>
      )}

      {comments.length > 0 && (
        <ul className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
          {comments.map((c) => (
            <li
              key={c.id}
              className="bg-bg border border-border rounded-md px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{c.author.name}</span>
                <span className="text-[10px] text-muted">
                  {formatTimestamp(c.createdAt)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canPost ? (
        <form onSubmit={onSubmit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="add a comment…"
            className="block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            disabled={postComment.isPending}
          />
          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={postComment.isPending || !body.trim()}
              className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {postComment.isPending ? "posting…" : "post"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted italic">
          viewers cannot post comments
        </p>
      )}
    </div>
  );
}
