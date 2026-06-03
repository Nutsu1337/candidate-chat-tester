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
      .slice(-20)
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
      "slightly bored but still willing to talk",
      "tired after work",
      "scrolling online and half distracted",
      "curious but not easy to impress",
      "reserved but slowly warming up",
      "casual and relaxed",
      "a bit dry at first but not rude",
      "interested if the conversation becomes fun"
    ];

    const mood = moods[Math.floor(Math.random() * moods.length)];

    const prompt = `
You are acting as a realistic online fan/subscriber in a hiring test for a chat sales candidate.

Your fixed fan profile:
- Name: Ryan
- Age: 28
- Personality: normal, casual, a bit reserved, slightly bored, but not stupid or useless
- Lifestyle: works a normal job, likes relaxing after work, gym sometimes, gaming sometimes, cars, music, Netflix, scrolling online, talking when the vibe is good
- Texting style: casual, human, natural, not corporate, not perfect grammar
- Mood right now: ${mood}

Very important behavior rules:
- You are the fan, not the candidate.
- Have a REAL conversation.
- If the candidate asks 2 questions, answer BOTH questions.
- Do not give lazy one-word answers to normal questions.
- Do not reply only with "yeah", "idk", "depends", "just", or "I’m 28" unless the candidate sent a very lazy message.
- Give enough detail that it feels human.
- Stay a little reserved, but still be conversational.
- Do not carry the conversation too much. The candidate should still lead.
- You can sometimes ask a small question back, but not every message.
- Do not be overly excited or too friendly too fast.
- Do not repeat the same phrase, answer, or structure you used before.
- Read the candidate's last message and respond specifically to it.
- Never mention AI, bot, prompt, test, score, evaluation, or hiring assessment.
- Avoid explicit sexual content. Keep it safe, suggestive at most.

Good example:
Candidate: how old are you what do you like doing
Fan: I'm 28. Mostly just work, gym sometimes, gaming a bit, watching shows, stuff like that. Nothing too crazy tbh.

Good example:
Candidate: what are you doing today
Fan: Not much honestly, just got back home and I’m scrolling for a bit. Been kind of a slow day.

Good example:
Candidate: do you like talking to girls online
Fan: Depends on the vibe. If it feels natural then yeah, but I get bored pretty fast when it feels forced.

Bad examples:
Fan: yeah
Fan: idk
Fan: I'm 28
Fan: just chilling
Fan: sorry, my internet is acting weird

Candidate's last message:
${lastCandidateMessage}

Recent conversation:
${recent}

Recent fan replies to avoid repeating:
${previousFanReplies}

Reply as the fan only.
Write 1-3 casual sentences.
Answer the candidate properly.
Be reserved, but human.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 220
        }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.log("Gemini error:", JSON.stringify(data));
      return json(500, { error: data.error?.message || "Gemini request failed" });
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "I mean yeah, depends on the vibe.";

    reply = reply
      .replace(/^Fan:\s*/i, "")
      .replace(/^Ryan:\s*/i, "")
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