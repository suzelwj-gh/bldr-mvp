const express = require('express');
const OpenAI = require('openai');
const { requireAuth } = require('../middleware/auth');
const FormData = require('form-data');
const fetch = require('node-fetch');

module.exports = (upload) => {
  const router = express.Router();

  router.post('/', requireAuth, (req, res, next) => {
    upload.single('audio')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Audio file too large (max 25MB). Try a shorter recording.' });
        }
        console.error('Audio upload error:', err);
        return res.status(400).json({ error: 'Audio upload failed' });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    try {
      console.log(`Transcribe upload: ${req.file.size} bytes, ${req.file.mimetype}`);
      const form = new FormData();
      form.append('file', req.file.buffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });
      form.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        body: form,
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Whisper API error:', data);
        return res.status(500).json({ error: 'Transcription failed' });
      }

      res.json({ transcript: data.text });
    } catch (err) {
      console.error('Transcription error:', err);
      res.status(500).json({ error: 'Transcription failed' });
    }
  });

  return router;
};
