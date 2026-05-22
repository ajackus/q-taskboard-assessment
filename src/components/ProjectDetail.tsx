"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ApiProjectDetail, ApiProjectMember, ApiUser } from "@/types";

type Props = {
  project: ApiProjectDetail;
  projectId: string;
  onClose: () => void;
};

const inputClass =
  "mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function ProjectDetail({ project, projectId, onClose }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"member" | "viewer">("member");
  const [error, setError] = useState<string | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<{ users: ApiUser[] }>("/api/users"),
  });

  const memberUserIds = useMemo(
    () => new Set(project.memberships.map((m) => m.user.id)),
    [project.memberships]
  );

  const availableUsers = useMemo(
    () => (usersData?.users ?? []).filter((u) => !memberUserIds.has(u.id)),
    [usersData?.users, memberUserIds]
  );

  const invalidateProject = () =>
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });

  const updateProject = useMutation({
    mutationFn: (input: { name: string; description: string | null }) =>
      apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await invalidateProject();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "save failed"),
  });

  const deleteProject = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>(`/api/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push("/dashboard");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "delete failed"),
  });

  const addMember = useMutation({
    mutationFn: (input: { userId: string; role: "member" | "viewer" }) =>
      apiFetch<{ membership: ApiProjectMember }>(
        `/api/projects/${projectId}/members`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: async () => {
      setAddUserId("");
      setAddRole("member");
      await invalidateProject();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "add member failed"),
  });

  const updateMemberRole = useMutation({
    mutationFn: ({
      membershipId,
      role,
    }: {
      membershipId: string;
      role: "member" | "viewer";
    }) =>
      apiFetch(`/api/projects/${projectId}/members/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => invalidateProject(),
    onError: (err) => setError(err instanceof Error ? err.message : "update role failed"),
  });

  const removeMember = useMutation({
    mutationFn: (membershipId: string) =>
      apiFetch<{ ok: true }>(`/api/projects/${projectId}/members/${membershipId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateProject(),
    onError: (err) => setError(err instanceof Error ? err.message : "remove failed"),
  });

  function onSave() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    updateProject.mutate({
      name: trimmed,
      description: description.trim() || null,
    });
  }

  function onAddMember() {
    if (!addUserId) return;
    setError(null);
    addMember.mutate({ userId: addUserId, role: addRole });
  }

  const memberships = project.memberships;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">edit project</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-muted">name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block mb-4">
          <span className="text-xs text-muted">description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputClass}
          />
        </label>

        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">members</h3>
          <ul className="border border-border rounded-lg divide-y divide-border mb-3">
            {memberships.map((m) => (
              <li
                key={m.id}
                className="px-3 py-2 flex items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="block truncate">{m.user.name}</span>
                  <span className="text-xs text-muted truncate block">{m.user.email}</span>
                </div>
                {m.role === "admin" ? (
                  <span className="text-xs text-muted uppercase shrink-0">{m.role}</span>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateMemberRole.mutate({
                          membershipId: m.id,
                          role: e.target.value as "member" | "viewer",
                        })
                      }
                      disabled={updateMemberRole.isPending}
                      className="rounded-md bg-bg border border-border px-2 py-1 text-xs focus:border-accent focus:outline-none"
                    >
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMember.mutate(m.id)}
                      disabled={removeMember.isPending}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[140px]">
              <span className="text-xs text-muted block mb-1">add member</span>
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className={inputClass.replace("mt-1 ", "")}
              >
                <option value="">select user</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs text-muted block mb-1">role</span>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as "member" | "viewer")}
                className="rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
            </label>
            <button
              type="button"
              onClick={onAddMember}
              disabled={!addUserId || addMember.isPending}
              className="text-sm px-4 py-2 rounded-md bg-accent text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              add
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => deleteProject.mutate()}
            disabled={deleteProject.isPending}
            className="text-sm text-red-400 hover:text-red-300"
          >
            delete project
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
              disabled={updateProject.isPending}
              className="text-sm px-4 py-2 rounded-md bg-accent text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {updateProject.isPending ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
