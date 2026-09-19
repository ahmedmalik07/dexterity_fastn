/**
 * Publish module.
 *
 * One role, every platform, without leaving what you are doing. Dexterity can read the
 * role off the screen you are already looking at, write a version for each platform, and
 * publish the ones it can reach. Everything outbound goes through the HireLoop service,
 * which talks to Notion, Slack and email through Fastn connectors.
 */
(() => {
  const PLATFORMS = [
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'x', label: 'X', limit: 280 },
    { key: 'facebook', label: 'Facebook' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'discord', label: 'Discord' },
  ];

  let draft = null; // { jobId, job, variants }
  let active = 'linkedin';
  let working = false;

  const el = (id) => document.getElementById(id);

  function status(text, tone = '') {
    const node = el('publish-status');
    if (!node) return;
    node.textContent = text;
    node.dataset.tone = tone;
  }

  function busy(state) {
    working = state;
    for (const id of ['from-screen', 'write-post', 'publish-now']) {
      const button = el(id);
      if (button) button.disabled = state;
    }
  }

  function saveCurrent() {
    if (draft) draft.variants[active] = el('variant-text').value;
  }

  function renderTabs() {
    const tabs = el('platform-tabs');
    if (!tabs || !draft) return;
    tabs.replaceChildren();

    for (const platform of PLATFORMS) {
      const button = document.createElement('button');
      button.className = 'platform-tab' + (platform.key === active ? ' active' : '');
      button.textContent = platform.label;
      button.onclick = () => {
        saveCurrent();
        active = platform.key;
        renderTabs();
        renderVariant();
      };
      tabs.append(button);
    }
  }

  function renderVariant() {
    if (!draft) return;
    const box = el('variant-text');
    box.value = draft.variants[active] || '';

    const platform = PLATFORMS.find((item) => item.key === active);
    const hasLink = box.value.includes('{{APPLY_LINK}}');
    el('variant-meta').textContent =
      `${box.value.length}${platform && platform.limit ? ` / ${platform.limit}` : ' characters'} · ` +
      (hasLink ? 'apply link ready' : 'no apply link placeholder');
  }

  function showDraft(data) {
    draft = { jobId: data.jobId, job: data.job, variants: data.variants };
    active = 'linkedin';
    el('draft-panel').hidden = false;
    el('draft-title').textContent = data.job.title;
    el('draft-meta').textContent =
      `${data.job.location} · ${data.job.workMode} · ${data.job.salaryRange}`;
    renderTabs();
    renderVariant();
  }

  function showResult(result) {
    el('result-panel').hidden = false;
    el('result-line').textContent = result.message || '';

    const list = el('channel-list');
    list.replaceChildren();

    for (const channel of result.channels || []) {
      const row = document.createElement('div');
      row.className = 'channel-row';

      const name = document.createElement('strong');
      name.textContent = channel.channel;

      const state = document.createElement('span');
      state.className =
        'channel-state ' + (channel.ok ? 'ok' : channel.manual ? 'manual' : 'failed');
      state.textContent = channel.ok
        ? 'published'
        : channel.manual
          ? 'copy and paste'
          : channel.error || 'not connected';

      row.append(name, state);
      list.append(row);
    }

    // Whatever we could not post for them is handed over ready to paste.
    const copies = el('copy-list');
    copies.replaceChildren();
    const posted = new Set((result.channels || []).filter((c) => c.ok).map((c) => c.channel));

    for (const platform of PLATFORMS) {
      if (posted.has(platform.key)) continue;
      const text = result.variants && result.variants[platform.key];
      if (!text) continue;

      const button = document.createElement('button');
      button.className = 'secondary copy-button';
      button.textContent = `Copy for ${platform.label}`;
      button.onclick = async () => {
        await navigator.clipboard.writeText(text);
        button.textContent = `Copied ${platform.label}`;
        setTimeout(() => {
          button.textContent = `Copy for ${platform.label}`;
        }, 1600);
      };
      copies.append(button);
    }

    if (result.applyBaseUrl) {
      const link = document.createElement('a');
      link.className = 'copy-button apply-link';
      link.href = `${result.applyBaseUrl}?src=direct`;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Open the application page';
      copies.append(link);
    }
  }

  function wire() {
    const fromScreen = el('from-screen');
    if (!fromScreen) return; // page not present

    fromScreen.onclick = async () => {
      if (working) return;
      busy(true);
      status('Reading your screen…');
      try {
        const result = await window.dexterity.draftFromScreen({});
        if (!result.found || !result.oneLiner) {
          status(result.reason || 'No role was visible on that screen.', 'warn');
        } else {
          el('one-liner').value = result.oneLiner;
          status('Read from your screen. Edit it if you like, then write the post.', 'ok');
        }
      } catch (error) {
        status(error.message, 'warn');
      } finally {
        busy(false);
      }
    };

    el('write-post').onclick = async () => {
      if (working) return;
      const oneLiner = el('one-liner').value.trim();
      if (oneLiner.length < 8) return status('Describe the role in a few more words.', 'warn');

      busy(true);
      status('Writing the job post and a version for each platform…');
      try {
        showDraft(await window.dexterity.generatePost(oneLiner));
        status('Ready. Check each platform, then publish.', 'ok');
      } catch (error) {
        status(error.message, 'warn');
      } finally {
        busy(false);
      }
    };

    el('variant-text').oninput = () => {
      saveCurrent();
      renderVariant();
    };

    el('publish-now').onclick = async () => {
      if (working || !draft) return;
      saveCurrent();
      busy(true);
      status('Publishing through Fastn…');
      try {
        const result = await window.dexterity.sendPost(draft);
        showResult(result);
        status(result.message || 'Done.', 'ok');
      } catch (error) {
        status(error.message, 'warn');
      } finally {
        busy(false);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
