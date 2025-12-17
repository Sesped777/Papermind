
export interface Paper {
  id: string;
  title: string;
  fileName: string;
  abstract?: string;
  authors: string[];
  content: string; // The full extracted text
  embedding?: number[]; // Vector representation
  uploadDate: number;
  year?: string; // Extracted publication year
  tags: string[];
  fileSize: number;
  similarity?: number; // Calculated on the fly during search
}

export interface SearchState {
  query: string;
  isSearching: boolean;
  results: Paper[];
}

export type ProcessingStatus = 'idle' | 'parsing' | 'embedding' | 'complete' | 'error';

export interface UploadQueueItem {
  id: string; // Unique tracking ID for the queue
  file: File;
  status: ProcessingStatus;
  error?: string;
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  paper: Paper;
}

export interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: Paper[]; // The papers used to generate this answer
}
