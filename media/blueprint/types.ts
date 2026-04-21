export type NodeKind =
  | "workspace"
  | "plugin"
  | "skill"
  | "hook"
  | "mcp"
  | "memory"
  | "permission"
  | "rule"
  | "claudeMd"
  | "env"
  | "pluginGroup"
  | "tool"
  | "configFile";

export type EdgeKind = "ownership" | "relationship";

export interface NodeData {
  id: string;
  label: string;
  kind: NodeKind;
  source?: string;
  path?: string;
  description?: string;
  parent?: string;
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  relation: string;
  kind: EdgeKind;
}

export interface GraphPayload {
  nodes: { data: NodeData }[];
  edges: { data: EdgeData }[];
}

export interface UpdateMessage {
  type: "update";
  elements: GraphPayload;
  issueTargets: string[];
}

export type FromExtensionMessage = UpdateMessage;

export interface OpenFileMessage {
  type: "openFile";
  path: string;
}

export interface ReadyMessage {
  type: "ready";
}

export interface SetIncludePluginSkillsMessage {
  type: "setIncludePluginSkills";
  value: boolean;
}

export interface SetIncludeEnvMessage {
  type: "setIncludeEnv";
  value: boolean;
}

export interface SetIncludePermissionsMessage {
  type: "setIncludePermissions";
  value: boolean;
}

export type ToExtensionMessage =
  | OpenFileMessage
  | ReadyMessage
  | SetIncludePluginSkillsMessage
  | SetIncludeEnvMessage
  | SetIncludePermissionsMessage;

export interface VsCodeApi {
  postMessage(msg: ToExtensionMessage): void;
}

declare global {
  interface Window {
    acquireVsCodeApi(): VsCodeApi;
  }
}
