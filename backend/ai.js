/**
 * ai.js
 * ─────
 * Centralized AI provider abstraction layer for Campus AI.
 * All LLM API calls are contained in this single file so the underlying
 * provider can be easily swapped in the future (e.g. Gemini, Claude, Groq, Ollama).
 *
 * Current Provider: Google Gemini (@google/generative-ai)
 * Model: gemini-2.0-flash (configurable via GEMINI_MODEL)
 * Key: GEMINI_API_KEY (from .env)
 *
 * Rules:
 *  - If GEMINI_API_KEY is missing/placeholder, returns "AI is not configured".
 *  - Enforces per-course AI policy ('disabled', 'hints_only', 'allowed').
 *  - Enforces academic-integrity rules (Socratic questioning in hints_only mode).
 *  - Preserves source citations and study modes (ask, explain, brainstorm, quiz, summarize).
 *  - Never exposes secret keys to the frontend.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Checks if the configured Gemini API key is valid and present.
 */
export function isKeyConfigured(apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) return false;
  const trimmed = apiKey.trim();
  if (trimmed === '' || trimmed === 'your_gemini_api_key_here' || trimmed === 'your_anthropic_api_key_here') {
    return false;
  }
  return true;
}

/**
 * Build the system instruction incorporating mode instructions and course policy.
 */
export function buildSystemInstruction({ mode, isHintsOnly, contextText }) {
  const modeInstructions = {
    ask: 'Answer the question directly, accurately, and thoroughly using the provided context materials and citing sources.',
    explain: 'Explain the core concept step-by-step using clear language, conceptual clarity, and intuitive real-world analogies.',
    brainstorm: 'Brainstorm creative, structured project topics, essay ideas, and study directions related to the inquiry.',
    quiz: 'Generate 3 interactive check-in/practice questions (with multiple-choice options or thought questions) along with concise answer explanations.',
    summarize: 'Provide an executive summary, highlighting core concepts, definitions, and key study takeaways in bullet points.',
  };

  const selectedModePrompt = modeInstructions[mode] || modeInstructions.ask;

  return `You are Campus AI, an expert, encouraging, and academically rigorous university tutor.
The current study mode is: ${mode.toUpperCase()}.
Task: ${selectedModePrompt}

${
  isHintsOnly
    ? 'CRITICAL ACADEMIC INTEGRITY POLICY: The instructor has set this course to HINTS ONLY mode. You MUST NOT under any circumstances provide direct answers, complete code, or solved solutions. Instead, guide the student using Socratic questioning, conceptual hints, breaking down the problem into smaller steps, and pointing to relevant sections of the course materials so the student discovers the answer themselves.'
    : 'Provide clear, comprehensive, and well-structured answers using rich markdown formatting.'
}

When referencing facts or information from the retrieved course materials below, always cite them explicitly using [Source 1], [Source 2], etc.

Context Materials:
${contextText || 'No specific document context provided. Rely on university course fundamentals and best practices.'}
`;
}

/**
 * Call the configured AI provider (Google Gemini).
 * Replace or extend this function to support Claude, Groq, Ollama, etc.
 */
async function callGeminiProvider({ systemPrompt, prompt, chatHistory = [], modelName = 'gemini-2.0-flash' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isKeyConfigured(apiKey)) {
    return { error: 'not_configured', text: 'AI is not configured' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    // Map conversation history to Gemini's expected format (assistant -> model)
    const contents = [
      ...chatHistory.slice(-6).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const result = await model.generateContent({ contents });
    const response = await result.response;
    return { text: response.text() };
  } catch (err) {
    console.error('Gemini API invocation error:', err?.message || err);
    // Sanitize any potential key leakage in error messages
    const sanitizedMsg = (err?.message || 'Failed to generate response')
      .replace(/key=[^&\s]+/gi, 'key=***')
      .replace(/[A-Za-z0-9_-]{35,}/g, '***');

    return { error: 'api_error', text: `⚠️ AI Service Error: ${sanitizedMsg}` };
  }
}

/**
 * Main AI generation entry point used across the application.
 */
export async function generateAiResponse({
  prompt,
  mode = 'ask',
  coursePolicy = 'allowed',
  retrievedChunks = [],
  chatHistory = [],
  courseCode = '',
}) {
  // 1. Check Course AI Policy (Per-Course Control)
  if (coursePolicy === 'disabled') {
    return {
      content: `🔒 **AI Study Assistant is Disabled**\n\nThe instructor for ${courseCode || 'this course'} has currently disabled AI assistance. You can review course materials directly or consult the instructor during office hours.`,
      citations: [],
    };
  }

  const isHintsOnly = coursePolicy === 'hints_only';

  // 2. Format Citations from Retrieved Chunks
  const citations = retrievedChunks
    .filter(c => c.score > 0.05)
    .map((c, i) => ({
      index: i + 1,
      docName: c.doc_filename || 'Course Document',
      page: c.page || 1,
      snippet: c.content.slice(0, 180).trim() + '...',
    }));

  const contextText = retrievedChunks
    .map((c, i) => `[Source ${i + 1} | ${c.doc_filename || 'Document'} | Page ${c.page || 1}]:\n${c.content}`)
    .join('\n\n---\n\n');

  // 3. Check if Key is configured before invoking provider
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isKeyConfigured(apiKey)) {
    return {
      content: 'AI is not configured',
      citations: [],
    };
  }

  // 4. Construct System Instruction
  const systemPrompt = buildSystemInstruction({
    mode,
    isHintsOnly,
    contextText,
  });

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  // 5. Invoke the AI provider
  const result = await callGeminiProvider({
    systemPrompt,
    prompt,
    chatHistory,
    modelName,
  });

  return {
    content: result.text || 'AI is not configured',
    citations: result.error ? [] : citations,
  };
}

export default {
  generateAiResponse,
};
