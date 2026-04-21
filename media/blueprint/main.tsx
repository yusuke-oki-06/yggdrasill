import "@xyflow/react/dist/style.css";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const vscode = window.acquireVsCodeApi();

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App vscode={vscode} />);
}
