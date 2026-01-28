#!/usr/bin/env node
/**
 * JimCircuit Static Blog Builder
 *
 * Generates static HTML pages for each blog post for better SEO.
 * Reads posts from markdown files with YAML frontmatter.
 * Run: node build.js
 */

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://jimcircuit.net";
const POSTS_DIR = "./posts";
const POSTS_JSON = "./posts/posts.json";
const OUTPUT_DIR = "./blog";

// Parse YAML frontmatter from markdown
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  
  const yamlStr = match[1];
  const body = match[2];
  const frontmatter = {};
  
  // Simple YAML parser for our use case
  let currentKey = null;
  let currentArray = null;
  
  for (const line of yamlStr.split('\n')) {
    // Array item
    if (line.match(/^\s+-\s+(.+)$/)) {
      const value = line.match(/^\s+-\s+(.+)$/)[1].trim();
      if (currentArray && currentKey) {
        frontmatter[currentKey].push(value);
      }
      continue;
    }
    
    // Key-value pair
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim();
      
      // Check if it's starting an array
      if (value === '') {
        frontmatter[key] = [];
        currentKey = key;
        currentArray = true;
      } else {
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        frontmatter[key] = value;
        currentArray = false;
      }
    }
  }
  
  return { frontmatter, body };
}

// Read all posts from markdown files with frontmatter
function readPostsFromMarkdown() {
  const posts = [];
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const { frontmatter, body } = parseFrontmatter(content);
    
    if (!frontmatter.slug || !frontmatter.title) {
      console.log(`   ⚠️  Skipping ${file}: missing slug or title in frontmatter`);
      continue;
    }
    
    posts.push({
      slug: frontmatter.slug,
      title: frontmatter.title,
      date: frontmatter.date || new Date().toISOString().split('T')[0],
      summary: frontmatter.summary || '',
      videoUrl: frontmatter.videoUrl || '',
      tags: frontmatter.tags || [],
      keywords: frontmatter.keywords || [],
      markdown: `posts/${file}`,
      body: body
    });
  }
  
  // Sort by date descending
  posts.sort((a, b) => b.date.localeCompare(a.date));
  
  return posts;
}

// Update posts.json from frontmatter (for backwards compatibility)
function updatePostsJson(posts) {
  const jsonData = {
    posts: posts.map(p => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      summary: p.summary,
      markdown: p.markdown,
      videoUrl: p.videoUrl,
      tags: p.tags,
      keywords: p.keywords
    }))
  };
  
  fs.writeFileSync(POSTS_JSON, JSON.stringify(jsonData, null, 2) + '\n');
  console.log(`📋 Updated: ${POSTS_JSON}`);
}

// Simple marked-like markdown parser (basic subset)
function parseMarkdown(md) {
  // Store code blocks temporarily to protect them from other transforms
  const codeBlocks = [];
  let html = md
    // Extract and protect code blocks (```lang ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`;
      codeBlocks.push(
        `<pre><code class="language-${lang || "text"}">${escapeHtml(code.trim())}</code></pre>`,
      );
      return placeholder;
    });

  // Now process inline elements
  html = html
    // Inline code (must come before italic/bold to protect backticks)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold (** or __)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // Italic (* or _) - use word boundaries to avoid matching paths like /usr/bin
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/(?<![\/\w])_([^_]+)_(?![\/\w])/g, "<em>$1</em>")
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
      if (block.startsWith("\x00CODEBLOCK")) return block; // Protected code block
      if (block.includes("<li>")) return `<ul>${block}</ul>`;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  // Restore code blocks
  codeBlocks.forEach((code, i) => {
    html = html.replace(`\x00CODEBLOCK${i}\x00`, code);
  });

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
    <link rel="stylesheet" href="../../blog.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

    <script type="application/ld+json">
${JSON.stringify(schemaData, null, 2)}
    </script>
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

  // Read posts from markdown files with frontmatter
  const posts = readPostsFromMarkdown();

  if (posts.length === 0) {
    console.log("No posts found in posts/ directory");
    return;
  }

  // Update posts.json for backwards compatibility (used by main site)
  updatePostsJson(posts);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate each post
  for (const post of posts) {
    console.log(`📝 Building: ${post.slug}`);

    const htmlContent = parseMarkdown(post.body);
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
