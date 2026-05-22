"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ApiActivity, ActivityType, TaskStatus } from "@/types";
import { STATUS_LABELS } from "@/types";

type Props = {
  projectId: string;
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

function statusLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return STATUS_LABELS[value as TaskStatus] ?? value;
}

function describe(activity: ApiActivity): string {
  const meta = activity.metadata ?? {};
  const title = typeof meta.title === "string" ? meta.title : "a task";

  switch (activity.type as ActivityType) {
    case "task_created":
      return `created task “${title}”`;
    case "task_status_changed": {
      const from = statusLabel(meta.from);
      const to = statusLabel(meta.to);
      return `moved “${title}” from ${from} to ${to}`;
    }
    case "task_assignee_changed": {
      const toName =
        typeof meta.toAssigneeName === "string" && meta.toAssigneeName
          ? meta.toAssigneeName
          : null;
      if (toName) return `assigned “${title}” to ${toName}`;
      if (meta.toAssigneeId === null || meta.toAssigneeId === undefined) {
        return `unassigned “${title}”`;
      }
      return `changed the assignee on “${title}”`;
    }
    case "comment_added":
      return `commented on “${title}”`;
    default:
      return "made a change";
  }
}

export function ActivityFeed({ projectId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["project-activities", projectId],
    queryFn: () =>
      apiFetch<{ activities: ApiActivity[] }>(
        `/api/projects/${projectId}/activities`
      ),
    refetchOnWindowFocus: true,
  });

  const activities = data?.activities ?? [];

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium mb-3">activity</h2>

      <div className="bg-surface border border-border rounded-lg">
        {isLoading && (
          <p className="text-xs text-muted px-4 py-3">loading activity…</p>
        )}

        {error && (
          <p className="text-xs text-red-400 px-4 py-3" role="alert">
            {error instanceof Error
              ? error.message
              : "failed to load activity"}
          </p>
        )}

        {!isLoading && !error && activities.length === 0 && (
          <p className="text-xs text-muted px-4 py-3">no activity yet</p>
        )}

        {activities.length > 0 && (
          <ul className="divide-y divide-border max-h-96 overflow-y-auto">
            {activities.map((a) => (
              <li
                key={a.id}
                className="px-4 py-3 flex items-start justify-between gap-4 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{a.actor.name}</span>{" "}
                  <span className="text-muted">{describe(a)}</span>
                </div>
                <span className="text-[10px] text-muted whitespace-nowrap">
                  {formatTimestamp(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
