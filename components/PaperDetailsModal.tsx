
import React from 'react';
import { Paper } from '../types';

interface PaperDetailsModalProps {
  paper: Paper;
  onClose: () => void;
}

export const PaperDetailsModal: React.FC<PaperDetailsModalProps> = ({ paper, onClose }) => {
  if (!paper) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header with Gradient */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-slate-700/50 flex-shrink-0">
           <button 
             onClick={onClose}
             className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-10"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
             </svg>
           </button>

           <div className="flex flex-wrap gap-2 mb-4">
              {paper.year && paper.year !== "Unknown" && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                   {paper.year}
                </span>
              )}
              {paper.tags.map(tag => (
                 <span key={tag} className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    {tag}
                 </span>
              ))}
           </div>

           <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2 pr-8">
             {paper.title}
           </h2>
           
           <div className="text-slate-400 text-sm">
              {paper.authors.length > 0 ? paper.authors.join(', ') : 'Autor Desconocido'}
           </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
           {/* Abstract Section */}
           <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                 </svg>
                 Abstract Completo
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-slate-300 leading-relaxed text-sm sm:text-base selection:bg-cyan-500/30">
                 {paper.abstract || "No se ha extraído un abstract para este documento."}
              </div>
           </div>
           
           {/* Actions / Stats */}
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
               <div className="bg-slate-800/30 p-3 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase">Subido el</div>
                  <div className="text-sm text-slate-300">{new Date(paper.uploadDate).toLocaleDateString()}</div>
               </div>
               <div className="bg-slate-800/30 p-3 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase">Tamaño</div>
                  <div className="text-sm text-slate-300">{(paper.fileSize / 1024 / 1024).toFixed(2)} MB</div>
               </div>
           </div>
        </div>

      </div>
    </div>
  );
};
