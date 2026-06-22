/* ============================================================
   linuxbyOBA — main.js
   Features: sidebar scroll-spy, search, modal, mobile toggle
   ============================================================ */
(function () {
  'use strict';

  /* ---------- DOM refs ---------- */
  const sidebar         = document.getElementById('sidebar');
  const menuToggle      = document.getElementById('menuToggle');
  const cmdIndex        = document.getElementById('cmd-index');
  const modalOverlay    = document.getElementById('modalOverlay');
  const modalClose      = document.getElementById('modalClose');
  const modalCmd        = document.getElementById('modalCmd');
  const terminalCmd     = document.getElementById('terminalCmdDisplay');
  const terminalOutput  = document.getElementById('terminalOutput');
  const copyBtn         = document.getElementById('copyCmd');
  const navLinks        = document.querySelectorAll('.nav-link[data-section]');
  const searchInput     = document.getElementById('searchInput');
  const searchClear     = document.getElementById('searchClear');
  const mobileSearchBtn = document.getElementById('mobileSearchBtn');
  const mobileSearchBar = document.getElementById('mobileSearchBar');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const mobileSearchClear = document.getElementById('mobileSearchClear');
  const searchResults   = document.getElementById('searchResults');
  const srCards         = document.getElementById('srCards');
  const srEmpty         = document.getElementById('srEmpty');
  const srLabel         = document.getElementById('srLabel');
  const srClearBtn      = document.getElementById('srClearBtn');

  /* ============================================================
     1. BUILD COMMAND INDEX
     ============================================================ */
  function buildCmdIndex() {
    const cards = document.querySelectorAll('.cmd-card[id]');
    cards.forEach(card => {
      const sectionEl = card.closest('.cmd-section');
      const level     = sectionEl ? sectionEl.dataset.level : '';
      const cmdName   = card.querySelector('.cmd-name');
      if (!cmdName) return;
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href          = `#${card.id}`;
      a.textContent   = cmdName.textContent.trim();
      a.className     = 'nav-link cmd-index-link';
      a.dataset.cmdId = card.id;
      a.dataset.level = level;
      li.appendChild(a);
      cmdIndex.appendChild(li);
    });
  }
  buildCmdIndex();

  /* ============================================================
     2. SCROLL-SPY
     ============================================================ */
  const sections = document.querySelectorAll('.cmd-section[id]');
  const cmdCards = document.querySelectorAll('.cmd-card[id]');

  function getScrollMid() { return window.scrollY + window.innerHeight * 0.35; }

  function updateActiveSection() {
    const mid = getScrollMid();
    let active = null;
    sections.forEach(s => { if (s.offsetTop <= mid) active = s; });
    navLinks.forEach(link => {
      link.classList.toggle('active', !!(active && link.dataset.section === active.id));
    });
  }

  function updateActiveCmd() {
    const mid = getScrollMid();
    let active = null;
    cmdCards.forEach(c => { if (c.offsetTop <= mid) active = c; });
    document.querySelectorAll('.cmd-index-link').forEach(link => {
      link.classList.toggle('active-cmd', !!(active && link.dataset.cmdId === active.id));
    });
  }

  window.addEventListener('scroll', () => { updateActiveSection(); updateActiveCmd(); }, { passive: true });
  updateActiveSection(); updateActiveCmd();

  /* ============================================================
     3. MOBILE SIDEBAR TOGGLE
     ============================================================ */
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const openSidebar  = () => { sidebar.classList.add('open'); backdrop.classList.add('visible'); document.body.style.overflow='hidden'; };
  const closeSidebar = () => { sidebar.classList.remove('open'); backdrop.classList.remove('visible'); document.body.style.overflow=''; };

  menuToggle.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  backdrop.addEventListener('click', closeSidebar);
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { if (window.innerWidth<=768) closeSidebar(); }));

  /* ============================================================
     4. SEARCH
     ============================================================ */

  // Natural language keyword map — maps plain English phrases to command names
  const NL_MAP = [
    { phrases: ['create file','make file','new file','empty file','how to create a file','make a new file'],   cmds: ['touch','echo'] },
    { phrases: ['create folder','make folder','make directory','new directory','new folder'],                   cmds: ['mkdir'] },
    { phrases: ['delete file','remove file','delete folder','erase'],                                           cmds: ['rm'] },
    { phrases: ['copy file','duplicate','backup file','clone'],                                                 cmds: ['cp'] },
    { phrases: ['move file','rename file','rename','relocate'],                                                 cmds: ['mv'] },
    { phrases: ['list files','show files','view folder','what is in','directory contents'],                      cmds: ['ls'] },
    { phrases: ['where am i','current location','current directory','my location'],                             cmds: ['pwd'] },
    { phrases: ['go to folder','navigate','change directory','move into'],                                      cmds: ['cd'] },
    { phrases: ['find file','locate file','search file','look for file'],                                       cmds: ['find'] },
    { phrases: ['search text','find text','search inside file','find word','look for word'],                     cmds: ['grep'] },
    { phrases: ['read file','view file','print file','show file content'],                                      cmds: ['cat','head','tail'] },
    { phrases: ['count lines','word count','how many lines','count words'],                                     cmds: ['wc'] },
    { phrases: ['first lines','top of file','beginning of file','preview file'],                                cmds: ['head'] },
    { phrases: ['last lines','end of file','follow log','live log','monitor log'],                              cmds: ['tail'] },
    { phrases: ['sort lines','alphabetical order','order output'],                                              cmds: ['sort'] },
    { phrases: ['pipe','combine commands','chain commands','filter output'],                                    cmds: ['|  (pipe)'] },
    { phrases: ['permissions','make executable','read write execute','chmod'],                                  cmds: ['chmod'] },
    { phrases: ['change owner','file ownership','chown'],                                                      cmds: ['chown'] },
    { phrases: ['running processes','cpu usage','memory usage','task manager','monitor processes'],              cmds: ['top','ps'] },
    { phrases: ['kill process','stop process','terminate','end process'],                                       cmds: ['kill'] },
    { phrases: ['open ports','listening','network connections','socket'],                                       cmds: ['ss'] },
    { phrases: ['disk space','free space','storage','how much space'],                                         cmds: ['df'] },
    { phrases: ['folder size','directory size','disk usage','how much space does folder'],                      cmds: ['du'] },
    { phrases: ['schedule task','automate','cron','timer','repeat task','run automatically'],                    cmds: ['crontab'] },
    { phrases: ['remote login','connect server','ssh','secure shell'],                                          cmds: ['ssh'] },
    { phrases: ['http request','download','api','web request','fetch url'],                                     cmds: ['curl'] },
    { phrases: ['print text','output text','write to file','display string'],                                   cmds: ['echo'] },
  ];

  function resolveNLQuery(q) {
    const lower = q.toLowerCase().trim();
    for (const entry of NL_MAP) {
      if (entry.phrases.some(p => lower.includes(p))) {
        return entry.cmds;
      }
    }
    return null;
  }

  function highlightText(text, query) {
    if (!query) return text;
    const words = query.trim().split(/\s+/).filter(w => w.length > 1);
    if (!words.length) return text;
    const esc = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return text.replace(new RegExp(`(${esc})`, 'gi'), '<mark class="search-highlight">$1</mark>');
  }

  function doSearch(query) {
    const q = query.trim();

    // Sync both inputs
    if (searchInput)      searchInput.value = q;
    if (mobileSearchInput) mobileSearchInput.value = q;

    // Toggle clear buttons
    if (searchClear)      searchClear.hidden = !q;
    if (mobileSearchClear) mobileSearchClear.hidden = !q;

    if (!q) {
      clearSearch();
      return;
    }

    // Collect all cards + their searchable text
    const allCards = Array.from(document.querySelectorAll('.cmd-card[id]'));

    // Try natural language first
    const nlMatches = resolveNLQuery(q);

    let matches = [];

    if (nlMatches) {
      // NL matched — find cards whose cmd-name is in the list
      matches = allCards.filter(card => {
        const name = (card.querySelector('.cmd-name')?.textContent || '').trim().toLowerCase();
        return nlMatches.some(m => name.includes(m.toLowerCase()));
      });
    }

    if (!matches.length) {
      // Fall back to keyword/full-text search
      const qLower = q.toLowerCase();
      const words  = qLower.split(/\s+/).filter(Boolean);
      matches = allCards.filter(card => {
        const searchable = [
          card.querySelector('.cmd-name')?.textContent || '',
          card.querySelector('.cmd-desc')?.textContent || '',
          card.dataset.keywords || '',
          card.querySelector('.flags-table')?.textContent || '',
          card.querySelector('.cmd-examples')?.textContent || '',
        ].join(' ').toLowerCase();
        return words.every(w => searchable.includes(w));
      });
    }

    // Show results panel
    searchResults.hidden = false;
    srCards.innerHTML = '';
    srLabel.textContent = `// ${matches.length} result${matches.length !== 1 ? 's' : ''} for "${q}"`;

    if (!matches.length) {
      srEmpty.hidden = false;
    } else {
      srEmpty.hidden = true;
      matches.forEach(card => {
        const clone = card.cloneNode(true);
        // Highlight matching text in clone
        const desc = clone.querySelector('.cmd-desc');
        if (desc) desc.innerHTML = highlightText(desc.innerHTML, q);
        // Re-wire Try It buttons in clone
        clone.querySelectorAll('.try-btn').forEach(btn => {
          btn.addEventListener('click', () => openModal(btn.dataset.cmd || 'ls'));
        });
        // Jump to real card on click of cmd name
        const nameEl = clone.querySelector('.cmd-name');
        if (nameEl) {
          nameEl.style.cursor = 'pointer';
          nameEl.title = 'Jump to full entry';
          nameEl.addEventListener('click', () => {
            clearSearch();
            const target = document.getElementById(card.id);
            if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          });
        }
        srCards.appendChild(clone);
      });
    }

    // Hide main sections while searching
    document.querySelectorAll('.cmd-section').forEach(s => s.style.display = 'none');
  }

  function clearSearch() {
    if (searchInput)       searchInput.value = '';
    if (mobileSearchInput) mobileSearchInput.value = '';
    if (searchClear)       searchClear.hidden = true;
    if (mobileSearchClear) mobileSearchClear.hidden = true;
    searchResults.hidden = true;
    srCards.innerHTML = '';
    srEmpty.hidden = true;
    document.querySelectorAll('.cmd-section').forEach(s => s.style.display = '');
  }

  // Debounce
  let searchTimer;
  function debouncedSearch(val) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(val), 200);
  }

  if (searchInput) {
    searchInput.addEventListener('input', e => debouncedSearch(e.target.value));
    searchInput.addEventListener('keydown', e => { if (e.key==='Escape') clearSearch(); });
  }
  if (searchClear) searchClear.addEventListener('click', clearSearch);
  if (srClearBtn)  srClearBtn.addEventListener('click', clearSearch);

  // Mobile search bar
  if (mobileSearchBtn) {
    mobileSearchBtn.addEventListener('click', () => {
      mobileSearchBar.classList.toggle('visible');
      if (mobileSearchBar.classList.contains('visible')) {
        mobileSearchInput.focus();
        document.querySelector('.content')?.classList.add('search-open');
      } else {
        document.querySelector('.content')?.classList.remove('search-open');
        clearSearch();
      }
    });
  }
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', e => debouncedSearch(e.target.value));
    mobileSearchInput.addEventListener('keydown', e => { if(e.key==='Escape') clearSearch(); });
  }
  if (mobileSearchClear) mobileSearchClear.addEventListener('click', clearSearch);

  /* ============================================================
     5. TRY IT MODAL
     ============================================================ */
  let currentCmd = '';

  const simulatedOutputs = {
    'ls':      'Documents/  Downloads/  Music/  Pictures/  projects/\n.bashrc  .profile  .ssh/',
    'cd':      '(directory changed — no output)',
    'pwd':     '/home/user',
    'touch':   '(empty file created — no output)',
    'mkdir':   '(directory created — no output)',
    'cp':      "'/etc/hostname' -> './hostname_copy'",
    'mv':      "renamed 'oldname.txt' -> 'newname.txt'",
    'rm':      "rm: remove regular file 'testfile.txt'?",
    'echo':    'Hello from Linux!',
    'grep':    'root:x:0:0:root:/root:/bin/bash',
    'cat':     'myhost',
    'find':    '/etc/apt/apt.conf\n/etc/resolv.conf\n/etc/nsswitch.conf',
    'wc':      '     45    88   2397 /etc/passwd',
    'sort':    'apt.conf\nbash.bashrc\nenvironment\nhostname',
    'head':    'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
    'tail':    'ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash',
    'chmod':   '-rwxr-xr-x 1 user user 128 Jun 15 12:00 myscript.sh',
    'chown':   'total 8\ndrwxr-xr-x 2 www-data www-data 4096 Jun 15 /var/www/html',
    'top':     'top - 12:00:01 up 3 days, 2:15,  1 user\nTasks: 142 total, 1 running, 141 sleeping\n%Cpu(s):  1.2 us,  0.4 sy',
    'ps':      'USER       PID %CPU %MEM    VSZ   RSS COMMAND\nroot         1  0.0  0.3  168936 12860 /sbin/init',
    'kill':    'HUP INT QUIT ILL TRAP ABRT BUS FPE KILL USR1 SEGV USR2 PIPE ALRM TERM',
    'ss':      'State   Recv-Q  Send-Q   Local Address:Port\nLISTEN  0       128      0.0.0.0:22\nLISTEN  0       511      0.0.0.0:80',
    'df':      'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   12G   36G  25% /',
    'du':      '4.2M\t/etc',
    'crontab': '(no crontab for user — no output)',
    'ssh':     'OpenSSH_8.9p1 Ubuntu-3ubuntu0.6, OpenSSL 3.0.2',
    'curl':    '{"current_user_url":"https://api.github.com/user",...}',
  };

  function getSimulatedOutput(cmd) {
    const first = cmd.trim().split(/\s+/)[0];
    return simulatedOutputs[first] || '(output would appear here)';
  }

  function openModal(cmd) {
    currentCmd = cmd;
    modalCmd.textContent = cmd;
    terminalCmd.textContent = cmd;
    terminalOutput.textContent = getSimulatedOutput(cmd);
    copyBtn.textContent = 'Copy Command';
    copyBtn.classList.remove('copied');
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.try-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.cmd || 'ls'));
  });

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  copyBtn.addEventListener('click', () => {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = currentCmd;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    };
    (navigator.clipboard ? navigator.clipboard.writeText(currentCmd) : Promise.reject())
      .catch(fallback)
      .finally(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.textContent = 'Copy Command'; copyBtn.classList.remove('copied'); }, 2000);
      });
  });

})();
