const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function buildPDF(user, notes) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100;
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Header
    doc.rect(0, 0, doc.page.width, 90).fill('#1B2E4B');
    doc.fontSize(26).fillColor('#E8651A').font('Helvetica-Bold').text('BLDR', 50, 20);
    doc.fontSize(10).fillColor('white').font('Helvetica').text('Daily Field Report', 50, 50);
    doc.fontSize(10).fillColor('white').text(today, 50, 65);
    doc.fontSize(10).fillColor('white').font('Helvetica-Bold')
       .text(user.name, 0, 30, { align: 'right', width: doc.page.width - 50 });
    doc.fontSize(10).fillColor('white').font('Helvetica')
       .text(user.project, 0, 46, { align: 'right', width: doc.page.width - 50 });

    // Summary boxes
    const typeCounts = {};
    notes.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });
    const summaryY = 110;
    const boxW = pageWidth / 4;
    const types = ['issue', 'progress', 'rfi', 'other'];
    const labels = { issue: 'Issues', progress: 'Progress', rfi: 'RFIs', other: 'Other' };
    const colors = { issue: '#DC2626', progress: '#16A34A', rfi: '#1B2E4B', other: '#4B5563' };

    types.forEach((type, i) => {
      const x = 50 + i * boxW;
      const count = typeCounts[type] || 0;
      doc.rect(x, summaryY, boxW - 4, 54).fill(count > 0 ? colors[type] : '#F5F6F8');
      doc.fontSize(24).fillColor(count > 0 ? 'white' : '#4B5563').font('Helvetica-Bold')
         .text(String(count), x, summaryY + 6, { width: boxW - 4, align: 'center' });
      doc.fontSize(9).fillColor(count > 0 ? 'white' : '#4B5563').font('Helvetica')
         .text(labels[type], x, summaryY + 36, { width: boxW - 4, align: 'center' });
    });

    let y = summaryY + 74;

    // Notes by type
    const typeOrder = ['issue', 'progress', 'rfi'];
    const sectionLabels = { issue: 'ISSUES', progress: 'PROGRESS NOTES', rfi: 'RFIs' };

    for (const type of typeOrder) {
      const typeNotes = notes.filter(n => n.type === type);
      if (typeNotes.length === 0) continue;

      if (y > doc.page.height - 150) { doc.addPage(); y = 50; }

      doc.rect(50, y, pageWidth, 22).fill('#1B2E4B');
      doc.fontSize(10).fillColor('white').font('Helvetica-Bold')
         .text(sectionLabels[type], 58, y + 6);
      y += 30;

      for (const note of typeNotes) {
        if (y > doc.page.height - 200) { doc.addPage(); y = 50; }

        const s = note.structured || {};
        const time = new Date(note.createdAt || note.created_at)
          .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        doc.rect(50, y, pageWidth, 2).fill('#F5F6F8');
        y += 6;

        doc.fontSize(8).fillColor('#4B5563').font('Helvetica').text(time, 50, y);
        if (s.area) doc.fontSize(8).fillColor('#4B5563').text(`  ${s.area}`, 110, y);

        if (type === 'issue' && s.priority) {
          const badgeColor = s.priority === 'HIGH' ? '#DC2626' : s.priority === 'MEDIUM' ? '#D97706' : '#16A34A';
          doc.rect(doc.page.width - 100, y - 1, 50, 1