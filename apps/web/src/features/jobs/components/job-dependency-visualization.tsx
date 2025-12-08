import { AlertCircle, ZoomIn, ZoomOut, Maximize2, RefreshCw, FileText, Clock } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { JobDependencyGraph, JobGraphNode, JobGraphEdge } from '@workspace/shared';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface JobDependencyVisualizationProps {
  graph: JobDependencyGraph;
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

// Card dimensions matching Control-M style
const CARD_WIDTH = 180;
const CARD_HEIGHT = 80;
const CARD_MARGIN_X = 40;
const CARD_MARGIN_Y = 30;
const GRID_CELL_WIDTH = CARD_WIDTH + CARD_MARGIN_X;
const GRID_CELL_HEIGHT = CARD_HEIGHT + CARD_MARGIN_Y;

// Colors for different job types
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Job: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  Dummy: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },
  Command: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  FileWatcher: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
};

const SELECTED_BORDER = '#3b82f6';
const HIGHLIGHT_BORDER = '#f97316';

interface GridPosition {
  row: number;
  col: number;
}

interface LayoutNode extends JobGraphNode {
  gridPos: GridPosition;
  pixelX: number;
  pixelY: number;
}

/**
 * Extract job pattern prefix and suffix from job name
 * e.g., SWCPOT942 -> { prefix: 'SWCPOT', suffix: '942' }
 */
function parseJobName(jobName: string): { prefix: string; suffix: string } {
  // Match pattern: letters followed by numbers at the end
  const match = jobName.match(/^([A-Za-z]+)(\d+[A-Za-z]*)$/);
  if (match) {
    return { prefix: match[1], suffix: match[2] };
  }
  // Fallback: try to find any number sequence
  const numMatch = jobName.match(/(\d+)/);
  if (numMatch) {
    const idx = jobName.indexOf(numMatch[1]);
    return {
      prefix: jobName.substring(0, idx),
      suffix: jobName.substring(idx)
    };
  }
  return { prefix: jobName, suffix: '' };
}

/**
 * Compute grid layout based on job naming patterns and dependencies
 * Groups jobs by prefix (row) and sorts by suffix (column)
 */
