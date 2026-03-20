const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const CATEGORIES = [
  { name: "Bollywood & Indian Cinema", emoji: "🎬" },
  { name: "Hollywood & Web Series & OTT", emoji: "🎥" },
  { name: "Viral Internet Memes & Trends", emoji: "😂" },
  { name: "Cricket & IPL", emoji: "🏏" },
  { name: "Football & NBA & F1 & Sports", emoji: "⚽" },
  { name: "Everyday Objects at Home", emoji: "🏠" },
  { name: "School College Hostel Life", emoji: "🎓" },
  { name: "Supercars & Bikes & Engines", emoji: "🚗" },
  { name: "Tech Gadgets & Social Media Apps", emoji: "📱" },
  { name: "Indian Street Food & Restaurants", emoji: "🍛" },
  { name: "Viral Songs Bollywood & Global Music", emoji: "🎵" },
  { name: "Ancient History & World Wonders", emoji: "🏛️" },
  { name: "Science Space & Crazy Facts", emoji: "🚀" },
  { name: "Indian Cities Landmarks & Culture", emoji: "📍" },
  { name: "Animals & Weird Nature Facts", emoji: "🐯" },
  { name: "Startup Hustle & Business World", emoji: "💼" },
  { name: "Famous Personalities & Legends", emoji: "👑" },
  { name: "Human Body Psychology & Life", emoji: "🧠" },
  { name: "World Records & Mind-Blowing Facts", emoji: "🌍" },
  { name: "Relationships Love & Life Situations", emoji: "❤️" },
  { name: "Stand-Up Comedy Style Riddles", emoji: "🎤" },
  { name: "Shayari Style Riddles in English", emoji: "✍️" },
  { name: "Chain Treasure Hunt Riddles", emoji: "🗺️" },
  { name: "Mythology Indian & Greek & Norse", emoji: "⚡" },
  { name: "Bathroom & Toilet Humor Riddles", emoji: "🚽" },
  { name: "Office Corporate & Work Life", emoji: "💻" },
  { name: "Desi Mom & Indian Family Life", emoji: "👩‍👦" },
  { name: "Money Finance & Investing", emoji: "💰" },
  { name: "Optical Illusions & Brain Traps", emoji: "👁️" },
  { name: "Philosophy & Deep Life Riddles", emoji: "🌌" },
  { name: "Fitness Gym & Sports Science", emoji: "💪" },
  { name: "Gaming & Esports & Pop Culture", emoji: "🎮" },
  { name: "Crime Mystery & Detective Riddles", emoji: "🔍" },
  { name: "Childhood Nostalgia 90s & 2000s India", emoji: "🎠" },
  { name: "Breaking News & Current Events", emoji: "📰" },
];

const STYLE_GUIDES = {
  "Stand-Up Comedy Style Riddles": "Write like a stand-up comedian. Funny, observational. Setup makes people laugh, punchline IS the answer.",
  "Shayari Style Riddles in English": "Write like an Urdu poet in English. Poetic, emotional, metaphorical. Moonlight, fire, silence, shadows.",
  "Chain Treasure Hunt Riddles": "CHAIN: clue1 → thing A → property B → answer. Feel like cracking a secret code. 4-5 steps.",
  "Desi Mom & Indian Family Life": "Relatable Indian household. Every Indian says THIS IS MY HOUSE. Warm, funny, nostalgic.",
  "Bathroom & Toilet Humor Riddles": "Funny, cheeky but totally harmless. Every human relates. Make the mundane hilarious.",
  "Crime Mystery & Detective Riddles": "Crime scene brief. 4-5 cryptic clues. Suspenseful. Logical answer.",
  "Philosophy & Deep Life Riddles": "Mind-bending existential. Makes people question reality. Screenshot-worthy.",
  "Optical Illusions & Brain Traps": "Lateral thinking. Answer obvious AFTER you see it. Wordplay, trick logic.",
  "Childhood Nostalgia 90s & 2000s India": "Kiteretsu, Shaktimaan, Gems candy, Nokia 3310, Orkut. Every 90s kid cries happy tears.",
};

