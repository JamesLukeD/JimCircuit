function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setSectionUrl(targetId) {
  const url = new URL(window.location.href);
  url.hash = `#${targetId}`;

  // Only keep the post query param while in the blog.
  if (targetId !== "blog") {
    url.searchParams.delete("post");
  }

  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function setBlogPostUrl(slug) {
  const url = new URL(window.location.href);
  url.hash = "#blog";
  if (slug) url.searchParams.set("post", slug);
  else url.searchParams.delete("post");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function upsertMetaTag(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertPropertyTag(property, content) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href) {
  if (!href) return;
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setPageMeta({ title, description, canonicalUrl } = {}) {
  if (title) document.title = title;
  if (description) {
    upsertMetaTag("description", description);
    upsertPropertyTag("og:description", description);
    upsertMetaTag("twitter:description", description);
  }
  if (title) {
    upsertPropertyTag("og:title", title);
    upsertMetaTag("twitter:title", title);
  }
  if (canonicalUrl) {
    upsertCanonical(canonicalUrl);
    upsertPropertyTag("og:url", canonicalUrl);
  }
}

function setStructuredDataBlogPosting(post, canonicalUrl) {
  const existing = document.getElementById("schema-post");
  if (existing) existing.remove();
  if (!post) return;

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "schema-post";

  const payload = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.date || undefined,
    description: post.summary || undefined,
    url: canonicalUrl || undefined,
    keywords: Array.isArray(post.keywords)
      ? post.keywords.join(", ")
      : Array.isArray(post.tags)
        ? post.tags.join(", ")
        : undefined,
    author: {
      "@type": "Person",
      name: "JimCircuit",
    },
  };

  script.textContent = JSON.stringify(payload);
  document.head.appendChild(script);
}

function normalizeTag(tag) {
  return String(tag || "").trim();
}

function uniqueTagsFromPosts(posts) {
  const out = new Set();
  (posts || []).forEach((p) => {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    tags
      .map(normalizeTag)
      .filter(Boolean)
      .forEach((t) => out.add(t));
  });
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

function getSiteBaseUrl() {
  // Prefer canonical if present; fallback to current origin.
  const canonical = document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute("href");
  try {
    if (canonical) return new URL(canonical).origin;
  } catch {
    // ignore
  }
  return window.location.origin;
}

function buildPostCanonicalUrl(slug) {
  const base = getSiteBaseUrl();
  const url = new URL(window.location.href);
  url.searchParams.set("post", slug);
  url.hash = "#blog";
  // Use base origin + current path so it works on GitHub Pages subpaths too.
  return `${base}${window.location.pathname}${url.search}${url.hash}`;
}

function youtubeIdFromUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.replace(/^\//, "").split("/")[0] || "";
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/shorts/")) {
        return u.pathname.replace("/shorts/", "").split("/")[0] || "";
      }
      if (u.pathname === "/watch") {
        return u.searchParams.get("v") || "";
      }
      if (u.pathname.startsWith("/embed/")) {
        return u.pathname.replace("/embed/", "").split("/")[0] || "";
      }
    }
    return "";
  } catch {
    return "";
  }
}

function renderYouTubeEmbed(videoUrl) {
  const id = youtubeIdFromUrl(videoUrl);
  if (!id) return "";
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
    id,
  )}?rel=0`;
  return `
    <div class="yt-inline" aria-label="Embedded YouTube video">
      <div class="yt-embed">
        <iframe
          src="${escapeHtml(src)}"
          title="YouTube video"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  `;
}

let blogInitialized = false;
let blogIndexPromise = null;
let blogIndex = [];
let activeBlogTag = "";

function setBlogReadingMode(isReading) {
  const modal = document.getElementById("blog-modal");
  if (!modal) return;
  if (isReading) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  } else {
    modal.hidden = true;
    document.body.style.overflow = "";
  }
}

function clearBlogPost() {
  const postEl = document.getElementById("blog-post");
  if (postEl) {
    postEl.innerHTML =
      '<p class="blog-empty">Select a post from the list to read.</p>';
  }
  setBlogReadingMode(false);
  setBlogPostUrl("");
}

async function loadBlogIndex() {
  if (blogIndexPromise) return blogIndexPromise;

  blogIndexPromise = (async () => {
    const res = await fetch("posts/posts.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load posts index (${res.status})`);
    const data = await res.json();
    const posts = Array.isArray(data) ? data : data.posts;
    if (!Array.isArray(posts)) throw new Error("posts.json must be an array");

    // Normalize + sort newest-first (YYYY-MM-DD sorts lexicographically).
    blogIndex = posts
      .filter((p) => p && typeof p.slug === "string")
      .map((p) => ({
        slug: String(p.slug),
        title: String(p.title || p.slug),
        date: String(p.date || ""),
        summary: String(p.summary || ""),
        markdown: String(p.markdown || ""),
        videoUrl: p.videoUrl ? String(p.videoUrl) : "",
        tags: Array.isArray(p.tags)
          ? p.tags.map(normalizeTag).filter(Boolean)
          : [],
        keywords: Array.isArray(p.keywords)
          ? p.keywords.map((k) => String(k)).filter(Boolean)
          : [],
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return blogIndex;
  })();

  return blogIndexPromise;
}

