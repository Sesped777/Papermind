
# PaperMind: Inteligencia Colectiva para tus Papers

**PaperMind** es una estación de trabajo avanzada para investigadores y estudiantes que transforma una carpeta de PDFs estáticos en una red de conocimiento interconectada. Utiliza modelos de lenguaje de última generación (Gemini API) y algoritmos de clustering para revelar la estructura semántica de tu librería.

## Funcionalidades Principales

### 1. Gestión Inteligente de Documentos
- **Extracción Automática:** Al subir un PDF, la app extrae el texto, identifica el título real, los autores, el año de publicación y genera un resumen (abstract) preciso mediante IA.
- **Embeddings de Alta Dimensión:** Cada documento se convierte en un vector numérico que representa su "significado" utilizando el modelo `text-embedding-004`.
- **Organización Flexible:** Agrupa tus papers por año, autor o etiquetas generadas automáticamente.

### 2. Visualización Avanzada
- **Grafo Neuronal:** Una representación de nodos y enlaces donde la distancia física refleja la similitud semántica. Incluye algoritmos de clustering dinámicos:
  - **K-Means:** Particiona tu librería en grupos definidos.
  - **DBSCAN:** Detecta grupos basados en densidad y señala documentos "ruido" (aislados).
- **Campo Semántico (Landscape):** Utiliza Mapas Auto-Organizativos (SOM) para crear un mapa topográfico de tus documentos. Las "montañas" representan fronteras de conocimiento y los "valles" clusters de temas similares.

### 3. Análisis de Kernel
- Una herramienta estadística para medir la salud de tu librería. Visualiza la matriz de similitud de todos contra todos y analiza la varianza y el índice de separabilidad de tus temas de investigación.

### 4. Chat Neuronal (RAG)
- No solo busques en tus documentos, habla con ellos. El chat utiliza **Generación Aumentada por Recuperación (RAG)** para responder preguntas basándose exclusivamente en el contenido de tu librería, citando las fuentes automáticamente.

## Stack Tecnológico

- **IA / LLM:** Google Gemini API (`gemini-2.5-flash` y `text-embedding-004`).
- **Frontend:** React + TypeScript + Tailwind CSS.
- **Procesamiento de PDF:** PDF.js para parsing local en el navegador.
- **Visualización:** Canvas API para renderizado de alto rendimiento de grafos y paisajes.
- **Matemáticas:** Implementaciones personalizadas de Similitud de Coseno, K-Means, DBSCAN y SOM.

**Prerequisites:**  Node.js
## Correr localmente 
1. Instalar dependencias:
   `npm install`
2. Establezca `GEMINI_API_KEY` en [.env.local](.env.local) en su clave API de Gemini3.
3. Corre la aplicacion:
   `npm run dev`

---

