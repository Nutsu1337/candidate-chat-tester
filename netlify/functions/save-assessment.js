exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return json(500, { error: "Missing Supabase environment variables" });
    }

    const body = JSON.parse(event.body || "{}");

    const candidate_name = String(body.candidate_name || "").trim();
    const candidate_email = String(body.candidate_email || "").trim();
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];

    if (!candidate_name || !candidate_email || transcript.length === 0) {
      return json(400, { error: "Missing candidate name, email, or transcript" });
    }

    let evaluation = null;

    // 1. Main evaluation: Gemini
    if (geminiKey) {
      evaluation = await evaluateTranscriptWithGemini(geminiKey, transcript);
    }

    // 2. Backup evaluation: only if Gemini fails
    if (!evaluation || !evaluation.overall_score) {
      evaluation = generateAutomaticBackupReview(transcript);
    }

    const score = Number(evaluation.overall_score || 0) || null;

    const payload = {
      candidate_name,
      candidate_email,
      transcript,
      evaluation,
      score
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/assessments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      console.log("Supabase insert error:", JSON.stringify(data));
      return json(500, { error: data.message || "Supabase insert failed" });
    }

    return json(200, {
      saved: true,
      assessment: data[0]
    });

  } catch (err) {
    console.log("Save assessment error:", err.message);
    return json(500, { error: err.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

/* ---------------- GEMINI REVIEW - MAIN EVALUATION ---------------- */

async function evaluateTranscriptWithGemini(apiKey, transcript) {
  try {
    const conversation = transcript
      .map(m => `${m.role === "fan" ? "Fan" : "Candidate"}: ${m.text}`)
      .join("\n");

    const prompt = `
You are evaluating a hiring candidate for a chat sales role.

Evaluate ONLY the Candidate messages.
Do NOT evaluate the Fan messages.

The candidate is being tested on:
- English grammar
- Natural conversation
- Engagement
- Creativity
- Ability to lead the chat
- Flirting and teasing
- Ability to build curiosity
- Sales skill
- Objection handling
- Personalization
- Not sounding robotic
- Not being too pushy

Important:
Return ONLY valid JSON.
Do not use markdown.
Do not use code blocks.
Do not write explanations outside the JSON.

Use this exact JSON structure:

{
  "grammar_score": 1,
  "engagement_score": 1,
  "conversation_flow_score": 1,
  "sales_skill_score": 1,
  "flirting_teasing_score": 1,
  "objection_handling_score": 1,
  "personalization_score": 1,
  "overall_score": 1,
  "recommendation": "Hire",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "manager_notes": "short practical summary for the manager",
  "evaluation_source": "Gemini AI Review"
}

Scoring rules:
- 1-3 = weak
- 4-6 = average
- 7-8 = good
- 9-10 = excellent

Recommendation rules:
- Hire = strong candidate, good English, good flow, can sell naturally
- Maybe = has potential but needs training
- Reject = weak English, bad flow, robotic, or poor sales ability

Be strict but fair.
If the candidate has bad grammar, awkward English, or robotic conversation, lower the score.
If the candidate leads the conversation well, asks good questions, flirts naturally, creates curiosity, and sells smoothly, give a higher score.

Conversation:
${conversation}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 1200
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.log("Gemini evaluation error:", JSON.stringify(data));
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const parsed = parseJsonFromText(text);

    if (!parsed) {
      console.log("Could not parse Gemini evaluation:", text);
      return null;
    }

    return normalizeEvaluation(parsed, "Gemini AI Review");

  } catch (err) {
    console.log("Gemini evaluation function error:", err.message);
    return null;
  }
}

function parseJsonFromText(text) {
  try {
    const cleaned = String(text || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      return null;
    }

    const jsonText = cleaned.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonText);

  } catch (err) {
    return null;
  }
}

function normalizeEvaluation(evaluation, source) {
  return {
    grammar_score: clampScore(evaluation.grammar_score),
    engagement_score: clampScore(evaluation.engagement_score),
    conversation_flow_score: clampScore(evaluation.conversation_flow_score),
    sales_skill_score: clampScore(evaluation.sales_skill_score),
    flirting_teasing_score: clampScore(evaluation.flirting_teasing_score),
    objection_handling_score: clampScore(evaluation.objection_handling_score),
    personalization_score: clampScore(evaluation.personalization_score),
    overall_score: clampScore(evaluation.overall_score),
    recommendation: normalizeRecommendation(evaluation.recommendation),
    strengths: normalizeArray(evaluation.strengths),
    weaknesses: normalizeArray(evaluation.weaknesses),
    manager_notes: String(evaluation.manager_notes || "No manager notes provided.").trim(),
    evaluation_source: source
  };
}

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.min(10, Math.round(num)));
}

function normalizeRecommendation(value) {
  const text = String(value || "").toLowerCase();

  if (text.includes("hire")) return "Hire";
  if (text.includes("maybe")) return "Maybe";
  if (text.includes("reject")) return "Reject";

  return "Maybe";
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v)).filter(Boolean).slice(0, 5);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

/* ---------------- AUTOMATIC BACKUP REVIEW - ONLY IF GEMINI FAILS ---------------- */

function generateAutomaticBackupReview(transcript) {
  const candidateMessages = transcript
    .filter(m => m.role === "candidate")
    .map(m => String(m.text || ""));

  const text = candidateMessages.join(" ").toLowerCase();

  const messageCount = candidateMessages.length;
  const totalWords = text.split(/\s+/).filter(Boolean).length;
  const avgWords = messageCount ? totalWords / messageCount : 0;

  const questionCount = (text.match(/\?/g) || []).length;

  const salesWords = countMatches(text, [
    "buy", "unlock", "vip", "secret", "special", "video", "content",
    "premium", "offer", "deal", "tip", "send", "ppv", "exclusive",
    "private", "surprise", "limited"
  ]);

  const flirtyWords = countMatches(text, [
    "baby", "babe", "cute", "sexy", "kiss", "tease", "miss",
    "want", "touch", "naughty", "dirty", "wet", "hot"
  ]);

  const personalizationWords = countMatches(text, [
    "you", "your", "about you", "what do you", "tell me", "how about",
    "what are you", "do you like"
  ]);

  const pushyWords = countMatches(text, [
    "buy now", "right now", "pay now", "hurry", "prove it",
    "stop wasting", "you have to"
  ]);

  let grammar_score = 6;
  let engagement_score = 5;
  let conversation_flow_score = 5;
  let sales_skill_score = 4;
  let flirting_teasing_score = 4;
  let objection_handling_score = 4;
  let personalization_score = 5;

  if (avgWords >= 8) engagement_score += 1;
  if (avgWords >= 14) conversation_flow_score += 1;

  if (questionCount >= 5) engagement_score += 1;
  if (questionCount >= 10) personalization_score += 1;

  if (salesWords >= 3) sales_skill_score += 2;
  if (salesWords >= 7) sales_skill_score += 1;

  if (flirtyWords >= 4) flirting_teasing_score += 2;
  if (flirtyWords >= 10) flirting_teasing_score += 1;

  if (personalizationWords >= 15) personalization_score += 2;

  if (pushyWords >= 2) {
    sales_skill_score -= 2;
    conversation_flow_score -= 1;
  }

  if (messageCount >= 50) {
    engagement_score += 1;
    conversation_flow_score += 1;
  }

  grammar_score = clampScore(grammar_score);
  engagement_score = clampScore(engagement_score);
  conversation_flow_score = clampScore(conversation_flow_score);
  sales_skill_score = clampScore(sales_skill_score);
  flirting_teasing_score = clampScore(flirting_teasing_score);
  objection_handling_score = clampScore(objection_handling_score);
  personalization_score = clampScore(personalization_score);

  const overall_score = clampScore(
    (
      grammar_score +
      engagement_score +
      conversation_flow_score +
      sales_skill_score +
      flirting_teasing_score +
      objection_handling_score +
      personalization_score
    ) / 7
  );

  let recommendation = "Maybe";
  if (overall_score >= 8) recommendation = "Hire";
  if (overall_score <= 4) recommendation = "Reject";

  return {
    grammar_score,
    engagement_score,
    conversation_flow_score,
    sales_skill_score,
    flirting_teasing_score,
    objection_handling_score,
    personalization_score,
    overall_score,
    recommendation,
    strengths: [
      "Candidate completed the chat assessment.",
      "Candidate maintained activity throughout the conversation."
    ],
    weaknesses: [
      "Gemini AI review was not available for this assessment.",
      "This is an automatic backup review, so the manager should manually verify the transcript."
    ],
    manager_notes: "Automatic backup review was used because Gemini AI review failed or did not return valid JSON. Manager should manually check the transcript before making a final hiring decision.",
    evaluation_source: "Automatic Backup Review"
  };
}

function countMatches(text, words) {
  let count = 0;

  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    count += (text.match(regex) || []).length;
  }

  return count;
}