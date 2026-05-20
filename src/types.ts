export interface MindMapNodeData {
  id: string;
  name: string;
  children: MindMapNodeData[];
  description?: string;
  isCollapsed?: boolean;
}

export interface AppSettings {
  apiKey: string;
  model: string;
  theme: "light" | "dark";
}

export interface MindMapMeta {
  id: string;
  name: string;
  modified: number;
}
