const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ============================================================
// RIDDLE GENERATION HAS BEEN REMOVED
// All riddles are now manually curated via the Admin Panel.
// Only checkTypedAnswer remains for type-mode answer checking.
// ============================================================

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

module.exports = { checkTypedAnswer };
