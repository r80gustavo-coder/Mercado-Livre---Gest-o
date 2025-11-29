
import { GoogleGenAI } from "@google/genai";
import { Product } from "../types";
import { calculateRupture } from "./inventoryService";

export const analyzeStockRisks = async (products: Product[]): Promise<string> => {
  // Ensure API Key is present from process.env as per guidelines
  // Note: process.env is polyfilled in vite.config.ts
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key não encontrada.");
    return "Recurso de IA indisponível no momento (Chave de API não configurada).";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Filter for risky products to save tokens and focus context
  const riskyProducts = products.map(p => {
    const { daysLeft, status } = calculateRupture(p.stock_full, p.avg_daily_sales);
    return {
      sku: p.sku,
      title: p.title,
      full_stock: p.stock_full,
      factory_stock: p.stock_factory,
      avg_daily_sales: p.avg_daily_sales,
      days_until_empty: daysLeft,
      status
    };
  }).filter(p => p.status !== 'HEALTHY');

  if (riskyProducts.length === 0) {
    return "Ótimas notícias! A saúde do seu estoque está excelente. Nenhum produto tem risco iminente de ruptura.";
  }

  const prompt = `
    You are an expert inventory manager for Mercado Livre Full.
    Analyze the following product data which contains items at risk of running out of stock (Rupture).
    
    Data:
    ${JSON.stringify(riskyProducts, null, 2)}

    Please provide a concise, actionable report in Portuguese (pt-BR).
    1. Identify the most critical urgency.
    2. Suggest specific actions (e.g., "Send batch immediately", "Increase production").
    3. If factory stock is low for high-velocity items, flag it as a manufacturing emergency.
    
    Keep the tone professional and direct.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com a IA. Verifique a chave de API.";
  }
};
