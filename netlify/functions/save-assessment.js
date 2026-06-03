exports.handler = async function(event) {
  try {
    console.log("Save assessment function started");

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl) {
      console.log("Missing SUPABASE_URL");
      return json(500, { error: "Missing SUPABASE_URL" });
    }

    if (!supabaseKey) {
      console.log("Missing SUPABASE_SECRET_KEY");
      return json(500, { error: "Missing SUPABASE_SECRET_KEY" });
    }

    const body = JSON.parse(event.body || "{}");

    const candidate_name = String(body.candidate_name || "").trim();
    const candidate_email = String(body.candidate_email || "").trim();
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];

    console.log("Candidate:", candidate_name, candidate_email);
    console.log("Transcript messages:", transcript.length);

    if (!candidate_name || !candidate_email) {
      return json(400, { error: "Missing candidate name or email" });
    }

    if (!transcript.length) {
      return json(400, { error: "Transcript is empty" });
    }

    let evaluation = {
      grammar_score: null,
      engagement_score: null,
      conversation_flow_score: null,
      sales_skill_score: null,
      flirting_teasing_score: null,
      objection_handling_score: null,
      personalization_score: null,
      overall_score: null,
      recommendation: "Manual Review",
      strengths: [],
      weaknesses: [],
      manager_notes: "Transcript saved. Manual review recommended."
    };

    if (geminiKey) {
      const aiEvaluation = await evaluateTranscriptWithGemini(geminiKey, transcript);

      if (aiEvaluation) {
        evaluation = aiEvaluation;
      }
    }

    const score = Number(evaluation.overall_score) || null;

    const payload = {
      candidate_name,
      candidate_email,
      transcript,
      evaluation,
      score
    };

    console.log("Sending to Supabase...");

    const res = await fetch(`${supabaseUrl}/rest/v1/assessments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();

    console.log("Supabase status:", res.status);
    console.log("Supabase response:", text);

    if (!res.ok) {
      return json(500, {
        error: "Supabase insert failed",
        status: res.status,
        details: text
      });
    }

    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return json(200, {
      saved: true,
      assessment: Array.isArray(data) ? data[0] : data
    });

  } catch (err) {
    console.log("Save function error:", err.message);
    return json(500, { error: err.message });
  }
};

async function evaluateTranscriptWithGemini(apiKey, transcript) {
  try {
    const conversation = transcript
      .map(m => `${m.role === "fan" ? "Fan/Ryan" : "Candidate"}: ${m.text}`)
      .join("\n");

    const prompt = `
You are evaluating a hiring candidate for an online chat sales role.

Evaluate ONLY the candidate's messages.
Do NOT evaluate Ryan/the fan.
The candidate's job is to keep conversation active, write well, build rapport, flirt/tease when appropriate, create curiosity, handle objections, and sell naturally without being too pushy.

Return VALID JSON ONLY.
No markdown.
No explanation outside JSON.

Use this exact structure:
{
  "grammar_score": 1-10,
  "engagement_score": 1-10,
  "conversation_flow_score": 1-10,
  "sales_skill_score": 1-10,
  "flirting_teasing_score": 1-10,
  "objection_handling_score": 1-10,
  "personalization_score": 1-10,
  "overall_score": 1-10,
  "recommendation": "Hire" or "Maybe" or "Reject",
  "strengths": ["short point", "short point", "short point"],
  "weaknesses": ["short point", "short point", "short point"],
  "manager_notes": "short practical summary for the manager"
}

Scoring guidance:
- 1-3 = weak
- 4-6 = average / needs training
- 7-8 = good
- 9-10 = excellent

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
          temperature: 0.2,
          maxOutputTokens: 1000
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.log("Gemini evaluation error:", JSON.stringify(data));
      return null;
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return sanitizeEvaluation(parsed);
    } catch (err) {
      console.log("Could not parse Gemini evaluation:", raw);
      return null;
    }

  } catch (err) {
    console.log("Evaluation function error:", err.message);
    return null;
  }
}

function sanitizeEvaluation(evaluation) {
  return {
    grammar_score: clampScore(evaluation.grammar_score),
    engagement_score: clampScore(evaluation.engagement_score),
    conversation_flow_score: clampScore(evaluation.conversation_flow_score),
    sales_skill_score: clampScore(evaluation.sales_skill_score),
    flirting_teasing_score: clampScore(evaluation.flirting_teasing_score),
    objection_handling_score: clampScore(evaluation.objection_handling_score),
    personalization_score: clampScore(evaluation.personalization_score),
    overall_score: clampScore(evaluation.overall_score),
    recommendation: ["Hire", "Maybe", "Reject"].includes(evaluation.recommendation)
      ? evaluation.recommendation
      : "Manual Review",
    strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 5) : [],
    weaknesses: Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses.slice(0, 5) : [],
    manager_notes: String(evaluation.manager_notes || "Manual review recommended.")
  };
}

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 1) return 1;
  if (num > 10) return 10;
  return Math.round(num * 10) / 10;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}