function computeRelatedPosts(posts, current) {
  if (!current) return [];
  const currentTags = new Set((current.tags || []).map(normalizeTag));
  const scored = (posts || [])
    .filter((p) => p.slug !== current.slug)
    .map((p) => {
      const tags = (p.tags || []).map(normalizeTag);
      let score = 0;
      tags.forEach((t) => {
        if (currentTags.has(t)) score += 1;
      });
      return { post: p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : a.post.date < b.post.date
          ? 1
          : -1,
    )
    .slice(0, 5)
    .map((x) => x.post);
  return scored;
}

function renderRelatedPosts(related) {
  if (!related || related.length === 0) return "";
  const items = related
    .map(
      (p) => `
        <button class="blog-item" type="button" data-slug="${escapeHtml(
          p.slug,
        )}" aria-label="Open related post ${escapeHtml(p.title)}">
          <div class="blog-item-title">${escapeHtml(p.title)}</div>
          ${p.date ? `<div class="blog-item-meta">${escapeHtml(p.date)}</div>` : ""}
          ${p.summary ? `<div class="blog-item-summary">${escapeHtml(p.summary)}</div>` : ""}
        </button>
      `,
    )
    .join("");
  return `
    <aside class="related-posts" aria-label="Related posts">
      <div class="related-posts-title">Related</div>
      <div class="related-posts-list">${items}</div>
    </aside>
  `;
}

function renderBlogFilters(posts) {
  const list = document.getElementById("blog-list");
  if (!list) return;

  // Create a wrapper so filters stay above the list.
  let wrap = list.querySelector(":scope > .blog-list-inner");
  if (!wrap) {
    const existing = list.innerHTML;
    list.innerHTML = `<div class="blog-filters" id="blog-filters" aria-label="Blog categories"></div><div class="blog-list-inner" id="blog-list-inner"></div>`;
    wrap = list.querySelector(":scope > .blog-list-inner");
    if (wrap) wrap.innerHTML = existing;
  }

  const filters = document.getElementById("blog-filters");
  if (!filters) return;

  const tags = uniqueTagsFromPosts(posts);
  const allLabel = "All";

  const pills = [allLabel, ...tags]
    .map((t) => {
      const active = (t === allLabel && !activeBlogTag) || t === activeBlogTag;
      return `<button class="filter-pill${active ? " active" : ""}" type="button" data-tag="${escapeHtml(
        t,
      )}">${escapeHtml(t)}</button>`;
    })
    .join("");

  filters.innerHTML = pills;
  filters.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;
      const tag = btn.getAttribute("data-tag") || "";
      activeBlogTag = tag === allLabel ? "" : tag;
      renderBlogListWithFilter(blogIndex);
    },
    { once: true },
  );
}

function renderBlogListWithFilter(posts) {
  const list =
    document.getElementById("blog-list-inner") ||
    document.getElementById("blog-list");
  if (!list) return;

  const filtered = !activeBlogTag
    ? posts
    : posts.filter((p) => (p.tags || []).includes(activeBlogTag));

  // Update active pill styles
  const allLabel = "All";
  $all(".filter-pill").forEach((pill) => {
    const tag = pill.getAttribute("data-tag") || "";
    const isActive =
      (!activeBlogTag && tag === allLabel) || tag === activeBlogTag;
    pill.classList.toggle("active", isActive);
  });

  renderBlogList(filtered);
}

