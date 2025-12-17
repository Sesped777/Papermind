
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { FileUpload } from './components/FileUpload';
import { PaperCard } from './components/PaperCard';
import { NetworkGraph } from './components/NetworkGraph';
import { KernelAnalysis } from './components/KernelAnalysis';
import { LandscapeView } from './components/LandscapeView';
import { ChatInterface } from './components/ChatInterface';
import { PaperDetailsModal } from './components/PaperDetailsModal';
import { extractTextFromPDF } from './services/pdfService';
import { generateEmbedding, inferMetadata, generateRagResponse } from './services/geminiService';
import { cosineSimilarityKernel } from './utils/mathUtils';
import { Paper, UploadQueueItem, ChatMessage } from './types';

// Mock UUID if uuid package not available in this env
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'title' | 'relevance';
type GroupOption = 'none' | 'year' | 'author' | 'tag';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'library' | 'graph' | 'landscape'>('library');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);
  const [showKernelAnalysis, setShowKernelAnalysis] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [groupBy, setGroupBy] = useState<GroupOption>('none');
  const [isExporting, setIsExporting] = useState(false);

  // Check for API key on mount
  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyError(true);
    }
  }, []);

  const handleFilesSelected = (files: File[]) => {
    // 1. Prepare items with unique IDs first
    const newItems: UploadQueueItem[] = files.map(f => ({
      id: generateId(),
      file: f,
      status: 'idle'
    }));

    // 2. Update state ONCE
    setUploadQueue(prev => [...prev, ...newItems]);

    // 3. Trigger processing independently
    // Passing the specific items to process avoids index confusion and strict mode double-invocation issues
    processQueueItems(newItems);
  };

  const processQueueItems = async (items: UploadQueueItem[]) => {
    for (const item of items) {
      updateQueueStatus(item.id, 'parsing');
      
      try {
        // 1. Parse PDF
        const text = await extractTextFromPDF(item.file);
        
        // 2. Metadata Inference
        updateQueueStatus(item.id, 'embedding');
        const metadata = await inferMetadata(text);

        // 3. Generate Embedding
        const richTextForEmbedding = `Title: ${metadata.title}\nKeywords: ${metadata.tags.join(", ")}\nAbstract: ${metadata.abstract}\n\nContent:\n${text}`;
        const embedding = await generateEmbedding(richTextForEmbedding);

        const newPaper: Paper = {
          id: generateId(),
          title: metadata.title,
          abstract: metadata.abstract,
          authors: metadata.authors,
          tags: metadata.tags,
          year: metadata.year,
          content: text,
          embedding: embedding,
          fileName: item.file.name,
          uploadDate: Date.now(),
          fileSize: item.file.size,
          similarity: 0
        };

        setPapers(prev => [newPaper, ...prev]);
        updateQueueStatus(item.id, 'complete');
        
      } catch (error) {
        console.error(error);
        updateQueueStatus(item.id, 'error', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  };

  const updateQueueStatus = (itemId: string, status: UploadQueueItem['status'], error?: string) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === itemId ? { ...item, status, error } : item
    ));
  };

  const handleDeletePaper = (id: string) => {
    setPapers(prev => prev.filter(p => p.id !== id));
  };

  const handlePaperClick = (paper: Paper) => {
    setSelectedPaper(paper);
  };

  // Search Logic
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      // Reset similarities
      setPapers(prev => prev.map(p => ({ ...p, similarity: 0 })));
      return;
    }

    setIsSearching(true);

    try {
      // 1. Embed query
      const queryEmbedding = await generateEmbedding(searchQuery);

      // 2. Kernelize (Cosine Similarity) and Update ALL papers
      setPapers(prevPapers => {
          return prevPapers.map(paper => {
            if (!paper.embedding) return { ...paper, similarity: 0 };
            return {
              ...paper,
              similarity: cosineSimilarityKernel(queryEmbedding, paper.embedding)
            };
          });
      });

    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
        handleSearch();
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]); 

  // --- RAG Logic ---
  const handleChatMessage = async (msg: string) => {
    if (papers.length === 0) return;

    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: msg,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      // 2. Retrieval: Find top 5 relevant papers
      const queryEmbedding = await generateEmbedding(msg);
      
      const scoredPapers = papers.map(p => {
        if (!p.embedding) return { ...p, score: 0 };
        return { ...p, score: cosineSimilarityKernel(queryEmbedding, p.embedding) };
      });
      
      // Filter threshold and sort
      const topPapers = scoredPapers
        .filter(p => p.score > 0.35) // Only somewhat relevant papers
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // 3. Generation (RAG)
      let responseText = "";
      if (topPapers.length === 0) {
        responseText = "No pude encontrar documentos relevantes en tu librería para responder esa pregunta. Intenta añadir más documentos o reformular tu pregunta.";
      } else {
        responseText = await generateRagResponse(msg, topPapers);
      }

      const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        sources: topPapers // Store sources for citation UI
      };
      
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
       console.error("Chat error", error);
       const errorMsg: ChatMessage = {
         id: generateId(),
         role: 'assistant',
         content: "Lo siento, tuve problemas analizando los documentos.",
         timestamp: Date.now()
       };
       setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- Export Logic ---
  const handleExport = async () => {
      if (papers.length === 0) return;
      setIsExporting(true);

      try {
          const zip = new JSZip();
          
          papers.forEach(paper => {
              // Determine folder name based on current grouping, or default to "Library" if none
              let folderName = "Sin Categoría";
              
              if (groupBy === 'year') {
                  folderName = paper.year && paper.year !== "Unknown" ? paper.year : "Año Desconocido";
              } else if (groupBy === 'author') {
                  folderName = paper.authors.length > 0 ? paper.authors[0] : "Autor Desconocido";
              } else if (groupBy === 'tag') {
                  folderName = paper.tags.length > 0 ? paper.tags[0] : "Varios";
              } else {
                  folderName = "Todos los Documentos";
              }

              // Clean folder name to be safe
              folderName = folderName.replace(/[^a-z0-9 _-]/gi, '').trim();

              const originalItem = uploadQueue.find(item => item.file.name === paper.fileName);
              if (originalItem) {
                   zip.folder(folderName)?.file(paper.fileName, originalItem.file);
              } else {
                   // Fallback: Save extracted text content
                   zip.folder(folderName)?.file(paper.fileName + ".txt", paper.content);
              }
          });

          const blob = await zip.generateAsync({type: "blob"});
          
          // Trigger download
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `PaperMind_Libreria_${groupBy !== 'none' ? groupBy : 'completa'}.zip`;
          a.click();
          window.URL.revokeObjectURL(url);

      } catch (e) {
          console.error("Export failed", e);
          alert("Fallo al crear el archivo ZIP.");
      } finally {
          setIsExporting(false);
      }
  };


  // --- Derived Data for Grouping ---
  const groupedPapers = useMemo(() => {
     if (groupBy === 'none') return null;

     const groups: Record<string, Paper[]> = {};

     papers.forEach(p => {
         let key = "Otros";
         if (groupBy === 'year') key = p.year && p.year !== "Unknown" ? p.year : "Año Desconocido";
         else if (groupBy === 'author') key = p.authors.length > 0 ? p.authors[0] : "Autor Desconocido";
         else if (groupBy === 'tag') key = p.tags.length > 0 ? p.tags[0] : "Varios";
         
         if (!groups[key]) groups[key] = [];
         groups[key].push(p);
     });
     
     // Sort keys
     return Object.keys(groups).sort().reduce((obj, key) => {
         obj[key] = groups[key];
         return obj;
     }, {} as Record<string, Paper[]>);

  }, [papers, groupBy]);

  // Derived Data for List View (Filtered & Sorted Flat List)
  const listDisplayedPapers = useMemo(() => {
    let data = [...papers];
    if (searchQuery) data = data.filter(p => (p.similarity || 0) > 0.3);
    
    return data.sort((a, b) => {
      if (sortBy === 'newest') return b.uploadDate - a.uploadDate;
      if (sortBy === 'oldest') return a.uploadDate - b.uploadDate;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'relevance') return (b.similarity || 0) - (a.similarity || 0);
      return 0;
    });
  }, [searchQuery, papers, sortBy]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-cyan-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0f172a]/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('library')}>
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white">Paper<span className="text-cyan-400">Mind</span></h1>
          </div>

          <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busca conceptos (ej: 'redes neuronales', 'biología molecular')..."
                className="w-full bg-slate-900 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {isSearching && (
                 <div className="absolute right-3 top-2.5 w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              )}
          </div>

          <div className="flex items-center space-x-4">
             {/* Upload Status */}
             {uploadQueue.some(item => item.status === 'parsing' || item.status === 'embedding') && (
               <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-950/30 px-3 py-1.5 rounded-full border border-cyan-500/20">
                 <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                 Procesando {uploadQueue.filter(i => i.status === 'parsing' || i.status === 'embedding').length} archivo(s)...
               </div>
             )}

            {/* Nav Tabs */}
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('library')}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'library' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                 <span>Librería</span>
                 <span className="bg-slate-800 text-slate-400 py-0.5 px-2 rounded-full text-xs">{papers.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('graph')}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'graph' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                 <span>Grafo Neuronal</span>
              </button>
              <button
                onClick={() => setActiveTab('landscape')}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'landscape' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                 <span>Campo</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {apiKeyError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center justify-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
             <span className="font-semibold">Error: No se encontró la API Key. Configura la variable de entorno API_KEY.</span>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Toolbar */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Tu Librería</h2>
                    <p className="text-slate-400 text-sm">Organiza, busca y analiza tus documentos académicos.</p>
                 </div>

                 <div className="flex items-center gap-3 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
                    {/* Kernel Analysis Toggle */}
                    <button
                        onClick={() => setShowKernelAnalysis(!showKernelAnalysis)}
                        className={`p-2 rounded hover:bg-slate-700 transition-colors ${showKernelAnalysis ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400'}`}
                        title="Análisis de Kernel"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                         </svg>
                    </button>
                    <div className="w-px h-6 bg-slate-700 mx-1"></div>

                    {/* View Toggles */}
                    <div className="flex bg-slate-900 rounded-md p-0.5">
                       <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                       </button>
                       <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                       </button>
                    </div>

                    <div className="w-px h-6 bg-slate-700 mx-1"></div>

                    {/* Sort */}
                    <select 
                       value={sortBy} 
                       onChange={(e) => setSortBy(e.target.value as SortOption)}
                       className="bg-slate-900 border-none text-xs text-slate-300 rounded focus:ring-0 cursor-pointer"
                    >
                       <option value="newest">Más recientes</option>
                       <option value="oldest">Más antiguos</option>
                       <option value="title">Título (A-Z)</option>
                       <option value="relevance" disabled={!searchQuery}>Relevancia</option>
                    </select>

                    {/* Group */}
                    <select 
                       value={groupBy} 
                       onChange={(e) => setGroupBy(e.target.value as GroupOption)}
                       className="bg-slate-900 border-none text-xs text-slate-300 rounded focus:ring-0 cursor-pointer"
                    >
                       <option value="none">Sin agrupar</option>
                       <option value="year">Por Año</option>
                       <option value="author">Por Autor</option>
                       <option value="tag">Por Etiqueta</option>
                    </select>

                    <button 
                       onClick={handleExport}
                       disabled={isExporting || papers.length === 0}
                       className="ml-2 p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
                       title="Exportar como ZIP"
                    >
                        {isExporting ? (
                           <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                           </svg>
                        )}
                    </button>
                 </div>
             </div>

             {/* Upload Area */}
             <div className="mb-8">
               <FileUpload onFilesSelected={handleFilesSelected} disabled={false} />
             </div>

             {/* Content Area */}
             <div className="space-y-8 pb-20">
                {groupBy === 'none' ? (
                   // FLAT LIST
                   <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-3"}>
                      {listDisplayedPapers.map(paper => (
                        <PaperCard 
                           key={paper.id} 
                           paper={paper} 
                           isResult={!!searchQuery} 
                           viewMode={viewMode}
                           onDelete={handleDeletePaper}
                           onClick={handlePaperClick}
                           onAnalyze={(p) => {
                               setActiveTab('graph');
                           }}
                        />
                      ))}
                      {listDisplayedPapers.length === 0 && papers.length > 0 && (
                         <div className="col-span-full text-center py-10 text-slate-500">
                            No se encontraron documentos que coincidan con tu búsqueda.
                         </div>
                      )}
                      {papers.length === 0 && (
                         <div className="col-span-full text-center py-10 text-slate-500">
                            Tu librería está vacía. Sube algunos PDFs para comenzar.
                         </div>
                      )}
                   </div>
                ) : (
                   // GROUPED LIST
                   <div className="space-y-8">
                      {groupedPapers && Object.entries(groupedPapers).map(([groupName, groupPapers]: [string, Paper[]]) => (
                          <div key={groupName} className="animate-in fade-in slide-in-from-bottom-2">
                             <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                                {groupName} 
                                <span className="text-slate-500 text-sm font-normal">({groupPapers.length})</span>
                             </h3>
                             <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-3"}>
                                {groupPapers.map(paper => (
                                   <PaperCard 
                                      key={paper.id} 
                                      paper={paper} 
                                      isResult={!!searchQuery} 
                                      viewMode={viewMode}
                                      onDelete={handleDeletePaper}
                                      onClick={handlePaperClick}
                                      onAnalyze={() => setActiveTab('graph')}
                                   />
                                ))}
                             </div>
                          </div>
                      ))}
                   </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'graph' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-12rem)] flex flex-col">
             <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Grafo Neuronal</h2>
                  <p className="text-slate-400 text-sm">Visualiza las conexiones semánticas entre tus documentos.</p>
                </div>
             </div>
             <div className="flex-1 min-h-0">
                <NetworkGraph 
                   papers={papers} 
                   searchQuery={searchQuery}
                   onNodeClick={handlePaperClick}
                />
             </div>
           </div>
        )}

        {activeTab === 'landscape' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Campo Semántico</h2>
                  <p className="text-slate-400 text-sm">Organización topológica de tus documentos usando Mapas Auto-Organizativos (SOM).</p>
                </div>
             </div>
             <LandscapeView papers={papers} />
           </div>
        )}

        {/* Paper Details Modal */}
        {selectedPaper && (
            <PaperDetailsModal 
                paper={selectedPaper} 
                onClose={() => setSelectedPaper(null)} 
            />
        )}

        {/* Floating Kernel Analysis Window */}
        {showKernelAnalysis && (
            <KernelAnalysis papers={papers} onClose={() => setShowKernelAnalysis(false)} />
        )}

        {/* Floating Chat Interface */}
        <ChatInterface 
           messages={messages} 
           onSendMessage={handleChatMessage} 
           isLoading={isChatLoading}
        />

      </main>
    </div>
  );
};

export default App;
