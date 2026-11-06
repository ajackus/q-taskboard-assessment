import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
	prisma: {
		task: { findUnique: vi.fn() },
		comment: { findMany: vi.fn(), create: vi.fn() },
	},
}));

vi.mock("@/lib/auth", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
	return {
		...actual,
		getCurrentUser: vi.fn(),
		getProjectMembership: vi.fn(),
	};
});

import { GET, POST } from "@/app/api/tasks/[id]/comments/route";
import { getCurrentUser, getProjectMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockUser = { id: "u1", email: "a@b.com", name: "A" };

function makeGetRequest(url: string) {
	return new NextRequest(url, {
		headers: { authorization: "Bearer test-token" },
	});
}

function makePostRequest(url: string, body: unknown) {
	return new NextRequest(url, {
		method: "POST",
		headers: {
			authorization: "Bearer test-token",
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

describe("task comments", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(
			getCurrentUser as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockUser);
		(
			prisma.task.findUnique as unknown as ReturnType<typeof vi.fn>
		).mockResolvedValue({
			projectId: "p1",
		});
	});

	describe("GET /api/tasks/[id]/comments", () => {
		it("returns 403 for a non-member", async () => {
			(
				getProjectMembership as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue(null);
			const req = makeGetRequest(
				"http://localhost/api/tasks/t1/comments",
			);
			const res = await GET(req, {
				params: Promise.resolve({ id: "t1" }),
			});

			expect(res.status).toBe(403);
			expect(prisma.comment.findMany).not.toHaveBeenCalled();
		});

		it("returns 404 when the task doesn't exist", async () => {
			(
				prisma.task.findUnique as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue(null);
			const req = makeGetRequest(
				"http://localhost/api/tasks/missing/comments",
			);
			const res = await GET(req, {
				params: Promise.resolve({ id: "missing" }),
			});

			expect(res.status).toBe(404);
		});

		it("a viewer can read comments in chronological (oldest-first) order", async () => {
			(
				getProjectMembership as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				role: "viewer",
			});
			(
				prisma.comment.findMany as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue([
				{
					id: "c1",
					body: "first",
					createdAt: "2026-01-01T00:00:00.000Z",
				},
				{
					id: "c2",
					body: "second",
					createdAt: "2026-01-02T00:00:00.000Z",
				},
			]);

			const req = makeGetRequest(
				"http://localhost/api/tasks/t1/comments",
			);
			const res = await GET(req, {
				params: Promise.resolve({ id: "t1" }),
			});
			const data = await res.json();

			expect(res.status).toBe(200);
			expect(prisma.comment.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { taskId: "t1" },
					orderBy: { createdAt: "asc" },
				}),
			);
			expect(data.comments.map((c: { id: string }) => c.id)).toEqual([
				"c1",
				"c2",
			]);
		});
	});

	describe("POST /api/tasks/[id]/comments", () => {
		it("returns 403 for a viewer, and never creates the comment", async () => {
			(
				getProjectMembership as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				role: "viewer",
			});
			const req = makePostRequest(
				"http://localhost/api/tasks/t1/comments",
				{
					body: "nice work",
				},
			);
			const res = await POST(req, {
				params: Promise.resolve({ id: "t1" }),
			});

			expect(res.status).toBe(403);
			expect(prisma.comment.create).not.toHaveBeenCalled();
		});

		it("returns 201 and creates the comment for a member, scoped to the caller as author", async () => {
			(
				getProjectMembership as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				role: "member",
			});
			(
				prisma.comment.create as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				id: "c1",
				taskId: "t1",
				authorId: "u1",
				body: "nice work",
				createdAt: "2026-01-01T00:00:00.000Z",
				author: { id: "u1", name: "A", email: "a@b.com" },
			});

			const req = makePostRequest(
				"http://localhost/api/tasks/t1/comments",
				{
					body: "nice work",
				},
			);
			const res = await POST(req, {
				params: Promise.resolve({ id: "t1" }),
			});
			const data = await res.json();

			expect(res.status).toBe(201);
			expect(prisma.comment.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: { taskId: "t1", authorId: "u1", body: "nice work" },
					include: {
						author: {
							select: { id: true, name: true, email: true },
						},
					},
				}),
			);
			expect(data.comment.body).toBe("nice work");
		});

		it("rejects an empty body with 400 before touching the database", async () => {
			(
				getProjectMembership as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				role: "admin",
			});
			const req = makePostRequest(
				"http://localhost/api/tasks/t1/comments",
				{ body: "" },
			);
			const res = await POST(req, {
				params: Promise.resolve({ id: "t1" }),
			});

			expect(res.status).toBe(400);
			expect(prisma.comment.create).not.toHaveBeenCalled();
		});

		it("returns 404 when the task doesn't exist", async () => {
			(
				prisma.task.findUnique as unknown as ReturnType<typeof vi.fn>
			).mockResolvedValue(null);
			const req = makePostRequest(
				"http://localhost/api/tasks/missing/comments",
				{
					body: "hi",
				},
			);
			const res = await POST(req, {
				params: Promise.resolve({ id: "missing" }),
			});

			expect(res.status).toBe(404);
		});
	});
});