function getDifficultyForXP(xp) {
  if (xp < 50) return 'Easy';
  if (xp < 150) return Math.random() < 0.7 ? 'Easy' : 'Medium';
  if (xp < 400) { const r = Math.random(); return r < 0.3 ? 'Easy' : r < 0.8 ? 'Medium' : 'Hard'; }
  if (xp < 1000) { const r = Math.random(); return r < 0.2 ? 'Easy' : r < 0.6 ? 'Medium' : 'Hard'; }
  return Math.random() < 0.3 ? 'Medium' : 'Hard';
}

async function generateRiddle(city, area, xp = 0) {
  const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const difficulty = getDifficultyForXP(xp);
  const style = STYLE_GUIDES[cat.name] || "Creative, poetic, impossible to put down. Every line = a new clue.";

  const newUserNote = xp < 100 ? `
IMPORTANT: New user! Make it FUN and EASY.
Make them smile and want more immediately.
Relatable everyday things or super famous stuff only.
` : '';

  const prompt = `You are CRACKL — India's most addictive riddle app.
User: ${area}, ${city}, India. XP: ${xp}
Category: ${cat.emoji} ${cat.name}
Difficulty: ${difficulty}
${newUserNote}
Style: ${style}

RULES:
1. Write like a poet or comedian — NEVER a textbook
2. Every line pulls user DEEPER
3. Use REAL names, places, events Indians know
4. Short punchy lines — max 8 words per line
5. Mix Hindi/desi naturally when it fits
6. Make people want to WhatsApp share it

DIFFICULTY:
Easy   → Answer in 5-10 seconds, feel-good
Medium → 20-30 seconds, maybe Google
Hard   → Needs real thinking, big reward

CRITICAL RULES — READ CAREFULLY:
- The "answer" field MUST be the EXACT same text as one of the 4 options
- Return ONLY a raw JSON object
- Start with { end with }
- Zero text before or after
- No markdown, no backticks, no explanation at all

{
  "question": "line1\\nline2\\nline3\\nline4",
  "answer": "Exact Option Text Here",
  "options": ["Exact Option Text Here", "Wrong Option 2", "Wrong Option 3", "Wrong Option 4"],
  "category": "${cat.emoji} ${cat.name}",
  "difficulty": "${difficulty}",
  "hint": "subtle nudge, not giving it away",
  "fun_fact": "one surprising fact about the answer",
  "share_text": "punchy WhatsApp line 🔥",
  "explanation": "2-3 lines explaining why this is correct"
}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  // Extract JSON cleanly
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Gemini did not return valid JSON');

  const parsed = JSON.parse(raw.substring(start, end + 1));

  // Guarantee answer exactly matches one option
  const ansLower = parsed.answer.toLowerCase().trim();
  const exactMatch = parsed.options.find(o => o.toLowerCase().trim() === ansLower);
  const partialMatch = parsed.options.find(o =>
    o.toLowerCase().includes(ansLower) || ansLower.includes(o.toLowerCase().trim())
  );

  if (exactMatch) {
    parsed.answer = exactMatch;
  } else if (partialMatch) {
    parsed.answer = partialMatch;
  } else {
    // Force first option as answer if nothing matches
    parsed.answer = parsed.options[0];
  }

  // Shuffle options
  for (let i = parsed.options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parsed.options[i], parsed.options[j]] = [parsed.options[j], parsed.options[i]];
  }

  console.log(`✅ Riddle ready | ${parsed.category} | ${parsed.difficulty} | Answer: "${parsed.answer}"`);
  return parsed;
}

async function checkTypedAnswer(userAnswer, correctAnswer, question) {
  const prompt = `Riddle game answer check.
Question: "${question}"
Correct Answer: "${correctAnswer}"
User's Answer: "${userAnswer}"

Is the user correct? Be generous — accept synonyms, partial answers, different phrasing.
Reply ONLY with JSON: {"correct": true} or {"correct": false}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const parsed = JSON.parse(text.substring(start, end + 1));
    return parsed.correct === true;
  } catch (e) {
    const u = userAnswer.toLowerCase().trim();
    const c = correctAnswer.toLowerCase().trim();
    return u === c || u.includes(c) || c.includes(u);
  }
}

module.exports = { generateRiddle, checkTypedAnswer, CATEGORIES };
