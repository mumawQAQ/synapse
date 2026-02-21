import { useAgentTool, useContextSync } from "@synapse/client";
import { useState } from "react";
import type { Note } from "../types";

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);

  useContextSync({ page_id: "notes" }, "NotesPage");

  useAgentTool(
    "addNote",
    async ({ title, body }: { title: string; body: string }) => {
      const note: Note = {
        id: crypto.randomUUID(),
        title,
        body,
        createdAt: Date.now(),
      };
      setNotes((prev) => [note, ...prev]);
      return `Note created: ${title}`;
    },
  );

  useAgentTool("removeNote", async ({ id }: { id: string }) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    return `Note removed: ${id}`;
  });

  useAgentTool("listNotes", async () => notes);

  useAgentTool("searchNotes", async ({ query }: { query: string }) => {
    const q = query.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>📝 Notes</h2>
        <span className="badge">{notes.length} notes</span>
      </div>
      <p className="page-hint">
        Try: "Create a note about our meeting" or "Search my notes for
        important"
      </p>
      {notes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📄</span>
          <p>No notes yet. Ask the agent to create some!</p>
        </div>
      ) : (
        <div className="notes-grid">
          {notes.map((note) => (
            <div key={note.id} className="note-card">
              <div className="note-header">
                <h3>{note.title}</h3>
                <button
                  className="btn-delete"
                  onClick={() =>
                    setNotes((p) => p.filter((n) => n.id !== note.id))
                  }
                >
                  ✕
                </button>
              </div>
              <p className="note-body">{note.body}</p>
              <span className="note-meta">
                #{note.id.slice(0, 6)} ·{" "}
                {new Date(note.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
