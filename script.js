function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function activateSection(targetId) {
  const section = document.getElementById(targetId);
  if (!section) return false;

  $all(".nav-link").forEach((l) => l.classList.remove("active"));
  $all(".content-section").forEach((s) => s.classList.remove("active"));

  const link = $(`.nav-link[href="#${targetId}"]`);
  if (link) link.classList.add("active");
  section.classList.add("active");

  // When switching sections, show the new content (especially helpful on mobile).
  const scroller = $(".terminal-content");
  if (scroller) scroller.scrollTop = 0;

  // Keep the URL hash in sync (nice for refresh/share)
  history.replaceState(null, "", `#${targetId}`);

  if (targetId === "videos") {
    processInstagramEmbeds();
    processTikTokEmbeds();
  }
  return true;
}

function processInstagramEmbeds() {
  // Instagram embeds are processed by https://www.instagram.com/embed.js
  // If the script is loaded, this will turn <blockquote class="instagram-media"> into embeds.
  try {
    if (
      window.instgrm &&
      window.instgrm.Embeds &&
      window.instgrm.Embeds.process
    ) {
      window.instgrm.Embeds.process();
    }
  } catch {
    // no-op
  }
}

function processTikTokEmbeds() {
  // TikTok embed.js finds <blockquote class="tiktok-embed"> and replaces it.
  // Some versions expose a global render function; if not, loading the script is usually enough.
  try {
    if (window.tiktokEmbed && typeof window.tiktokEmbed.init === "function") {
      window.tiktokEmbed.init();
    }
  } catch {
    // no-op
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeInto(el, text, { minDelay = 32, maxDelay = 68 } = {}) {
  if (!el) return;

  el.classList.add("boot-typing");
  el.textContent = "";

  for (let i = 0; i < text.length; i += 1) {
    el.textContent += text[i];

    // Show the first character immediately so we never display a blank prompt line.
    if (i === 0) continue;

    const jitter =
      Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await sleep(jitter);
  }

  el.classList.remove("boot-typing");
}

function hideEl(el) {
  if (!el) return;
  el.classList.add("boot-hidden");
}

function showEl(el) {
  if (!el) return;
  el.classList.remove("boot-hidden");
  el.classList.add("boot-fade-in");
  // Remove animation class after it runs so reflows don't retrigger it.
  setTimeout(() => el.classList.remove("boot-fade-in"), 260);
}

async function runBootSequence() {
  const home = document.querySelector('section[data-boot="home"]');
  if (!home) return;

  document.body.classList.add("booting");

  const cli = document.getElementById("cli");
  const shouldRestoreFocus = document.activeElement !== cli;
  if (cli) {
    cli.disabled = true;
    cli.setAttribute("aria-disabled", "true");
  }

  const steps = Array.from(home.querySelectorAll(".command-line.boot-step"));
  const pairs = steps
    .map((cmdLine) => {
      const commandEl = cmdLine.querySelector(".command");
      const outputEl = cmdLine.nextElementSibling;
      if (!commandEl || !outputEl || !outputEl.classList.contains("output"))
        return null;
      return {
        cmdLine,
        commandEl,
        commandText: commandEl.textContent || "",
        outputEl,
      };
    })
    .filter(Boolean);

  // Prep: hide prompts+outputs and clear commands for typing.
  pairs.forEach(({ cmdLine, commandEl, outputEl }) => {
    hideEl(cmdLine);
    hideEl(outputEl);
    commandEl.textContent = "";
  });

  // Now that everything is explicitly hidden, allow rendering.
  document.documentElement.classList.remove("boot-prep");

  try {
    // Slight pause like a terminal coming alive.
    await sleep(420);

    for (const { cmdLine, commandEl, commandText, outputEl } of pairs) {
      // Show the prompt and start typing immediately (no blank prompt-only frame).
      showEl(cmdLine);
      await typeInto(commandEl, commandText);

      // Small "thinking" pause before showing output.
      // Keep the cursor blinking at end of command during this pause.
      commandEl.classList.add("boot-typing");
      if (commandText.trim() === "cat ~/profile.txt") {
        await sleep(900);
      } else {
        await sleep(260);
      }
      commandEl.classList.remove("boot-typing");
      showEl(outputEl);
      await sleep(520);
    }
  } finally {
    if (cli) {
      cli.disabled = false;
      cli.removeAttribute("aria-disabled");
    }

    if (cli && shouldRestoreFocus) {
      cli.focus();
    }

    document.body.classList.remove("booting");
  }
}

function appendRuntimeEntry(commandText, outputLines = []) {
  const log = $("#runtime-log");
  if (!log) return;

  const wrapper = document.createElement("div");
  wrapper.className = "runtime-entry";

  const cmdLine = document.createElement("div");
  cmdLine.className = "command-line";
  cmdLine.innerHTML = `
    <span class="promptline" aria-hidden="true">
      <span class="ansi ansi-green">jimcircuit</span><span class="ansi ansi-fg">@</span><span class="ansi ansi-green">web</span><span class="ansi ansi-fg">:</span><span class="ansi ansi-blue">~</span><span class="ansi ansi-fg">$</span>
    </span>
    <span class="command"></span>
  `;
  cmdLine.querySelector(".command").textContent = commandText;
  wrapper.appendChild(cmdLine);

  if (outputLines.length > 0) {
    const out = document.createElement("div");
    out.className = "output";
    out.innerHTML = outputLines.map((line) => `<p>${line}</p>`).join("");
    wrapper.appendChild(out);
  }

  log.appendChild(wrapper);

  // Keep the newest entry visible
  const scroller = $(".terminal-content");
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}

function clearRuntimeLog() {
  const log = $("#runtime-log");
  if (log) log.innerHTML = "";
}

function runCommand(rawInput) {
  const input = rawInput.trim();
  if (!input) return;

  const [cmd, ...args] = input.split(/\s+/);
  const command = cmd.toLowerCase();

  const routeAliases = {
    h: "home",
    a: "about",
    v: "videos",
    s: "shop",
    reels: "videos",
  };

  const route = routeAliases[command] || command;
  if (["home", "about", "videos", "shop"].includes(route)) {
    appendRuntimeEntry(input);
    activateSection(route);
    return;
  }

  if (command === "help") {
    appendRuntimeEntry(input, [
      "Commands:",
      "  home | about | videos | shop",
      "  clear  (clears the session output)",
      "  reels  (alias for videos)",
      "  s      (alias for shop)",
      "Tip: click the pills above or type commands here.",
    ]);
    return;
  }

  if (command === "clear") {
    clearRuntimeLog();
    return;
  }

  if (command === "echo") {
    appendRuntimeEntry(input, [args.join(" ") || ""]);
    return;
  }

  appendRuntimeEntry(input, [
    `Command not found: ${command}`,
    "Type help to see available commands.",
  ]);
}

document.addEventListener("DOMContentLoaded", () => {
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // Nav click support
  $all(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("href").slice(1);
      if (activateSection(target)) {
        const cli = $("#cli");
        // On mobile/touch, focusing the input jumps the page and opens the keyboard.
        if (cli && !isCoarsePointer) cli.focus();
      }
    });
  });

  // Deep link support
  const initial = (location.hash || "#home").slice(1);
  if (!activateSection(initial)) {
    activateSection("home");
  }

  // Boot animation on first load (Home only)
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const alreadyBooted = sessionStorage.getItem("jc_booted") === "1";
  const forceBoot = new URLSearchParams(location.search).get("boot") === "1";
  const navEntry = performance.getEntriesByType("navigation")[0];
  const isReload = navEntry && navEntry.type === "reload";
  const shouldBoot =
    !reduceMotion &&
    initial === "home" &&
    (forceBoot || isReload || !alreadyBooted);

  let bootScheduled = false;
  if (shouldBoot) {
    bootScheduled = true;
    // Run after layout is settled to avoid jumps.
    setTimeout(() => {
      runBootSequence()
        .then(() => {
          sessionStorage.setItem("jc_booted", "1");
        })
        .catch(() => {
          // If boot fails, don't permanently suppress it.
          sessionStorage.removeItem("jc_booted");
        });
    }, 80);
  }

  // If we are not booting, show everything immediately.
  if (!shouldBoot) {
    document.documentElement.classList.remove("boot-prep");
  }

  // If we load directly into videos, ensure embeds are processed.
  if (initial === "videos") {
    setTimeout(() => processInstagramEmbeds(), 150);
  }

  // CLI input
  const cli = $("#cli");
  if (cli) {
    cli.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const value = cli.value;
        cli.value = "";
        runCommand(value);
      }
    });

    // Autofocus like a terminal (but don't fight the boot sequence)
    // Avoid auto-opening the keyboard on touch devices.
    if (!bootScheduled && !isCoarsePointer) {
      setTimeout(() => cli.focus(), 50);
    }
  }
});

// Easter egg: konami code
const konamiCode = [];
const konamiSequence = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

document.addEventListener("keydown", (e) => {
  konamiCode.push(e.key);
  konamiCode.splice(-konamiSequence.length - 1);

  if (konamiCode.join(",").includes(konamiSequence.join(","))) {
    triggerEasterEgg();
  }
});

function triggerEasterEgg() {
  const terminalContent = document.querySelector(".terminal-content");
  terminalContent.style.animation = "glitch 0.3s ease-in-out 3";

  const matrix = document.createElement("div");
  matrix.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        color: #00ff00;
        font-family: monospace;
        font-size: 14px;
        overflow: hidden;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    `;
  matrix.textContent = "[ EASTER EGG ACTIVATED ] Welcome, curious explorer!";
  document.body.appendChild(matrix);

  setTimeout(() => matrix.remove(), 3000);
}

// Add glitch animation to stylesheet
const style = document.createElement("style");
style.textContent = `
    @keyframes glitch {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        50% { transform: translateX(5px); }
        75% { transform: translateX(-5px); }
    }
`;
document.head.appendChild(style);
