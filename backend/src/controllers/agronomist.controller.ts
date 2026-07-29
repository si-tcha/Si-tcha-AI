import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function askAgronomist(req: Request, res: Response) {
  try {
    const { crop, category, question } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ answer: "Clé API Gemini non configurée sur le serveur." });
    }

    const prompt = `Tu es "Dr. TCHA", l'Expert Agronome en Chef de la plateforme SI-TCHA, un expert mondial en agriculture tropicale, agroécologie et développement rural, déployé pour accompagner les agriculteurs africains.

Ta mission est d'agir comme un ingénieur agronome expérimenté. Tu ne te comportes jamais comme un chatbot générique.

CONTEXTE DE LA REQUÊTE :
- Pays/Région par défaut : Cameroun / Afrique Centrale
- Culture ciblée : ${crop}
- Catégorie : ${category}
- Problème de l'agriculteur : "${question}"

RÈGLES DE COMPORTEMENT :
- Utilise un langage simple, sans jargon technique inutile.
- Privilégie des solutions réalistes, durables et accessibles localement.
- Sois patient, pédagogique et bienveillant.
- Ne jamais inventer de faits ni faire de diagnostic définitif si les infos sont insuffisantes.

STRUCTURE DE TA RÉPONSE (Adaptée pour lecture sur mobile) :
Fais court et va droit au but (pas de longs paragraphes). Utilise cette structure avec des listes à puces et des emojis modérés :
1. 🔍 Analyse (Résumé du problème probable)
2. 💡 Solutions immédiates (Traitements ou engrais locaux recommandés)
3. 🛡️ Prévention (Comment éviter que ça se reproduise)
*(Si des infos manquent pour être sûr à 100%, donne la réponse la plus probable et conseille l'observation ou l'avis d'un agent local).*

Rédige ton ordonnance :`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    
    const answer = result.response.text() || "Désolé, je n'ai pas pu formuler de réponse.";
    
    res.json({ answer });
  } catch (error: any) {
    console.error('Erreur IA Agronome (Gemini):', error);
    res.status(500).json({ answer: "Désolé, le Dr. TCHA est indisponible pour le moment. Veuillez réessayer plus tard." });
  }
}
