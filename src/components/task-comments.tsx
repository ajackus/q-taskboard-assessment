"use client";

import { useEffect, useState } from "react";

export default function TaskComments({
  taskId,
}: {
  taskId: string;
}) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");

  async function loadComments() {
    const res = await fetch(
      `/api/tasks/${taskId}/comments`
    );

    const data = await res.json();

    setComments(data.comments);
  }

  useEffect(() => {
    loadComments();
  }, []);

  async function addComment() {
    await fetch(
      `/api/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body,
        }),
      }
    );

    setBody("");

    loadComments();
  }

  return (
    <div className="mt-6">
      <h3>Comments</h3>

      <div>
        {comments.map((comment: any) => (
          <div
            key={comment.id}
            className="border p-2 mb-2"
          >
            <div>
              <strong>
                {comment.author.name ||
                  comment.author.email}
              </strong>
            </div>

            <div>{comment.body}</div>

            <small>
              {new Date(
                comment.createdAt
              ).toLocaleString()}
            </small>
          </div>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) =>
          setBody(e.target.value)
        }
      />

      <button onClick={addComment}>
        Add Comment
      </button>
    </div>
  );
}