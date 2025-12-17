
import React, { useEffect, useRef, useMemo } from 'react';
import { Paper } from '../types';
import { computeKernelMatrix, calculateStats } from '../utils/mathUtils';

interface KernelAnalysisProps {
  papers: Paper[];
  onClose: () => void;
}

export const KernelAnalysis: React.FC<KernelAnalysisProps> = ({ papers, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Compute Matrix & Stats
  const analysis = useMemo(() => {
    const validPapers = papers.filter(p => p.embedding);
    if (validPapers.length < 2) return null;

    const vectors = validPapers.map(p => p.embedding!);
    const rawMatrix = computeKernelMatrix(vectors);

    // Sort Matrix to cluster similar items (Greedy Traversal)
    // This makes the heatmap diagonal show structure instead of noise
    const indices: number[] = [0];
    const visited = new Set([0]);
    
    while (indices.length < validPapers.length) {
      const current = indices[indices.length - 1];
      let bestNext = -1;
      let maxSim = -1;

      for (let i = 0; i < validPapers.length; i++) {
        if (!visited.has(i)) {
          if (rawMatrix[current][i] > maxSim) {
            maxSim = rawMatrix[current][i];
            bestNext = i;
          }
        }
      }
      
      // If we are disjoint, just pick the next unvisited
      if (bestNext === -1) {
         for(let i=0; i<validPapers.length; i++) {
             if(!visited.has(i)) { bestNext = i; break; }
         }
      }

      visited.add(bestNext);
      indices.push(bestNext);
    }

    // Reconstruct sorted matrix
    const sortedMatrix = indices.map(i => indices.map(j => rawMatrix[i][j]));
    
    // Flatten upper triangle (excluding diagonal) for histogram
    const flatValues: number[] = [];
    let separabilitySum = 0;

    for (let i = 0; i < sortedMatrix.length; i++) {
      let rowSum = 0;
      let top3Sum = 0;
      const rowValues = [...rawMatrix[indices[i]]].sort((a, b) => b - a); // Sort row desc
      
      // Top 3 neighbors (excluding self at index 0)
      for(let k=1; k<Math.min(4, rowValues.length); k++) top3Sum += rowValues[k];
      const top3Avg = top3Sum / Math.max(1, Math.min(3, rowValues.length - 1));

      for (let j = 0; j < sortedMatrix.length; j++) {
        if (i !== j) {
            rowSum += rawMatrix[indices[i]][j];
            if (i < j) flatValues.push(rawMatrix[indices[i]][j]);
        }
      }
      const globalAvg = rowSum / (sortedMatrix.length - 1);
      separabilitySum += (top3Avg - globalAvg);
    }

    const stats = calculateStats(flatValues);
    const separabilityIndex = separabilitySum / sortedMatrix.length;

    return { matrix: sortedMatrix, flatValues, stats, separabilityIndex };
  }, [papers]);

  // 2. Draw Heatmap
  useEffect(() => {
    if (!analysis || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const size = analysis.matrix.length;
    const pixelSize = Math.max(2, Math.floor(280 / size)); // Fit in 280px box
    const displaySize = size * pixelSize;

    canvasRef.current.width = displaySize;
    canvasRef.current.height = displaySize;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const val = analysis.matrix[i][j];
        // Heatmap Color Map: Dark Slate -> Cyan -> Emerald
        // 0.0 -> 0.5 -> 1.0
        let r, g, b;
        if (val < 0.5) {
            // Slate (15, 23, 42) to Cyan (6, 182, 212)
            const t = val * 2;
            r = 15 + (6 - 15) * t;
            g = 23 + (182 - 23) * t;
            b = 42 + (212 - 42) * t;
        } else {
            // Cyan (6, 182, 212) to White/Emerald (236, 253, 245)
            const t = (val - 0.5) * 2;
            r = 6 + (236 - 6) * t;
            g = 182 + (253 - 182) * t;
            b = 212 + (245 - 212) * t;
        }
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(j * pixelSize, i * pixelSize, pixelSize, pixelSize);
      }
    }
  }, [analysis]);

  if (!analysis) return null;

  // Histogram Bins
  const bins = new Array(20).fill(0);
  analysis.flatValues.forEach(v => {
      // Clamp between -1 and 1 just in case, map to 0-19
      const idx = Math.min(19, Math.max(0, Math.floor((v + 1) / 2 * 20))); // Map -1..1 to 0..20 roughly
      // Actually cosine sim is usually 0..1 for embeddings unless specific training
      // Let's assume 0 to 1 for typical text embeddings
      const idx01 = Math.min(19, Math.max(0, Math.floor(v * 20)));
      bins[idx01]++;
  });
  const maxBin = Math.max(...bins);

  return (
    <div className="absolute top-20 right-4 z-40 w-80 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-10 duration-300">
       <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            Análisis de Kernel
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
       </div>

       <div className="p-4 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Heatmap Section */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Matriz de Similitud</span>
                <span className="text-[10px] text-slate-500">Ordenado por grupo</span>
            </div>
            <div className="flex justify-center bg-slate-950 p-2 rounded-lg border border-slate-800">
               <canvas ref={canvasRef} className="image-pixelated" />
            </div>
          </div>

          {/* Histogram Section */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Distribución</span>
                <span className="text-[10px] text-slate-500">Densidad de valores</span>
            </div>
            <div className="h-24 flex items-end justify-between gap-1 px-1">
               {bins.map((count, i) => (
                 <div key={i} className="w-full bg-slate-800 hover:bg-cyan-500/50 transition-colors relative group rounded-t-sm" 
                      style={{ height: `${Math.max(1, (count / maxBin) * 100)}%` }}>
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[10px] bg-black text-white px-1 rounded pointer-events-none whitespace-nowrap z-50">
                       Rango: {(i/20).toFixed(2)}-{((i+1)/20).toFixed(2)} ({count})
                    </div>
                 </div>
               ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1 border-t border-slate-800 pt-1">
               <span>0.0</span>
               <span>0.5</span>
               <span>1.0</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <div className="text-[10px] text-slate-500 uppercase">Similitud Media</div>
                <div className="text-lg font-mono text-cyan-400">{analysis.stats.mean.toFixed(3)}</div>
             </div>
             <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <div className="text-[10px] text-slate-500 uppercase">Varianza</div>
                <div className="text-lg font-mono text-purple-400">{analysis.stats.variance.toFixed(3)}</div>
             </div>
             <div className="col-span-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <div className="flex justify-between items-center mb-1">
                   <div className="text-[10px] text-slate-500 uppercase">Índice de Separabilidad</div>
                   <div className="text-[10px] text-emerald-500 font-bold">{analysis.separabilityIndex > 0.1 ? "BUENO" : "POBRE"}</div>
                </div>
                <div className="text-2xl font-mono text-white">{analysis.separabilityIndex.toFixed(3)}</div>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                   Diferencia entre vecindario local y promedio global. Mayor significa clusters más distintos.
                </p>
             </div>
          </div>
       </div>
    </div>
  );
};
