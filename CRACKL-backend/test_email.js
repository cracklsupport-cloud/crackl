const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

transporter.verify(function (error, success) {
  if (error) { console.error("❌ SMTP Error:", error); } 
  else { console.log("✅ SMTP Ready. Server is capable of sending messages."); }
});
