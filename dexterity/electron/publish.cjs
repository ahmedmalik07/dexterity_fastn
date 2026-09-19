/**
 * Publish module.
 *
 * The companion already sees what you are working on. So when the thing you are looking
 * at is a role you need to fill, you should not have to screenshot it, open a chat bot,
 * retype the role, then paste the result into five different sites.
 *
 * This module does the whole loop from inside Dexterity:
 *   draft from the screen  ->  write a version per platform  ->  publish through Fastn
 *
 * Everything that leaves the machine goes through the HireLoop service, which reaches
 * Notion, Slack and email through Fastn connectors. No platform tokens live in here.
 */

const { readConfig } = require('./hireloop.cjs');

const TIMEOUT_MS = 90000;

async function request(userDataDir, path, { method = 'POST', json, form } = {}) {
  const { baseUrl } = readConfig(userDataDir);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: json ? { 'content-type': 'application/json' } : undefined,
      body: json ? JSON.stringify(json) : form,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`The publishing service replied oddly (${response.status}).`);
    }
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `The publishing service refused that (${response.status}).`);
    }
    return payload.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The publishing service did not answer in time.');
    if (error.cause?.code === 'ECONNREFUSED') {
      const { baseUrl } = readConfig(userDataDir);
      throw new Error(`Could not reach the publishing service at ${baseUrl}. Is it running?`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function pngFromDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Capture your screen first.');
  return Buffer.from(match[1], 'base64');
}

/** Build a multipart body without pulling in a dependency. */
function multipart(fields, image) {
  const boundary = '----dexterity' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const chunks = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
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

/** Read the role off the screen the user is already looking at. */
async function draftFromScreen({ userDataDir, image, note = '' }) {
  const png = pngFromDataUrl(image);
  const { body, contentType } = multipart({ note: String(note).slice(0, 500) }, png);

  const { baseUrl } = readConfig(userDataDir);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/from-screen`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
      signal: controller.signal,
    });
    const payload = JSON.parse(await response.text());
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not read that screen.');
    return payload.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Reading the screen took too long.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** One line in, a full job post and a version per platform out. */
function generate({ userDataDir, oneLiner }) {
  const line = String(oneLiner || '').trim();
  if (line.length < 8) throw new Error('Describe the role in a few more words.');
  return request(userDataDir, '/api/generate', { json: { oneLiner: line } });
}

/** Publish everywhere that has a connector; hand back the rest ready to paste. */
function publish({ userDataDir, jobId, job, variants }) {
  if (!jobId || !job || !variants) throw new Error('Generate the post before publishing it.');
  return request(userDataDir, '/api/publish', { json: { jobId, job, variants } });
}

/** One plain line the companion can speak or show. */
function describe(result) {
  if (!result) return 'Nothing came back from the publishing service.';

  const posted = (result.channels || []).filter((channel) => channel.ok).map((c) => c.channel);
  const manual = (result.channels || []).filter((channel) => channel.manual).map((c) => c.channel);

  const parts = [];
  if (posted.length) parts.push(`Published to ${posted.join(', ')}`);
  if (manual.length) parts.push(`${manual.join(', ')} are ready to paste`);

  return parts.length ? `${parts.join('. ')}.` : 'The job was saved, but no channel accepted it.';
}

module.exports = { draftFromScreen, generate, publish, describe };
