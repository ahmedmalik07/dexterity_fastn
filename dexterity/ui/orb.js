document.getElementById('open').onclick = () => window.dexterity.listen().catch(() => window.dexterity.open());
document.getElementById('open').oncontextmenu = e => { e.preventDefault(); window.dexterity.orbMenu(); };
document.body.onmouseenter = () => window.dexterity.holdCompanion(true);
document.body.onmouseleave = () => window.dexterity.holdCompanion(false);
