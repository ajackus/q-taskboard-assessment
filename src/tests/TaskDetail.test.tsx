import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskDetail } from "@/components/TaskDetail";
import type { ApiTask } from "@/types";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: mocks.apiFetch,
}));

const task: ApiTask = {
  id: "task-1",
  projectId: "project-1",
  title: "Test task",
  description: null,
  status: "todo",
  assigneeId: null,
  createdById: "user-1",
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderTaskDetail(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TaskDetail task={task} projectId="project-1" members={[]} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("<TaskDetail /> delete confirmation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks for confirmation and does not delete when cancelled", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTaskDetail();

    fireEvent.click(screen.getByRole("button", { name: "delete task" }));

    expect(confirm).toHaveBeenCalledWith("Are you sure you want to delete this task?");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("deletes the task only after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.apiFetch.mockResolvedValue({ ok: true });
    const { onClose } = renderTaskDetail();

    fireEvent.click(screen.getByRole("button", { name: "delete task" }));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith("/api/tasks/task-1", {
        method: "DELETE",
      });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
