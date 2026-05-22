"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getStoredUser, getToken } from "@/lib/api-client";
import { Header } from "@/components/Header";

type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  role: "admin" | "member" | "viewer";
  owner: { id: string; name: string; email: string };
  taskCount: number;
  createdAt: string;
};

const inputClass =
  "w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const ownerName = getStoredUser()?.name ?? "—";

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<{ projects: ProjectSummary[] }>("/api/projects"),
  });

  const createProject = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      apiFetch<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) =>
      setFormError(err instanceof Error ? err.message : "create failed"),
  });

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">your projects</h1>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="bg-accent hover:bg-indigo-500 text-white text-sm font-medium rounded-md px-4 py-2"
          >
            {showAddForm ? "cancel" : "add project"}
          </button>
        </div>

        {showAddForm && (
          <section className="bg-surface border border-border rounded-lg p-4 mb-6">
            <h2 className="text-sm font-medium mb-3">add a project</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = name.trim();
                if (!trimmed) return;
                setFormError(null);
                createProject.mutate({
                  name: trimmed,
                  description: description.trim() || undefined,
                });
              }}
              className="flex flex-col gap-3"
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="project name"
                className={inputClass}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="description (optional)"
                rows={3}
                className={inputClass}
              />
              <div>
                <label className="text-xs text-muted block mb-1">owner</label>
                <input
                  type="text"
                  value={ownerName}
                  disabled
                  className={`${inputClass} opacity-70 cursor-not-allowed`}
                />
                <p className="text-xs text-muted mt-1">you will be the project owner</p>
              </div>
              <button
                type="submit"
                disabled={createProject.isPending}
                className="self-start bg-accent hover:bg-indigo-500 text-white text-sm font-medium rounded-md px-4 py-2 disabled:opacity-50"
              >
                add
              </button>
            </form>
            {formError && (
              <p className="text-sm text-red-400 mt-2" role="alert">
                {formError}
              </p>
            )}
          </section>
        )}

        {isLoading && <p className="text-muted text-sm">loading…</p>}
        {error && (
          <p className="text-sm text-red-400">
            {error instanceof Error ? error.message : "failed to load projects"}
          </p>
        )}

        {data && data.projects.length === 0 && (
          <p className="text-muted text-sm">no projects yet.</p>
        )}

        {data && data.projects.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((p) => (
              <li
                key={p.id}
                className="bg-surface border border-border rounded-lg p-5 hover:border-accent transition"
              >
                <Link href={`/projects/${p.id}`} className="block">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-medium">{p.name}</h2>
                    <span className="text-xs uppercase tracking-wide text-muted">
                      {p.role}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted mb-3 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    {p.taskCount} {p.taskCount === 1 ? "task" : "tasks"} · owner: {p.owner.name}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