function computeGridLayout(
  nodes: JobGraphNode[],
  edges: JobGraphEdge[]
): LayoutNode[] {
  if (nodes.length === 0) return [];

  // Build adjacency for topological hints
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge.target);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target)!.push(edge.source);
  }

  // Group nodes by prefix
  const prefixGroups = new Map<string, JobGraphNode[]>();
  for (const node of nodes) {
    const { prefix } = parseJobName(node.jobName);
    if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
    prefixGroups.get(prefix)!.push(node);
  }

  // Sort groups by their average dependency depth (sources first)
  const groupDepth = new Map<string, number>();
  for (const [prefix, group] of prefixGroups) {
    let totalDepth = 0;
    for (const node of group) {
      // Count incoming edges as depth indicator
      totalDepth += incoming.get(node.id)?.length ?? 0;
    }
    groupDepth.set(prefix, totalDepth / group.length);
  }

  const sortedPrefixes = [...prefixGroups.keys()].sort((a, b) => {
    return (groupDepth.get(a) ?? 0) - (groupDepth.get(b) ?? 0);
  });

  // Collect all unique suffixes and sort them
  const allSuffixes = new Set<string>();
  for (const node of nodes) {
    const { suffix } = parseJobName(node.jobName);
    allSuffixes.add(suffix);
  }
  const sortedSuffixes = [...allSuffixes].sort((a, b) => {
    // Sort numerically if possible
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const suffixToCol = new Map<string, number>();
  sortedSuffixes.forEach((s, i) => suffixToCol.set(s, i));

  const prefixToRow = new Map<string, number>();
  sortedPrefixes.forEach((p, i) => prefixToRow.set(p, i));

  // Assign grid positions
  const layoutNodes: LayoutNode[] = nodes.map(node => {
    const { prefix, suffix } = parseJobName(node.jobName);
    const row = prefixToRow.get(prefix) ?? 0;
    const col = suffixToCol.get(suffix) ?? 0;

    return {
      ...node,
      gridPos: { row, col },
      pixelX: col * GRID_CELL_WIDTH + 50,
      pixelY: row * GRID_CELL_HEIGHT + 50
    };
  });

  return layoutNodes;
}

/**
 * Compute edge path with right-angle routing
 */
function computeEdgePath(source: LayoutNode, target: LayoutNode): string {
  const sx = source.pixelX + CARD_WIDTH / 2;
  const sy = source.pixelY + CARD_HEIGHT / 2;
  const tx = target.pixelX + CARD_WIDTH / 2;
  const ty = target.pixelY + CARD_HEIGHT / 2;

  // Determine exit and entry points
  let x1: number, y1: number, x2: number, y2: number;

  if (tx > sx + CARD_WIDTH / 2) {
    // Target is to the right
    x1 = source.pixelX + CARD_WIDTH;
    y1 = sy;
    x2 = target.pixelX;
    y2 = ty;
  } else if (tx < sx - CARD_WIDTH / 2) {
    // Target is to the left
    x1 = source.pixelX;
    y1 = sy;
    x2 = target.pixelX + CARD_WIDTH;
    y2 = ty;
  } else if (ty > sy) {
    // Target is below
    x1 = sx;
    y1 = source.pixelY + CARD_HEIGHT;
    x2 = tx;
    y2 = target.pixelY;
  } else {
    // Target is above
    x1 = sx;
    y1 = source.pixelY;
    x2 = tx;
    y2 = target.pixelY + CARD_HEIGHT;
  }

  // Create orthogonal path
  if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
    // Horizontal-first routing
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  } else {
    // Vertical-first routing
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }
}