function renderCategorySections(posts) {
  $all(".category-posts").forEach((host) => {
    const tag = host.getAttribute("data-tag") || "";
    const match = posts.filter((p) => (p.tags || []).includes(tag));
    if (match.length === 0) {
      host.innerHTML =
        '<p class="blog-empty">No lessons in this category yet.</p>';
      return;
    }

    host.innerHTML = match
      .slice(0, 5)
      .map((p) => {
        const meta = [p.date].filter(Boolean).join(" • ");
        return `
          <button class="blog-item" type="button" data-slug="${escapeHtml(
            p.slug,
          )}" aria-label="Open post ${escapeHtml(p.title)}">
            <div class="blog-item-title">${escapeHtml(p.title)}</div>
            ${meta ? `<div class="blog-item-meta">${escapeHtml(meta)}</div>` : ""}
            ${
              p.summary
                ? `<div class="blog-item-summary">${escapeHtml(p.summary)}</div>`
                : ""
            }
          </button>
        `;
      })
      .join("");
  });
}

function renderBlogList(posts) {
  const list = document.getElementById("blog-list");
  if (!list) return;

  if (!posts || posts.length === 0) {
    list.innerHTML = '<p class="blog-empty">No posts yet.</p>';
    return;
  }

  list.innerHTML = posts
    .map((p) => {
      const meta = [p.date].filter(Boolean).join(" • ");
      return `
        <button class="blog-item" type="button" data-slug="${escapeHtml(
          p.slug,
        )}" aria-label="Open post ${escapeHtml(p.title)}">
          <div class="blog-item-title">${escapeHtml(p.title)}</div>
          ${meta ? `<div class="blog-item-meta">${escapeHtml(meta)}</div>` : ""}
          ${
            p.summary
              ? `<div class="blog-item-summary">${escapeHtml(p.summary)}</div>`
              : ""
          }
        </button>
      `;
    })
    .join("");
}

async function showBlogPost(slug) {
  const postEl = document.getElementById("blog-post");
  if (!postEl) return;

  const posts = await loadBlogIndex();
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    postEl.innerHTML = `<p class="blog-empty">Post not found: <span class="ansi ansi-magenta">${escapeHtml(
      slug,
    )}</span></p>`;
    setBlogReadingMode(false);
    setBlogPostUrl("");
    return;
  }

  if (!post.markdown) {
    postEl.innerHTML = `<p class="blog-empty">This post has no markdown file set.</p>`;
    setBlogReadingMode(true);
    setBlogPostUrl(post.slug);
    return;
  }

  setBlogReadingMode(true);

  postEl.innerHTML = '<p class="blog-loading">Loading article…</p>';

  const res = await fetch(post.markdown, { cache: "no-store" });
  if (!res.ok) {
    postEl.innerHTML = `<p class="blog-empty">Failed to load <span class="ansi ansi-magenta">${escapeHtml(
      post.markdown,
    )}</span> (${res.status})</p>`;
    setBlogPostUrl(post.slug);
    return;
  }
  const md = await res.text();

  let html = "";
  if (window.marked && typeof window.marked.parse === "function") {
    try {
      html = window.marked.parse(md);
    } catch {
      html = `<pre>${escapeHtml(md)}</pre>`;
    }
  } else {
    html = `<pre>${escapeHtml(md)}</pre>`;
  }

  if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
    html = window.DOMPurify.sanitize(html);
  }

  const headerBits = [
    `<h2 class="blog-post-title">${escapeHtml(post.title)}</h2>`,
    post.date
      ? `<div class="blog-post-meta">${escapeHtml(post.date)}</div>`
      : "",
    post.videoUrl
      ? `<div class="blog-post-links"><a class="contact-link" href="${escapeHtml(
          post.videoUrl,
        )}" target="_blank" rel="noreferrer noopener">\u25B6 Watch video</a></div>`
      : "",
  ].join("");

  const related = computeRelatedPosts(posts, post);
  const canonicalUrl = buildPostCanonicalUrl(post.slug);

  const keywords =
    Array.isArray(post.keywords) && post.keywords.length > 0
      ? post.keywords
      : Array.isArray(post.tags)
        ? post.tags
        : [];

  const description =
    post.summary ||
    (keywords.length > 0
      ? `Learn: ${keywords.slice(0, 6).join(", ")}.`
      : "Learn how the internet works: networking, systems, and protocols.");

  setPageMeta({
    title: `${post.title} | JimCircuit`,
    description,
    canonicalUrl,
  });
  setStructuredDataBlogPosting(post, canonicalUrl);

  postEl.innerHTML = `
    <header class="blog-post-header">${headerBits}</header>
    ${post.videoUrl ? renderYouTubeEmbed(post.videoUrl) : ""}
    <div class="blog-post-body">${html}</div>
    ${renderRelatedPosts(related)}
  `;

  setBlogPostUrl(post.slug);
}

