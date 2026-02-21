import { useAgentChat, useAgentClient } from "@mumaw/synapse-client";
import { useState, useRef, useEffect } from "react";
import { TodosPage } from "./pages/TodosPage";
import { NotesPage } from "./pages/NotesPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { PageId, AppSettings } from "./types";

const PAGES: { id: PageId; label: string; icon: string }[] = [
  { id: "todos", label: "Todos", icon: "📋" },
  { id: "notes", label: "Notes", icon: "📝" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

function App() {
  const [currentMsg, setCurrentMsg] = useState("");
  const [activePage, setActivePage] = useState<PageId>("todos");
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: true,
    fontSize: "medium",
    accentColor: "blue",
  });

  const { history, sendMessage, lastResponse, suggestedActions } =
    useAgentChat();
  const client = useAgentClient();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, lastResponse, suggestedActions]);

  // Apply settings to root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", settings.darkMode ? "dark" : "light");
    root.setAttribute("data-font", settings.fontSize);
    root.setAttribute("data-accent", settings.accentColor);
  }, [settings]);

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentMsg) {
      sendMessage(currentMsg);
      setCurrentMsg("");
    }
  };

  const mergedContext = client.getMergedContext();

  return (
    <div className="app-shell">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-text">Synapse</span>
        </div>

        <nav className="nav-tabs">
          {PAGES.map((page) => (
            <button
              key={page.id}
              className={`nav-tab ${activePage === page.id ? "active" : ""}`}
              onClick={() => setActivePage(page.id)}
            >
              <span className="nav-icon">{page.icon}</span>
              <span className="nav-label">{page.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Context Inspector ────────────────────────────────── */}
        <div className="context-inspector">
          <h4>🔍 Live Context</h4>
          <pre>{JSON.stringify(mergedContext, null, 2)}</pre>
        </div>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>Connected</span>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="main-content">
        {activePage === "todos" && <TodosPage />}
        {activePage === "notes" && <NotesPage />}
        {activePage === "settings" && (
          <SettingsPage settings={settings} onSettingsChange={setSettings} />
        )}
      </main>

      {/* ── Chat Panel ───────────────────────────────────────────── */}
      <aside className="chat-panel">
        <div className="chat-header">
          <h3>💬 Agent Chat</h3>
          <span className="chat-page-tag">{activePage}</span>
        </div>

        <div className="chat-messages">
          {history.length === 0 && (
            <div className="chat-empty">
              <p>Chat with the AI agent.</p>
              <p className="chat-empty-sub">
                It can only use tools for the active page.
              </p>
            </div>
          )}
          {history.map((msg, i) => (
            <div
              key={i}
              className={`chat-bubble ${msg.role === "user" ? "user" : "agent"}`}
            >
              <span className="bubble-role">
                {msg.role === "user" ? "You" : "Agent"}
              </span>
              <span className="bubble-text">{msg.content}</span>
            </div>
          ))}
          {lastResponse &&
            !lastResponse.done &&
            !history.some((h) => h.content === lastResponse.content) && (
              <div className="chat-bubble agent typing">
                <span className="bubble-role">Agent</span>
                <span className="bubble-text">
                  <span className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                </span>
              </div>
            )}
          <div ref={chatEndRef} />
        </div>

        {suggestedActions.length > 0 && (
          <div className="suggested-actions">
            {suggestedActions.map((action, i) => (
              <button
                key={i}
                className="action-chip"
                onClick={() => {
                  setCurrentMsg(action);
                }}
              >
                {action}
              </button>
            ))}
          </div>
        )}

        <form className="chat-input-form" onSubmit={handleSend}>
          <input
            type="text"
            placeholder={`Ask about ${activePage}...`}
            className="chat-input"
            value={currentMsg}
            onChange={(e) => setCurrentMsg(e.target.value)}
          />
          <button type="submit" className="chat-send">
            ↑
          </button>
        </form>
      </aside>
    </div>
  );
}

export default App;
