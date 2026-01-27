import React, { useEffect, useRef, useMemo, useCallback, memo } from "react";
import * as d3 from "d3";
import { RobotOutlined } from "@ant-design/icons";
import {
  Commit,
  Branch,
  VisualizationData,
  GraphNode,
} from "@src/shared/types";
import { Legend } from "./Legend";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./ToastContext";

interface CommitGraphProps {
  commits: Commit[];
  branches: Branch[];
  headCommitHash?: string;
  onCommitSelect?: (commit: Commit) => void;
  selectedCommitHash?: string;
  stashes?: string[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  onLoadAll?: () => void;
  onAiClick?: () => void;
  isTimeMachineActive?: boolean;
  onTimeMachineToggle?: () => void;
  repoPath?: string;
}

export const CommitGraph = memo(
  ({
    commits,
    branches,
    headCommitHash,
    onCommitSelect,
    selectedCommitHash,
    stashes = [],
    onLoadMore,
    hasMore,
    onLoadAll,
    onAiClick,
    isTimeMachineActive,
    onTimeMachineToggle,
    repoPath,
  }: CommitGraphProps) => {
    const { showToast } = useToast();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(
      null,
    );
    const gRef = useRef<d3.Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    > | null>(null);

    // Persistent Layer Refs
    const laneLayerRef = useRef<d3.Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    > | null>(null);
    const edgeLayerRef = useRef<d3.Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    > | null>(null);
    const labelLayerRef = useRef<d3.Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    > | null>(null);
    const nodeLayerRef = useRef<d3.Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    > | null>(null);
    const dragLayerRef = useRef<d3.Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    > | null>(null);

    const [isBranchMenuOpen, setIsBranchMenuOpen] = React.useState(false);

    const [branchSearch, setBranchSearch] = React.useState("");
    const [hoveredCommitHash, setHoveredCommitHash] = React.useState<
      string | null
    >(null);
    const [commitSearch, setCommitSearch] = React.useState("");
    const [isCalculating, setIsCalculating] = React.useState(false);
    const [data, setData] = React.useState<VisualizationData>({
      nodes: [],
      edges: [],
      laneSegments: [],
      width: 0,
      height: 0,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    });

    // Merge State
    const [mergeSource, setMergeSource] = React.useState<string | null>(null);
    const [mergeTarget, setMergeTarget] = React.useState<string | null>(null);
    const [isMergeConfirmOpen, setIsMergeConfirmOpen] = React.useState(false);

    // Calculate layout in a Web Worker
    useEffect(() => {
      if (commits.length === 0) return;
      setIsCalculating(true);
      const worker = new Worker(
        new URL("../utils/layout.worker.ts", import.meta.url),
        {
          type: "module",
        },
      );
      worker.onmessage = (event) => {
        const { type, result, error } = event.data;
        if (type === "SUCCESS") setData(result);
        else console.error("Layout worker error:", error);
        setIsCalculating(false);
        worker.terminate();
      };
      worker.postMessage({ commits, branches, headCommitHash, stashes });
      return () => worker.terminate();
    }, [commits, branches, headCommitHash, stashes]);

    const directMatches = useMemo(() => {
      if (!commitSearch.trim()) return null;
      const search = commitSearch.toLowerCase();
      const isTagSearch = search.startsWith("tag:");
      const query = isTagSearch ? search.substring(4) : search;
      if (!query) return null;
      return new Set(
        commits
          .filter((c) => {
            if (isTagSearch)
              return c.tags?.some((t) => t.toLowerCase().includes(query));
            return (
              c.message.toLowerCase().includes(query) ||
              c.author.name.toLowerCase().includes(query) ||
              c.hash.toLowerCase().includes(query) ||
              c.tags?.some((t) => t.toLowerCase().includes(query))
            );
          })
          .map((c) => c.hash),
      );
    }, [commits, commitSearch]);

    const highlightedInfo = useMemo(() => {
      const focusHash = hoveredCommitHash || selectedCommitHash;
      if (!focusHash && !directMatches) return null;
      const nodesMap = new Map(data.nodes.map((n) => [n.id, n]));
      const highlightedNodes = new Set<string>();
      const highlightedEdges = new Set<string>();

      if (focusHash) {
        highlightedNodes.add(focusHash);
        const findAncestors = (id: string) => {
          const node = nodesMap.get(id);
          if (!node) return;
          node.parents.forEach((parentId) => {
            if (!highlightedNodes.has(parentId)) {
              highlightedNodes.add(parentId);
              findAncestors(parentId);
            }
          });
        };
        findAncestors(focusHash);
        const findDescendants = (id: string) => {
          const node = nodesMap.get(id);
          if (!node) return;
          node.children.forEach((childId) => {
            if (!highlightedNodes.has(childId)) {
              highlightedNodes.add(childId);
              findDescendants(childId);
            }
          });
        };
        findDescendants(focusHash);
      }

      if (directMatches) directMatches.forEach((h) => highlightedNodes.add(h));
      data.edges.forEach((edge) => {
        if (
          highlightedNodes.has(edge.source) &&
          highlightedNodes.has(edge.target)
        ) {
          highlightedEdges.add(edge.id);
        }
      });
      return { nodes: highlightedNodes, edges: highlightedEdges };
    }, [selectedCommitHash, directMatches, data, hoveredCommitHash]);

    const centerOnCommit = useCallback(
      (hash: string) => {
        if (!svgRef.current || !zoomRef.current) return;
        const targetNode = data.nodes.find((n) => n.id === hash);
        if (!targetNode) return;
        const svg = d3.select(svgRef.current);
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const transform = d3.zoomIdentity
          .translate(width / 2 - targetNode.x, height / 2 - targetNode.y)
          .scale(1);
        svg
          .transition()
          .duration(750)
          .call(zoomRef.current.transform, transform);
      },
      [data.nodes],
    );

    const goToHead = () => headCommitHash && centerOnCommit(headCommitHash);

    const handleMergeConfirm = async () => {
      if (!repoPath || !mergeSource || !mergeTarget) return;
      try {
        await window.gitcanopyAPI.mergeBranch(repoPath, mergeSource);
        showToast(
          `Merged ${mergeSource} into ${mergeTarget} successfully`,
          "success",
        );
      } catch (error: any) {
        console.error("Merge failed:", error);
        showToast(`Merge failed: ${error.message}`, "error");
      } finally {
        setIsMergeConfirmOpen(false);
        setMergeSource(null);
        setMergeTarget(null);
      }
    };

    // 1. Initialize SVG, Zoom & Layers (Runs once)
    useEffect(() => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const g = svg.append("g");
      gRef.current = g;

      // Initialize Layers in order
      laneLayerRef.current = g.append("g").attr("class", "lane-layer");
      edgeLayerRef.current = g.append("g").attr("class", "edge-layer");
      labelLayerRef.current = g.append("g").attr("class", "label-layer");
      nodeLayerRef.current = g.append("g").attr("class", "node-layer");
      dragLayerRef.current = g
        .append("g")
        .attr("class", "drag-layer")
        .style("pointer-events", "none");

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()

        .scaleExtent([0.1, 2])
        .on("zoom", (event) => g.attr("transform", event.transform));

      zoomRef.current = zoom;
      svg.call(zoom);
      svg.call(zoom.transform, d3.zoomIdentity.translate(40, 60).scale(0.8));
    }, []);

    // 2. Draw Graph Structure (Runs when data changes)
    useEffect(() => {
      if (!laneLayerRef.current || !data.nodes.length) return;

      const laneLayer = laneLayerRef.current;
      const edgeLayer = edgeLayerRef.current!;
      const labelLayer = labelLayerRef.current!;
      const nodeLayer = nodeLayerRef.current!;
      const dragLayer = dragLayerRef.current!;

      // Clear layers before redraw (Better than clearing everything)
      laneLayer.selectAll("*").remove();
      edgeLayer.selectAll("*").remove();
      labelLayer.selectAll("*").remove();
      nodeLayer.selectAll("*").remove();
      dragLayer.selectAll("*").remove();

      // Draw Lanes
      laneLayer
        .selectAll("line")
        .data(data.laneSegments)
        .enter()
        .append("line")
        .attr("x1", (d) => d.x)
        .attr("y1", 0)
        .attr("x2", (d) => d.x)
        .attr("y2", data.height)
        .attr("stroke", (d) => d.color)
        .attr("stroke-width", 2)
        .attr("opacity", 0.15);

      // Draw Edges
      edgeLayer
        .selectAll("path")
        .data(data.edges)
        .enter()
        .append("path")
        .attr("class", "edge")
        .attr("id", (d) => `edge-${d.id}`)
        .attr("d", (d: any) => {
          const s = data.nodes.find((n) => n.id === d.source);
          const t = data.nodes.find((n) => n.id === d.target);
          if (!s || !t) return null;
          if (Math.abs(s.x - t.x) < 1) return `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
          const cp = s.y - (s.y - t.y) / 2;
          return `M ${s.x} ${s.y} C ${s.x} ${cp}, ${t.x} ${cp}, ${t.x} ${t.y}`;
        })
        .attr("fill", "none")
        .attr("stroke", (d) => d.color)
        .attr("stroke-dasharray", (d) => (d.type === "merge" ? "4,4" : "none"))
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.6);

      // Draw Node Groups
      const nodes = nodeLayer
        .selectAll("g")
        .data(data.nodes, (d: any) => d.id)
        .enter()
        .append("g")
        .attr("class", "node-group")
        .attr("id", (d) => `node-${d.id}`)
        .attr("transform", (d) => `translate(${d.x}, ${d.y}) scale(0)`) // Start at scale 0
        .style("cursor", "pointer")
        .on("click", (e, d) => onCommitSelect?.(d.commit))
        .on("mouseenter", (e, d) => setHoveredCommitHash(d.id))
        .on("mouseleave", () => setHoveredCommitHash(null));

      nodes
        .transition()
        .duration(500)
        .delay((d, i) => Math.min(i * 10, 500)) // Staggered entrance
        .attr("transform", (d) => `translate(${d.x}, ${d.y}) scale(1)`);

      nodes.each(function (d) {
        const group = d3.select(this);
        const isHead = d.id === headCommitHash;

        // HEAD Pulse Aura
        if (isHead) {
          group
            .append("circle")
            .attr("r", 12)
            .attr("fill", d.color)
            .attr("class", "head-aura animate-pulse")
            .attr("opacity", 0.3)
            .style("pointer-events", "none");
        }

        if (d.shape === "diamond") {
          const diamondSize = d.size * 2.0;
          const halfSize = diamondSize / 2;

          // Main shape
          group
            .append("rect")
            .attr("width", diamondSize)
            .attr("height", diamondSize)
            .attr("x", -halfSize)
            .attr("y", -halfSize)
            .attr("transform", "rotate(45)")
            .attr("fill", d.color);

          // Avatar or Initials
          if (d.commit.author.avatarUrl) {
            const clipId = `clip-${d.id}`;

            group
              .append("clipPath")
              .attr("id", clipId)
              .append("rect")
              .attr("width", diamondSize)
              .attr("height", diamondSize)
              .attr("x", -halfSize)
              .attr("y", -halfSize)
              .attr("transform", "rotate(45)");

            const img = group
              .append("image")
              .attr("href", d.commit.author.avatarUrl)
              .attr("width", diamondSize * 1.4)
              .attr("height", diamondSize * 1.4)
              .attr("x", -diamondSize * 0.7)
              .attr("y", -diamondSize * 0.7)
              .attr("clip-path", `url(#${clipId})`);

            // Handle image error - fallback to initials
            img.on("error", function () {
              d3.select(this).remove();

              const initial = d.commit.author.name.charAt(0).toUpperCase();
              group
                .append("text")
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .attr("fill", "white")
                .style("font-size", "10px")
                .style("font-weight", "bold")
                .style("pointer-events", "none")
                .text(initial);
            });

            // Border on top
            group
              .append("rect")
              .attr("width", diamondSize)
              .attr("height", diamondSize)
              .attr("x", -halfSize)
              .attr("y", -halfSize)
              .attr("transform", "rotate(45)")
              .attr("fill", "none")
              .attr("stroke", d.color) // Will be updated by Phase 3
              .attr("stroke-width", 2)
              .attr("class", "node-border");
          } else {
            const initial = d.commit.author.name.charAt(0).toUpperCase();
            group
              .append("text")
              .attr("dy", "0.35em")
              .attr("text-anchor", "middle")
              .attr("fill", "white")
              .style("font-size", "10px")
              .style("font-weight", "bold")
              .style("pointer-events", "none")
              .text(initial);
          }
        } else if (d.shape === "square") {
          const squareSize = d.size * 1.6;

          group
            .append("rect")
            .attr("width", squareSize)
            .attr("height", squareSize)
            .attr("x", -squareSize / 2)
            .attr("y", -squareSize / 2)
            .attr("rx", 2)
            .attr("fill", d.color);

          group
            .append("text")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .style("pointer-events", "none")
            .text(d.id.startsWith("stash@{") ? "S" : "R");
        } else {
          // Circle
          group.append("circle").attr("r", d.size).attr("fill", d.color);

          // Commit Type Initial
          const typeInitialMap: Record<string, string> = {
            feat: "F",
            fix: "X",
            docs: "D",
            style: "S",
            refactor: "R",
            perf: "P",
            test: "T",
            chore: "C",
            revert: "V",
          };
          const typeInitial = typeInitialMap[d.commit.type] || "";

          group
            .append("text")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .style("font-size", "8px")
            .style("font-weight", "bold")
            .style("pointer-events", "none")
            .text(typeInitial);
        }
      });

      // Draw Labels (Memoized labels logic)
      const maxGraphX = Math.max(...data.nodes.map((n) => n.x), 0);
      const infoXOffset = maxGraphX + 60;
      const commitToBranches = new Map<string, Branch[]>();
      branches.forEach((b) => {
        const list = commitToBranches.get(b.objectName) || [];
        list.push(b);
        commitToBranches.set(b.objectName, list);
      });

      // Drag Behavior for Branch Tips
      const dragBehavior = d3
        .drag<SVGGElement, Branch>()
        .on("start", function (event, d) {
          // Create ghost element in drag layer
          const ghost = dragLayer
            .append("g")
            .attr("class", "drag-ghost")
            .attr("transform", `translate(${event.x}, ${event.y})`);

          ghost
            .append("rect")
            .attr("width", 100)
            .attr("height", 24)
            .attr("rx", 12)
            .attr("fill", d.color)
            .attr("opacity", 0.8)
            .attr("x", -50)
            .attr("y", -12);

          ghost
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "white")
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .text(`Merging ${d.name}...`);

          d3.select(this).attr("opacity", 0.5);
        })
        .on("drag", function (event) {
          // Move ghost
          dragLayer
            .select(".drag-ghost")
            .attr("transform", `translate(${event.x}, ${event.y})`);

          // Detect collision with other branch labels
          let foundTarget: string | null = null;

          labelLayer.selectAll(".branch-label").each(function (bd: any) {
            // Skip self
            if (bd.name === (event.subject as Branch).name) return;

            // Simple proximity check using raw coordinates (since we are in the same <g>)
            // Note: The event.x/y are relative to the parent <g> (gRef),
            // and branch labels are also children of labelLayer which is child of gRef.
            // However, branch labels have a transform applied.
            // We need to get the transformed position of the label group.

            // Actually, d3.drag event gives coords relative to the container.
            // Let's use simple distance check to the label's center.
            // We stored the transform in the datum? No.
            // We can use the parent group's transform (commit group).

            const parentGroup = d3.select(
              (this as Element).parentNode as Element,
            );
            // parent group datum is GraphNode
            const nodeData = parentGroup.datum() as GraphNode;

            // Approximate label position: nodeY, infoXOffset + internalOffset
            // This is hard to calculate precisely without DOM inspection.
            // Let's rely on DOM-based collision.

            // Convert event coordinates (SVG space) to Screen space for comparison
            // Or convert Screen rect to SVG space.
            // Simpler: Use d3.pointer or verify overlap in SVG logic.

            // Let's just assume if we are hovering close to the commit row Y and X > infoXOffset
            if (Math.abs(event.y - nodeData.y) < 20 && event.x > infoXOffset) {
              foundTarget = bd.name;
              d3.select(this)
                .select("rect")
                .attr("stroke", "white")
                .attr("stroke-width", 3);
            } else {
              d3.select(this)
                .select("rect")
                .attr("stroke", "white")
                .attr("stroke-width", 0.5);
            }
          });

          if (!foundTarget) {
            // Clear highlights
            labelLayer
              .selectAll(".branch-label rect")
              .attr("stroke", "white")
              .attr("stroke-width", 0.5);
          }
        })
        .on("end", function (event, d) {
          dragLayer.selectAll("*").remove();
          d3.select(this).attr("opacity", 1);
          labelLayer
            .selectAll(".branch-label rect")
            .attr("stroke", "white")
            .attr("stroke-width", 0.5);

          // Final detection
          let finalTarget: string | null = null;
          labelLayer.selectAll(".branch-label").each(function (bd: any) {
            if (bd.name === d.name) return;
            const parentGroup = d3.select(
              (this as Element).parentNode as Element,
            );
            const nodeData = parentGroup.datum() as GraphNode;

            if (Math.abs(event.y - nodeData.y) < 20 && event.x > infoXOffset) {
              finalTarget = bd.name;
            }
          });

          if (finalTarget) {
            setMergeSource(d.name);
            setMergeTarget(finalTarget);
            setIsMergeConfirmOpen(true);
          }
        });

      labelLayer
        .selectAll("g")
        .data(data.nodes)
        .enter()
        .append("g")
        .attr("class", "label-group")
        .attr("id", (d) => `label-${d.id}`)
        .attr("transform", (d) => `translate(${infoXOffset}, ${d.y})`)
        .style("cursor", "pointer")
        .on("click", (e, d) => onCommitSelect?.(d.commit))
        .each(function (node) {
          const rowG = d3.select(this);
          const nodeBranches = commitToBranches.get(node.id) || [];
          const nodeTags = node.commit.tags || [];
          let labelXOffset = 0;

          nodeBranches.forEach((branch) => {
            const w = branch.name.length * 6.5 + 14;
            const p = rowG
              .append("g")
              .attr("transform", `translate(${labelXOffset}, -9)`)
              .attr("class", "branch-label")
              .datum(branch) // Bind branch data to this group
              .style("cursor", "grab"); // Show grab cursor

            p.append("rect")
              .attr("width", w)
              .attr("height", 18)
              .attr("rx", 9)
              .attr("fill", branch.color)
              .attr("stroke", "white")
              .attr("stroke-width", 0.5);

            p.append("text")
              .attr("x", w / 2)
              .attr("y", 9)
              .attr("dy", "0.35em")
              .attr("text-anchor", "middle")
              .attr("fill", "white")
              .style("font-size", "9px")
              .style("font-weight", "800")
              .text(branch.name);

            // Attach drag behavior
            p.call(dragBehavior as any);

            labelXOffset += w + 8;
          });

          nodeTags.forEach((tag) => {
            const w = tag.length * 6.5 + 14;
            const p = rowG
              .append("g")
              .attr("transform", `translate(${labelXOffset}, -9)`);
            p.append("rect")
              .attr("width", w)
              .attr("height", 18)
              .attr("rx", 4)
              .attr("fill", "#eab308")
              .attr("stroke", "white")
              .attr("stroke-width", 0.5);
            p.append("text")
              .attr("x", w / 2)
              .attr("y", 9)
              .attr("dy", "0.35em")
              .attr("text-anchor", "middle")
              .attr("fill", "#1f2937")
              .style("font-size", "9px")
              .style("font-weight", "800")
              .text(tag);
            labelXOffset += w + 8;
          });

          rowG
            .append("text")
            .attr("x", labelXOffset)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .style("font-size", "13px")
            .style("font-weight", "500")
            .attr("fill", "currentColor")
            .text(node.commit.shortMessage);
        });
    }, [data, branches, onCommitSelect, headCommitHash]);

    // 3. Fast Style Updates (Runs on hover/selection/search) - NO REDRAW
    useEffect(() => {
      if (!gRef.current || !data.nodes.length) return;
      const g = gRef.current;

      // Fast update for nodes
      g.selectAll(".node-group").each(function (datum) {
        const d = datum as GraphNode;
        const isHighlighted =
          !highlightedInfo || highlightedInfo.nodes.has(d.id);
        const isSelected = d.id === selectedCommitHash;
        const isSearchMatch = directMatches?.has(d.id);
        const group = d3.select<SVGGElement, GraphNode>(this as any);

        group
          .transition("style")
          .duration(150)
          .attr("opacity", isHighlighted ? 1.0 : 0.2)
          .attr(
            "transform",
            `translate(${d.x}, ${d.y}) scale(${isSelected || d.id === hoveredCommitHash ? 1.2 : 1})`,
          );

        // Selection ring
        let ring = group.select<SVGCircleElement>(".selection-ring");
        if (isSelected || isSearchMatch) {
          if (ring.empty()) {
            ring = group
              .append("circle")
              .attr("class", "selection-ring")
              .attr("r", d.size + 4)
              .attr("fill", "none")
              .attr("stroke-width", 2);
          }
          ring
            .attr("stroke", isSearchMatch ? "#3b82f6" : "#fff")
            .style(
              "filter",
              isSearchMatch ? "drop-shadow(0 0 4px #3b82f6)" : "none",
            );
        } else {
          ring.remove();
        }
      });

      // Fast update for edges
      g.selectAll(".edge")
        .transition("style")
        .duration(150)
        .attr("opacity", (d) => {
          const edge = d as any;
          if (!highlightedInfo) return 0.6;
          return highlightedInfo.edges.has(edge.id) ? 1.0 : 0.1;
        })
        .attr("stroke-width", (d) => {
          const edge = d as any;
          return highlightedInfo?.edges.has(edge.id) ? 2.5 : 1.5;
        });

      // Fast update for labels
      g.selectAll(".label-group")
        .transition("style")
        .duration(150)
        .attr("opacity", (d) => {
          const node = d as GraphNode;
          if (!highlightedInfo) return 1.0;
          return highlightedInfo.nodes.has(node.id) ? 1.0 : 0.2;
        });
    }, [
      highlightedInfo,
      selectedCommitHash,
      directMatches,
      hoveredCommitHash,
      data.nodes,
    ]);

    const filteredBranches = useMemo(
      () =>
        branches.filter((b) =>
          b.name.toLowerCase().includes(branchSearch.toLowerCase()),
        ),
      [branches, branchSearch],
    );

    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-zed-bg dark:bg-zed-dark-bg overflow-hidden relative flex flex-col"
      >
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-zed-border dark:border-zed-dark-border bg-zed-surface/50 dark:bg-zed-dark-surface/50 backdrop-blur-sm">
          <div className="flex items-center gap-6">
            <div className="relative group w-64">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zed-muted dark:text-zed-dark-muted group-focus-within:text-zed-accent">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search (use 'tag:' for tags)..."
                value={commitSearch}
                onChange={(e) => setCommitSearch(e.target.value)}
                className="w-full bg-zed-element dark:bg-zed-dark-element border border-zed-border dark:border-zed-dark-border rounded-md pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-zed-accent focus:border-zed-accent text-zed-text dark:text-zed-dark-text placeholder-zed-muted/40 dark:placeholder-zed-dark-muted/40 transition-all"
              />
            </div>
            <button
              onClick={onAiClick}
              className="flex items-center gap-2 px-3 py-1 bg-zed-element dark:bg-zed-dark-element border border-zed-border dark:border-zed-dark-border rounded hover:border-zed-accent dark:hover:border-zed-dark-accent transition-all group"
              title="Ask AI (Cmd+J)"
            >
              <RobotOutlined className="text-[10px] text-zed-accent dark:text-zed-dark-accent" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-zed-muted dark:text-zed-dark-muted group-hover:text-zed-accent dark:group-hover:text-zed-dark-accent">
                AI Command
              </span>
            </button>
            <button
              onClick={onTimeMachineToggle}
              className={`flex items-center gap-2 px-3 py-1 border rounded transition-all group ${isTimeMachineActive ? "bg-zed-accent/10 border-zed-accent dark:border-zed-dark-accent" : "bg-zed-element dark:bg-zed-dark-element border-zed-border dark:border-zed-dark-border hover:border-zed-text dark:hover:border-zed-dark-text"}`}
              title="Toggle Time Machine"
            >
              <svg
                className={`w-3 h-3 ${isTimeMachineActive ? "text-zed-accent dark:text-zed-dark-accent" : "text-zed-muted dark:text-zed-dark-muted"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span
                className={`text-[9px] font-bold uppercase tracking-widest ${isTimeMachineActive ? "text-zed-accent dark:text-zed-dark-accent" : "text-zed-muted dark:text-zed-dark-muted group-hover:text-zed-text dark:group-hover:text-zed-dark-text"}`}
              >
                Time Machine
              </span>
            </button>
            <div className="w-px h-4 bg-zed-border/50 dark:bg-zed-dark-border/50 mx-1"></div>
            <div className="flex items-center gap-4 text-zed-muted dark:text-zed-dark-muted">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">
                  Commits
                </span>
                <span className="text-xs font-mono text-zed-text dark:text-zed-dark-text">
                  {commits.length}
                </span>
              </div>
              <div className="w-px h-6 bg-zed-border dark:bg-zed-dark-border"></div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">
                  Branches
                </span>
                <span className="text-xs font-mono text-zed-text dark:text-zed-dark-text">
                  {branches.length}
                </span>
              </div>
            </div>
            {isCalculating && (
              <div className="flex items-center gap-2 px-3 py-1 bg-zed-accent/10 rounded-full border border-zed-accent/20 animate-pulse ml-4 shrink-0">
                <div className="w-1.5 h-1.5 bg-zed-accent rounded-full"></div>
                <span className="text-[10px] font-bold text-zed-accent uppercase tracking-wider">
                  Calculating Layout...
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <svg ref={svgRef} className="w-full h-full" />
          <div className="absolute top-4 left-4 z-10">
            <Legend />
          </div>
          <div className="absolute top-4 right-4 flex flex-col items-end pointer-events-none">
            <div className="flex flex-col items-end gap-2 pointer-events-auto">
              <button
                onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
                className={`flex items-center gap-2 bg-zed-surface/90 dark:bg-zed-dark-surface/90 backdrop-blur-md px-3 py-1.5 rounded-md border shadow-lg transition-all ${isBranchMenuOpen ? "border-zed-accent" : "border-zed-border dark:border-zed-dark-border"}`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-zed-accent animate-pulse"></div>
                <span className="text-xs font-semibold text-zed-text dark:text-zed-dark-text">
                  Branches
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-zed-muted dark:text-zed-dark-muted transition-transform ${isBranchMenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isBranchMenuOpen && (
                <div className="bg-zed-surface/95 dark:bg-zed-dark-surface/95 backdrop-blur-xl p-2 rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl flex flex-col gap-2 w-56 animate-slide-in">
                  <div className="px-1">
                    <input
                      type="text"
                      placeholder="Search branches..."
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      className="w-full bg-zed-element dark:bg-zed-dark-element border border-zed-border dark:border-zed-dark-border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-zed-accent text-zed-text dark:text-zed-dark-text placeholder-zed-muted dark:placeholder-zed-dark-muted"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto custom-scrollbar flex flex-col max-h-80">
                    {filteredBranches.map((branch) => (
                      <button
                        key={branch.name}
                        onClick={() => {
                          centerOnCommit(branch.objectName);
                          setIsBranchMenuOpen(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-zed-element dark:hover:bg-zed-dark-element rounded transition-colors text-left group"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: branch.color }}
                        ></div>
                        <span
                          className="text-[11px] font-mono truncate text-zed-text dark:text-zed-dark-text group-hover:text-zed-accent"
                          title={branch.name}
                        >
                          {branch.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zed-surface/90 dark:bg-zed-dark-surface/90 backdrop-blur-md px-3 py-2 rounded-full shadow-lg border border-zed-border dark:border-zed-dark-border animate-slide-in">
            <button
              onClick={goToHead}
              className="flex items-center gap-2 text-xs font-medium text-zed-text dark:text-zed-dark-text hover:text-zed-accent transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 2 9 18zm0 0v-8"
                />
              </svg>
              Go to HEAD
            </button>
            {hasMore && onLoadMore && (
              <>
                <div className="w-px h-4 bg-zed-border dark:bg-zed-dark-border mx-1"></div>
                <button
                  onClick={onLoadMore}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zed-muted dark:text-zed-dark-muted hover:text-zed-accent transition-colors"
                  title="Load next batch of commits"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 13l-7 7-7-7m14-8l-7 7-7-7"
                    />
                  </svg>
                  Load More
                </button>
                <div className="w-px h-4 bg-zed-border dark:bg-zed-dark-border mx-1"></div>
                <button
                  onClick={onLoadAll}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zed-muted/60 dark:text-zed-dark-muted/60 hover:text-zed-accent transition-colors shrink-0"
                  title="Load full repository history"
                >
                  All
                </button>
              </>
            )}
            {selectedCommitHash && (
              <>
                <div className="w-px h-4 bg-zed-border dark:bg-zed-dark-border mx-1"></div>
                <div className="text-[10px] font-mono text-zed-muted dark:text-zed-dark-muted px-1">
                  {selectedCommitHash.substring(0, 7)}
                </div>
              </>
            )}
          </div>
        </div>

        <ConfirmDialog
          isOpen={isMergeConfirmOpen}
          title="Merge Branch"
          message={`Are you sure you want to merge '${mergeSource}' into '${mergeTarget}'? This action will modify your history.`}
          confirmText="Merge Branches"
          cancelText="Cancel"
          type="warning"
          onConfirm={handleMergeConfirm}
          onCancel={() => setIsMergeConfirmOpen(false)}
        />
      </div>
    );
  },
);

CommitGraph.displayName = "CommitGraph";
