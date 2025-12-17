
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Paper } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  isLoading: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center
          ${isOpen ? 'bg-slate-700 rotate-90 text-slate-300' : 'bg-cyan-500 text-white hover:bg-cyan-400 hover:scale-110'}
        `}
      >
        {isOpen ? (
           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
           </svg>
        ) : (
           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
           </svg>
        )}
      </button>

      {/* Chat Window */}
      <div className={`
        fixed bottom-24 right-6 w-[90vw] sm:w-[400px] h-[600px] max-h-[80vh] z-40 
        bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col
        transition-all duration-300 origin-bottom-right
        ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-10 pointer-events-none'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 bg-slate-900/50 rounded-t-2xl flex justify-between items-center">
            <div>
               <h3 className="text-white font-bold">Chat Neuronal</h3>
               <p className="text-xs text-slate-400">Pregunta a tu biblioteca</p>
            </div>
            <div className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20">
               RAG Activo
            </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                    <p className="text-sm">Aún no hay mensajes.</p>
                    <p className="text-xs mt-2">Intenta preguntar: "¿Cuáles son los temas comunes?"</p>
                </div>
            )}
            
            {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`
                        max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed
                        ${msg.role === 'user' 
                           ? 'bg-cyan-600 text-white rounded-tr-sm' 
                           : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm shadow-md'
                        }
                    `}>
                        {msg.content}
                    </div>
                    {/* Citations */}
                    {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1 max-w-[85%] justify-start">
                            {msg.sources.map((source, i) => (
                                <span key={i} className="text-[9px] bg-slate-950 text-slate-400 px-2 py-1 rounded border border-slate-800 truncate max-w-[150px]" title={source.title}>
                                   📚 {source.title}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            
            {isLoading && (
               <div className="flex items-start">
                  <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-sm border border-slate-700">
                     <div className="flex space-x-1.5">
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></div>
                     </div>
                  </div>
               </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700/50 bg-slate-900/50 rounded-b-2xl">
           <div className="relative">
             <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               placeholder="Pregunta sobre tus documentos..."
               className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all pr-12"
               disabled={isLoading}
             />
             <button
               type="submit"
               disabled={!input.trim() || isLoading}
               className="absolute right-2 top-2 p-1.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500 transition-colors"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
             </button>
           </div>
        </form>
      </div>
    </>
  );
};