export const JobDependencyVisualization = ({
  graph,
  onNodeClick,
  selectedNodeId
}: JobDependencyVisualizationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Compute layout
  const layoutNodes = useMemo(() => {
    return computeGridLayout(graph.nodes, graph.edges);
  }, [graph.nodes, graph.edges]);

  // Calculate content bounds
  const contentBounds = useMemo(() => {
    if (layoutNodes.length === 0) return { width: 800, height: 600 };
    const maxX = Math.max(...layoutNodes.map(n => n.pixelX)) + CARD_WIDTH + 100;
    const maxY = Math.max(...layoutNodes.map(n => n.pixelY)) + CARD_HEIGHT + 100;
    return { width: maxX, height: maxY };
  }, [layoutNodes]);

  const nodeMap = useMemo(() => {
    return new Map(layoutNodes.map(n => [n.id, n]));
  }, [layoutNodes]);

  // Get connected nodes for highlighting
  const connectedNodes = useMemo(() => {
    const connected = new Set<string>();
    if (selectedNodeId || hoveredNodeId) {
      const targetId = selectedNodeId ?? hoveredNodeId;
      for (const edge of graph.edges) {
        if (edge.source === targetId) connected.add(edge.target);
        if (edge.target === targetId) connected.add(edge.source);
      }
    }
    return connected;
  }, [selectedNodeId, hoveredNodeId, graph.edges]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Suppress unused variable warning
  void contentBounds;

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No jobs to display. Import Control-M jobs to see the dependency graph.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-muted/10 rounded-lg overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleReset} title="Reset View">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg p-3 text-xs shadow-lg border">
        <div className="font-semibold mb-2">Legend</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(TYPE_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-4 h-3 rounded-sm border"
                style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              />
              <span>{type}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded-sm border-2" style={{ borderColor: SELECTED_BORDER }} />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded-sm border-2" style={{ borderColor: HIGHLIGHT_BORDER }} />
            <span>Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3 w-3 text-pink-500" />
            <span>Cyclic</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg p-3 text-xs shadow-lg border">
        <div className="font-semibold mb-1">Graph Stats</div>
        <div>{graph.nodes.length} jobs</div>
        <div>{graph.edges.length} dependencies</div>
      </div>

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        className="select-none"
      >
        <defs>
          <marker
            id="arrowhead-default"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
          </marker>
          {/* Drop shadow filter */}
          <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {graph.edges.map(edge => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const isHighlighted =
              edge.source === selectedNodeId ||
              edge.target === selectedNodeId ||
              edge.source === hoveredNodeId ||
              edge.target === hoveredNodeId;

            const path = computeEdgePath(source, target);

            return (
              <path
                key={edge.id}
                d={path}
                fill="none"
                stroke={isHighlighted ? '#3b82f6' : '#d1d5db'}
                strokeWidth={isHighlighted ? 2 : 1.5}
                markerEnd={isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead-default)'}
                opacity={isHighlighted ? 1 : 0.6}
                className="transition-all duration-150"
              />
            );
          })}

          {/* Job Cards */}
          {layoutNodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isConnected = connectedNodes.has(node.id);
            const colors = TYPE_COLORS[node.taskType] || TYPE_COLORS.Job;

            let borderColor = colors.border;
            let borderWidth = 1;
            if (isSelected) {
              borderColor = SELECTED_BORDER;
              borderWidth = 3;
            } else if (isConnected) {
              borderColor = HIGHLIGHT_BORDER;
              borderWidth = 2;
            } else if (isHovered) {
              borderColor = colors.border;
              borderWidth = 2;
            }

            return (
              <g
                key={node.id}
                transform={`translate(${node.pixelX}, ${node.pixelY})`}
                onClick={() => onNodeClick?.(node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{ cursor: 'pointer' }}
                className="transition-transform duration-150"
              >
                {/* Card background */}
                <rect
                  x={0}
                  y={0}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  rx={6}
                  fill={colors.bg}
                  stroke={borderColor}
                  strokeWidth={borderWidth}
                  filter="url(#card-shadow)"
                  opacity={node.isActive ? 1 : 0.7}
                />

                {/* Inactive overlay */}
                {!node.isActive && (
                  <rect
                    x={0}
                    y={0}
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    rx={6}
                    fill="rgba(0,0,0,0.1)"
                  />
                )}

                {/* Job name (top) */}
                <text
                  x={10}
                  y={20}
                  fontSize={12}
                  fontWeight={600}
                  fill={colors.text}
                  className="pointer-events-none"
                >
                  {node.jobName.length > 18 ? node.jobName.slice(0, 18) + '...' : node.jobName}
                </text>

                {/* Time/Node row with clock icon */}
                <Clock
                  x={10}
                  y={30}
                  width={12}
                  height={12}
                  style={{ color: '#6b7280' }}
                />
                <text
                  x={26}
                  y={40}
                  fontSize={10}
                  fill="#6b7280"
                  className="pointer-events-none"
                >
                  {node.nodeId || '—'}
                </text>

                {/* Task type row with file icon */}
                <FileText
                  x={10}
                  y={50}
                  width={12}
                  height={12}
                  style={{ color: '#6b7280' }}
                />
                <text
                  x={26}
                  y={60}
                  fontSize={10}
                  fill="#6b7280"
                  className="pointer-events-none"
                >
                  {node.taskType}
                </text>

                {/* Cyclic indicator badge */}
                {node.isCyclic && (
                  <g transform={`translate(${CARD_WIDTH - 20}, 4)`}>
                    <circle r={8} cx={8} cy={8} fill="#ec4899" />
                    <text
                      x={8}
                      y={12}
                      fontSize={10}
                      fill="white"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      ↻
                    </text>
                  </g>
                )}

                {/* Active indicator dot */}
                <circle
                  cx={CARD_WIDTH - 10}
                  cy={CARD_HEIGHT - 10}
                  r={4}
                  fill={node.isActive ? '#22c55e' : '#ef4444'}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
