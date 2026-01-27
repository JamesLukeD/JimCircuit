#!/usr/bin/env node
/**
 * JimCircuit Static Blog Builder
 *
 * Generates static HTML pages for each blog post for better SEO.
 * Run: node build.js
 */

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://jimcircuit.net";
const POSTS_JSON = "./posts/posts.json";
const OUTPUT_DIR = "./blog";

// Simple marked-like markdown parser (basic subset)
function parseMarkdown(md) {
  let html = md
    // Code blocks (```lang ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang || "text"}">${escapeHtml(code.trim())}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Paragraphs (simple: split by double newline)
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith("<")) return block; // Already HTML
      if (block.includes("<li>")) return `<ul>${block}</ul>`;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function youtubeIdFromUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
      if (u.pathname === "/watch") return u.searchParams.get("v") || "";
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
    }
    return "";
  } catch {
    return "";
  }
}

function isInstagramUrl(url) {
  if (!url) return false;
  try {
    return new URL(url).hostname.includes("instagram.com");
  } catch {
    return false;
  }
}

function renderVideoEmbed(videoUrl) {
  if (!videoUrl) return "";

  if (isInstagramUrl(videoUrl)) {
    const cleanUrl = videoUrl.endsWith("/") ? videoUrl : `${videoUrl}/`;
    return `
      <div class="ig-inline" aria-label="Embedded Instagram video">
        <blockquote
          class="instagram-media"
          data-instgrm-permalink="${escapeHtml(cleanUrl)}"
          data-instgrm-version="14"
        ></blockquote>
      </div>
    `;
  }

  const id = youtubeIdFromUrl(videoUrl);
  if (!id) return "";
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
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

function generatePostHTML(post, content) {
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}/`;
  const description =
    post.summary ||
    `Learn: ${(post.keywords || post.tags || []).slice(0, 6).join(", ")}.`;
  const videoEmbed = renderVideoEmbed(post.videoUrl);

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.date,
    description: description,
    url: canonicalUrl,
    author: {
      "@type": "Person",
      name: "JimCircuit",
    },
    publisher: {
      "@type": "Organization",
      name: "JimCircuit",
      url: SITE_URL,
    },
  };

  if (post.keywords && post.keywords.length > 0) {
    schemaData.keywords = post.keywords.join(", ");
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>${escapeHtml(post.title)} | JimCircuit</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />

    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(post.title)} | JimCircuit" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonicalUrl}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(post.title)} | JimCircuit" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />

    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-41QBQ7R0DY"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag("js", new Date());
      gtag("config", "G-41QBQ7R0DY");
    </script>

    <link rel="icon" href="../../assets/jimcircuit-logo.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../../styles.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

    <script type="application/ld+json">
${JSON.stringify(schemaData, null, 2)}
    </script>

    <style>
      /* Blog post page specific styles */
      .blog-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      .blog-page-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 0;
        border-bottom: 1px solid var(--term-border);
        margin-bottom: 24px;
      }
      .blog-page-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--term-fg);
      }
      .blog-page-brand img {
        width: 36px;
        height: 36px;
        border-radius: 8px;
      }
      .blog-page-brand span {
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.04em;
      }
      .blog-page-nav {
        margin-left: auto;
        display: flex;
        gap: 12px;
      }
      .blog-page-nav a {
        color: var(--term-fg-dim);
        text-decoration: none;
        font-size: 13px;
        padding: 8px 12px;
        border-radius: 8px;
        transition: background 150ms ease, color 150ms ease;
      }
      .blog-page-nav a:hover {
        background: rgba(255,255,255,0.06);
        color: var(--term-fg);
      }
      .blog-page-content {
        background: var(--term-bg);
        border: 1px solid var(--term-border-strong);
        border-radius: 12px;
        padding: 32px;
      }
      .blog-page-title {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 8px 0;
        line-height: 1.3;
      }
      .blog-page-meta {
        color: var(--term-fg-dim);
        font-size: 13px;
        margin-bottom: 20px;
      }
      .blog-page-body {
        line-height: 1.7;
      }
      .blog-page-body h2 {
        margin: 28px 0 14px 0;
        font-size: 20px;
        color: var(--ansi-cyan);
      }
      .blog-page-body h3 {
        margin: 20px 0 10px 0;
        font-size: 16px;
      }
      .blog-page-body p {
        margin: 0 0 16px 0;
      }
      .blog-page-body pre {
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--term-border);
        border-radius: 8px;
        padding: 16px;
        overflow-x: auto;
        margin: 16px 0;
      }
      .blog-page-body code {
        font-family: "Courier New", monospace;
        font-size: 13px;
      }
      .blog-page-body ul {
        margin: 16px 0;
        padding-left: 24px;
      }
      .blog-page-body li {
        margin: 8px 0;
      }
      .blog-page-back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 24px;
        padding: 10px 16px;
        background: rgba(192, 97, 203, 0.15);
        border: 1px solid rgba(192, 97, 203, 0.3);
        border-radius: 8px;
        color: var(--term-fg);
        text-decoration: none;
        font-size: 13px;
        transition: background 150ms ease;
      }
      .blog-page-back:hover {
        background: rgba(192, 97, 203, 0.25);
      }
      @media (max-width: 600px) {
        .blog-page { padding: 12px; }
        .blog-page-content { padding: 20px; }
        .blog-page-title { font-size: 22px; }
        .blog-page-nav { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="blog-page">
      <header class="blog-page-header">
        <a class="blog-page-brand" href="../../">
          <img src="../../assets/jimcircuit-logo.svg" alt="JimCircuit" />
          <span>JimCircuit</span>
        </a>
        <nav class="blog-page-nav">
          <a href="../../#home">Home</a>
          <a href="../../#videos">Videos</a>
          <a href="../../#blog">Blog</a>
          <a href="../../#about">About</a>
        </nav>
      </header>

      <article class="blog-page-content">
        <h1 class="blog-page-title">${escapeHtml(post.title)}</h1>
        <div class="blog-page-meta">📅 ${escapeHtml(post.date)}</div>
        
        ${videoEmbed}

        <div class="blog-page-body">
          ${content}
        </div>

        <a class="blog-page-back" href="../../#blog">← Back to all posts</a>
      </article>
    </div>

    ${isInstagramUrl(post.videoUrl) ? '<script async src="https://www.instagram.com/embed.js"></script>' : ""}
  </body>
</html>`;
}

