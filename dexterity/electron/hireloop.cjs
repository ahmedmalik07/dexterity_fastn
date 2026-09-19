/**
 * HireLoop bridge.
 *
 * Dexterity already sees the recruiter's screen. HireLoop already owns the hiring
 * pipeline and reaches Notion, email and Slack through Fastn. This module is the one
 * seam between them: it takes a capture Dexterity has already made and posts it to
 * HireLoop's /api/capture, which reads the candidate out of the image and files them.
 *
 * It exists because WhatsApp groups, Facebook groups and DMs have no API for anybody.
 * Fastn connects every service that has one; this covers the ones that do not.
 *
 * Self-contained on purpose: its own config file, no edits to Dexterity's settings.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_NAME = 'hireloop.json';
const TIMEOUT_MS = 60000;

function configPath(userDataDir) {
  return path.join(userDataDir, CONFIG_NAME);
}

/** Env wins, then the saved file, then a local default. */
function readConfig(userDataDir) {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(configPath(userDataDir), 'utf8'));
  } catch {
    /* not configured yet */
  }
  return {
    baseUrl: (process.env.HIRELOOP_URL || saved.baseUrl || 'http://localhost:3000').replace(/\/$/, ''),
    jobId: process.env.HIRELOOP_JOB || saved.jobId || '',
  };
}

function writeConfig(userDataDir, input) {
  const next = {
    baseUrl: String(input?.baseUrl || '').trim().replace(/\/$/, ''),
    jobId: String(input?.jobId || '').trim(),
  };
  if (next.baseUrl && !/^https?:\/\//.test(next.baseUrl)) {
    throw new Error('HireLoop address must start with http:// or https://');
  }
  if (next.jobId && !/^[a-z0-9-]{3,60}$/i.test(next.jobId)) {
    throw new Error('That job id does not look right.');
  }
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(configPath(userDataDir), JSON.stringify(next));
  return readConfig(userDataDir);
}

/** Build a multipart body by hand so this module needs no dependencies. */
function multipart(fields, image) {
  const boundary = '----dexterity' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const chunks = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="screen.png"\r\n` +
        'Content-Type: image/png\r\n\r\n',
    ),
    image,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );

  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Capture the screen before sending it to HireLoop.');
  return Buffer.from(match[1], 'base64');
}

/**
 * Send a capture to HireLoop.
 * `commit` false asks HireLoop to read the screen and report back without filing
 * anybody, so the recruiter can confirm first.
 */
async function sendCapture({ userDataDir, image, note = '', jobId = '', commit = true }) {
  const config = readConfig(userDataDir);
  const job = String(jobId || config.jobId || '').trim();

  if (!job) throw new Error('Set the HireLoop job id first.');

  const png = decodeDataUrl(image);
  if (png.length > 8 * 1024 * 1024) throw new Error('That screen capture is too large to send.');

  const { body, contentType } = multipart(
    { jobId: job, note: String(note || '').slice(0, 500), commit: String(!!commit) },
    png,
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/api/capture`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`HireLoop replied with something unexpected (${response.status}).`);
    }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `HireLoop refused the capture (${response.status}).`);
    }
    return payload.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('HireLoop did not answer in time.');
    if (error.cause?.code === 'ECONNREFUSED') {
      throw new Error(`Could not reach HireLoop at ${config.baseUrl}. Is it running?`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** One line a person can read, for the companion to speak or show. */
function describe(result) {
  if (!result) return 'HireLoop did not say anything back.';
  if (!result.capture?.found) return 'No candidate was visible on that screen.';

  const { name, channel, email } = result.capture;
  const where = channel && channel !== 'direct' ? ` from ${channel}` : '';

  if (result.reason === 'preview') {
    return `Found ${name}${where}${email ? ` (${email})` : ''}. Nothing has been sent yet.`;
  }
  if (result.added) {
    return `Added ${name}${where} to the hiring board${result.emailed ? ' and emailed them' : ''}.`;
  }
  return `Read ${name}${where}, but could not add them: ${result.error || 'unknown error'}.`;
}

module.exports = { readConfig, writeConfig, sendCapture, describe };
