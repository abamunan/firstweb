/* ═══════════════════════════════════════════════════════════════
   posts.js — Shared Blog Posts Data
   ───────────────────────────────────────────────────────────────
   ✏️  ONLY EDIT THIS FILE TO ADD / REMOVE BLOG POSTS.
   Both index.html and blog.html read from this file automatically.

   HOW TO ADD A NEW POST:
   1. Copy one { ... } block
   2. Paste it at the TOP of the array (newest first)
   3. Give it a unique id (e.g. "03", "04" ...)
   4. Fill in all fields
   5. Write your content in the `content` field using HTML tags:
        Paragraph   → <p>Text here</p>
        Heading     → <h2>Section Title</h2>
        Sub-heading → <h3>Smaller Title</h3>
        Bold        → <strong>important word</strong>
        Italic      → <em>emphasis</em>
        Quote       → <blockquote>quoted text</blockquote>
        Code inline → <code>someCode()</code>
        Code block  → <pre><code>multi
                       line code</code></pre>
        List        → <ul><li>item one</li><li>item two</li></ul>
        Numbered    → <ol><li>first</li><li>second</li></ol>
        Divider     → <hr>
        Link        → <a href="https://...">link text</a>

   STRIP COLORS (top bar on each card):
        Blue   → stripA:"#0284c7"  stripB:"#0ea5e9"
        Green  → stripA:"#059669"  stripB:"#10b981"
        Purple → stripA:"#7c3aed"  stripB:"#a855f7"
        Amber  → stripA:"#d97706"  stripB:"#f59e0b"
        Red    → stripA:"#dc2626"  stripB:"#f87171"
        Teal   → stripA:"#0f766e"  stripB:"#14b8a6"
        Pink   → stripA:"#db2777"  stripB:"#f472b6"
═══════════════════════════════════════════════════════════════ */

const BLOG_POSTS = [

    /* ── ADD YOUR NEWEST POST HERE AT THE TOP ──────────────────

    {
        id:       "02",
        title:    "Your Post Title Here",
        excerpt:  "A short 1–2 sentence summary shown on the card.",
        date:     "May 9, 2026",
        tag:      "Life",        // e.g. Life, Code, Tech, Study, Meta
        readTime: "3 min read",
        stripA:   "#059669",
        stripB:   "#10b981",
        content: `
            <p>Write your full post here using HTML tags.</p>

            <h2>A Section Heading</h2>
            <p>More content goes here.</p>

            <blockquote>An inspiring quote or key takeaway.</blockquote>

            <p>Keep writing...</p>
        `
    },

    ── END TEMPLATE ── */

    /* ── YOUR POSTS BELOW ─────────────────────────────────────── */

    {
        id:       "01",
        title:    "Hello World — Starting My Blog",
        excerpt:  "Every developer writes a Hello World at some point. This is mine — just in blog form.",
        date:     "May 9, 2026",
        tag:      "Meta",
        readTime: "2 min read",
        stripA:   "#0284c7",
        stripB:   "#0ea5e9",
        content: `
            <p>I've been meaning to start writing for a long time. Code is great, but sometimes you need <em>words</em> to explain the thinking behind it.</p>

            <p>This blog will be a mix of:</p>
            <ul>
                <li>Things I'm learning — web dev, Python, CS concepts</li>
                <li>Life as a Botany student who codes</li>
                <li>Tools and workflows I find useful</li>
                <li>Occasional random thoughts</li>
            </ul>

            <p>No strict schedule. Just writing when I have something worth saying.</p>

            <blockquote>Tawakkul &amp; grind.</blockquote>
        `
    },

]; // ← DO NOT DELETE THIS LINE
