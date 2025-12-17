
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Paper, GraphNode, GraphLink } from '../types';
import { cosineSimilarityKernel, kMeans, dbscan, calculateClusteringMetrics, ClusteringMetrics } from '../utils/mathUtils';

interface NetworkGraphProps {
  papers: Paper[];
  searchQuery?: string;
  onNodeClick: (paper: Paper) => void;
}

type ClusteringMode = 'threshold' | 'kmeans' | 'dbscan';

// Vibrant palette for clusters
const CLUSTER_COLORS = [
    '#f472b6', // Pink 400
    '#a78bfa', // Violet 400
    '#34d399', // Emerald 400
    '#fbbf24', // Amber 400
    '#60a5fa', // Blue 400
    '#f87171', // Red 400
    '#c084fc', // Purple 400
    '#2dd4bf', // Teal 400
    '#a3e635', // Lime 400
    '#fb923c', // Orange 400
];

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ papers, searchQuery, onNodeClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null); // Ref for the floating tooltip

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(true);
  
  // Clustering State
  const [clusteringMode, setClusteringMode] = useState<ClusteringMode>('threshold');
  
  // K-Means Params
  const [kValue, setKValue] = useState<number>(3);
  
  // DBSCAN Params
  const [epsilon, setEpsilon] = useState<number>(0.4); 
  const [minPts, setMinPts] = useState<number>(2);

  const [nodeClusters, setNodeClusters] = useState<Map<string, number>>(new Map());
  const [metrics, setMetrics] = useState<ClusteringMetrics | null>(null);

  const requestRef = useRef<number>(0);
  
  // Camera State
  const cameraRef = useRef({ x: 0, y: 0, zoom: 0.7 }); 
  const targetCameraRef = useRef({ x: 0, y: 0, zoom: 0.7 });
  
  // Interaction State
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Physics parameters optimized for stability
  const REPULSION = 600;
  const SPRING_LENGTH = 120;
  const SPRING_STRENGTH = 0.02; // Very low to prevent crazy oscillation
  const CENTERING_STRENGTH = 0.015;
  const DAMPING = 0.6; // High friction (low number) to stop movement fast
  const MAX_VELOCITY = 8; // Speed limit

  // Run Clustering & Metrics
  useEffect(() => {
      if (papers.length === 0) return;

      const validPapers = papers.filter(p => p.embedding);
      const vectors = validPapers.map(p => p.embedding!);
      const ids = validPapers.map(p => p.id);
      
      if (vectors.length > 0) {
        let assignments: number[] = [];

        if (clusteringMode === 'kmeans') {
            assignments = kMeans(vectors, Math.min(kValue, vectors.length));
        } else if (clusteringMode === 'dbscan') {
            assignments = dbscan(vectors, epsilon, minPts);
        } else {
            setMetrics(null);
            setNodeClusters(new Map());
            return;
        }
        
        const clusterMap = new Map<string, number>();
        ids.forEach((id, idx) => {
            clusterMap.set(id, assignments[idx]);
        });
        setNodeClusters(clusterMap);

        const calculatedMetrics = calculateClusteringMetrics(vectors, assignments);
        setMetrics(calculatedMetrics);
      }
  }, [clusteringMode, kValue, epsilon, minPts, papers]);

  // Initialize Graph Data with KNN (K-Nearest Neighbors) to reduce complexity
  useEffect(() => {
    if (papers.length === 0) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    // Initialize nodes
    const newNodes: GraphNode[] = papers.map(p => {
      const existing = nodes.find(n => n.id === p.id);
      return {
        id: p.id,
        x: existing ? existing.x : Math.random() * width,
        y: existing ? existing.y : Math.random() * height,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
        paper: p
      };
    });

    const newLinks: GraphLink[] = [];
    
    // KNN Optimization: Only connect each node to its top 3 most similar nodes
    // This reduces O(N^2) links to O(N*3), preventing the "hairball" explosion.
    const K_NEIGHBORS = 3;

    for (let i = 0; i < newNodes.length; i++) {
        const similarities: { targetIdx: number; score: number }[] = [];

        for (let j = 0; j < newNodes.length; j++) {
            if (i === j) continue;
            const p1 = newNodes[i].paper;
            const p2 = newNodes[j].paper;
            
            if (p1.embedding && p2.embedding) {
                const sim = cosineSimilarityKernel(p1.embedding, p2.embedding);
                if (sim > 0.5) { // Minimum threshold
                    similarities.push({ targetIdx: j, score: sim });
                }
            }
        }

        // Sort by similarity and take top K
        similarities.sort((a, b) => b.score - a.score);
        const topK = similarities.slice(0, K_NEIGHBORS);

        topK.forEach(rel => {
            // Avoid duplicate links (undirected graph)
            const source = newNodes[i].id;
            const target = newNodes[rel.targetIdx].id;
            
            // Check if reverse link already exists
            const exists = newLinks.some(l => 
                (l.source === source && l.target === target) || 
                (l.source === target && l.target === source)
            );

            if (!exists) {
                newLinks.push({
                    source,
                    target,
                    strength: rel.score
                });
            }
        });
    }

    setNodes(newNodes);
    setLinks(newLinks);
    setSimulationRunning(true); // Restart physics when data changes
  }, [papers]);

  // Handle Zoom to Search Results
  useEffect(() => {
    if (searchQuery && nodes.length > 0) {
        const sorted = [...nodes].sort((a,b) => (b.paper.similarity || 0) - (a.paper.similarity || 0));
        const topNodes = sorted.filter(n => (n.paper.similarity || 0) > 0.2).slice(0, 5);
        if (topNodes.length > 0) handleZoomToFit(topNodes);
    }
  }, [searchQuery, nodes]);

  const handleZoomToFit = (targetNodes: GraphNode[]) => {
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    targetNodes.forEach(n => {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
    });

    if (maxX === minX) { maxX += 100; minX -= 100; }
    if (maxY === minY) { maxY += 100; minY -= 100; }

    const padding = 100;
    const contentWidth = (maxX - minX) + padding * 2;
    const contentHeight = (maxY - minY) + padding * 2;

    let targetZoom = Math.min(width / contentWidth, height / contentHeight);
    targetZoom = Math.min(Math.max(targetZoom, 0.4), 2.0); 

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    targetCameraRef.current = {
       zoom: targetZoom,
       x: (width / 2) - (centerX * targetZoom),
       y: (height / 2) - (centerY * targetZoom)
    };
  };

  // Animation Loop
  useEffect(() => {
    if (nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    canvas.width = width;
    canvas.height = height;

    let topNodeIds = new Set<string>();
    if (searchQuery) {
        const sorted = [...nodes].sort((a,b) => (b.paper.similarity || 0) - (a.paper.similarity || 0));
        sorted.filter(n => (n.paper.similarity || 0) > 0.2).slice(0, 5).forEach(n => topNodeIds.add(n.id));
    }

    const animate = () => {
      // 0. Update Camera
      const lerpFactor = isDragging.current ? 1.0 : 0.1;
      cameraRef.current.x += (targetCameraRef.current.x - cameraRef.current.x) * lerpFactor;
      cameraRef.current.y += (targetCameraRef.current.y - cameraRef.current.y) * lerpFactor;
      cameraRef.current.zoom += (targetCameraRef.current.zoom - cameraRef.current.zoom) * lerpFactor;

      const { x: camX, y: camY, zoom: camZoom } = cameraRef.current;

      // 1. Calculate Forces (Only if simulation is running)
      if (simulationRunning && !isDragging.current) {
          nodes.forEach(node => {
            let fx = 0;
            let fy = 0;

            // Repulsion
            nodes.forEach(other => {
              if (node.id === other.id) return;
              const dx = node.x - other.x;
              const dy = node.y - other.y;
              if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return; 

              const distSq = dx * dx + dy * dy;
              if (distSq > 0 && distSq < 90000) { 
                const force = REPULSION / Math.sqrt(distSq); 
                const angle = Math.atan2(dy, dx);
                fx += Math.cos(angle) * force;
                fy += Math.sin(angle) * force;
              }
            });

            // Spring Force
            links.forEach(link => {
              let targetId = null;
              if (link.source === node.id) targetId = link.target;
              if (link.target === node.id) targetId = link.source;

              if (targetId) {
                const targetNode = nodes.find(n => n.id === targetId);
                if (targetNode) {
                  const dx = targetNode.x - node.x;
                  const dy = targetNode.y - node.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH * link.strength;
                  const angle = Math.atan2(dy, dx);
                  fx += Math.cos(angle) * force;
                  fy += Math.sin(angle) * force;
                }
              }
            });

            // Center Gravity
            const cx = width / 2;
            const cy = height / 2;
            fx += (cx - node.x) * CENTERING_STRENGTH;
            fy += (cy - node.y) * CENTERING_STRENGTH;

            node.vx = (node.vx + fx) * DAMPING;
            node.vy = (node.vy + fy) * DAMPING;
            
            // Limit Velocity
            const speed = Math.sqrt(node.vx*node.vx + node.vy*node.vy);
            if (speed > MAX_VELOCITY) {
                node.vx = (node.vx / speed) * MAX_VELOCITY;
                node.vy = (node.vy / speed) * MAX_VELOCITY;
            }
          });

          // 2. Update Positions
          let totalMovement = 0;
          nodes.forEach(node => {
            node.x += node.vx;
            node.y += node.vy;
            totalMovement += Math.abs(node.vx) + Math.abs(node.vy);
          });
          
          // Auto-stop if stable
          if (totalMovement < 0.2 && nodes.length > 0) {
              setSimulationRunning(false);
          }
      }

      // 3. Update Tooltip Position Directly (Perf Optimization)
      if (tooltipRef.current && hoveredNode) {
         const screenX = hoveredNode.x * camZoom + camX;
         const screenY = hoveredNode.y * camZoom + camY;
         // Position tooltip above the node
         // Using fixed position or translation. Since parent is relative, we use absolute coords.
         // Ensuring z-index is high.
         tooltipRef.current.style.transform = `translate(${screenX}px, ${screenY - 15 * camZoom - 10}px) translate(-50%, -100%)`;
         tooltipRef.current.style.opacity = '1';
      } else if (tooltipRef.current) {
         tooltipRef.current.style.opacity = '0';
      }

      // 4. Render
      ctx.clearRect(0, 0, width, height);
      
      // Apply Camera Transform
      ctx.save();
      ctx.translate(camX, camY);
      ctx.scale(camZoom, camZoom);

      // Draw Links
      links.forEach(link => {
        const s = nodes.find(n => n.id === link.source);
        const t = nodes.find(n => n.id === link.target);
        if (s && t) {
          const isConnectedToSelection = selectedNodeId && (link.source === selectedNodeId || link.target === selectedNodeId);
          let alpha = isConnectedToSelection ? 0.8 : 0.15; 
          let lineWidth = isConnectedToSelection ? 2 : 1;

          if (searchQuery && topNodeIds.has(s.id) && topNodeIds.has(t.id)) {
             alpha = 0.6;
             lineWidth = 2;
          }

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
      });

      // Draw Nodes
      nodes.forEach(node => {
        const isSelected = node.id === selectedNodeId;
        const isNeighbor = selectedNodeId && links.some(l => 
          (l.source === node.id && l.target === selectedNodeId) || 
          (l.target === node.id && l.source === selectedNodeId)
        );
        const isHovered = hoveredNode?.id === node.id;
        
        // Size optimization
        let radius = isSelected ? 12 : 5;
        if (isHovered) radius = 8;
        if (isNeighbor) radius = 7;

        let fillStyle = '#0f172a';
        let strokeStyle = '#06b6d4';

        if (clusteringMode !== 'threshold') {
            const clusterId = nodeClusters.get(node.id);
            if (clusterId !== undefined) {
                if (clusterId === -1) {
                    fillStyle = '#334155';
                    strokeStyle = '#475569';
                } else {
                    const color = CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
                    fillStyle = isSelected || isHovered ? color : '#1e293b'; 
                    strokeStyle = color;
                    if (isSelected || isHovered) fillStyle = color;
                }
            }
        } else {
            fillStyle = (isHovered || isSelected) ? '#22d3ee' : '#0f172a'; 
            strokeStyle = (isHovered || isSelected) ? '#fff' : '#06b6d4';
        }

        if (searchQuery) {
            if (topNodeIds.has(node.id)) {
                fillStyle = '#f59e0b';
                strokeStyle = '#fffbeb';
                radius = 10;
            } else {
                fillStyle = '#1e293b';
                strokeStyle = '#334155';
                radius = 3;
            }
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.lineWidth = isSelected || isHovered ? 2 : 1;
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();

        // Labels: Only show if selected, neighbor, or zoomed in greatly. Hover is handled by tooltip now.
        const showLabel = isSelected || isNeighbor || (searchQuery && topNodeIds.has(node.id));
        const showLabelZoom = camZoom > 1.2;

        if (showLabel || showLabelZoom) {
          ctx.font = isSelected ? 'bold 12px Inter' : '10px Inter';
          const labelX = node.x + radius + 4;
          const labelY = node.y + 3;
          
          let title = node.paper.title;
          if (title.length > 30 && !isSelected) title = title.substring(0, 30) + '...';

          ctx.fillStyle = isSelected ? '#fff' : '#94a3b8';
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#0f172a';
          ctx.strokeText(title, labelX, labelY);
          ctx.fillText(title, labelX, labelY);
        }
      });

      ctx.restore();

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [nodes, links, hoveredNode, selectedNodeId, searchQuery, clusteringMode, nodeClusters, simulationRunning]);

  // --- MOUSE INTERACTION HANDLERS ---

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
     isDragging.current = true;
     lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging.current) {
        // PANNING
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        targetCameraRef.current.x += deltaX;
        targetCameraRef.current.y += deltaY;
        cameraRef.current.x += deltaX;
        cameraRef.current.y += deltaY;
        canvas.style.cursor = 'grabbing';
    } else {
        // HOVER
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = (screenX - cameraRef.current.x) / cameraRef.current.zoom;
        const worldY = (screenY - cameraRef.current.y) / cameraRef.current.zoom;

        // Optimized hit detection
        let found: GraphNode | undefined;
        // Search in reverse to find top-most node
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const dx = node.x - worldX;
            const dy = node.y - worldY;
            // Hit radius
            if (dx * dx + dy * dy < 200) { 
                found = node;
                break;
            }
        }
        setHoveredNode(found || null);
        canvas.style.cursor = found ? 'pointer' : 'default'; 
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.stopPropagation();
      e.preventDefault(); 
      const zoomSensitivity = 0.001;
      const newZoom = targetCameraRef.current.zoom - e.deltaY * zoomSensitivity;
      const clampedZoom = Math.min(Math.max(newZoom, 0.1), 5.0);
      targetCameraRef.current.zoom = clampedZoom;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hoveredNode) {
      setSelectedNodeId(hoveredNode.id);
      onNodeClick(hoveredNode.paper);
    } else {
      setSelectedNodeId(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-[600px] bg-slate-900 rounded-xl border border-slate-700 relative group">
      
      {/* TOOLTIP POPUP - Moved here and styled z-50 to ensure visibility */}
      <div 
        ref={tooltipRef}
        className="absolute top-0 left-0 bg-slate-800/95 text-white p-3 rounded-lg border border-cyan-500/30 shadow-2xl backdrop-blur-md pointer-events-none transition-opacity duration-75 z-50 flex flex-col gap-1 min-w-[200px]"
        style={{ opacity: 0 }}
      >
        {hoveredNode && (
            <>
                <h4 className="font-bold text-sm leading-tight text-cyan-50">{hoveredNode.paper.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">
                        {hoveredNode.paper.year !== 'Unknown' ? hoveredNode.paper.year : 'N/A'}
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-[150px]">
                        {hoveredNode.paper.authors[0] || 'Autor Desconocido'}
                    </span>
                </div>
            </>
        )}
      </div>

      {/* CANVAS WRAPPER with Overflow Hidden to clip the graph but NOT the tooltip */}
      <div className="absolute inset-0 overflow-hidden rounded-xl z-0">
          <canvas 
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onClick={handleClick}
            className="block w-full h-full cursor-default"
          />
      </div>

      {/* CONTROLS */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
         <div className="bg-slate-800/90 p-2 rounded-lg backdrop-blur-sm border border-slate-700 shadow-xl pointer-events-auto flex items-center gap-2">
             <button 
                onClick={() => setSimulationRunning(!simulationRunning)}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors flex items-center gap-2 ${simulationRunning ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}
             >
                {simulationRunning ? (
                    <>
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        Simulando
                    </>
                ) : (
                    <>
                        <span className="w-2 h-2 bg-red-400 rounded-sm"></span>
                        Congelado
                    </>
                )}
             </button>
             <button 
                onClick={() => {
                   targetCameraRef.current = { x: 0, y: 0, zoom: 0.7 };
                }}
                className="px-2 py-1.5 text-xs bg-slate-700 text-slate-300 hover:text-white rounded"
                title="Reset View"
             >
                Centrar
             </button>
         </div>

         {/* CLUSTERING CONTROLS */}
         <div className="bg-slate-800/90 p-3 rounded-lg backdrop-blur-sm border border-slate-700 shadow-xl pointer-events-auto space-y-3 min-w-[200px]">
             <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Algoritmo</label>
                <select 
                    value={clusteringMode}
                    onChange={(e) => setClusteringMode(e.target.value as ClusteringMode)}
                    className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1.5 outline-none w-full focus:border-cyan-500 transition-colors"
                >
                    <option value="threshold">Similitud (Estático)</option>
                    <option value="kmeans">K-Means (Partición)</option>
                    <option value="dbscan">DBSCAN (Densidad)</option>
                </select>
             </div>

             {clusteringMode === 'kmeans' && (
                 <div className="animate-in slide-in-from-top-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Clusters (K): {kValue}</label>
                    <input 
                        type="range" 
                        min="2" 
                        max={Math.min(10, Math.max(2, papers.length))} 
                        value={kValue} 
                        onChange={(e) => setKValue(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                 </div>
             )}

             {clusteringMode === 'dbscan' && (
                 <div className="space-y-2 animate-in slide-in-from-top-2">
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Radio (Epsilon): {epsilon}</label>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="1.0" 
                            step="0.05"
                            value={epsilon} 
                            onChange={(e) => setEpsilon(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Min Puntos: {minPts}</label>
                        <input 
                            type="range" 
                            min="2" 
                            max="6" 
                            value={minPts} 
                            onChange={(e) => setMinPts(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                 </div>
             )}
         </div>
      </div>

      {/* METRICS PANEL */}
      {metrics && clusteringMode !== 'threshold' && (
        <div className="absolute bottom-4 right-4 z-20 bg-slate-900/95 p-4 rounded-xl backdrop-blur-md border border-slate-700 shadow-2xl pointer-events-auto w-64 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Métricas de Calidad
            </h4>
            <div className="space-y-3">
                <div className="flex justify-between items-center group relative">
                    <span className="text-xs text-slate-400 border-b border-dashed border-slate-600 cursor-help">Silhouette</span>
                    <span className={`text-sm font-mono font-bold ${metrics.silhouetteScore > 0.5 ? 'text-emerald-400' : metrics.silhouetteScore > 0.25 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {metrics.silhouetteScore.toFixed(3)}
                    </span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-0 mb-2 w-full bg-black text-[10px] text-slate-300 p-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        Cohesión vs Separación. Rango [-1, 1].
                    </div>
                </div>
                
                <div className="flex justify-between items-center group relative">
                    <span className="text-xs text-slate-400 border-b border-dashed border-slate-600 cursor-help">Davies-Bouldin</span>
                    <span className={`text-sm font-mono font-bold ${metrics.daviesBouldinIndex < 1.0 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                        {metrics.daviesBouldinIndex.toFixed(3)}
                    </span>
                     <div className="absolute bottom-full left-0 mb-2 w-full bg-black text-[10px] text-slate-300 p-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        Similitud media entre clusters. Menor es mejor.
                    </div>
                </div>

                <div className="flex justify-between items-center group relative">
                    <span className="text-xs text-slate-400 border-b border-dashed border-slate-600 cursor-help">Calinski-Harabasz</span>
                    <span className="text-sm font-mono font-bold text-purple-400">
                        {metrics.calinskiHarabaszIndex.toFixed(1)}
                    </span>
                     <div className="absolute bottom-full left-0 mb-2 w-full bg-black text-[10px] text-slate-300 p-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        Ratio de dispersión. Mayor es mejor.
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
