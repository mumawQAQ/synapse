import { useAgentTool, useContextSync } from "@mumaw/synapse-client";
import type { AppSettings } from "../types";

interface SettingsPageProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function SettingsPage({
  settings,
  onSettingsChange,
}: SettingsPageProps) {
  useContextSync({ page_id: "settings" }, "SettingsPage");

  useAgentTool("toggleDarkMode", async () => {
    const next = !settings.darkMode;
    onSettingsChange({ ...settings, darkMode: next });
    return { darkMode: next };
  });

  useAgentTool(
    "setFontSize",
    async ({ size }: { size: "small" | "medium" | "large" }) => {
      onSettingsChange({ ...settings, fontSize: size });
      return { fontSize: size };
    },
  );

  useAgentTool(
    "setAccentColor",
    async ({
      color,
    }: {
      color: "blue" | "purple" | "green" | "orange" | "pink";
    }) => {
      onSettingsChange({ ...settings, accentColor: color });
      return { accentColor: color };
    },
  );

  useAgentTool("getSettings", async () => settings);

  const colors = ["blue", "purple", "green", "orange", "pink"] as const;
  const fontSizes = ["small", "medium", "large"] as const;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>⚙️ Settings</h2>
      </div>
      <p className="page-hint">
        Try: "Turn on dark mode" or "Change the accent color to purple"
      </p>

      <div className="settings-section">
        <h3>Appearance</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>🌙 Dark Mode</span>
            <span className="setting-desc">Toggle dark/light theme</span>
          </div>
          <button
            className={`toggle ${settings.darkMode ? "active" : ""}`}
            onClick={() =>
              onSettingsChange({ ...settings, darkMode: !settings.darkMode })
            }
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>🔤 Font Size</span>
            <span className="setting-desc">Adjust UI text size</span>
          </div>
          <div className="btn-group">
            {fontSizes.map((size) => (
              <button
                key={size}
                className={`btn-option ${settings.fontSize === size ? "active" : ""}`}
                onClick={() =>
                  onSettingsChange({ ...settings, fontSize: size })
                }
              >
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>🎨 Accent Color</span>
            <span className="setting-desc">Choose your theme color</span>
          </div>
          <div className="color-picker">
            {colors.map((color) => (
              <button
                key={color}
                className={`color-dot ${color} ${settings.accentColor === color ? "active" : ""}`}
                onClick={() =>
                  onSettingsChange({ ...settings, accentColor: color })
                }
                title={color}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
