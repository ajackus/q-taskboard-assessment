"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

type ApiComment = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
};

type Props = {
  taskId: string;
  canPost: boolean;
};

export function TaskComments({ taskId, canPost }: Props) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const { data, isLoading } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => apiFetch<{ comments: ApiComment[] }>(`/api/tasks/${taskId}/comments`),
  });

  const postComment = useMutation({
    mutationFn: (newBody: string) =>
      apiFetch<{ comment: ApiComment }>(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: newBody }),
      }),
    onSuccess: () => {
      setBody("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to post comment"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    postComment.mutate(body);
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="text-sm font-semibold mb-3">comments</h3>

      {isLoading ? (
        <p className="text-xs text-muted">loading comments...</p>
      ) : (
        <div className="space-y-4 mb-4 max-h-48 overflow-y-auto pr-2">
          {data?.comments.length === 0 ? (
            <p className="text-xs text-muted">no comments yet.</p>
          ) : (
            data?.comments.map((comment) => (
              <div key={comment.id} className="bg-bg border border-border rounded p-3">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-medium text-gray-200">{comment.author.name}</span>
                  <span className="text-[10px] text-muted">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))
          )}
        </div>
      )}

      {canPost ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="write a comment..."
            rows={2}
            className="w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
          />
          <div className="flex justify-between items-center">
            {error ? <span className="text-xs text-red-400">{error}</span> : <span></span>}
            <button
              type="submit"
              disabled={postComment.isPending || !body.trim()}
              className="text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {postComment.isPending ? "posting..." : "post"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted italic">viewers cannot post comments.</p>
      )}
    </div>
  );
}
