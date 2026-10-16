/**
 * ai.js (utility)
 * ───────────────
 * Core AI and RAG engine:
 *  - Document text extraction (PDF via pdf-parse, DOCX via mammoth, TXT/MD)
 *  - Overlapping chunking engine with page/section tracking
 *  - Local TF-IDF Cosine Similarity retrieval for zero-dependency RAG
 *  - Re-exports generateAiResponse from centralized provider: backend/ai.js
 *  - Campus FAQ knowledge base
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { generateAiResponse } from '../../ai.js';

// ── Campus FAQ Knowledge Base ─────────────────────────────────────────────────
export const CAMPUS_FAQ = [
  {
    category: 'Academics',
    question: 'What is the university grading scale?',
    answer: 'A+ (97-100%, 4.0), A (93-96%, 4.0), A- (90-92%, 3.7), B+ (87-89%, 3.3), B (83-86%, 3.0), B- (80-82%, 2.7), C+ (77-79%, 2.3), C (73-76%, 2.0), D (60-69%, 1.0), F (<60%, 0.0).',
  },
  {
    category: 'Library',
    question: 'What are the Campus Library operating hours?',
    answer: 'The Main University Library is open Monday through Thursday 8:00 AM – 11:00 PM, Friday 8:00 AM – 8:00 PM, and Saturday/Sunday 10:00 AM – 6:00 PM. 24/7 study quiet zones are open during midterm and final exam weeks.',
  },
  {
    category: 'Registrar',
    question: 'What is the deadline for course add/drop?',
    answer: 'Students can add or drop courses without academic penalty during the first 14 calendar days of each semester through the Registrar portal.',
  },
  {
    category: 'IT Support',
    question: 'How do I connect to Campus Wi-Fi or reset my password?',
    answer: 'Connect to "Campus-Secure" using your university email and network password. To reset your password, visit it.campus.edu or visit the Help Desk in Tech Hall Room 102 (Mon-Fri 9 AM - 5 PM).',
  },
  {
    category: 'Student Life',
    question: 'Where can I access tutoring and academic support?',
    answer: 'The Academic Success Center offers free peer tutoring, writing center consultations, and study workshops in Student Union Room 304. Appointments can be scheduled online.',
  },
];

// ── 1. Document Text Extraction ───────────────────────────────────────────────

export async function extractTextFromFile(filePath, filename) {
  const ext = path.extname(filename).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return {
      text: data.text || '',
      numPages: data.numpages || 1,
    };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value || '',
      numPages: 1,
    };
  }

  // Text, Markdown, CSV, Code
  const text = buffer.toString('utf-8');
  return {
    text,
    numPages: 1,
  };
}

// ── 2. Text Chunking ──────────────────────────────────────────────────────────

export function chunkText(text, { chunkSize = 700, overlap = 150 } = {}) {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const chunks = [];
  let startIndex = 0;
  let page = 1;

  // Split into rough paragraphs or segments
  const paragraphs = clean.split(/\n\s*\n/);
  let currentChunk = '';

  for (const para of paragraphs) {
    const pTrim = para.trim();
    if (!pTrim) continue;

    if (currentChunk.length + pTrim.length + 1 <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + pTrim;
    } else {
      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          page: Math.max(1, Math.ceil(startIndex / 2500)),
        });
        startIndex += currentChunk.length;
      }

      // If a single paragraph is longer than chunkSize, slice it
      if (pTrim.length > chunkSize) {
        let pStart = 0;
        while (pStart < pTrim.length) {
          const slice = pTrim.slice(pStart, pStart + chunkSize);
          chunks.push({
            content: slice,
            page: Math.max(1, Math.ceil((startIndex + pStart) / 2500)),
          });
          pStart += chunkSize - overlap;
        }
        currentChunk = '';
        startIndex += pTrim.length;
      } else {
        currentChunk = pTrim;
      }
    }
  }

  if (currentChunk) {
    chunks.push({
      content: currentChunk,
      page: Math.max(1, Math.ceil(startIndex / 2500)),
    });
  }

  return chunks;
}

// ── 3. Cosine Similarity & TF-IDF Retrieval ───────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function getTfVector(tokens) {
  const map = {};
  tokens.forEach(t => {
    map[t] = (map[t] || 0) + 1;
  });
  return map;
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const term in vecA) {
    normA += vecA[term] * vecA[term];
    if (vecB[term]) {
      dot += vecA[term] * vecB[term];
    }
  }
  for (const term in vecB) {
    normB += vecB[term] * vecB[term];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function searchChunks(chunks, query, topK = 4) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return chunks.slice(0, topK);

  const queryVec = getTfVector(queryTokens);

  const scored = chunks.map(chunk => {
    const chunkTokens = tokenize(chunk.content);
    const chunkVec = getTfVector(chunkTokens);
    const sim = cosineSimilarity(queryVec, chunkVec);
    return { ...chunk, score: sim };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(c => c.score > 0.05).slice(0, topK);
}

// ── 4. AI Response Generation ─────────────────────────────────────────────────
// Delegated to centralized backend/ai.js adapter
export { generateAiResponse };