async function ensureBlogInitialized() {
  if (blogInitialized) return;
  blogInitialized = true;

  // Configure marked a bit (if present).
  if (window.marked && typeof window.marked.setOptions === "function") {
    window.marked.setOptions({ gfm: true, breaks: true });
  }

  const list = document.getElementById("blog-list");
  if (list) {
    list.addEventListener("click", (e) => {
      const btn = e.target.closest(".blog-item");
      if (!btn) return;
      const slug = btn.getAttribute("data-slug");
      if (slug) showBlogPost(slug);
    });
  }

  const postEl = document.getElementById("blog-post");
  if (postEl) {
    postEl.addEventListener("click", (e) => {
      const related = e.target.closest(".related-posts .blog-item");
      if (related) {
        const slug = related.getAttribute("data-slug");
        if (slug) showBlogPost(slug);
      }
    });
  }

  // Modal close button
  const closeBtn = document.getElementById("blog-modal-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => clearBlogPost());
  }

  // Click backdrop to close
  const backdrop = document.getElementById("blog-modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => clearBlogPost());
  }

  // Escape key to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("blog-modal");
      if (modal && !modal.hidden) {
        clearBlogPost();
      }
    }
  });

  try {
    const posts = await loadBlogIndex();
    renderBlogFilters(posts);
    renderBlogListWithFilter(posts);
    renderCategorySections(posts);

    const initialSlug = new URLSearchParams(location.search).get("post");
    if (initialSlug) {
      showBlogPost(initialSlug);
    } else {
      setBlogReadingMode(false);
    }
  } catch (err) {
    const listEl = document.getElementById("blog-list");
    if (listEl) {
      listEl.innerHTML = `<p class="blog-empty">Failed to load posts index.</p>`;
    }
    // Keep details out of the UI; still log for debugging.
    console.error(err);
  }
}

function setSectionMeta(targetId) {
  const baseTitle = "JimCircuit - Exploring the Internet";
  const baseDesc =
    "Learn how the internet works: networking, systems, and protocols — with short lessons and notes from JimCircuit.";

  const sectionTitles = {
    home: baseTitle,
    networking: "Networking Lessons | JimCircuit",
    systems: "Systems Lessons | JimCircuit",
    protocols: "Protocols Lessons | JimCircuit",
    videos: "Videos | JimCircuit",
    blog: "Blog | JimCircuit",
    about: "About | JimCircuit",
  };

  const sectionDescs = {
    home: baseDesc,
    networking:
      "Networking lessons: DNS, TCP/UDP, routing, troubleshooting, and how packets move.",
    systems:
      "Systems lessons: Linux/Unix internals, permissions, processes, I/O, filesystems, and security basics.",
    protocols:
      "Protocol lessons: TCP/IP, HTTP, TLS, DNS, and the rules-of-the-road between machines.",
    videos:
      "Short video lessons and sources across YouTube, Instagram, and TikTok.",
    blog: "Notes that go with my lessons — short write-ups you can reuse.",
    about:
      "About JimCircuit: educational breakdowns of networking, systems, and protocols.",
  };

  const title = sectionTitles[targetId] || baseTitle;
  const description = sectionDescs[targetId] || baseDesc;
  const canonicalUrl = `${getSiteBaseUrl()}${window.location.pathname}#${targetId}`;

  setPageMeta({ title, description, canonicalUrl });
  setStructuredDataBlogPosting(null);
}

