
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Paper } from '../types';
import { SOM } from '../utils/som';

interface LandscapeViewProps {
  papers: Paper[];
}

interface MappedPaper {
  paper: Paper;
  x: number;
  y: number;
}

export const LandscapeView: React.FC<LandscapeViewProps> = ({ papers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mappedPapers, setMappedPapers] = useState<MappedPaper[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  
  // Hover Interaction State (Bidirectional)
  const [hoveredPaperId, setHoveredPaperId] = useState<string | null>(null);

  // Canvas Transform State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Configuration
  const GRID_SIZE = 30; // 30x30 grid cells
  const CELL_PIXEL_SIZE = 20; // Slightly smaller to fit better
  const TOTAL_SIZE = GRID_SIZE * CELL_PIXEL_SIZE;

  // Center the map initially
  useEffect(() => {
    if (containerRef.current) {
        // Initial center
        setTransform({ x: 50, y: 50, scale: 1 });
    }
  }, []);

  useEffect(() => {
    const validPapers = papers.filter(p => p.embedding);
    if (validPapers.length < 3) return;

    const trainSOM = async () => {
      setIsTraining(true);
      
      // Delay to allow UI render
      await new Promise(resolve => setTimeout(resolve, 100));

      const inputDim = validPapers[0].embedding!.length;
      const som = new SOM(GRID_SIZE, GRID_SIZE, inputDim);

      const vectors = validPapers.map(p => p.embedding!);
      
      // Fast training for UX
      const iterations = Math.max(1000, validPapers.length * 50);
      som.train(vectors, iterations);

      const uMatrix = som.getUMatrix();

      const mapped = validPapers.map(paper => {
        const bmu = som.findBMU(paper.embedding!);
        return { paper, x: bmu.x, y: bmu.y };
      });

      setMappedPapers(mapped);
      drawLandscape(uMatrix);
      setIsTraining(false);
    };

    trainSOM();

  }, [papers]);

  const drawLandscape = (uMatrix: number[][]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = TOTAL_SIZE;
    canvas.height = TOTAL_SIZE;

    // Draw Terrain
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        const val = uMatrix[x][y];
        const height = 1.0 - val;
        
        let color = '';
        if (height < 0.3) {
             color = `rgb(15, 23, 42)`; 
        } else if (height < 0.5) {
             const i = (height - 0.3) / 0.2;
             color = `rgb(${15 + i*15}, ${23 + i*18}, ${42 + i*20})`; 
        } else if (height < 0.8) {
             const i = (height - 0.5) / 0.3;
             color = `rgb(${30 + i*20}, ${41 + i*30}, ${59 + i*40})`; 
        } else {
             const i = (height - 0.8) / 0.2;
             color = `rgb(${50 + i*10}, ${71 + i*111}, ${99 + i*113})`; 
        }

        ctx.fillStyle = color;
        ctx.fillRect(x * CELL_PIXEL_SIZE, y * CELL_PIXEL_SIZE, CELL_PIXEL_SIZE, CELL_PIXEL_SIZE);
      }
    }
  };

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      
      setTransform(prev => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy
      }));
  };

  const handleMouseUp = () => {
      isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const scaleSpeed = 0.001;
      const newScale = Math.min(Math.max(transform.scale - e.deltaY * scaleSpeed, 0.4), 3);
      
      setTransform(prev => ({
          ...prev,
          scale: newScale
      }));
  };

  const hoveredPaperDetails = useMemo(() => {
     return mappedPapers.find(p => p.paper.id === hoveredPaperId);
  }, [mappedPapers, hoveredPaperId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        
        {/* LEFT: MAP CANVAS (Col Span 3) */}
        <div 
            ref={containerRef} 
            className="lg:col-span-3 bg-slate-900 rounded-xl border border-slate-700 relative overflow-hidden cursor-grab active:cursor-grabbing shadow-inner"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            {isTraining && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm pointer-events-none">
                    <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-cyan-400 font-mono text-sm animate-pulse">ORGANIZANDO...</span>
                    </div>
                </div>
            )}
            
            {papers.length < 3 && !isTraining && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-slate-500 text-center px-6">
                        <p>Añade al menos 3 documentos para ver el paisaje.</p>
                    </div>
                </div>
            )}

            {/* Transformable Content */}
            <div 
                className="absolute origin-center transition-transform duration-75 ease-out"
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    width: TOTAL_SIZE,
                    height: TOTAL_SIZE
                }}
            >
                <div className="relative shadow-2xl shadow-black/50 overflow-hidden rounded-lg">
                    <canvas ref={canvasRef} className="block pixelated" />
                    
                    {/* Dots */}
                    {mappedPapers.map((mp) => {
                        const isHovered = hoveredPaperId === mp.paper.id;
                        return (
                            <div
                                key={mp.paper.id}
                                className={`absolute rounded-full transition-all duration-200 border cursor-pointer z-10
                                    ${isHovered 
                                        ? 'w-6 h-6 bg-cyan-400 border-white shadow-[0_0_15px_rgba(34,211,238,0.8)] z-50 scale-125' 
                                        : 'w-2.5 h-2.5 bg-white/90 border-slate-900 shadow-sm'
                                    }
                                `}
                                style={{
                                    left: mp.x * CELL_PIXEL_SIZE + CELL_PIXEL_SIZE/2 - (isHovered ? 12 : 5),
                                    top: mp.y * CELL_PIXEL_SIZE + CELL_PIXEL_SIZE/2 - (isHovered ? 12 : 5)
                                }}
                                onMouseEnter={() => setHoveredPaperId(mp.paper.id)}
                                onMouseLeave={() => setHoveredPaperId(null)}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="absolute bottom-4 left-4 bg-slate-900/80 p-2 rounded text-xs text-slate-400 border border-slate-700 pointer-events-none">
                Usa el scroll para Zoom, arrastra para mover.
            </div>
        </div>

        {/* RIGHT: INFO PANEL (Col Span 1) */}
        <div className="lg:col-span-1 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
             <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                 <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4" />
                    </svg>
                    Topología
                 </h3>
                 <p className="text-[10px] text-slate-500 mt-1">Pasa el ratón para ubicar documentos</p>
             </div>

             {/* Details of Hovered Paper */}
             {hoveredPaperDetails ? (
                 <div className="p-4 bg-slate-800 border-b border-slate-700 animate-in slide-in-from-top-2 duration-200">
                     <span className="text-[10px] text-cyan-400 font-bold uppercase mb-1 block">Seleccionado</span>
                     <h4 className="text-sm font-bold text-white leading-snug mb-2">{hoveredPaperDetails.paper.title}</h4>
                     <p className="text-xs text-slate-400 line-clamp-3 mb-2">{hoveredPaperDetails.paper.abstract || "Sin resumen."}</p>
                     <div className="flex flex-wrap gap-1">
                        {hoveredPaperDetails.paper.tags.slice(0,3).map(t => (
                            <span key={t} className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-500">{t}</span>
                        ))}
                     </div>
                 </div>
             ) : (
                <div className="p-4 bg-slate-800/20 border-b border-slate-700/50 text-center py-8">
                    <span className="text-slate-600 text-xs italic">Señala un punto en el mapa...</span>
                </div>
             )}

             {/* List of All Papers */}
             <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                 {mappedPapers.map((mp) => (
                     <div 
                        key={mp.paper.id}
                        onMouseEnter={() => setHoveredPaperId(mp.paper.id)}
                        onMouseLeave={() => setHoveredPaperId(null)}
                        className={`
                            p-2 rounded cursor-pointer border transition-all duration-200 flex items-center gap-3
                            ${hoveredPaperId === mp.paper.id 
                                ? 'bg-cyan-900/30 border-cyan-500/50' 
                                : 'bg-transparent border-transparent hover:bg-slate-800 hover:border-slate-700'}
                        `}
                     >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hoveredPaperId === mp.paper.id ? 'bg-cyan-400' : 'bg-slate-600'}`}></div>
                        <span className={`text-xs truncate ${hoveredPaperId === mp.paper.id ? 'text-cyan-100 font-medium' : 'text-slate-400'}`}>
                            {mp.paper.title}
                        </span>
                     </div>
                 ))}
             </div>
        </div>
    </div>
  );
};
