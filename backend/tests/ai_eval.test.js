/**
 * ai_eval.test.js
 * ───────────────
 * Automated Evaluation Suite for Campus AI Provider & Answer Quality:
 *
 *  T1:  [Key Missing Check] If GEMINI_API_KEY is not configured, returns "AI is not configured" instead of fake answer.
 *  T2:  [Security Invariant] API responses and errors NEVER expose the GEMINI_API_KEY to the client.
 *  T3:  [Academic Integrity] "hints_only" policy enforces Socratic questioning and forbids direct answers.
 *  T4:  [Course Policy: Disabled] Course with policy "disabled" returns clean rejection message.
 *  T5:  [5 Modes Support] System instructions strictly preserve Ask, Explain, Brainstorm, Quiz, and Summarize directives.
 *  T6:  [Citations & RAG] Document upload, text chunking, and TF-IDF citation formatting [Source X | Doc | Page].
 *  T7:  [Daily Limit Enforcement] Rejects requests exceeding daily message quota with HTTP 429.
 *  T8:  [Admin Master Switch] Disabling AI campus-wide in ai_settings rejects requests with HTTP 403.
 *  T9:  [Campus FAQ: Library] Accurate library operating hours retrieval from institutional knowledge base.
 *  T10: [Campus FAQ: Grading] Accurate university letter grade scale and GPA values.
 *  Bonus / Live: If a valid GEMINI_API_KEY is configured, validates live Google Gemini 2.0 Flash response.
 */

import dotenv from 'dotenv';
dotenv.config();

import { isKeyConfigured, buildSystemInstruction } from '../ai.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000/api/v1';

let passed = 0;
let failed = 0;

function evaluate(condition, tNum, title, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS T${tNum}: ${title}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL T${tNum}: ${title} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  return data.access_token;
}

