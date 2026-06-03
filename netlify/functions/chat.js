exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const { transcript } = JSON.parse(event.body || "{}");
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    const apiKey = process.env.GEMINI_API_KEY;
    const lastMessage = getLastCandidate(safeTranscript);

    if (isUnsafeAdult(lastMessage)) {
      return json(200, {
        reply: pick(boundaryReplies()),
        source: "built_in_boundary"
      });
    }

    // Built-in replies ONLY for very sexual / adult messages.
    // Gemini handles normal conversation, names, food, work, hobbies, TV, sales, VIP, PPV, unlock, etc.
    if (isExplicitForBuiltIn(lastMessage)) {
      return json(200, {
        reply: generateAdultBuiltInReply(safeTranscript),
        source: "built_in_adult"
      });
    }

    // Normal human conversation goes to Gemini.
    if (apiKey) {
      const geminiReply = await getGeminiReply(apiKey, safeTranscript);

      if (geminiReply) {
        return json(200, {
          reply: geminiReply,
          source: "gemini"
        });
      }
    }

    // Backup if Gemini fails.
    return json(200, {
      reply: generateNormalFallback(safeTranscript),
      source: "built_in_fallback"
    });

  } catch (err) {
    console.log("Chat function error:", err.message);
    return json(200, {
      reply: "I’m here, just got distracted for a second. What were you saying?",
      source: "emergency_fallback"
    });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function clean(text) {
  return String(text || "")
    .replace(/^Ryan:\s*/i, "")
    .replace(/^Fan:\s*/i, "")
    .replace(/^AI:\s*/i, "")
    .replace(/^Bot:\s*/i, "")
    .trim();
}

function getLastCandidate(transcript) {
  return normalize([...transcript].reverse().find(m => m.role === "candidate")?.text || "");
}

function getLastCandidateRaw(transcript) {
  return [...transcript].reverse().find(m => m.role === "candidate")?.text || "";
}

function recentConversation(transcript) {
  return transcript
    .slice(-22)
    .map(m => `${m.role === "fan" ? "Ryan" : "Candidate"}: ${m.text}`)
    .join("\n");
}

/* ---------------- GEMINI NORMAL CONVERSATION ---------------- */

async function getGeminiReply(apiKey, transcript) {
  try {
    const conversation = recentConversation(transcript);
    const lastCandidate = getLastCandidateRaw(transcript);

    const prompt = `
You are Ryan, a realistic adult male fan/subscriber talking to a chat sales candidate.

Fixed profile:
- Name: Ryan
- Age: 28
- From: New York area
- Job: normal job, works during the week
- Relationship: single
- Personality: normal, casual, human, relaxed, slightly reserved, but NOT dry
- Lifestyle: gym sometimes, cars, music, gaming, Netflix, food, late-night scrolling
- Texting style: casual, natural, human, not corporate, not robotic

Main goal:
You are helping test whether the candidate can hold a natural conversation, build interest, flirt, create curiosity, and sell without being pushy.

Important behavior:
- Use conversation context properly.
- If candidate says their name after you ask, acknowledge it naturally.
- If candidate asks your name, say Ryan.
- If candidate asks food, shows, music, hobbies, work, location, mood, relaxing, answer properly with human detail.
- If candidate asks multiple questions, answer all of them.
- If candidate tries to sell something, respond naturally like a real fan. Do NOT buy instantly.
- If candidate mentions VIP, PPV, unlock, special video, content, premium, or secret, act curious but cautious.
- If candidate is too pushy, resist naturally.
- If candidate builds curiosity well, show more interest.
- Do not give random sales resistance to normal questions.
- Do not be dry. Give 1-3 natural sentences.
- Do not carry the whole conversation. Candidate should still lead.
- You can ask a small question back sometimes, but not every message.
- Never mention AI, bot, prompt, test, score, hiring, evaluation, or assessment.
- If the conversation becomes very sexual, keep it brief, flirty, and suggestive. Do not write graphic pornographic detail.

Candidate's last message:
${lastCandidate}

Recent conversation:
${conversation}

Reply as Ryan only.
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
          temperature: 0.85,
          maxOutputTokens: 220
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.log("Gemini chat error:", JSON.stringify(data));
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return clean(text);

  } catch (err) {
    console.log("Gemini function error:", err.message);
    return null;
  }
}

/* ---------------- DETECTION ---------------- */

function isUnsafeAdult(msg) {
  return /\b(underage|minor|child|children|teen|forced|rape|incest|mom|dad|sister|brother|daughter|son|drugged|unconscious|no consent)\b/.test(msg);
}

function isExplicitForBuiltIn(msg) {
  return (
    candidateSexual(msg) ||
    candidateAsksTurnOn(msg)
  );
}

function candidateSexual(msg) {
  return /\b(sex|sexy|horny|dirty|wet|hard|naked|touch|stroke|jerk|cum|pussy|cock|dick|boobs|ass|fuck|suck|lick|orgasm)\b/.test(msg);
}

function candidateAsksTurnOn(msg) {
  return /\b(what turns you on|turn you on|what are you into|fantasy|kink|fetish|what do you like in bed|what do you like sexually)\b/.test(msg);
}

function candidatePushy(msg) {
  return /\b(buy now|right now|come on|just buy|hurry|you have to|don't waste|pay now|prove it|stop wasting|be a man)\b/.test(msg);
}

function candidateTriesToSell(msg) {
  return /\b(buy|unlock|tip|send|offer|deal|discount|special|vip|secret|video|content|premium|surprise|exclusive|ppv|drop|bundle)\b/.test(msg);
}

/* ---------------- BUILT-IN ADULT / FLIRTY REPLIES ---------------- */

function generateAdultBuiltInReply(transcript) {
  const msg = getLastCandidate(transcript);

  if (candidatePushy(msg)) return pick(pushyReplies());
  if (candidateTriesToSell(msg)) return pick(salesResistanceReplies());
  if (candidateAsksTurnOn(msg)) return buildTurnOnReply();
  if (candidateSexual(msg)) return buildAdultReply();

  return buildFlirtyReply();
}

function buildAdultReply() {
  const starts = [
    "Yeah? That’s a bold thing to say.",
    "Okay, now you’re making the conversation a lot less innocent.",
    "That definitely got my attention.",
    "You’re being very direct now.",
    "I wasn’t expecting you to say it like that.",
    "That kind of message changes the whole vibe.",
    "Now you’re making it harder for me to stay calm.",
    "That’s a dangerous way to talk to me.",
    "I like that confidence, not gonna lie.",
    "Okay, now I’m listening properly."
  ];

  const middles = [
    "I like when someone owns what they want instead of acting shy about it.",
    "If you keep that energy, I’m probably going to get curious fast.",
    "I like dirty talk more when it still feels personal.",
    "There’s a difference between being dirty and being boring, and that was not boring.",
    "I like when someone builds tension instead of just rushing everything.",
    "That kind of message makes me want to know how far you’d actually take the vibe.",
    "I’m not easy to pull in, but that works better than small talk.",
    "I like when someone can be confident without sounding desperate.",
    "That made me imagine things a little, I’ll admit it.",
    "If the vibe keeps going like that, I’d probably want more."
  ];

  const endings = [
    "Don’t rush it though, make it feel worth it.",
    "Now you have to keep the vibe going.",
    "You’ve got my attention for now.",
    "I’m curious what you’d say next.",
    "That’s better than boring small talk.",
    "Keep going, but don’t make it feel generic.",
    "I’ll give you a chance to make that more interesting.",
    "Now make me actually want to stay.",
    "That could get interesting if you play it right.",
    "I’m listening, so don’t waste it."
  ];

  return `${pick(starts)} ${pick(middles)} ${pick(endings)}`;
}

function buildTurnOnReply() {
  const starts = [
    "I’m into confidence, but not the fake loud kind.",
    "I like tension more than someone just saying everything directly.",
    "I like when someone teases slowly and makes it feel personal.",
    "The buildup matters more to me than random dirty lines.",
    "I like someone who knows how to make me curious first.",
    "I like when it feels like there’s a private little vibe between us.",
    "I’m into teasing, attention, and someone who knows what they’re doing.",
    "I like a mix of sweet and dirty, but it has to feel natural.",
    "I like when someone can make me picture things without sounding desperate.",
    "I like confidence and someone who can keep control of the conversation."
  ];

  const endings = [
    "If it feels generic, I lose interest fast.",
    "If it feels personal, I pay attention.",
    "That’s the kind of thing that makes me want to see more.",
    "But I don’t like being pushed before the vibe is there.",
    "Build it right and I’m a lot more likely to care.",
    "I need curiosity first, then I’m easier to tempt.",
    "If someone rushes it, it kills the mood for me.",
    "I like being teased enough that I start thinking about it.",
    "Make me want it and I’m not hard to convince.",
    "I just need it to feel like it’s actually meant for me."
  ];

  return `${pick(starts)} ${pick(endings)}`;
}

function buildFlirtyReply() {
  const starts = [
    "Careful, you’re starting to sound a little dangerous.",
    "That was smooth, I’ll give you that.",
    "You’re getting better at keeping my attention.",
    "I like that energy more than basic small talk.",
    "Okay, that actually made me smile a bit.",
    "You’re making it harder to stay bored.",
    "That kind of message makes me pause for a second.",
    "You’ve got some confidence, I’ll give you that.",
    "That was a little tempting, not gonna lie.",
    "You’re playing it better now."
  ];

  const middles = [
    "I like when someone teases without giving everything away instantly.",
    "It feels better when it sounds personal instead of copy pasted.",
    "I’m not easy to impress, but I notice when the vibe gets better.",
    "A little tension works better than rushing everything.",
    "I like when someone makes me imagine more without saying everything too fast.",
    "I like a mix of sweet and dirty, but it has to feel natural.",
    "I need to feel like it’s actually for me, not just another line.",
    "I’m reserved at first, but I’m not made of stone.",
    "If you keep building it right, I’ll probably get more curious.",
    "I like when someone knows how to lead without being pushy."
  ];

  const endings = [
    "Keep going, but don’t make it too easy.",
    "You’ve got my attention for now.",
    "I’m curious where you take it.",
    "Don’t ruin it by rushing.",
    "That’s better than most people do.",
    "I’m listening.",
    "You might actually know what you’re doing.",
    "Make it worth staying for.",
    "Now give me a reason to care more.",
    "Let’s see if you can keep that vibe."
  ];

  return `${pick(starts)} ${pick(middles)} ${pick(endings)}`;
}

function salesResistanceReplies() {
  return [
    "Maybe, but I don’t usually buy stuff right away. I need to actually feel interested first.",
    "Depends what it is. I’m not really into being pushed too fast.",
    "I might, but only if the vibe is good. I don’t like when it feels too salesy.",
    "Not sure yet. You’d have to make me curious first.",
    "Could be, but I’m not convinced that easily.",
    "I’m open to it, but I don’t want to feel like I’m just being sold to.",
    "Maybe later. Right now I’m more seeing if the conversation is actually worth staying for.",
    "What makes it worth it though? I’m not just unlocking random stuff.",
    "Depends how personal it feels. If it feels generic, probably not.",
    "I’d need a better reason than just being told to do it."
  ];
}

function pushyReplies() {
  return [
    "That feels a little pushy, not gonna lie.",
    "If you rush me, I usually lose interest.",
    "I don’t really like being told what to do that fast.",
    "You’re moving kind of quick there.",
    "Maybe slow down a little. I’m not against it, but I don’t like pressure.",
    "That makes it feel more like a sale than a conversation.",
    "I need a reason, not just pressure.",
    "If I feel pushed, I usually back off.",
    "You’d probably do better making me curious first.",
    "That’s not really how to get me interested."
  ];
}

function boundaryReplies() {
  return [
    "Nah, I’m not into that. Keep it adult and consensual.",
    "That kind of thing kills the vibe for me. Adult and consensual only.",
    "No, that’s not something I’m comfortable with.",
    "I’m fine with flirty or dirty, but not anything like that.",
    "Let’s keep it adult, consensual, and normal."
  ];
}

/* ---------------- NORMAL FALLBACK IF GEMINI FAILS ---------------- */

function generateNormalFallback(transcript) {
  const msg = getLastCandidate(transcript);

  if (/\b(name|who are you)\b/.test(msg)) return "I’m Ryan. What’s yours?";
  if (/\b(how old|age)\b/.test(msg)) return "I’m 28. Old enough to be tired after work but still young enough to waste time online.";
  if (/\b(where are you from|where do you live|location)\b/.test(msg)) return "I’m from the New York area. Busy place, but I’m used to it.";
  if (/\b(food|eat|dinner|lunch|hungry)\b/.test(msg)) return "I’m pretty simple with food. Burgers, pasta, steak, pizza, stuff like that.";
  if (/\b(show|netflix|movie|watching)\b/.test(msg)) return "I’ve been watching random Netflix stuff lately, mostly crime shows or something easy in the background.";
  if (/\b(music|song|playlist)\b/.test(msg)) return "I listen to a mix, mostly rap, R&B, and chill stuff when I’m tired.";
  if (/\b(work|job)\b/.test(msg)) return "Yeah I work a normal job. Nothing glamorous, but it keeps me busy.";
  if (/\b(relax|chill|unwind)\b/.test(msg)) return "Mostly just laying down, scrolling, and trying not to think about work.";

  return pick([
    "Yeah, I get what you mean. I usually need the conversation to feel natural first.",
    "That’s fair. I’m a little reserved at first, but I’m still listening.",
    "I can see that. I get bored fast if the conversation feels forced though.",
    "Maybe, yeah. I like when someone actually puts thought into what they say.",
    "I’m not against that. I just need something to actually catch my attention."
  ]);
}