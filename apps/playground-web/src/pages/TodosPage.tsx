import { useAgentTool, useContextSync } from "@mumaw/synapse-client";
import { useState } from "react";
import type { Todo } from "../types";

export function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useContextSync({ page_id: "todos" }, "TodosPage");

  useAgentTool("addTodo", async ({ text }: { text: string }) => {
    const newTodo: Todo = { id: crypto.randomUUID(), text, completed: false };
    setTodos((prev) => [...prev, newTodo]);
    return `Todo added: ${text}`;
  });

  useAgentTool("removeTodo", async ({ id }: { id: string }) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    return `Todo removed: ${id}`;
  });

  useAgentTool("toggleTodo", async ({ id }: { id: string }) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
    return `Todo toggled: ${id}`;
  });

  useAgentTool("listTodos", async () => todos);

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>📋 Todos</h2>
        <span className="badge">{todos.length} items</span>
      </div>
      <p className="page-hint">
        Try: "Add a todo to buy groceries" or "Mark my first todo as done"
      </p>
      {todos.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">✨</span>
          <p>No todos yet. Ask the agent to add some!</p>
        </div>
      ) : (
        <ul className="item-list">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className={`item ${todo.completed ? "completed" : ""}`}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() =>
                  setTodos((p) =>
                    p.map((t) =>
                      t.id === todo.id ? { ...t, completed: !t.completed } : t,
                    ),
                  )
                }
              />
              <span className="item-text">{todo.text}</span>
              <button
                className="btn-delete"
                onClick={() =>
                  setTodos((p) => p.filter((t) => t.id !== todo.id))
                }
              >
                ✕
              </button>
              <span className="item-id">#{todo.id.slice(0, 6)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
