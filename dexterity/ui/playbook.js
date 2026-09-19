// A single place that teaches the whole flow: how to call Dexterity, what to say, and what comes back.
const PLAYBOOK = [
 { group: 'Understand anything on your screen', mode: 'answer', screen: true, rows: [
  ['What does this word mean?', 'Select the word first, or just say it. You get the meaning in context plus a short example.', 'Explain the selected word or passage in this context. Give a plain meaning and one short example.'],
  ['What am I looking at?', 'A plain description of the page or app in front of you, and what it is for.', 'Explain what I am looking at in simple terms, and what this screen is for.'],
  ['Translate this', 'Any visible text into English, or into another language you name.', 'Translate the visible text into English and explain what it means.'],
  ['Summarize this page', 'The three or four points that actually matter.', 'Summarize the visible content in three short points.'],
  ['What does this error mean?', 'The cause in plain words, then what to try.', 'Explain the error visible on my screen and what is most likely causing it.'],
  ['Is this safe to click?', 'A read of the dialog or link before you commit to it.', 'Read this dialog or message and tell me plainly what it will do if I continue.'],
 ]},
 { group: 'Learn how to do something', mode: 'teach', screen: true, rows: [
  ['Teach me this app', 'One step at a time beside your cursor, with a pointer at the control to use.', 'Teach me how to use this app. Start with the first useful action and explain why it matters.'],
  ['How do I do X here?', 'The next single step for the screen you are actually on, not a generic tutorial.', 'Walk me through doing this on my current screen, one step at a time.'],
  ['I did that, what next?', 'Choose "I have done that" and Dexterity rereads your screen before the next step.', 'I have done that step. Look at my updated screen, check my progress, and teach me the next step.'],
  ['Where is the setting for X?', 'A pointer at the control if it is visible, or how to reach it if it is not.', 'Find the setting I am asking about on this screen and show me where it is.'],
 ]},
 { group: 'Hand over a task', mode: 'do', screen: true, rows: [
  ['Fill this form', 'Dexterity types into the real fields, rereads them, and pauses before anything is submitted.', 'Fill this form with my details. Let me review before submitting.'],
  ['Fill it from my saved details', 'Uses the facts you enabled under My context. It never invents personal data.', 'Fill this form using my saved name and email. Let me review before submitting.'],
  ['Open a page and work there', 'Opens a tab in the browser window you are already signed into.', 'Open example.com in my current browser and tell me what is on the page.'],
  ['Tick these options for me', 'Checkboxes, dropdowns and links that expose accessible controls.', 'Set the options on this page the way I just described, and tell me what you changed.'],
 ]},
 { group: 'Ask without sharing your screen', mode: 'answer', screen: false, rows: [
  ['Explain a concept', 'Turn off "Use my screen" and ask anything. No capture is taken.', 'Explain compound interest with a simple example.'],
  ['Help me write something', 'Drafts, replies and rewrites, entirely from what you type or say.', 'Help me write a short, polite message asking for a deadline extension.'],
  ['Check my reasoning', 'Talk a decision through and get the holes in it.', 'I am about to make a decision. Ask me what you need, then tell me what I might be missing.'],
 ]},
];
document.querySelector('nav').insertAdjacentHTML('beforeend', '<button class="nav" id="playbook-nav" data-page="playbook"><span>◈</span>Playbook</button>');
document.querySelector('main').insertAdjacentHTML('beforeend', `<section id="playbook" class="page" hidden>
 <div class="eyebrow">SAY THIS, GET THAT</div><h1>One flow. Everything else is what you say.</h1>
 <p class="subtitle">Dexterity has a single loop. Learn it once and it covers every task below.</p>
 <div class="flow-strip">
  <div><b>1</b><strong>Open what you need help with</strong><p>A page, a form, an error, a new app. Leave it in front of you.</p></div>
  <div><b>2</b><strong>Call Dexterity</strong><p>Hold Ctrl for 3 seconds, triple-click, or click the cursor companion.</p></div>
  <div><b>3</b><strong>Say what you want</strong><p>Speak normally, then pause. Check the words it heard, then let it run.</p></div>
  <div><b>4</b><strong>It reads your screen</strong><p>Selected text and the real accessible controls, not only a picture.</p></div>
  <div><b>5</b><strong>Answer, lesson, or action</strong><p>In Do it, one action at a time, rereading the screen after each one.</p></div>
  <div><b>6</b><strong>You approve what matters</strong><p>Submit, send, pay and delete always stop for you first.</p></div>
 </div>
 <div id="playbook-groups"></div>
 <div class="playbook-notes">
  <div><h3>When it will stop and ask you</h3><ul>
   <li>Anything that submits, sends, pays, deletes or confirms. It shows the exact control and waits.</li>
   <li>Sign-in, passwords and CAPTCHA. Dexterity does not touch those.</li>
   <li>Two actions with no change on screen. It stops rather than looping.</li>
   <li>Eight actions in one task, or two minutes. It reports where it got to.</li>
   <li>An app with no accessible controls. It explains the limit instead of guessing at pixels.</li>
  </ul></div>
  <div><h3>If it misheard you</h3><ul>
   <li>Edit the text in the box it shows you. The countdown stops as soon as you type.</li>
   <li>Add your names, places and app names under Settings, "Words Dexterity keeps mishearing".</li>
   <li>Set your language to Urdu + English in Settings if you mix the two.</li>
   <li>Give yourself more thinking time with the longer pause setting.</li>
  </ul></div>
  <div><h3>What each task costs you</h3><ul>
   <li>Every task shows elapsed time, model requests, tokens and an estimated price.</li>
   <li>Answer and Teach me use one request. Do it adds a plan and a completion check.</li>
   <li>The action log lists each real action, with the verification result underneath.</li>
  </ul></div>
 </div>
</section>`);
for (const section of PLAYBOOK) {
 const block = document.createElement('div'); block.className = 'playbook-group';
 const heading = document.createElement('h3'); heading.textContent = section.group;
 const badge = document.createElement('span'); badge.className = 'playbook-mode';
 badge.textContent = (section.mode === 'do' ? 'Do it' : section.mode === 'teach' ? 'Teach me' : 'Answer') + (section.screen ? ' · uses your screen' : ' · no screen needed');
 heading.append(badge); block.append(heading);
 for (const [title, effect, prompt] of section.rows) {
  const row = document.createElement('button'); row.type = 'button'; row.className = 'playbook-row';
  const left = document.createElement('div'); const say = document.createElement('strong'); say.textContent = title;
  const what = document.createElement('p'); what.textContent = effect; left.append(say, what);
  const use = document.createElement('span'); use.className = 'playbook-use'; use.textContent = 'Load this ↗';
  row.append(left, use);
  row.onclick = () => {
   openAssistant(); chooseTaskMode(section.mode);
   $('task-goal').value = prompt; $('task-screen').checked = section.screen; $('task-screen').onchange(); $('task-goal').focus();
   toast('Loaded. Edit it if you like, then start the task.');
  };
  block.append(row);
 }
 $('playbook-groups').append(block);
}
$('playbook-nav').onclick = () => showPage('playbook');