function activateSection(targetId) {
  const section = document.getElementById(targetId);
  if (!section) return false;

  $all(".nav-link").forEach((l) => l.classList.remove("active"));
  $all(".content-section").forEach((s) => s.classList.remove("active"));

  const link = $(`.nav-link[href="#${targetId}"]`);
  if (link) link.classList.add("active");
  section.classList.add("active");

  // Sync top navbar state
  $all(".site-nav-link").forEach((l) => l.removeAttribute("aria-current"));
  const top = document.querySelector(`.site-nav-link[href="#${targetId}"]`);
  if (top) top.setAttribute("aria-current", "page");

  // When switching sections, show the new content (especially helpful on mobile).
  const scroller = $(".terminal-content");
  if (scroller) scroller.scrollTop = 0;

  // Keep the URL in sync (nice for refresh/share)
  setSectionUrl(targetId);

  // Meta tags for discovery/sharing
  if (targetId !== "blog") {
    setSectionMeta(targetId);
  }

  if (targetId === "blog") {
    ensureBlogInitialized();

    // Keep the blog UI aligned with the URL.
    const slug = new URLSearchParams(location.search).get("post");
    if (slug) {
      showBlogPost(slug);
    } else {
      setBlogReadingMode(false);
    }
  }

  if (targetId === "videos") {
    ensureVideosInitialized();
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

let videosInitialized = false;
let videosIndexPromise = null;
let videosState = {
  primary: "",
  instagram: [],
  youtube: [],
  tiktok: [],
  igLimit: 6,
  igStep: 6,
  igEmbedded: new Set(),
};

async function loadVideosIndex() {
  if (videosIndexPromise) return videosIndexPromise;

  videosIndexPromise = (async () => {
    const res = await fetch("videos/videos.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load videos index (${res.status})`);
    const data = await res.json();
    return {
      primary: data.primary ? String(data.primary).toLowerCase() : "",
      instagramInitial:
        typeof data.instagramInitial === "number"
          ? data.instagramInitial
          : null,
      instagramStep:
        typeof data.instagramStep === "number" ? data.instagramStep : null,
      instagram: Array.isArray(data.instagram) ? data.instagram : [],
      youtube: Array.isArray(data.youtube) ? data.youtube : [],
      tiktok: Array.isArray(data.tiktok) ? data.tiktok : [],
    };
  })();

  return videosIndexPromise;
}

function tiktokIdFromUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("video");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    return "";
  } catch {
    return "";
  }
}

function normalizeInstagramUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(String(url));
    // Strip tracking params; keep a stable permalink.
    const clean = `${u.origin}${u.pathname}`;
    return clean.endsWith("/") ? clean : `${clean}/`;
  } catch {
    return String(url);
  }
}

function instagramShortLabel(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("reel");
    if (idx !== -1 && parts[idx + 1]) return `reel/${parts[idx + 1]}`;
    return u.pathname.replace(/^\//, "");
  } catch {
    return String(url);
  }
}

