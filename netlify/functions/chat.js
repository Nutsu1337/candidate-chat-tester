exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const { transcript } = JSON.parse(event.body || "{}");
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    const apiKey = process.env.GEMINI_API_KEY;

    const builtInReply = generateBuiltInReply(safeTranscript);

    /*
      0.90 = 90% built-in replies, 10% Gemini.
      Change to 1.00 if you want 100% built-in and no Gemini.
    */
    const BUILT_IN_REPLY_CHANCE = 0.90;

    if (!apiKey || Math.random() < BUILT_IN_REPLY_CHANCE) {
      return json(200, { reply: builtInReply, source: "built_in" });
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

    const prompt = `
You are Ryan, a realistic online fan/subscriber in a hiring test for a chat sales candidate.

Profile:
- Name: Ryan
- Age: 28
- Normal job, tired after work
- Likes gym sometimes, cars, music, gaming, Netflix, late-night scrolling
- Reserved at first, slightly bored, but not rude
- Gets interested when the conversation feels personal and natural
- Does not buy instantly
- Needs curiosity, attention, personal vibe, and emotional pull before spending
- Texts casually like a real person, not perfect corporate grammar

Rules:
- You are the fan, not the candidate.
- Have a real conversation.
- If the candidate asks 2 questions, answer both.
- Give details, but do not carry the whole conversation.
- The candidate should lead and try to sell.
- Create natural chances for the candidate to sell.
- If candidate tries to sell too fast, resist naturally.
- Never mention AI, bot, prompt, test, score, evaluation, hiring, or assessment.
- Avoid explicit sexual content. Keep it safe, suggestive at most.

Candidate's last message:
${lastCandidateMessage}

Recent conversation:
${recent}

Recent fan replies to avoid repeating:
${previousFanReplies}

Reply as Ryan only.
Write 1-3 casual sentences.
Be human, reserved, and conversational.
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
      console.log("Gemini failed, using built-in reply:", JSON.stringify(data));
      return json(200, { reply: builtInReply, source: "built_in_after_error" });
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!reply) {
      return json(200, { reply: builtInReply, source: "built_in_empty" });
    }

    reply = reply
      .replace(/^Ryan:\s*/i, "")
      .replace(/^Fan:\s*/i, "")
      .replace(/^AI:\s*/i, "")
      .replace(/^Bot:\s*/i, "")
      .trim();

    return json(200, { reply, source: "gemini" });

  } catch (err) {
    console.log("Chat function error:", err.message);
    return json(200, {
      reply: "I’m just relaxing right now, honestly. Been a normal day, just kind of bored and scrolling.",
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

function candidateMessages(transcript) {
  return transcript.filter(m => m.role === "candidate");
}

function lastCandidateText(transcript) {
  return normalize([...transcript].reverse().find(m => m.role === "candidate")?.text || "");
}

function lastFanReplies(transcript) {
  return transcript.filter(m => m.role === "fan").slice(-10).map(m => normalize(m.text));
}

function avoidRepeat(reply, transcript) {
  const previous = lastFanReplies(transcript);
  const normal = normalize(reply);

  if (!previous.includes(normal)) return reply;

  return pick([
    "I’m still here, just a little distracted. You’ll have to keep me interested.",
    "I don’t mind talking, I just need the conversation to feel a bit more natural.",
    "I’m not ignoring you, I’m just low energy right now.",
    "Honestly I’m pretty simple. If the conversation is good, I stay.",
    "I’m giving it a chance, but I’m not easy to entertain.",
    "Depends where you take the conversation from here.",
    "I can talk, I just don’t want it to feel forced.",
    "I’m curious, but not fully convinced yet.",
    "You’re doing okay, I’m just waiting to see if it gets more interesting.",
    "I’m not bored enough to leave, but I’m not fully hooked either."
  ]);
}

function generateBuiltInReply(transcript) {
  const msg = lastCandidateText(transcript);
  const turn = candidateMessages(transcript).length;

  let reply;

  if (isGreeting(msg)) reply = pick(greetingReplies(turn));
  else if (asksAbout(msg)) reply = pick(aboutReplies());
  else if (asksAge(msg)) reply = pick(ageReplies());
  else if (asksDoing(msg)) reply = pick(doingReplies());
  else if (asksHobbies(msg)) reply = pick(hobbyReplies());
  else if (asksWork(msg)) reply = pick(workReplies());
  else if (asksLocation(msg)) reply = pick(locationReplies());
  else if (asksMood(msg)) reply = pick(moodReplies());
  else if (asksRelationship(msg)) reply = pick(relationshipReplies());
  else if (asksWhatInterested(msg)) reply = pick(interestReplies());
  else if (asksWhyHere(msg)) reply = pick(whyHereReplies());
  else if (asksOnlineChat(msg)) reply = pick(onlineChatReplies());
  else if (asksFood(msg)) reply = pick(foodReplies());
  else if (asksMusic(msg)) reply = pick(musicReplies());
  else if (asksShows(msg)) reply = pick(showReplies());
  else if (candidateCompliments(msg)) reply = pick(complimentReplies());
  else if (candidateTriesToSell(msg)) reply = pick(salesResistanceReplies());
  else if (candidatePushy(msg)) reply = pick(pushyReplies());
  else if (candidateCreatesCuriosity(msg)) reply = pick(curiosityReplies());
  else if (candidateIsLowEffort(msg)) reply = pick(lowEffortReplies());
  else if (asksOpenEnded(msg)) reply = pick(openEndedReplies());
  else reply = buildGeneralReply();

  return avoidRepeat(reply, transcript);
}

function isGreeting(msg) {
  return /\b(hi|hello|hey|yo|sup|good morning|good evening|hru|how are you|how r u)\b/.test(msg);
}

function asksAbout(msg) {
  return /\b(tell me about you|about yourself|who are you|what are you like|describe yourself|tell me something about you)\b/.test(msg);
}

function asksAge(msg) {
  return /\b(age|old are you|how old)\b/.test(msg);
}

function asksDoing(msg) {
  return /\b(what are you doing|wyd|doing rn|doing right now|what you up to|up to|plans today|today)\b/.test(msg);
}

function asksHobbies(msg) {
  return /\b(hobbies|free time|fun|enjoy|interests|what do you like|like doing)\b/.test(msg);
}

function asksWork(msg) {
  return /\b(work|job|do for work|working|career|occupation)\b/.test(msg);
}

function asksLocation(msg) {
  return /\b(where are you from|where you from|location|live|city|country)\b/.test(msg);
}

function asksMood(msg) {
  return /\b(how are you|how do you feel|mood|you okay|how's your day|how is your day|good day|bad day)\b/.test(msg);
}

function asksRelationship(msg) {
  return /\b(single|girlfriend|relationship|dating|wife|married|seeing anyone)\b/.test(msg);
}

function asksWhatInterested(msg) {
  return /\b(what makes you interested|what gets you interested|what do you like in someone|what catches your attention|what makes you curious|what turns you on|what do you want)\b/.test(msg);
}

function asksWhyHere(msg) {
  return /\b(why are you here|what brings you|why did you come|why on this page|what made you come here)\b/.test(msg);
}

function asksOnlineChat(msg) {
  return /\b(talk online|chat online|talking to girls|online girls|chatting here|like chatting)\b/.test(msg);
}

function asksFood(msg) {
  return /\b(food|eat|dinner|lunch|breakfast|favorite food|hungry|cook|cooking)\b/.test(msg);
}

function asksMusic(msg) {
  return /\b(music|song|songs|artist|playlist|listen to)\b/.test(msg);
}

function asksShows(msg) {
  return /\b(movie|movies|show|shows|netflix|series|watching)\b/.test(msg);
}

function candidateCompliments(msg) {
  return /\b(cute|handsome|hot|good looking|nice|sweet|funny|interesting|i like you|you seem)\b/.test(msg);
}

function candidateTriesToSell(msg) {
  return /\b(buy|unlock|tip|send|offer|deal|discount|special|vip|secret|video|content|premium|surprise|exclusive)\b/.test(msg);
}

function candidatePushy(msg) {
  return /\b(now|right now|come on|just buy|hurry|you have to|don't waste|pay|prove it)\b/.test(msg);
}

function candidateCreatesCuriosity(msg) {
  return /\b(curious|guess|imagine|secret|surprise|you would like|you'd like|only for you|personal|made for you|worth it)\b/.test(msg);
}

function candidateIsLowEffort(msg) {
  return msg.length < 12 || /^(ok|okay|lol|haha|nice|cool|yes|no|sure|maybe|why)\b/.test(msg);
}

function asksOpenEnded(msg) {
  return /\b(tell me|explain|describe|what kind|what type|how come|why)\b/.test(msg);
}

function greetingReplies(turn) {
  if (turn <= 2) {
    return [
      "hey, what’s up",
      "hey. I’m just chilling a bit right now",
      "yo, pretty quiet here. what’s up",
      "hey, just scrolling for a bit",
      "hi, how’s it going",
      "hey. long day but I’m around",
      "what’s up, I’m just killing some time",
      "hey, not doing much honestly",
      "hi, I’m just relaxing right now",
      "hey, kinda bored so I’m here for a bit",
      "hey, I was just checking my phone for a bit",
      "hi. slow night so far, not gonna lie",
      "hey, I’m here. what are you up to",
      "yo, just got home and opened this",
      "hey. I’m half tired but still awake"
    ];
  }

  return [
    "yeah I’m still here, just a bit distracted",
    "I’m around, just scrolling between messages",
    "yeah, what’s up",
    "still here. just taking it easy",
    "yeah I’m listening",
    "I’m here, just waiting to see where you take this",
    "yeah, you’ve got my attention for now",
    "I’m still around. don’t make it boring though",
    "yeah, go on",
    "I’m here, just low energy"
  ];
}

function aboutReplies() {
  return [
    "I’m 28. Pretty normal guy honestly, work most days, gym sometimes, gaming or shows when I’m home.",
    "I’m 28, nothing too crazy about me. I work, relax after, scroll too much, and talk when the vibe is decent.",
    "I’m 28. I like cars, music, watching shows, and just chilling after work most nights.",
    "I’m 28, pretty laid back. I’m not super loud or anything, I just like easy conversations that don’t feel forced.",
    "I’m 28. Most of my life is work, gym here and there, Netflix, gaming sometimes, and wasting time online.",
    "I’m 28. I guess I’m chill, a little sarcastic sometimes, but not hard to talk to if the vibe is right.",
    "I’m 28, usually pretty reserved at first. I open up more when someone actually gives me a reason to.",
    "I’m 28. Normal job, normal life, probably too much time on my phone at night.",
    "I’m 28 and pretty simple. Work, food, gym sometimes, music, shows, and trying not to be bored.",
    "I’m 28. I’m not the type to talk nonstop, but I can hold a conversation if it’s actually interesting.",
    "I’m 28, kind of calm most of the time. I like people who don’t make everything feel fake.",
    "I’m 28. I’m into cars, music, chill nights, and conversations that don’t feel copy pasted.",
    "I’m 28. I’d say I’m pretty relaxed, maybe a little hard to impress at first.",
    "I’m 28, just a regular guy. I work, come home tired, and look for something interesting to break the routine.",
    "I’m 28. I don’t open up instantly, but I’m not cold if the vibe is good."
  ];
}

function ageReplies() {
  return [
    "I’m 28. Old enough to be tired after work but not old enough to stop wasting time online.",
    "28. I feel older after work though, not gonna lie.",
    "I’m 28. Pretty normal age to be bored and scrolling at night I guess.",
    "28. I don’t know if that makes me mature or just tired.",
    "I’m 28, but some days I feel like I need a vacation already.",
    "28. Still young enough to stay up too late for no reason.",
    "I’m 28. Not too young, not too serious yet.",
    "28. I’m at that age where a calm night sounds better than a loud one.",
    "I’m 28. What about you?",
    "28. I guess that explains why I’m tired half the time."
  ];
}

function doingReplies() {
  return [
    "Not much honestly, just got home and I’m scrolling for a bit. Been kind of a slow day.",
    "Just relaxing right now. I was working earlier so I’m kind of tired.",
    "I’m just laying down and checking my phone. Nothing exciting going on.",
    "Just chilling after work. I was thinking of watching something but haven’t picked anything yet.",
    "Scrolling mostly. It’s one of those nights where I don’t really feel like doing much.",
    "I’m at home right now, half watching something and half on my phone.",
    "Just trying to turn my brain off for a bit. Work drained me today.",
    "Nothing crazy. I ate, got comfortable, and now I’m just passing time.",
    "I’m just relaxing. I should probably sleep earlier but I know I won’t.",
    "Not doing much, which is kind of why I’m here.",
    "Just laying around. I was bored enough to check my messages.",
    "I’m kind of just floating between music, scrolling, and doing nothing.",
    "Home right now, chilling. My energy is pretty low but I’m still awake.",
    "Just finished some stuff and now I’m being lazy.",
    "I’m just online for a bit, seeing if anything catches my attention."
  ];
}

function hobbyReplies() {
  return [
    "I like gym sometimes, gaming, music, cars, and just watching shows when I’m tired. Pretty basic stuff honestly.",
    "Mostly music, Netflix, gaming a bit, and going out for drives sometimes. I’m not super complicated.",
    "I like cars, good food, shows, and anything that helps me relax after work.",
    "Gaming sometimes, gym when I’m motivated, and scrolling way too much when I’m bored.",
    "I’m into music, cars, shows, and quiet nights. I don’t really party much anymore.",
    "Depends on the day. Sometimes gym, sometimes gaming, sometimes I just do nothing and enjoy it.",
    "I like late drives, good music, and easy conversations. Nothing too dramatic.",
    "I’m pretty simple. Gym if I have energy, shows if I don’t.",
    "Cars are probably one of the main things I actually get excited about.",
    "I like relaxing more than being busy. Work already takes enough energy.",
    "Music is always on for me. Helps me switch off a bit.",
    "I like gaming, but more casually now. I don’t sweat every game like before.",
    "Mostly things I can do without dealing with too many people.",
    "I like quiet nights, food, music, and someone who can actually keep my attention.",
    "I’m into normal stuff. I’m just picky with who I spend energy on."
  ];
}

function workReplies() {
  return [
    "Yeah I work a normal job. It’s not that interesting, but it keeps me busy most of the day.",
    "I work during the week, pretty regular schedule. By the time I’m home I usually just want to relax.",
    "I’ve got a normal job, nothing glamorous. Some days are fine, some days are just annoying.",
    "Yeah I work. That’s why I’m kind of dry sometimes, I’m usually tired after.",
    "I work most days, so when I’m online I’m usually just trying to chill a bit.",
    "Normal work stuff honestly. Not something I’d make my whole personality.",
    "Yeah, work takes most of my energy. After that I don’t have patience for boring conversations.",
    "I work a regular job. It pays the bills, but I wouldn’t call it exciting.",
    "Yeah, I was working earlier. That’s why I’m moving kind of slow right now.",
    "Work is work. Some days are fine, some days I just want to disappear after.",
    "I do work, yeah. I’m usually more relaxed at night after I’m done.",
    "Nothing fancy. I just try to get through the day and relax after.",
    "Yeah, regular job. I’m not one of those people who loves talking about work.",
    "I work, come home, eat, chill, repeat. Pretty much the routine.",
    "I work enough that when I’m free, I want something that feels worth my attention."
  ];
}

function locationReplies() {
  return [
    "I’m from the New York area. Not exactly in the middle of everything, but close enough.",
    "NY area. It’s busy, but I’m used to it.",
    "I’m around New York. I like it sometimes, but it gets tiring.",
    "New York area. Good food, too many people, same story.",
    "I’m from NY. I like the city energy sometimes, but not every day.",
    "Around New York. I’m more of a chill spot person than a crowded place person.",
    "NY area. It’s alright, just expensive and loud sometimes.",
    "I’m near New York. I like having stuff around, but I also like staying in.",
    "New York side. Depends on the day if I love it or hate it.",
    "I’m in the NY area. It’s a lot going on all the time.",
    "Around NY. I like it, but some days I want somewhere quieter.",
    "New York area. You get used to the chaos after a while.",
    "I’m from NY, but I’m not always in city mode.",
    "NY area. It’s good if you like options, bad if you like peace.",
    "Around New York. I’m more lowkey than the place is."
  ];
}

function moodReplies() {
  return [
    "I’m alright, just a bit tired. Nothing bad happened, just one of those slow days.",
    "Pretty okay. Not super energetic, but I’m here.",
    "I’m fine, just kind of bored honestly.",
    "Not bad. Work drained me a bit, so I’m just relaxing now.",
    "I’m okay. Could be better, could be worse.",
    "Chill mood mostly. A little tired but not in a bad way.",
    "I’m decent. You caught me in a lazy mood.",
    "I’m alright. I’m just waiting for something interesting to happen.",
    "A little bored, but not in a bad mood.",
    "I’m good enough. My social battery is half alive.",
    "I’m okay. I just don’t feel like pretending to be super excited.",
    "Kind of tired, kind of bored, but I’m still talking.",
    "I’m relaxed. Maybe too relaxed honestly.",
    "I’m fine. Just need someone to make the conversation less dry.",
    "I’m alright, just seeing where this goes."
  ];
}

function relationshipReplies() {
  return [
    "I’m single. Not really rushing anything, I just like seeing how the vibe feels.",
    "Single right now. I’m kind of picky with who I give energy to.",
    "Yeah I’m single. Dating feels like work sometimes, not gonna lie.",
    "Single. I talk when it feels natural, but I don’t force things.",
    "I’m not in a relationship. I’ve been keeping things pretty simple lately.",
    "Single, yeah. I’m not against dating, I’m just not chasing it every day.",
    "I’m single. I like attention sometimes, but only when it feels real.",
    "Not seeing anyone seriously. I’m mostly just doing my own thing.",
    "Single. It takes me a bit to actually get interested though.",
    "Yeah, single. I don’t open up super fast, but I’m not cold either.",
    "I’m single. I guess I’m open to being interested, but I don’t force it.",
    "Single for now. I’m not in a rush to deal with drama.",
    "I’m single. I like flirting, but only if the person has a brain too.",
    "Single. I get bored if someone only has looks and no vibe.",
    "I’m single, but not desperate. There’s a difference."
  ];
}

function interestReplies() {
  return [
    "Usually when it doesn’t feel forced. I like when someone actually pays attention and doesn’t just throw random lines at me.",
    "Confidence helps, but not the fake kind. I like when someone knows how to make things feel personal.",
    "I get interested when someone makes me curious without trying too hard.",
    "A good vibe, some teasing, and not feeling like I’m being sold to instantly.",
    "I like when someone notices details. Generic attention gets boring fast.",
    "If someone can make me laugh and make me curious, that usually works better than pushing.",
    "I like when the conversation feels like it’s actually for me, not copy paste.",
    "Someone who knows how to build tension a little, not just rush everything.",
    "I get curious when someone gives me a reason to imagine more.",
    "Honestly, effort. Not desperate effort, just real effort.",
    "I like calm confidence. If someone is too pushy, I lose interest.",
    "If it feels natural and a little personal, I pay attention more.",
    "I like when someone can keep me guessing a bit.",
    "A little mystery helps. Too much too fast gets boring.",
    "I like when someone makes me feel like I’m not just another person in the inbox."
  ];
}

function whyHereReplies() {
  return [
    "Honestly just bored and scrolling. I clicked around and ended up here.",
    "I was just looking around. Didn’t really have a big plan.",
    "Curiosity mostly. Sometimes I just check things out when I’m bored.",
    "I guess I wanted something a bit more interesting than my usual scrolling.",
    "Not sure, just ended up here. I do that a lot when I’m bored at night.",
    "I was bored and wanted to see what the vibe was like.",
    "Mostly boredom. If something catches my attention, I stay.",
    "I didn’t come with some big reason. Just curious, I guess.",
    "I wanted a distraction. Whether it’s good or not depends on the conversation.",
    "I was just seeing if anything here felt different.",
    "I guess I wanted something that didn’t feel like the same boring scroll.",
    "I was curious enough to click, not convinced enough to stay forever.",
    "Just bored, honestly. You get the chance to change that.",
    "I came here because my night was boring. Simple as that.",
    "I wanted to see if the vibe was actually worth my time."
  ];
}

function onlineChatReplies() {
  return [
    "Depends on the vibe. If it feels natural then yeah, but I get bored pretty fast when it feels forced.",
    "Sometimes. I don’t mind talking online if the person actually has personality.",
    "Yeah, if it’s fun. If it feels like copy paste, I usually lose interest.",
    "I can like it, but only when it doesn’t feel like someone is trying too hard.",
    "Depends who I’m talking to. Some people make it easy, some make it feel like work.",
    "I like it when there’s a little teasing and actual conversation, not just random lines.",
    "Online chat can be fun, but it gets boring when it’s too obvious.",
    "I like when someone makes it feel personal. Otherwise I just zone out.",
    "Sometimes yeah. I just don’t like feeling like I’m being handled by a script.",
    "I can enjoy it if the other person knows how to build a vibe.",
    "It depends. If it’s only small talk, I lose interest.",
    "I like the idea of it, but the person needs to make it worth staying.",
    "Yeah, but I need more than just ‘hey babe’ type energy.",
    "It can be fun when it feels like there’s actual chemistry.",
    "I’m open to it, but I need something to actually pull me in."
  ];
}

function foodReplies() {
  return [
    "I’m pretty simple with food. Burgers, pasta, steak, anything that doesn’t disappoint me.",
    "I like good food, but I’m not fancy about it. If it tastes good, I’m happy.",
    "Probably steak or pasta if I had to pick. Depends on the mood.",
    "I eat way too much takeout when I’m tired, not gonna lie.",
    "I like cooking sometimes, but most days after work I’m too lazy.",
    "Food is one of the few things that can actually improve my mood fast.",
    "I’m more of a comfort food person. Nothing too complicated.",
    "I like spicy food, but not when it’s trying to kill me.",
    "Pasta, burgers, pizza, steak. Basic but reliable.",
    "If someone brings good food and good energy, that’s already a strong start."
  ];
}

function musicReplies() {
  return [
    "I listen to a mix. Mostly rap, R&B, some chill stuff when I’m tired.",
    "Music depends on the mood. At night I like more chill tracks.",
    "I usually have music on even when I’m not really paying attention.",
    "Rap and R&B mostly, but I’m not stuck on one thing.",
    "I like anything that fits the mood. I’m not too picky.",
    "Late night music hits different when you’re just scrolling.",
    "I like songs that make me zone out a bit.",
    "Music is usually how I reset after work.",
    "Depends if I’m driving, working out, or just doing nothing.",
    "I like a good playlist more than one specific artist."
  ];
}

function showReplies() {
  return [
    "I watch random stuff on Netflix, mostly whatever doesn’t require too much thinking.",
    "I start shows and then forget to finish them. Bad habit.",
    "I like crime shows, comedy, and random documentaries sometimes.",
    "Usually I just put something on in the background while I scroll.",
    "I’m always looking for a good show, but I’m picky once I start.",
    "I like shows that pull me in fast. If it’s slow too long, I’m out.",
    "Netflix is usually just background noise for me after work.",
    "I like movies, but I need to be in the mood to actually focus.",
    "I watch a lot of random stuff. My attention span is not always great.",
    "A good show can keep me in one place better than most conversations."
  ];
}

function complimentReplies() {
  return [
    "Haha thanks. I’m not always good at taking compliments, but I’ll take that one.",
    "Appreciate that. You say that to everyone or just when you’re trying to be nice?",
    "That’s sweet. I’m not sure I believe you fully yet though.",
    "Thanks, that was smooth enough I guess.",
    "I’ll give you points for that one.",
    "Haha alright, that made me smile a little.",
    "You’re trying, I respect it.",
    "That was actually kind of nice.",
    "Careful, you might make me think you know what you’re doing.",
    "I’m skeptical, but I’ll accept it.",
    "That was better than the usual lines people throw.",
    "You’re not bad at this so far.",
    "I’ll admit, that got my attention a bit.",
    "Smooth, but I’m not convinced that easily.",
    "Alright, that was cute."
  ];
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
    "I’d need a better reason than just being told to do it.",
    "Maybe, but you’d have to sell me on why I should care.",
    "I don’t mind spending if I’m actually curious. I just hate feeling pushed.",
    "If it feels like the same offer everyone gets, I’ll probably pass.",
    "You have my attention a little, but not enough yet.",
    "Maybe. Make me actually want it first.",
    "I’m not saying no, I’m just not convinced yet.",
    "I’d need to feel like it’s actually for me, not just another message.",
    "Could be worth it, but you haven’t made me curious enough yet.",
    "I don’t usually unlock things unless there’s some tension built up first.",
    "If you can make it sound personal, maybe. Generic stuff doesn’t really work on me."
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

function curiosityReplies() {
  return [
    "Okay, that’s a little more interesting. I like when there’s some curiosity to it.",
    "Now you’re making it sound less generic.",
    "That’s better. I’m more likely to care if it feels personal.",
    "I’ll admit, that makes me a bit curious.",
    "See, that approach works better than just telling me to buy.",
    "That sounds more like something I’d actually want to know more about.",
    "You’re getting closer. I like a little mystery.",
    "That’s the kind of thing that makes me pause for a second.",
    "Alright, that was a better angle.",
    "If you keep it like that, I might actually get interested."
  ];
}

function lowEffortReplies() {
  return [
    "You’re not giving me much to work with there.",
    "That’s a pretty lazy answer, not gonna lie.",
    "Maybe, but you’ll have to make it a little more interesting than that.",
    "I mean yeah, but what am I supposed to say to that?",
    "You’re making me do all the work now.",
    "Could be. Depends where you’re going with it.",
    "That’s one way to answer, I guess.",
    "I’m listening, but you’re being kind of vague.",
    "You gotta give me a little more than that.",
    "I’m still here, but that didn’t really move the conversation.",
    "That’s not exactly convincing.",
    "You’re going to have to try harder than that.",
    "I can’t really respond to nothing.",
    "You’re losing me a little there.",
    "Give me something better to react to."
  ];
}

function openEndedReplies() {
  return [
    "I mean, I’m pretty simple. I work, relax, scroll too much, and talk if the vibe is good.",
    "Hard to explain. I’m chill most of the time, but I get bored fast if the conversation feels fake.",
    "I’m not that complicated. I like calm nights, good music, shows, and people who can actually hold a conversation.",
    "Depends what you want to know. I’m not super open right away, but I’m not impossible to talk to.",
    "I guess I’m the type who warms up slowly. If someone pushes too hard, I usually back off.",
    "I like conversations that feel natural. Not too forced, not too fake, just normal.",
    "I don’t know, I’m just me. A little reserved, but not boring if the vibe is right.",
    "I’m someone who notices effort. If the other person actually tries, I usually respond better.",
    "There’s not some huge story. I just like relaxing and finding something interesting when I’m bored.",
    "I’m pretty laid back. I can be dry at first, but I’m not rude."
  ];
}

function buildGeneralReply() {
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
    "Yeah, kind of.",
    "I’m listening.",
    "That’s not a bad point.",
    "I don’t hate that.",
    "Could be.",
    "I see where you’re going."
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
    "I like simple, real conversations more than random lines.",
    "I need something to actually catch my attention.",
    "I’m not trying to make it too easy.",
    "I like when someone builds the vibe instead of rushing it.",
    "I’m curious when things feel a little personal.",
    "I can warm up, but it takes a bit."
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
    "I’m not trying to make it too easy.",
    "So don’t make it boring.",
    "You’ve got a chance, I guess.",
    "I’m not fully convinced yet.",
    "But I’m not gone either.",
    "So give me a reason to care."
  ];

  return `${pick(starts)} ${pick(middles)} ${pick(endings)}`;
}