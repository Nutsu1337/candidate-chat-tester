exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const { transcript } = JSON.parse(event.body || "{}");
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    const reply = generateReply(safeTranscript);

    return json(200, { reply, source: "built_in_100_percent" });
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
  return String(text || "").replace(/\s+/g, " ").trim();
}

function lastCandidateRaw(transcript) {
  return [...transcript].reverse().find(m => m.role === "candidate")?.text || "";
}

function lastCandidate(transcript) {
  return normalize(lastCandidateRaw(transcript));
}

function candidateTurn(transcript) {
  return transcript.filter(m => m.role === "candidate").length;
}

function recentFanReplies(transcript) {
  return transcript
    .filter(m => m.role === "fan")
    .slice(-12)
    .map(m => normalize(m.text));
}

function avoidRepeat(reply, transcript) {
  const previous = recentFanReplies(transcript);
  const normal = normalize(reply);

  if (!previous.includes(normal)) return reply;

  return pick([
    "I’m still here, just a little distracted. You’ll have to keep me interested.",
    "I don’t mind talking, I just need the conversation to feel natural.",
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

function generateReply(transcript) {
  const msg = lastCandidate(transcript);
  const turn = candidateTurn(transcript);
  let reply;

  // Safety boundary: adult and consensual only
  if (unsafeSexual(msg)) reply = pick(boundaryReplies());

  // Normal human direct questions first
  else if (asksName(msg)) reply = pick(nameReplies());
  else if (asksAge(msg)) reply = pick(ageReplies());
  else if (asksLocation(msg)) reply = pick(locationReplies());
  else if (asksMood(msg)) reply = pick(moodReplies());
  else if (asksRelaxing(msg)) reply = pick(relaxingReplies());
  else if (asksDoing(msg)) reply = pick(doingReplies());
  else if (asksAbout(msg)) reply = pick(aboutReplies());
  else if (asksFood(msg)) reply = pick(foodReplies());
  else if (asksMusic(msg)) reply = pick(musicReplies());
  else if (asksShows(msg)) reply = pick(showReplies());
  else if (asksGames(msg)) reply = pick(gamingReplies());
  else if (asksCars(msg)) reply = pick(carReplies());
  else if (asksHobbies(msg)) reply = pick(hobbyReplies());
  else if (asksWork(msg)) reply = pick(workReplies());
  else if (asksRelationship(msg)) reply = pick(relationshipReplies());
  else if (asksPersonality(msg)) reply = pick(personalityReplies());
  else if (asksWhatInterested(msg)) reply = pick(interestReplies());
  else if (asksWhyHere(msg)) reply = pick(whyHereReplies());
  else if (asksOnlineChat(msg)) reply = pick(onlineChatReplies());

  // Flirty / adult / sales test
  else if (candidatePushy(msg)) reply = pick(pushyReplies());
  else if (candidateTriesToSell(msg)) reply = pick(salesResistanceReplies());
  else if (candidateCreatesCuriosity(msg)) reply = pick(curiosityReplies());
  else if (candidateAsksTurnOn(msg)) reply = buildTurnOnReply();
  else if (candidateSexual(msg)) reply = buildAdultReply();
  else if (candidateFlirts(msg)) reply = buildFlirtyReply();

  // Normal fallback behavior
  else if (candidateCompliments(msg)) reply = pick(complimentReplies());
  else if (candidateIsLowEffort(msg)) reply = pick(lowEffortReplies());
  else if (isGreeting(msg)) reply = pick(greetingReplies(turn));
  else if (asksOpenEnded(msg)) reply = pick(openEndedReplies());
  else reply = buildHumanGeneralReply();

  return avoidRepeat(clean(reply), transcript);
}

/* ---------------- INTENT DETECTION ---------------- */

function unsafeSexual(msg) {
  return /\b(underage|minor|child|children|teen|forced|rape|incest|mom|dad|sister|brother|daughter|son|drugged|unconscious|no consent)\b/.test(msg);
}

function asksName(msg) {
  return /\b(what is your name|what's your name|your name|who am i talking to|what should i call you|who are you)\b/.test(msg);
}

function asksAge(msg) {
  return /\b(age|how old|old are you)\b/.test(msg);
}

function asksLocation(msg) {
  return /\b(where are you from|where you from|where do you live|location|city|country|from where)\b/.test(msg);
}

function asksMood(msg) {
  return /\b(how are you|how have you been|how you been|how's your day|how is your day|how do you feel|you okay|mood|good day|bad day|how was your day)\b/.test(msg);
}

function asksRelaxing(msg) {
  return /\b(how are you relaxing|how do you relax|relaxing|relax|chilling|taking it easy|resting|unwind|calm down)\b/.test(msg);
}

function asksDoing(msg) {
  return /\b(what are you doing|wyd|doing rn|doing right now|what you up to|up to|plans today|what are your plans|tonight|today)\b/.test(msg);
}

function asksAbout(msg) {
  return /\b(tell me about you|about yourself|tell me something about you|what are you like|describe yourself|tell me more about you)\b/.test(msg);
}

function asksFood(msg) {
  return /\b(food|eat|eating|dinner|lunch|breakfast|favorite food|favourite food|hungry|cook|cooking|meal|restaurant|pizza|burger|pasta|steak|what do you like to eat|what you like to eat)\b/.test(msg);
}

function asksMusic(msg) {
  return /\b(music|song|songs|artist|playlist|listen to|what do you listen)\b/.test(msg);
}

function asksShows(msg) {
  return /\b(movie|movies|show|shows|netflix|series|watching|what do you watch|tv show|tv shows)\b/.test(msg);
}

function asksGames(msg) {
  return /\b(game|games|gaming|playstation|xbox|pc game|what do you play)\b/.test(msg);
}

function asksCars(msg) {
  return /\b(car|cars|drive|driving|bmw|mercedes|audi|porsche)\b/.test(msg);
}

function asksHobbies(msg) {
  if (asksFood(msg) || asksMusic(msg) || asksShows(msg) || asksGames(msg) || asksCars(msg)) return false;
  return /\b(hobbies|free time|fun|enjoy|interests|what do you like|like doing|what you like doing)\b/.test(msg);
}

function asksWork(msg) {
  return /\b(work|job|do for work|working|career|occupation|what do you do)\b/.test(msg);
}

function asksRelationship(msg) {
  return /\b(single|girlfriend|relationship|dating|wife|married|seeing anyone|do you have a girl)\b/.test(msg);
}

function asksPersonality(msg) {
  return /\b(personality|are you shy|are you quiet|are you confident|what kind of guy)\b/.test(msg);
}

function asksWhatInterested(msg) {
  return /\b(what makes you interested|what gets you interested|what do you like in someone|what catches your attention|what makes you curious|what do you want|what are you looking for)\b/.test(msg);
}

function asksWhyHere(msg) {
  return /\b(why are you here|what brings you|why did you come|why on this page|what made you come here|why did you join)\b/.test(msg);
}

function asksOnlineChat(msg) {
  return /\b(talk online|chat online|talking to girls|online girls|chatting here|like chatting|like talking)\b/.test(msg);
}

function candidateCompliments(msg) {
  return /\b(cute|handsome|hot|good looking|nice|sweet|funny|interesting|i like you|you seem cool|you seem nice|you seem fun)\b/.test(msg);
}

function candidateTriesToSell(msg) {
  return /\b(buy|unlock|tip|send|offer|deal|discount|special|vip|secret|video|content|premium|surprise|exclusive|ppv|drop|bundle)\b/.test(msg);
}

function candidatePushy(msg) {
  return /\b(buy now|right now|come on|just buy|hurry|you have to|don't waste|pay now|prove it|stop wasting|be a man)\b/.test(msg);
}

function candidateCreatesCuriosity(msg) {
  return /\b(curious|guess|imagine|secret|surprise|you would like|you'd like|only for you|personal|made for you|worth it|special for you|you won’t regret)\b/.test(msg);
}

function candidateFlirts(msg) {
  return /\b(flirt|tease|cute|babe|baby|handsome|wish you were here|miss me|thinking of you|naughty|bad boy|good boy)\b/.test(msg);
}

function candidateSexual(msg) {
  return /\b(sex|sexy|horny|dirty|wet|hard|naked|touch|stroke|jerk|cum|pussy|cock|dick|boobs|ass|fuck|suck|lick)\b/.test(msg);
}

function candidateAsksTurnOn(msg) {
  return /\b(what turns you on|turn you on|what are you into|fantasy|kink|fetish|what do you like in bed|what do you like sexually)\b/.test(msg);
}

function candidateIsLowEffort(msg) {
  return msg.length < 10 || /^(ok|okay|lol|haha|nice|cool|yes|no|sure|maybe|why|k)\b/.test(msg);
}

function isGreeting(msg) {
  return /\b(hi|hello|hey|yo|sup|good morning|good evening|good afternoon)\b/.test(msg);
}

function asksOpenEnded(msg) {
  return /\b(tell me|explain|describe|what kind|what type|how come|why)\b/.test(msg);
}

/* ---------------- NORMAL HUMAN RESPONSES ---------------- */

function nameReplies() {
  return [
    "I’m Ryan. What’s yours?",
    "Ryan. Pretty normal name, nothing exciting.",
    "My name’s Ryan. What should I call you?",
    "Ryan. I don’t think I said that yet.",
    "I’m Ryan, 28.",
    "Ryan. Nice to meet you, I guess.",
    "Name’s Ryan. What about you?",
    "I’m Ryan. I’m not great at introductions, not gonna lie.",
    "Ryan. You?",
    "I’m Ryan. Simple enough."
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
    "I’m in the NY area. It’s a lot going on all the time."
  ];
}

function moodReplies() {
  return [
    "I’ve been alright, just tired from work mostly. Nothing bad, just one of those slow weeks.",
    "I’m good, just kind of low energy today. Work drained me a bit.",
    "I’ve been okay. Not amazing, not terrible, just normal life stuff.",
    "Pretty decent. I’m just relaxing now and trying to switch my brain off.",
    "I’m alright. A little bored honestly, but not in a bad mood.",
    "I’ve been good enough. Same routine mostly: work, eat, chill, repeat.",
    "Not bad. Today was just slow, so I’m trying to find something interesting now.",
    "I’m fine, just tired. I’m still here though.",
    "I’ve been okay. I could use a better distraction tonight.",
    "I’m alright. Nothing exciting happened, but maybe that’s not always bad."
  ];
}

function relaxingReplies() {
  return [
    "Mostly just laying down, scrolling, and trying not to think about work. That’s my usual way to relax.",
    "I usually relax by putting something on in the background and just scrolling for a bit. Nothing fancy.",
    "Just chilling at home honestly. Music on, phone in hand, and trying to switch my brain off.",
    "Usually I relax with a show, some music, or just doing absolutely nothing after work.",
    "I’m relaxing by being lazy right now, pretty much. Sometimes that’s all I need after a long day.",
    "Mostly just quiet time. I don’t always feel like talking to people after work unless the vibe is good.",
    "I usually just get comfortable, put on Netflix or music, and scroll until I get bored.",
    "Right now I’m just relaxing by laying around and checking my phone. Nothing exciting.",
    "I like calm nights when I’m relaxing. Food, music, maybe a show, and no annoying people.",
    "I guess relaxing for me is just not having to do anything for a while."
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
    "Not doing much, which is kind of why I’m here."
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
    "I’m 28. I don’t open up instantly, but I’m not cold if the vibe is good."
  ];
}

function foodReplies() {
  return [
    "I’m pretty simple with food. Burgers, pasta, steak, pizza, stuff like that. If I’m tired after work, I usually just order something.",
    "Pasta is probably one of my go-to meals. Easy, filling, and hard to mess up.",
    "I like steak, burgers, pizza, and Mexican food. Nothing too fancy, just food that actually tastes good.",
    "If I’m lazy, I’ll order a burger or pizza. If I have energy, maybe steak or pasta.",
    "I like comfort food more than fancy food. Pasta, burgers, fries, that kind of thing.",
    "Honestly I eat too much takeout when I’m tired. Work kills my motivation to cook.",
    "I’m not picky, but I like food that feels worth it. Good pasta or a good burger usually wins.",
    "I like spicy food sometimes, but not when it’s trying to destroy me.",
    "Probably pasta, steak, pizza, or wings. Basic, but reliable.",
    "I like simple food. If someone can cook well, that’s honestly attractive too."
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
    "I’ve been watching random Netflix stuff lately, mostly crime shows and easy background shows. I don’t always fully pay attention.",
    "I start shows and then forget to finish them. Bad habit, but if it doesn’t grab me fast I lose interest.",
    "I like crime shows, comedy, and random documentaries sometimes. Depends what mood I’m in.",
    "Usually I just put something on in the background while I scroll. It’s more noise than watching sometimes.",
    "I’m always looking for a good show, but I’m picky once I start. If it’s slow too long, I’m out.",
    "I like shows that pull me in fast. I don’t have patience for five episodes of setup.",
    "Netflix is usually just background noise for me after work. Helps me turn my brain off.",
    "I like movies, but I need to be in the mood to actually focus for two hours.",
    "I watch a lot of random stuff. My attention span is not always great.",
    "A good show can keep me in one place better than most conversations."
  ];
}

function gamingReplies() {
  return [
    "I game sometimes, but not like I used to. Mostly when I want to turn my brain off.",
    "I play random stuff, depends what friends are on. I’m not grinding games every night anymore.",
    "Gaming is more casual for me now. I like it, but I’m not trying to rage at 2am.",
    "I’ll play shooters or story games sometimes. Depends on my mood.",
    "I like gaming after work if I still have energy. Some nights I just scroll instead.",
    "I used to play more. Now I play when I’m bored enough or someone invites me.",
    "Gaming is fun, but I get annoyed if the lobby is full of idiots.",
    "I like competitive games sometimes, but I’m not always in the mood to sweat.",
    "I’ll play whatever feels fun. I don’t care about being amazing at everything.",
    "Gaming is one of those things I like, but I go through phases with it."
  ];
}

function carReplies() {
  return [
    "I like cars a lot. I’m not rich enough to buy every one I like, but I still look at them too much.",
    "Cars are one thing I actually get excited talking about. I like clean builds more than loud ugly ones.",
    "I’m into cars, yeah. Late night drives with music on are underrated.",
    "I like BMWs, Porsches, stuff like that. Expensive taste, normal budget.",
    "Cars are probably my biggest interest outside of relaxing and wasting time online.",
    "I like cars that look clean, not overdone. Simple and aggressive usually works.",
    "Driving clears my head sometimes. Music, empty road, no one bothering me.",
    "I watch car videos more than I should. It’s kind of a problem.",
    "I like fast cars, but also comfortable ones. I’m not trying to break my back daily driving.",
    "Cars are easy to talk about. People are more complicated."
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
    "I like relaxing more than being busy. Work already takes enough energy."
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
    "Work is work. Some days are fine, some days I just want to disappear after."
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
    "Yeah, single. I don’t open up super fast, but I’m not cold either."
  ];
}

function personalityReplies() {
  return [
    "I’m pretty calm, maybe a little reserved at first. I open up more if the conversation feels natural.",
    "I’m not shy exactly, just not loud for no reason. I like watching the vibe first.",
    "I’d say I’m chill, sarcastic sometimes, and not easy to impress right away.",
    "I’m quiet at first, but not boring. I just don’t give full energy to everyone instantly.",
    "I’m laid back, but I notice when someone is trying too hard.",
    "I’m not cold, I’m just selective with my attention.",
    "I can be flirty, but only if it feels like there’s actual chemistry.",
    "I’m more of a slow warm-up person. Push too fast and I back off.",
    "I like calm confidence. Loud energy gets annoying fast.",
    "I’m simple, but not stupid. I pay attention more than people think."
  ];
}

/* ---------------- SALES / FLIRTY / ADULT SIMULATION ---------------- */

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
    "Honestly, effort. Not desperate effort, just real effort."
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
    "I was just seeing if anything here felt different."
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
    "I can enjoy it if the other person knows how to build a vibe."
  ];
}

function buildFlirtyReply() {
  const starts = [
    "Careful, you’re starting to sound a little dangerous.",
    "That was smooth, I’ll give you that.",
    "You’re getting a little better at keeping my attention.",
    "I like that energy more than the basic lines.",
    "Okay, that actually made me smile a bit.",
    "You’re making it harder to stay bored.",
    "That’s the kind of message that makes me pause for a second.",
    "You’ve got some confidence, I’ll give you that.",
    "That was a little tempting, not gonna lie.",
    "You’re playing it better now."
  ];

  const middles = [
    "I like when someone teases without giving everything away instantly.",
    "I get curious when it feels personal instead of copy pasted.",
    "I’m not easy to impress, but I do notice when the vibe gets better.",
    "I like a little tension, especially when it doesn’t feel forced.",
    "I’m more interested when someone makes me imagine things instead of spelling everything out too fast.",
    "I like when someone can be sweet and a little dirty at the same time.",
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

function buildTurnOnReply() {
  const starts = [
    "I’m into confidence, but not the fake loud kind.",
    "I like tension more than someone just saying everything directly.",
    "I like when someone teases slowly and makes it feel personal.",
    "I get turned on more by the buildup than by random explicit lines.",
    "I like someone who knows how to make me curious first.",
    "I like when it feels like there’s a private little vibe between us.",
    "I’m into teasing, attention, and feeling like someone actually knows what they’re doing.",
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
    "I need the curiosity first, then I’m easier to tempt.",
    "If someone rushes it, it kills the mood for me.",
    "I like being teased enough that I start thinking about it.",
    "Make me want it and I’m not hard to convince.",
    "I just need it to feel like it’s actually meant for me."
  ];

  return `${pick(starts)} ${pick(endings)}`;
}

function buildAdultReply() {
  const starts = [
    "That’s a dirty thought, not gonna lie.",
    "Okay, now you’re moving into dangerous territory.",
    "That kind of message can get my attention fast.",
    "I like when the conversation gets a little more intense.",
    "You’re making it less innocent now.",
    "I can work with that kind of energy.",
    "That’s more tempting than the usual boring small talk.",
    "I’m not going to pretend that didn’t get my attention.",
    "That’s the kind of thing that makes me curious.",
    "You’re making it harder to stay reserved."
  ];

  const middles = [
    "I like teasing that builds slowly instead of rushing straight to the end.",
    "If it feels personal, it hits different.",
    "I need to feel like you’re saying it to me, not just throwing dirty lines around.",
    "I like the buildup, the details, and the feeling that there’s something private behind it.",
    "I’m more into it when someone knows how to create tension first.",
    "I don’t mind explicit energy, but I still need it to feel natural.",
    "The right words can definitely get me thinking.",
    "I like when someone makes me imagine what comes next.",
    "I’m not easy, but I’m not impossible when the vibe is right.",
    "If you keep it personal, I’ll probably get more interested."
  ];

  const endings = [
    "So don’t rush it, make me want more.",
    "That’s how you get me curious.",
    "Now you’d have to make it worth unlocking.",
    "Keep building it like that and I might actually care.",
    "You’ve got my attention, but I’m not fully convinced yet.",
    "Make me feel like it’s actually for me.",
    "That’s better, but I’d still need a reason to spend.",
    "I like the direction, just don’t make it feel generic.",
    "If you make me curious enough, I’m more likely to bite.",
    "Now tell me why I should want it that badly."
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
    "I’d need a better reason than just being told to do it.",
    "Maybe, but you’d have to sell me on why I should care.",
    "I don’t mind spending if I’m actually curious. I just hate feeling pushed.",
    "If it feels like the same offer everyone gets, I’ll probably pass.",
    "You have my attention a little, but not enough yet.",
    "Maybe. Make me actually want it first."
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

/* ---------------- CONVERSATION QUALITY ---------------- */

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
    "I’m skeptical, but I’ll accept it."
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
      "hey, kinda bored so I’m here for a bit"
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

function boundaryReplies() {
  return [
    "Nah, I’m not into that. Keep it adult and consensual.",
    "That kind of thing kills the vibe for me. Adult and consensual only.",
    "No, that’s not something I’m comfortable with.",
    "I’m fine with flirty or dirty, but not anything like that.",
    "Let’s keep it adult, consensual, and normal."
  ];
}

/* ---------------- GENERAL HUMAN TEMPLATE ENGINE ---------------- */

function buildHumanGeneralReply() {
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
    "I see where you’re going.",
    "That’s possible.",
    "I’m not sure yet.",
    "Maybe you’re right.",
    "I can work with that.",
    "That depends on the vibe."
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
    "I can warm up, but it takes a bit.",
    "I like when the conversation has a little personality.",
    "I notice effort more than big words.",
    "I lose interest when it feels like a script.",
    "I like a little confidence, but not pressure.",
    "I’m more likely to stay if it feels like you’re actually talking to me."
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
    "So give me a reason to care.",
    "That’s where I’m at right now.",
    "I’m waiting to see if you can keep the vibe going.",
    "Don’t waste the opening.",
    "I’ll give you a little time.",
    "Now it’s on you to make it interesting."
  ];

  return `${pick(starts)} ${pick(middles)} ${pick(endings)}`;
}