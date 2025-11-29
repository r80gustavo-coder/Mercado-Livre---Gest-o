import { GoogleGenAI } from "@google/genai";
import { Product } from "../types";
import { calculateRupture } from "./inventoryService";

export const analyzeStockRisks = async (products: Product[]): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "API Key not found. Please set the API_KEY environment variable to use AI features.";
  }

  const ai = new GoogleGenAI({ apiKey });

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
    return "Great news! Your stock health is excellent. No products are currently at risk of rupture in the immediate future.";
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
    return response.text || "Could not generate analysis.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI service. Please try again later.";
  }
};