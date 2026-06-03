exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const { transcript } = JSON.parse(event.body || "{}");
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    const apiKey = process.env.GEMINI_API_KEY;

    const fallbackReply = generateFallbackReply(safeTranscript);

    if (!apiKey) {
      return json(200, { reply: fallbackReply, source: "built_in" });
    }

    const recent = safeTranscript
      .slice(-20)
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    const lastCandidateMessage = [...safeTranscript]
      .reverse()
      .find(m => m.role === "candidate")?.text || "";

    const previousFanReplies = safeTranscript
      .filter(m => m.role === "fan")
      .slice(-10)
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

    const mood = pick(moods);

    const prompt = `
You are acting as a realistic online fan/subscriber in a hiring test for a chat sales candidate.

Your fixed fan profile:
- Name: Ryan
- Age: 28
- Personality: normal, casual, a bit reserved, slightly bored, but not stupid or useless
- Lifestyle: works a normal job, likes relaxing after work, gym sometimes, gaming sometimes, cars, music, Netflix, scrolling online, talking when the vibe is good
- Texting style: casual, human, natural, not corporate, not perfect grammar
- Mood right now: ${mood}

Rules:
- You are the fan, not the candidate.
- Have a REAL conversation.
- If the candidate asks 2 questions, answer BOTH questions.
- Do not give lazy one-word answers to normal questions.
- Give enough detail that it feels human.
- Stay a little reserved, but still be conversational.
- Do not carry the conversation too much.
- The candidate should still lead.
- You can sometimes ask a small question back, but not every message.
- Do not be overly excited or too friendly too fast.
- Do not repeat the same phrase, answer, or structure.
- Never mention AI, bot, prompt, test, score, evaluation, or hiring assessment.
- Avoid explicit sexual content. Keep it safe, suggestive at most.

Candidate's last message:
${lastCandidateMessage}

Recent conversation:
${recent}

Recent fan replies to avoid repeating:
${previousFanReplies}

Reply as the fan only.
Write 1-3 casual sentences.
Answer properly.
Be reserved, but human.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

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
      console.log("Gemini error, using built-in fan reply:", JSON.stringify(data));
      return json(200, { reply: fallbackReply, source: "built_in_after_error" });
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!reply) {
      return json(200, { reply: fallbackReply, source: "built_in_empty" });
    }

    reply = reply
      .replace(/^Fan:\s*/i, "")
      .replace(/^Ryan:\s*/i, "")
      .replace(/^AI:\s*/i, "")
      .replace(/^Bot:\s*/i, "")
      .trim();

    return json(200, { reply, source: "gemini" });

  } catch (err) {
    console.log("Chat function error, using fallback:", err.message);
    return json(200, {
      reply: "I mean, I’m just relaxing a bit right now. Been a pretty normal day, nothing too crazy.",
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
  return String(text || "").toLowerCase();
}

function countCandidateMessages(transcript) {
  return transcript.filter(m => m.role === "candidate").length;
}

function lastFanReplies(transcript) {
  return transcript.filter(m => m.role === "fan").slice(-8).map(m => m.text);
}

function avoidRepeating(reply, transcript) {
  const previous = lastFanReplies(transcript).map(x => normalize(x));
  const normalizedReply = normalize(reply);

  if (!previous.includes(normalizedReply)) return reply;

  return pick([
    "I guess I’m just having one of those slow days. Not bad, just kind of bored and scrolling.",
    "Nothing too special honestly. I’m just relaxing and seeing what’s going on here for a bit.",
    "Hard to explain, I’m pretty chill most of the time. I warm up more when the conversation feels natural.",
    "I’m not doing anything crazy right now, just killing time after a long day.",
    "Depends on the vibe honestly. I can talk, I just get bored fast when it feels forced."
  ]);
}

function generateFallbackReply(transcript) {
  const lastCandidate = [...transcript].reverse().find(m => m.role === "candidate")?.text || "";
  const msg = normalize(lastCandidate);
  const turn = countCandidateMessages(transcript);

  let reply = "";

  if (isGreeting(msg)) {
    reply = pick(greetingReplies(turn));
  } else if (asksAgeOrAbout(msg)) {
    reply = pick(aboutReplies());
  } else if (asksWhatDoing(msg)) {
    reply = pick(doingReplies());
  } else if (asksHobbies(msg)) {
    reply = pick(hobbyReplies());
  } else if (asksWork(msg)) {
    reply = pick(workReplies());
  } else if (asksLocation(msg)) {
    reply = pick(locationReplies());
  } else if (asksMood(msg)) {
    reply = pick(moodReplies());
  } else if (asksRelationship(msg)) {
    reply = pick(relationshipReplies());
  } else if (asksLikesOnlineChat(msg)) {
    reply = pick(onlineChatReplies());
  } else if (asksWhyHere(msg)) {
    reply = pick(whyHereReplies());
  } else if (candidateIsLowEffort(msg)) {
    reply = pick(lowEffortReplies());
  } else if (candidateCompliments(msg)) {
    reply = pick(complimentReplies());
  } else if (candidateTriesToSell(msg)) {
    reply = pick(salesResistanceReplies());
  } else if (candidateAsksOpenEnded(msg)) {
    reply = pick(openEndedReplies());
  } else {
    reply = pick(generalReplies());
  }

  return avoidRepeating(reply, transcript);
}

function isGreeting(msg) {
  return /\b(hi|hello|hey|yo|sup|good morning|good evening|how are you|how r u|hru)\b/.test(msg);
}

function asksAgeOrAbout(msg) {
  return /\b(age|old are you|tell me about you|about yourself|who are you|what are you like)\b/.test(msg);
}

function asksWhatDoing(msg) {
  return /\b(what are you doing|wyd|doing rn|doing right now|what you up to|up to|plans today|today)\b/.test(msg);
}

function asksHobbies(msg) {
  return /\b(like doing|hobbies|free time|fun|enjoy|interests|what do you like)\b/.test(msg);
}

function asksWork(msg) {
  return /\b(work|job|do for work|working|occupation)\b/.test(msg);
}

function asksLocation(msg) {
  return /\b(where are you from|where you from|location|live|city|country)\b/.test(msg);
}

function asksMood(msg) {
  return /\b(how are you|how do you feel|mood|you okay|how's your day|how is your day)\b/.test(msg);
}

function asksRelationship(msg) {
  return /\b(single|girlfriend|relationship|dating|wife|married)\b/.test(msg);
}

function asksLikesOnlineChat(msg) {
  return /\b(talk online|chat online|talking to girls|online girls|chatting here)\b/.test(msg);
}

function asksWhyHere(msg) {
  return /\b(why are you here|what brings you|why did you come|why on this page|what made you)\b/.test(msg);
}

function candidateIsLowEffort(msg) {
  return msg.length < 12 || /^(ok|okay|lol|haha|nice|cool|come on|why|yes|no|sure)\b/.test(msg);
}

function candidateCompliments(msg) {
  return /\b(cute|handsome|hot|sexy|good looking|nice|sweet|funny|interesting)\b/.test(msg);
}

function candidateTriesToSell(msg) {
  return /\b(buy|unlock|tip|send|offer|deal|discount|special|vip|secret|video|content|premium)\b/.test(msg);
}

function candidateAsksOpenEnded(msg) {
  return /\b(tell me|explain|describe|what kind|what type|how come|why)\b/.test(msg);
}

function greetingReplies(turn) {
  const early = [
    "hey, what’s up",
    "hey. I’m just chilling a bit right now",
    "yo, pretty quiet here. what’s up",
    "hey, just scrolling for a bit",
    "hi, how’s it going",
    "hey. long day but I’m around",
    "what’s up, I’m just killing some time",
    "hey, not doing much honestly",
    "hi, I’m just relaxing right now",
    "hey, kinda bored so I’m here for a bit"
  ];

  const later = [
    "yeah I’m still here, just a bit distracted",
    "I’m around, just scrolling between messages",
    "yeah, what’s up",
    "still here. just taking it easy",
    "yeah I’m listening"
  ];

  return turn <= 2 ? early : later;
}

function aboutReplies() {
  return [
    "I’m 28. Pretty normal guy honestly, work most days, gym sometimes, gaming or shows when I’m home.",
    "I’m 28, nothing too crazy about me. I work, relax after, scroll too much, and talk when the vibe is decent.",
    "I’m 28. I like cars, music, watching shows, and just chilling after work most nights.",
    "I’m 28, pretty laid back. I’m not super loud or anything, I just like easy conversations that don’t feel forced.",
    "I’m 28. Most of my life is work, gym here and there, Netflix, gaming sometimes, and wasting time online.",
    "I’m 28. I guess I’m chill, a little sarcastic sometimes, but not hard to talk to if the vibe is right."
  ];
}

function doingReplies() {
  return [
    "Not much honestly, just got home and I’m scrolling for a bit. Been kind of a slow day.",
    "Just relaxing right now. I was working earlier so I’m kind of tired.",
    "I’m just laying down and checking my phone. Nothing exciting going on.",
    "Just chilling after work. I was thinking of watching something but haven’t picked anything yet.",
    "Scrolling mostly. It’s one of those nights where I don’t really feel like doing much.",
    "I’m at home right now, half watching something and half on my phone."
  ];
}

function hobbyReplies() {
  return [
    "I like gym sometimes, gaming, music, cars, and just watching shows when I’m tired. Pretty basic stuff honestly.",
    "Mostly music, Netflix, gaming a bit, and going out for drives sometimes. I’m not super complicated.",
    "I like cars, good food, shows, and anything that helps me relax after work.",
    "Gaming sometimes, gym when I’m motivated, and scrolling way too much when I’m bored.",
    "I’m into music, cars, shows, and quiet nights. I don’t really party much anymore.",
    "Depends on the day. Sometimes gym, sometimes gaming, sometimes I just do nothing and enjoy it."
  ];
}

function workReplies() {
  return [
    "Yeah I work a normal job. It’s not that interesting, but it keeps me busy most of the day.",
    "I work during the week, pretty regular schedule. By the time I’m home I usually just want to relax.",
    "I’ve got a normal job, nothing glamorous. Some days are fine, some days are just annoying.",
    "Yeah I work. That’s why I’m kind of dry sometimes, I’m usually tired after.",
    "I work most days, so when I’m online I’m usually just trying to chill a bit.",
    "Normal work stuff honestly. Not something I’d make my whole personality."
  ];
}

function locationReplies() {
  return [
    "I’m from New York area. Not exactly in the middle of everything, but close enough.",
    "NY area. It’s busy, but I’m used to it.",
    "I’m around New York. I like it sometimes, but it gets tiring.",
    "New York area. Good food, too many people, same story.",
    "I’m from NY. I like the city energy sometimes, but not every day.",
    "Around New York. I’m more of a chill spot person than a crowded place person."
  ];
}

function moodReplies() {
  return [
    "I’m alright, just a bit tired. Nothing bad happened, just one of those slow days.",
    "Pretty okay. Not super energetic, but I’m here.",
    "I’m fine, just kind of bored honestly.",
    "Not bad. Work drained me a bit, so I’m just relaxing now.",
    "I’m okay. Could be better, could be worse.",
    "Chill mood mostly. A little tired but not in a bad way."
  ];
}

function relationshipReplies() {
  return [
    "I’m single. Not really rushing anything, I just like seeing how the vibe feels.",
    "Single right now. I’m kind of picky with who I give energy to.",
    "Yeah I’m single. Dating feels like work sometimes, not gonna lie.",
    "Single. I talk when it feels natural, but I don’t force things.",
    "I’m not in a relationship. I’ve been keeping things pretty simple lately.",
    "Single, yeah. I’m not against dating, I’m just not chasing it every day."
  ];
}

function onlineChatReplies() {
  return [
    "Depends on the vibe. If it feels natural then yeah, but I get bored pretty fast when it feels forced.",
    "Sometimes. I don’t mind talking online if the person actually has personality.",
    "Yeah, if it’s fun. If it feels like copy paste, I usually lose interest.",
    "I can like it, but only when it doesn’t feel like someone is trying too hard.",
    "Depends who I’m talking to. Some people make it easy, some make it feel like work.",
    "I like it when there’s a little teasing and actual conversation, not just random lines."
  ];
}

function whyHereReplies() {
  return [
    "Honestly just bored and scrolling. I clicked around and ended up here.",
    "I was just looking around. Didn’t really have a big plan.",
    "Curiosity mostly. Sometimes I just check things out when I’m bored.",
    "I guess I wanted something a bit more interesting than my usual scrolling.",
    "Not sure, just ended up here. I do that a lot when I’m bored at night.",
    "I was bored and wanted to see what the vibe was like."
  ];
}

function lowEffortReplies() {
  return [
    "You’re not giving me much to work with there.",
    "That’s a pretty lazy answer, not gonna lie.",
    "Maybe, but you’ll have to make it a little more interesting than that.",
    "I mean yeah, but what am I supposed to say to that?",
    "You’re making me do all the work now.",
    "Could be. Depends where you’re going with it."
  ];
}

function complimentReplies() {
  return [
    "Haha thanks. I’m not always good at taking compliments, but I’ll take that one.",
    "Appreciate that. You say that to everyone or just when you’re trying to be nice?",
    "That’s sweet. I’m not sure I believe you fully yet though.",
    "Thanks, that was smooth enough I guess.",
    "I’ll give you points for that one.",
    "Haha alright, that made me smile a little."
  ];
}

function salesResistanceReplies() {
  return [
    "Maybe, but I don’t usually buy stuff right away. I need to actually feel interested first.",
    "Depends what it is. I’m not really into being pushed too fast.",
    "I might, but only if the vibe is good. I don’t like when it feels too salesy.",
    "Not sure yet. You’d have to make me curious first.",
    "Could be, but I’m not convinced that easily.",
    "I’m open to it, but I don’t want to feel like I’m just being sold to."
  ];
}

function openEndedReplies() {
  return [
    "I mean, I’m pretty simple. I work, relax, scroll too much, and talk if the vibe is good.",
    "Hard to explain. I’m chill most of the time, but I get bored fast if the conversation feels fake.",
    "I’m not that complicated. I like calm nights, good music, shows, and people who can actually hold a conversation.",
    "Depends what you want to know. I’m not super open right away, but I’m not impossible to talk to.",
    "I guess I’m the type who warms up slowly. If someone pushes too hard, I usually back off.",
    "I like conversations that feel natural. Not too forced, not too fake, just normal."
  ];
}

function generalReplies() {
  const starts = [
    "Yeah, I get what you mean.",
    "I mean, maybe.",
    "That’s fair.",
    "Honestly, depends.",
    "I can see that.",
    "Maybe, yeah.",
    "I’m not against that.",
    "That could be interesting.",
    "I guess so.",
    "Yeah, kind of."
  ];

  const middles = [
    "I’m just not someone who gets excited instantly.",
    "I usually need the conversation to feel natural first.",
    "I’m a little reserved when I first talk to someone.",
    "I get bored pretty fast if it feels forced.",
    "I like when someone actually puts thought into what they say.",
    "I’m more relaxed when the vibe isn’t too pushy.",
    "I don’t mind talking, I just don’t like fake energy.",
    "I pay attention more than I probably show.",
    "I’m not super easy to impress, but I’m not impossible.",
    "I like simple, real conversations more than random lines."
  ];

  const endings = [
    "So I guess we’ll see.",
    "That’s just how I am.",
    "Makes sense?",
    "I don’t know, maybe I’m weird like that.",
    "Depends what you do with that.",
    "I’m still listening though.",
    "You can work with that if you’re good.",
    "I’m curious where you’re going with it.",
    "That’s the honest answer.",
    "I’m not trying to make it too easy."
  ];

  return [`${pick(starts)} ${pick(middles)} ${pick(endings)}`];
}