
import React, { useMemo } from 'react';
import { Paper } from '../types';

interface PaperCardProps {
  paper: Paper;
  isResult?: boolean;
  viewMode: 'grid' | 'list';
  onDelete?: (id: string) => void;
  onAnalyze?: (paper: Paper) => void;
  onClick?: (paper: Paper) => void;
}

// Helper to generate a consistent gradient from a string
const generateGradient = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c1 = Math.abs(hash % 360);
  const c2 = (c1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${c1}, 70%, 60%), hsl(${c2}, 70%, 40%))`;
};

export const PaperCard: React.FC<PaperCardProps> = ({ paper, isResult, viewMode, onDelete, onAnalyze, onClick }) => {
  // Format similarity as percentage
  const relevance = paper.similarity ? Math.round(paper.similarity * 100) : 0;
  
  const coverGradient = useMemo(() => generateGradient(paper.title), [paper.title]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && window.confirm("¿Estás seguro de que deseas eliminar este documento?")) {
      onDelete(paper.id);
    }
  };

  const handleCardClick = () => {
      if(onClick) onClick(paper);
  };

  const handleAnalyzeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onAnalyze) onAnalyze(paper);
  };

  // --- LIST VIEW ---
  if (viewMode === 'list') {
    return (
      <div 
        onClick={handleCardClick}
        className={`
        group flex items-center gap-4 p-3 rounded-lg border transition-all duration-200 cursor-pointer
        ${isResult && relevance > 70 ? 'bg-cyan-900/10 border-cyan-500/30' : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'}
      `}>
        {/* Tiny Color Swatch */}
        <div className="w-10 h-10 rounded-md shadow-inner flex-shrink-0" style={{ background: coverGradient }}></div>
        
        {/* Main Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-200 truncate pr-4">{paper.title}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
             <span className="truncate max-w-[200px]">{paper.authors.length > 0 ? paper.authors.join(', ') : 'Autor Desconocido'}</span>
             <span>•</span>
             <span>{new Date(paper.uploadDate).toLocaleDateString('es-ES')}</span>
          </div>
        </div>

        {/* Tags (Desktop only) */}
        <div className="hidden md:flex gap-2">
           {paper.tags.slice(0, 3).map((tag, i) => (
             <span key={i} className="px-2 py-0.5 text-[10px] uppercase rounded bg-slate-900 text-slate-400 border border-slate-700">
                {tag}
             </span>
           ))}
        </div>

        {/* Metrics */}
        {isResult && (
           <div className={`text-xs font-bold px-2 py-1 rounded ${relevance > 80 ? 'text-emerald-400 bg-emerald-500/10' : 'text-cyan-400 bg-cyan-500/10'}`}>
              {relevance}% Coincidencia
           </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onAnalyze && (
                <button onClick={handleAnalyzeClick} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400" title="Ver en Grafo">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </button>
            )}
            <button onClick={handleDelete} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400" title="Eliminar">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
      </div>
    );
  }

  // --- GRID VIEW ---
  return (
    <div 
        onClick={handleCardClick}
        className={`
      relative group flex flex-col rounded-xl overflow-hidden border transition-all duration-300 bg-slate-900 cursor-pointer
      ${isResult && relevance > 70 ? 'border-cyan-500/40 shadow-lg shadow-cyan-900/20' : 'border-slate-800 hover:border-slate-600 hover:shadow-xl hover:shadow-black/50'}
    `}>
      {/* Visual Header / Cover */}
      <div className="h-24 w-full relative overflow-hidden" style={{ background: coverGradient }}>
         <div className="absolute inset-0 bg-slate-900/20"></div>
         <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
         
         {isResult && (
            <div className="absolute top-2 right-2 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/10">
               <span className={`text-xs font-bold ${relevance > 80 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                 {relevance}%
               </span>
            </div>
         )}
      </div>

      {/* Content Body */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
               {new Date(paper.uploadDate).toLocaleDateString('es-ES')}
            </span>
        </div>

        <h3 className="text-base font-bold text-slate-100 mb-2 line-clamp-2 leading-snug group-hover:text-cyan-400 transition-colors">
          {paper.title}
        </h3>
        
        <div className="flex items-center gap-2 mb-4">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
           </svg>
           <p className="text-xs text-slate-400 truncate w-full">
             {paper.authors && paper.authors.length > 0 ? paper.authors.join(', ') : 'Autor Desconocido'}
           </p>
        </div>

        {paper.abstract && (
          <p className="text-sm text-slate-500 mb-4 line-clamp-3 leading-relaxed border-l-2 border-slate-800 pl-3">
            {paper.abstract}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-800/50">
           <div className="flex flex-wrap gap-1">
             {paper.tags.slice(0, 4).map((tag, idx) => (
               <span key={idx} className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                 {tag}
               </span>
             ))}
           </div>
           
           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-200">
              <button 
                onClick={handleDelete}
                className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                title="Eliminar Documento"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
