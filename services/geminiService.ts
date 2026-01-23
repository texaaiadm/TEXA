
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getToolDescription(toolName: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Buat deskripsi pemasaran yang sangat menarik, persuasif, dan profesional dalam Bahasa Indonesia untuk tool AI bernama "${toolName}". Fokus pada manfaat untuk kreator digital Indonesia, gunakan gaya bahasa yang modern tapi mudah dimengerti pemula.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

export async function askSupport(question: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: question,
      config: {
        systemInstruction: "Anda adalah asisten bantuan TEXA-Ai, marketplace AI nomor 1 di Indonesia. Tugas Anda adalah membantu pengguna (kreator digital) dengan masalah teknis injeksi sesi, pertanyaan langganan, dan rekomendasi tool dalam Bahasa Indonesia yang ramah, santun, dan sangat solutif. Gunakan istilah gaul digital yang sopan."
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Maaf, sistem bantuan kami sedang sibuk. Silakan coba lagi nanti atau hubungi WhatsApp admin.";
  }
}
