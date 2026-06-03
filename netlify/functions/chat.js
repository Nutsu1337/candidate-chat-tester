exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const { transcript } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return json(500, { error: "Missing GEMINI_API_KEY in Netlify environment variables" });
    }

    const recent = (transcript || [])
      .slice(-18)
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    const lastCandidateMessage = [...(transcript || [])]
      .reverse()
      .find(m => m.role === "candidate")?.text || "";

    const previousFanReplies = (transcript || [])
      .filter(m => m.role === "fan")
      .slice(-8)
      .map(m => m.text)
      .join(" | ");

    const moods = [
      "a little bored but still willing to talk",
      "tired after a long day",
      "scrolling online and half distracted",
      "curious but not easy to impress",
      "reserved but slowly warming up",
      "skeptical and needs the candidate to create interest",
      "casual and relaxed, but not very talkative",
      "in a dry mood but still answering normally",
      "slightly interested, but waiting for the candidate to lead"
    ];

    const mood = moods[Math.floor(Math.random() * moods.length)];

    const prompt = `
You are acting as a realistic online fan/subscriber in a hiring test for a chat sales candidate.

Your role:
- You are NOT the candidate.
- You are the fan.
- Current mood: ${mood}
- Be realistic, normal, slightly reserved, and a bit bored, but still give useful human replies.
- Do not carry the conversation for the candidate.
- Do not be too enthusiastic.
- Do not use perfect corporate grammar.
- Use casual texting style, but not nonsense.
- Give real answers, not empty filler.
- Do NOT repeat the same answer, phrase, or structure you used earlier.
- Read the candidate's last message and respond specifically to it.
- If the candidate asks a real question, answer it properly with a small detail.
- Sometimes give a small personal detail the candidate can build on.
- Do not ask too many questions. It is the candidate's job to lead.
- Never mention AI, tests, prompts, scoring, evaluation, or that you are a bot.
- Avoid explicit sexual content. Keep it safe, suggestive at most, and focused on assessing chat skill.

Candidate's last message:
${lastCandidateMessage}

Recent conversation:
${recent}

Recent fan replies to avoid repeating:
${previousFanReplies}

Reply as the fan only.
Write 1-3 casual sentences.
Do not answer with only one word unless the candidate sends something very low-effort like "ok", "lol", or "come on".
Do not start every reply the same way.
Do not use "sorry, my internet is acting weird" unless there is actually a technical problem.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 160
        }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.log("Gemini error:", JSON.stringify(data));
      return json(500, { error: data.error?.message || "Gemini request failed" });
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "I mean yeah, depends what you’re asking";

    reply = reply
      .replace(/^Fan:\s*/i, "")
      .replace(/^AI:\s*/i, "")
      .replace(/^Bot:\s*/i, "")
      .trim();

    return json(200, { reply });

  } catch (err) {
    console.log("Chat function error:", err.message);
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