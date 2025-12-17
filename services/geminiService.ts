
import { GoogleGenAI } from "@google/genai";
import { Paper } from "../types";

// We use 'text-embedding-004' as it is the latest stable embedding model.
const MODEL_NAME = "text-embedding-004";

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
  if (!aiClient) {
    // We expect the API key to be available in process.env.API_KEY
    if (!process.env.API_KEY) {
       throw new Error("Falta la API Key.");
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

/**
 * Generates an embedding vector for a given text.
 * Truncates text if it's too long.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const client = getClient();
  
  // Truncate to avoid payload limits.
  // text-embedding-004 has a limit of 2048 tokens (~8000 chars).
  const truncatedText = text.slice(0, 8000); 

  try {
    // Use 'contents' (plural) and pass the text directly.
    const result = await client.models.embedContent({
      model: MODEL_NAME,
      contents: truncatedText,
    });

    // Fix: The @google/genai SDK response uses 'embeddings' (plural) which is an array of ContentEmbedding.
    if (!result.embeddings || result.embeddings.length === 0 || !result.embeddings[0].values) {
      throw new Error("Fallo al generar embedding: La API no devolvió valores.");
    }

    return result.embeddings[0].values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    throw error;
  }
};

/**
 * Uses a generative model to infer a title, abstract, authors, and tags.
 */
export const inferMetadata = async (text: string): Promise<{title: string, abstract: string, authors: string[], tags: string[], year: string}> => {
  const client = getClient();
  // We use the first 6000 chars to ensure we capture the full abstract even in verbose layouts
  const truncatedText = text.slice(0, 6000);

  try {
     const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Eres un algoritmo estricto de extracción. Analiza el siguiente fragmento de texto de un paper académico. 
        
        Devuelve un objeto JSON con:
        - 'title': El título exacto del paper.
        - 'abstract': El texto de la sección 'Abstract' copiado VERBATIM (sin cambios). Si no hay abstract, devuelve string vacío.
        - 'authors': Array de strings con los nombres de los autores.
        - 'keywords': Array de 5 a 10 strings en ESPAÑOL. Prioridad: 1. Extrae las 'Keywords' oficiales del paper. 2. Si no existen, genera palabras clave técnicas precisas basadas en el contenido.
        - 'year': El año de publicación como string (ej. "2023"). Si no se encuentra, usa "Unknown".
        
        Fragmento de Texto: ${truncatedText}`,
        config: {
            responseMimeType: "application/json",
        }
     });

     let result = response.text;
     if (!result) return { title: "Paper Sin Título", abstract: "", authors: [], tags: [], year: "Unknown" };
     
     // Clean up if the model returns markdown code blocks
     if (result.startsWith('```')) {
        result = result.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
     }

     try {
       const parsed = JSON.parse(result);
       return {
          title: parsed.title || "Paper Sin Título",
          abstract: parsed.abstract || "",
          authors: parsed.authors || [],
          // Map keywords from JSON to 'tags' in our internal model
          tags: parsed.keywords || parsed.tags || [],
          year: parsed.year || "Unknown"
       };
     } catch (e) {
       console.warn("JSON Parse Error in metadata:", e);
       return { title: "Paper Sin Título", abstract: "", authors: [], tags: [], year: "Unknown" };
     }
  } catch (e) {
      console.warn("Metadata inference failed", e);
      return { title: "Título Desconocido", abstract: "", authors: [], tags: [], year: "Unknown" };
  }
};

/**
 * RAG: Generates an answer based on the provided context papers.
 */
export const generateRagResponse = async (query: string, contextPapers: Paper[]): Promise<string> => {
  const client = getClient();

  // Construct context blob
  // We limit context to avoid exceeding token limits, taking abstract + first 1000 chars of content
  let contextText = "";
  contextPapers.forEach((p, index) => {
    contextText += `[DOCUMENTO ${index + 1}] Título: ${p.title}\nAbstract: ${p.abstract}\nExtracto: ${p.content.slice(0, 1500)}...\n\n`;
  });

  const prompt = `Eres un asistente de investigación académica especializado. 
  Responde a la pregunta del usuario utilizando ÚNICAMENTE la información proporcionada en el Contexto a continuación.
  
  Reglas:
  1. Si la respuesta no está en el contexto, indica "No puedo encontrar la respuesta en los documentos proporcionados."
  2. Cita los documentos que utilices por su Título o Número (ej. "Según [Documento 1]...").
  3. Sé conciso y técnico.
  4. RESPONDE SIEMPRE EN ESPAÑOL.
  
  Pregunta del Usuario: ${query}
  
  Contexto:
  ${contextText}`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "No se generó respuesta.";
  } catch (e) {
    console.error("RAG Error:", e);
    return "Encontré un error analizando los documentos.";
  }
};
