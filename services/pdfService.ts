
// Access the global pdfjsLib exposed by the CDN script in index.html
const getPdfJs = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = (window as any).pdfjsLib;
  if (!pdfjs) {
    throw new Error("La librería PDF.js no se ha cargado. Por favor revisa tu conexión a internet.");
  }
  return pdfjs;
};

export const extractTextFromPDF = async (file: File): Promise<string> => {
  const pdfjs = getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    // Limit to first 20 pages for demo performance, or read all.
    // Reading all for "Organizing Papers" is better.
    const maxPages = Math.min(pdf.numPages, 20); 

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    if (fullText.trim().length === 0) {
      throw new Error("No se encontró texto en el PDF. Podría ser un escaneo solo de imágenes.");
    }

    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("Error al analizar el archivo PDF.");
  }
};
