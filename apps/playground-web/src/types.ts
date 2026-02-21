export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

export interface AppSettings {
  darkMode: boolean;
  fontSize: "small" | "medium" | "large";
  accentColor: "blue" | "purple" | "green" | "orange" | "pink";
}

export type PageId = "todos" | "notes" | "settings";