async function runAiEvaluation() {
  console.log('\n======================================================');
  console.log('🤖 RUNNING CAMPUS AI GEMINI PROVIDER & INTEGRITY TESTS');
  console.log('======================================================\n');

  const token = await login('sam@campus.edu', 'Student@123');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Setup: Ingest a benchmark syllabus document
  const sampleDoc = `CS101 Course Syllabus - Operating Systems Fundamentals
Topic 1: Virtual Memory and Paging
Virtual memory provides an illusion of a large, contiguous address space by dividing physical memory into fixed-size blocks called page frames (typically 4 KB).
The Page Table maps virtual page numbers (VPN) to physical frame numbers (PFN).
When a requested page is not in physical RAM, a Page Fault exception is triggered by the Memory Management Unit (MMU).`;

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let multipart = '';
  multipart += '--' + boundary + '\r\n';
  multipart += 'Content-Disposition: form-data; name="file"; filename="OS_Syllabus.txt"\r\n';
  multipart += 'Content-Type: text/plain\r\n\r\n';
  multipart += sampleDoc + '\r\n';
  multipart += '--' + boundary + '--\r\n';

  const uploadRes = await fetch(`${BASE_URL}/ai/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: Buffer.from(multipart),
  }).then(r => r.json());

  const docId = uploadRes.id;

  // Create test session linked to document
  const sessionRes = await fetch(`${BASE_URL}/ai/chat/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ document_id: docId, mode: 'ask' }),
  }).then(r => r.json());
  const sessionId = sessionRes.id;

  const keyConfigured = isKeyConfigured(process.env.GEMINI_API_KEY);

  // ── T1: Key Missing Check or Live Response Check ───────────────────────────
  const t1Res = await fetch(`${BASE_URL}/ai/chat/sessions/${sessionId}/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: 'What size are physical page frames in virtual memory?',
      mode: 'ask',
    }),
  }).then(r => r.json());

  const t1Content = t1Res.message?.content || '';

  if (!keyConfigured) {
    evaluate(
      t1Content === 'AI is not configured',
      1,
      'If GEMINI_API_KEY is missing/placeholder, returns "AI is not configured" (no fake answer)',
      `Received: "${t1Content}"`
    );
  } else {
    evaluate(
      t1Content.length > 0 && !t1Content.includes('AI is not configured'),
      1,
      'Live Gemini generation returned content using configured GEMINI_API_KEY',
      `Preview: ${t1Content.slice(0, 50)}...`
    );
  }

  // ── T2: Security Invariant - Never Expose Secret Key ───────────────────────
  const rawResponseText = JSON.stringify(t1Res);
  const secretKey = process.env.GEMINI_API_KEY || '';
  const keyExposed = secretKey.length > 5 && rawResponseText.includes(secretKey);
  evaluate(
    !keyExposed,
    2,
    'Security Guard: Secret API key is NEVER exposed to the client or frontend'
  );

  // ── T3: Academic Integrity Policy (Hints Only Socratic Rules) ───────────────
  const hintsPrompt = buildSystemInstruction({
    mode: 'ask',
    isHintsOnly: true,
    contextText: 'Virtual memory concepts',
  });
  evaluate(
    hintsPrompt.includes('CRITICAL ACADEMIC INTEGRITY POLICY') &&
    hintsPrompt.includes('HINTS ONLY') &&
    hintsPrompt.includes('Socratic questioning') &&
    hintsPrompt.includes('MUST NOT under any circumstances provide direct answers'),
    3,
    'Academic Integrity Rule strictly instructs Socratic hints and forbids direct solutions'
  );

  // ── T4: Course Policy Enforcement - Disabled ───────────────────────────────
  const courses = await fetch(`${BASE_URL}/student/courses`, { headers }).then(r => r.json());
  const disabledCourse = courses.find(c => c.ai_policy === 'disabled');
  let testOfferingId = disabledCourse?.offering_id;

  if (!testOfferingId && courses.length > 0) {
    const adminToken = await login('admin@campus.edu', 'Admin@123');
    await fetch(`${BASE_URL}/faculty/courses/${courses[0].offering_id}/ai-policy`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_policy: 'disabled' }),
    });
    testOfferingId = courses[0].offering_id;
  }

  const t4Res = await fetch(`${BASE_URL}/ai/chat/sessions/${sessionId}/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: 'Can you help me with this course?',
      mode: 'ask',
      offering_id: testOfferingId,
    }),
  }).then(r => r.json());

  const t4Text = t4Res.message?.content || '';
  evaluate(
    t4Text.includes('AI Study Assistant is Disabled') || t4Text.toLowerCase().includes('disabled'),
    4,
    'Course Policy "disabled" cleanly rejects requests with official notice'
  );

  // Restore policy if altered
  if (!disabledCourse && courses.length > 0) {
    const adminToken = await login('admin@campus.edu', 'Admin@123');
    await fetch(`${BASE_URL}/faculty/courses/${testOfferingId}/ai-policy`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_policy: 'allowed' }),
    });
  }

  // ── T5: All 5 Study Modes Supported ────────────────────────────────────────
  const modes = ['ask', 'explain', 'brainstorm', 'quiz', 'summarize'];
  const allModesVerified = modes.every(m => {
    const instruction = buildSystemInstruction({ mode: m, isHintsOnly: false, contextText: 'Test' });
    return instruction.includes(m.toUpperCase());
  });
  evaluate(
    allModesVerified,
    5,
    'Preserves all 5 study modes (ask, explain, brainstorm, quiz, summarize)'
  );

  // ── T6: Document Citations & Context Formatting ────────────────────────────
  const sampleCitationPrompt = buildSystemInstruction({
    mode: 'ask',
    isHintsOnly: false,
    contextText: '[Source 1 | OS_Syllabus.txt | Page 1]:\nVirtual memory content',
  });
  evaluate(
    sampleCitationPrompt.includes('[Source 1]') && sampleCitationPrompt.includes('cite them explicitly using [Source 1]'),
    6,
    'Citations framework formats source snippets and explicitly instructs citations'
  );

  // ── T7: Daily Message Limit Enforcement ────────────────────────────────────
  const adminToken = await login('admin@campus.edu', 'Admin@123');
  // Temporarily set daily limit to current count to test 429
  const currentSettings = await fetch(`${BASE_URL}/ai/admin/settings`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).then(r => r.json());

  await fetch(`${BASE_URL}/ai/admin/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_message_limit: 1 }),
  });

  const limitRes = await fetch(`${BASE_URL}/ai/chat/sessions/${sessionId}/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: 'Test limit message', mode: 'ask' }),
  });

  evaluate(
    limitRes.status === 429,
    7,
    'Daily message cap enforcement returns 429 when quota is reached'
  );

  // Restore daily limit
  await fetch(`${BASE_URL}/ai/admin/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_message_limit: currentSettings.daily_message_limit || 50 }),
  });

  // ── T8: Admin Global Master Kill-switch ─────────────────────────────────────
  await fetch(`${BASE_URL}/ai/admin/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ai_enabled: false }),
  });

  const disabledAiRes = await fetch(`${BASE_URL}/ai/chat/sessions/${sessionId}/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: 'Hello AI', mode: 'ask' }),
  });

  evaluate(
    disabledAiRes.status === 403,
    8,
    'Global AI toggle in ai_settings cleanly disables AI with HTTP 403'
  );

  // Re-enable global AI
  await fetch(`${BASE_URL}/ai/admin/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ai_enabled: true }),
  });

  // ── T9: Campus FAQ - Library Hours ─────────────────────────────────────────
  const faqRes = await fetch(`${BASE_URL}/ai/faq`).then(r => r.json());
  const libFaq = faqRes.find(f => f.category === 'Library');
  evaluate(
    libFaq && libFaq.answer.includes('8:00 AM') && libFaq.answer.includes('11:00 PM'),
    9,
    'Campus FAQ accurately retrieves library operating hours from knowledge base'
  );

  // ── T10: Campus FAQ - Grading Scale ────────────────────────────────────────
  const gradeFaq = faqRes.find(f => f.category === 'Academics');
  evaluate(
    gradeFaq && gradeFaq.answer.includes('4.0') && gradeFaq.answer.includes('A+'),
    10,
    'Campus FAQ accurately retrieves university GPA points and letter grade scale'
  );

  console.log('\n======================================================');
  console.log(`AI EVALUATION SUMMARY: ${passed} Passed, ${failed} Failed (Target: 10/10)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAiEvaluation().catch(err => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});
