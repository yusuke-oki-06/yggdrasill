(function () {
  const vscode = acquireVsCodeApi();

  const KIND_COLOR = {
    workspace: "#7c5cff",
    skill: "#f0a830",
    pluginGroup: "#26c4b5",
    hook: "#e05b5b",
    mcp: "#5b8ff7",
    memory: "#a06cd5",
    permission: "#6b7280",
    rule: "#38bdf8",
    claudeMd: "#ec4899",
    env: "#84cc16",
    plugin: "#14b8a6",
    tool: "#22d3ee",
    configFile: "#facc15",
  };

  const KIND_SHAPE = {
    workspace: "round-rectangle",
    skill: "ellipse",
    pluginGroup: "round-rectangle",
    hook: "diamond",
    mcp: "hexagon",
    memory: "round-tag",
    permission: "vee",
    rule: "round-triangle",
    claudeMd: "round-rectangle",
    env: "tag",
    plugin: "round-rectangle",
    tool: "ellipse",
    configFile: "round-rectangle",
  };

  if (window.cytoscape && window.cytoscapeFcose) {
    window.cytoscape.use(window.cytoscapeFcose);
  }

  const style = [
    {
      selector: "node",
      style: {
        "background-color": (ele) => KIND_COLOR[ele.data("kind")] || "#888",
        shape: (ele) => KIND_SHAPE[ele.data("kind")] || "ellipse",
        label: "data(label)",
        color: "#ffffff",
        "text-outline-color": "rgba(0,0,0,0.7)",
        "text-outline-width": 2,
        "font-size": 13,
        width: 52,
        height: 52,
        "text-wrap": "wrap",
        "text-max-width": "140px",
        "text-valign": "center",
        "text-halign": "center",
        "border-width": 1,
        "border-color": "rgba(0,0,0,0.25)",
      },
    },
    {
      selector: "node[kind = 'workspace']",
      style: { width: 96, height: 96, "font-size": 18 },
    },
    {
      selector: "node[kind = 'pluginGroup']",
      style: { width: 72, height: 72, "font-size": 14 },
    },
    {
      selector: "node[kind = 'env'], node[kind = 'tool']",
      style: { width: 38, height: 38, "font-size": 11 },
    },
    {
      selector: "edge",
      style: {
        width: 1,
        "line-color": "rgba(150,150,150,0.55)",
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "target-arrow-color": "rgba(150,150,150,0.55)",
        "arrow-scale": 0.8,
        label: "data(relation)",
        "font-size": 8,
        color: "rgba(180,180,180,0.8)",
        "text-background-opacity": 0,
        "text-rotation": "autorotate",
      },
    },
    {
      selector: "edge[kind = 'ownership']",
      style: {
        width: 0.6,
        "line-color": "rgba(150,150,150,0.22)",
        "target-arrow-color": "rgba(150,150,150,0.22)",
        "text-opacity": 0,
      },
    },
    {
      selector: "edge[kind = 'relationship']",
      style: {
        width: 1.6,
        "line-color": "#8b5cf6",
        "target-arrow-color": "#8b5cf6",
        color: "#c4b5fd",
        "font-size": 9,
      },
    },
    {
      selector: ".faded",
      style: { opacity: 0.12, "text-opacity": 0.05 },
    },
    {
      selector: ".has-issue",
      style: {
        "border-color": "#ef4444",
        "border-width": 3,
        "border-style": "solid",
      },
    },
    {
      selector: ":selected",
      style: {
        "border-color": "#ffd166",
        "border-width": 3,
      },
    },
  ];

  const cy = window.cytoscape({
    container: document.getElementById("cy"),
    elements: [],
    style,
    wheelSensitivity: 0.4,
    minZoom: 0.2,
    maxZoom: 4,
  });

  const RING = {
    workspace: 5,
    pluginGroup: 4,
    plugin: 4,
    mcp: 4,
    claudeMd: 4,
    skill: 3,
    hook: 3,
    memory: 3,
    rule: 3,
    permission: 2,
    configFile: 2,
    tool: 1,
    env: 1,
  };

  let currentLayout = "concentric";

  cy.on("tap", "node", (evt) => {
    const data = evt.target.data();
    if (data.path) {
      vscode.postMessage({ type: "openFile", path: data.path });
    }
  });

  const search = document.getElementById("search");
  const stats = document.getElementById("stats");
  const refit = document.getElementById("refit");
  const showPlugins = document.getElementById("show-plugins");
  const showEnv = document.getElementById("show-env");
  const showPerms = document.getElementById("show-perms");
  const layoutSelect = document.getElementById("layout-select");

  search.addEventListener("input", () => applyFilter(search.value));
  refit.addEventListener("click", () => smartFit());
  if (showPlugins) {
    showPlugins.addEventListener("change", () => {
      vscode.postMessage({ type: "setIncludePluginSkills", value: showPlugins.checked });
    });
  }
  if (showEnv) {
    showEnv.addEventListener("change", () => {
      vscode.postMessage({ type: "setIncludeEnv", value: showEnv.checked });
    });
  }
  if (showPerms) {
    showPerms.addEventListener("change", () => {
      vscode.postMessage({ type: "setIncludePermissions", value: showPerms.checked });
    });
  }
  if (layoutSelect) {
    layoutSelect.addEventListener("change", () => {
      currentLayout = layoutSelect.value;
      runLayout();
      smartFit();
    });
  }

  function applyFilter(term) {
    const q = term.trim().toLowerCase();
    if (!q) {
      cy.elements().removeClass("faded");
      return;
    }
    const matchedNodes = cy.nodes().filter((n) => {
      const data = n.data();
      return (
        (data.label || "").toLowerCase().includes(q) ||
        (data.description || "").toLowerCase().includes(q)
      );
    });
    const matchedWithEdges = matchedNodes.closedNeighborhood();
    cy.elements().addClass("faded");
    matchedWithEdges.removeClass("faded");
  }

  function runLayout() {
    let opts;
    if (currentLayout === "concentric") {
      opts = {
        name: "concentric",
        concentric: (n) => RING[n.data("kind")] ?? 0,
        levelWidth: () => 1,
        minNodeSpacing: 80,
        spacingFactor: 1.4,
        startAngle: -Math.PI / 2,
        clockwise: true,
        animate: false,
        padding: 60,
      };
    } else if (currentLayout === "breadthfirst") {
      const ws = cy.nodes('[kind = "workspace"]');
      opts = {
        name: "breadthfirst",
        roots: ws.length ? ws.map((n) => n.id()) : undefined,
        spacingFactor: 1.5,
        animate: false,
        padding: 60,
      };
    } else if (currentLayout === "fcose" && window.cytoscapeFcose) {
      opts = {
        name: "fcose",
        animate: false,
        quality: "default",
        randomize: true,
        idealEdgeLength: 200,
        nodeRepulsion: 18000,
        gravity: 0.25,
        gravityRangeCompound: 1.2,
        nodeSeparation: 160,
        nestingFactor: 0.6,
        padding: 80,
      };
    } else {
      opts = {
        name: "cose",
        animate: false,
        nodeRepulsion: 16000,
        idealEdgeLength: 180,
        gravity: 0.25,
        padding: 60,
      };
    }
    cy.layout(opts).run();
  }

  function smartFit() {
    const total = cy.nodes().length;
    if (total === 0) return;
    if (total <= 40) {
      cy.animate({ fit: { padding: 60 }, duration: 250 });
      return;
    }
    cy.fit(undefined, 60);
    if (cy.zoom() < 0.45) {
      cy.zoom(0.7);
      const ws = cy.nodes('[kind = "workspace"]')[0];
      if (ws) cy.center(ws);
      else cy.center();
    }
  }

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;
    if (msg.type === "update") {
      cy.elements().remove();
      cy.add(msg.elements.nodes);
      cy.add(msg.elements.edges);
      runLayout();
      smartFit();
      const issueTargets = new Set(msg.issueTargets || []);
      cy.nodes().forEach((n) => {
        if (issueTargets.has(n.id())) n.addClass("has-issue");
        else n.removeClass("has-issue");
      });
      const issueCount = issueTargets.size;
      const relCount = msg.elements.edges.filter((e) => e.data.kind === "relationship").length;
      stats.textContent =
        `${msg.elements.nodes.length} nodes · ${msg.elements.edges.length} edges` +
        (relCount ? ` · ${relCount} rel` : "") +
        (issueCount ? ` · ${issueCount} ⚠` : "");
      applyFilter(search.value);
    }
  });

  vscode.postMessage({ type: "ready" });
})();