function generateSitemap(posts) {
  const now = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <priority>1.0</priority>
  </url>
`;

  for (const post of posts) {
    xml += `  <url>
    <loc>${SITE_URL}/blog/${post.slug}/</loc>
    <lastmod>${post.date}</lastmod>
    <priority>0.8</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  return xml;
}

function build() {
  console.log("🔨 Building JimCircuit static pages...\n");

  // Read posts index
  const postsData = JSON.parse(fs.readFileSync(POSTS_JSON, "utf8"));
  const posts = postsData.posts || [];

  if (posts.length === 0) {
    console.log("No posts found in posts.json");
    return;
  }

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate each post
  for (const post of posts) {
    console.log(`📝 Building: ${post.slug}`);

    // Read markdown
    const mdPath = path.join(".", post.markdown);
    if (!fs.existsSync(mdPath)) {
      console.log(`   ⚠️  Markdown not found: ${mdPath}`);
      continue;
    }

    let mdContent = fs.readFileSync(mdPath, "utf8");

    // Remove front matter or title if duplicated
    mdContent = mdContent.replace(/^#\s+.+\n+/, ""); // Remove first H1
    mdContent = mdContent.replace(/^## Video\n+- .+\n+/m, ""); // Remove video link section

    const htmlContent = parseMarkdown(mdContent);
    const pageHtml = generatePostHTML(post, htmlContent);

    // Create directory for post
    const postDir = path.join(OUTPUT_DIR, post.slug);
    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    // Write HTML file
    const outPath = path.join(postDir, "index.html");
    fs.writeFileSync(outPath, pageHtml);
    console.log(`   ✅ Created: ${outPath}`);
  }

  // Generate sitemap
  const sitemap = generateSitemap(posts);
  fs.writeFileSync("sitemap.xml", sitemap);
  console.log(`\n🗺️  Created: sitemap.xml`);

  console.log(`\n✨ Built ${posts.length} post(s) successfully!`);
  console.log(`\nURLs will be:`);
  for (const post of posts) {
    console.log(`   ${SITE_URL}/blog/${post.slug}/`);
  }
}

build();