function renderInstagramEmbeds(urls) {
  const host = document.getElementById("ig-embeds");
  if (!host) return;

  const panel = document.getElementById("ig-panel");
  const count = document.getElementById("ig-count");
  const more = document.getElementById("videos-more");

  const clean = (urls || []).map(normalizeInstagramUrl).filter(Boolean);
  if (clean.length === 0) {
    host.hidden = true;
    host.innerHTML = "";
    if (panel) panel.hidden = true;
    if (count) count.textContent = "";
    if (more) more.hidden = true;
    const loadVisible = document.getElementById("videos-load-visible");
    if (loadVisible) loadVisible.hidden = true;
    return;
  }

  host.hidden = false;
  if (panel) panel.hidden = false;

  const limit = Math.max(1, Number(videosState.igLimit || 6));
  const shown = Math.min(clean.length, limit);
  const embeddedCount = clean
    .slice(0, shown)
    .filter((u) => videosState.igEmbedded.has(u)).length;
  if (count) {
    count.textContent = `Showing ${shown} of ${clean.length} (previews: ${embeddedCount})`;
  }
  if (more) {
    more.hidden = !(clean.length > shown);
  }

  const loadVisible = document.getElementById("videos-load-visible");
  if (loadVisible) {
    loadVisible.hidden = !(shown > 0 && embeddedCount < shown);
  }

  host.innerHTML = clean
    .slice(0, shown)
    .map((u) => {
      const isEmbedded = videosState.igEmbedded.has(u);
      if (isEmbedded) {
        return `
          <div class="embed-cell" data-ig-url="${escapeHtml(u)}">
            <blockquote
              class="instagram-media"
              data-instgrm-permalink="${escapeHtml(u)}"
              data-instgrm-version="14"
            ></blockquote>
          </div>
        `;
      }

      return `
        <div class="video-card" data-ig-url="${escapeHtml(u)}" aria-label="Instagram ${escapeHtml(
          instagramShortLabel(u),
        )}">
          <div class="video-card-title">${escapeHtml(
            instagramShortLabel(u),
          )}</div>
          <div class="video-card-meta">Lightweight card (fast). Click preview to load embed.</div>
          <div class="video-card-actions">
            <a class="cta cta-secondary" href="${escapeHtml(
              u,
            )}" target="_blank" rel="noreferrer noopener">Open</a>
            <button class="cta cta-primary ig-preview" type="button">Preview</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Only process Instagram embeds if we rendered at least one.
  if (embeddedCount > 0) {
    setTimeout(() => processInstagramEmbeds(), 50);
  }
}

function renderYouTubeEmbeds(urls) {
  const host = document.getElementById("yt-embeds");
  if (!host) return;

  const panel = document.getElementById("yt-panel");

  const clean = (urls || []).map(String).filter(Boolean);
  if (clean.length === 0) {
    host.hidden = true;
    host.innerHTML = "";
    if (panel) panel.hidden = true;
    return;
  }

  host.hidden = false;
  if (panel) panel.hidden = false;

  host.innerHTML = clean
    .slice(0, 6)
    .map((u) => {
      const id = youtubeIdFromUrl(u);
      if (!id) {
        return `<div class="ig-placeholder">Invalid YouTube URL: <span class="ansi ansi-magenta">${escapeHtml(
          u,
        )}</span></div>`;
      }
      const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
        id,
      )}?rel=0`;
      return `
        <div class="embed-cell">
          <div class="yt-embed">
            <iframe
              src="${escapeHtml(src)}"
              title="YouTube video"
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTikTokEmbeds(urls) {
  const host = document.getElementById("tt-embeds");
  if (!host) return;

  const panel = document.getElementById("tt-panel");

  const clean = (urls || []).map(String).filter(Boolean);
  if (clean.length === 0) {
    host.hidden = true;
    host.innerHTML = "";
    if (panel) panel.hidden = true;
    return;
  }

  host.hidden = false;
  if (panel) panel.hidden = false;

  host.innerHTML = clean
    .slice(0, 6)
    .map((u) => {
      const id = tiktokIdFromUrl(u);
      return `
        <div class="embed-cell">
          <blockquote
            class="tiktok-embed"
            cite="${escapeHtml(u)}"
            ${id ? `data-video-id="${escapeHtml(id)}"` : ""}
          >
            <section></section>
          </blockquote>
        </div>
      `;
    })
    .join("");

  setTimeout(() => processTikTokEmbeds(), 50);
}

async function ensureVideosInitialized() {
  if (videosInitialized) return;
  videosInitialized = true;

  try {
    const data = await loadVideosIndex();
    videosState.primary = (data.primary || "").toLowerCase().trim();
    videosState.instagram = (data.instagram || []).map(normalizeInstagramUrl);
    videosState.youtube = (data.youtube || []).map(String);
    videosState.tiktok = (data.tiktok || []).map(String);
    videosState.igLimit =
      typeof data.instagramInitial === "number" &&
      Number.isFinite(data.instagramInitial)
        ? Math.max(1, Math.floor(data.instagramInitial))
        : 12;
    videosState.igStep =
      typeof data.instagramStep === "number" &&
      Number.isFinite(data.instagramStep)
        ? Math.max(1, Math.floor(data.instagramStep))
        : 12;

    const primary = (data.primary || "").toLowerCase().trim();

    const showInstagram = primary ? primary === "instagram" : true;
    const showYouTube = primary ? primary === "youtube" : true;
    const showTikTok = primary ? primary === "tiktok" : true;

    renderInstagramEmbeds(showInstagram ? data.instagram : []);
    renderYouTubeEmbeds(showYouTube ? data.youtube : []);
    renderTikTokEmbeds(showTikTok ? data.tiktok : []);

    const more = document.getElementById("videos-more");
    if (more) {
      more.onclick = () => {
        videosState.igLimit = Math.min(
          videosState.instagram.length,
          Number(videosState.igLimit || 6) + Number(videosState.igStep || 6),
        );
        renderInstagramEmbeds(videosState.instagram);
      };
    }

    const loadVisible = document.getElementById("videos-load-visible");
    if (loadVisible) {
      loadVisible.onclick = () => {
        const limit = Math.min(
          videosState.instagram.length,
          Math.max(1, Number(videosState.igLimit || 6)),
        );
        videosState.instagram.slice(0, limit).forEach((u) => {
          videosState.igEmbedded.add(u);
        });
        renderInstagramEmbeds(videosState.instagram);
      };
    }

    const host = document.getElementById("ig-embeds");
    if (host) {
      host.addEventListener("click", (e) => {
        const btn = e.target.closest(".ig-preview");
        if (!btn) return;
        const card = e.target.closest("[data-ig-url]");
        const url = card ? card.getAttribute("data-ig-url") : "";
        if (!url) return;
        videosState.igEmbedded.add(normalizeInstagramUrl(url));
        renderInstagramEmbeds(videosState.instagram);
      });
    }
  } catch (err) {
    const ig = document.getElementById("ig-embeds");
    const yt = document.getElementById("yt-embeds");
    const tt = document.getElementById("tt-embeds");
    if (ig) {
      ig.hidden = false;
      ig.innerHTML = '<p class="blog-empty">Failed to load embeds.</p>';
    }
    if (yt) {
      yt.hidden = true;
      yt.innerHTML = "";
    }
    if (tt) {
      tt.hidden = true;
      tt.innerHTML = "";
    }
    console.error(err);
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
    b: "blog",
    reels: "videos",
    notes: "blog",
    net: "networking",
    networking: "networking",
    sys: "systems",
    systems: "systems",
    proto: "protocols",
    protocols: "protocols",
  };

  const route = routeAliases[command] || command;
  if (
    [
      "home",
      "networking",
      "systems",
      "protocols",
      "about",
      "videos",
      "blog",
    ].includes(route)
  ) {
    appendRuntimeEntry(input);
    activateSection(route);
    return;
  }

  if (command === "help") {
    appendRuntimeEntry(input, [
      "Commands:",
      "  home | about | videos | blog",
      "  networking | systems | protocols",
      "  clear  (clears the session output)",
      "  reels  (alias for videos)",
      "  notes  (alias for blog)",
      "Tip: click nav links above or type commands here.",
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

  // Top navbar click support (shares the same section activator)
  $all(".site-nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("href").slice(1);
      if (activateSection(target)) {
        const cli = $("#cli");
        if (cli && !isCoarsePointer) cli.focus();
      }
    });
  });

  // CTAs: latest lesson
  function openLatestLesson() {
    loadBlogIndex()
      .then((posts) => {
        const latest = posts && posts[0];
        if (!latest) return;
        activateSection("blog");
        showBlogPost(latest.slug);
      })
      .catch(() => {
        activateSection("blog");
      });
  }

  const cta = document.getElementById("cta-latest-inline");
  if (cta) cta.addEventListener("click", openLatestLesson);

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

  // Category section list clicks
  $all(".category-posts").forEach((host) => {
    host.addEventListener("click", (e) => {
      const btn = e.target.closest(".blog-item");
      if (!btn) return;
      const slug = btn.getAttribute("data-slug");
      if (!slug) return;
      activateSection("blog");
      showBlogPost(slug);
    });
  });

  // Deep link support
  const initial = (location.hash || "#home").slice(1);
  if (!activateSection(initial)) {
    activateSection("home");
  }

  // Ensure initial meta reflects initial route (unless blog post overrides).
  if (initial !== "blog") {
    setSectionMeta(initial);
  }

  // Boot animation on first load (Home only)
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
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
    setTimeout(() => {
      ensureVideosInitialized();
      processInstagramEmbeds();
      processTikTokEmbeds();
    }, 150);
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
