const express = require('express');
const OpenAI = require('openai');
const { toFile } = require('openai');
const { requireAuth } = require('../middleware/auth');

module.exports = (upload) => {
  const router = express.Router();

  router.post('/', requireAuth, upload.single('audio'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const file = await toFile(req.file.buffer, 'audio.webm', { type: 'audio/webm' });

      const transcription = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file,
      });

      res.json({ transcript: transcription.text });
    } catch (err) {
      console.error('Transcription error:', err);
      res.status(500).json({ error: 'Transcription failed' });
    }
  });

  return router;
};
