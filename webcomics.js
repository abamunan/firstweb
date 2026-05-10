/* ═══════════════════════════════════════════════════════════════
   webcomics.js — Webcomic Series Data
   ───────────────────────────────────────────────────────────────
   ✏️  EDIT THIS FILE TO ADD / REMOVE / UPDATE WEBCOMICS.
   Both index.html and webcomic.html read from this file automatically.

   HOW TO ADD A NEW WEBCOMIC:
   1. Copy one { ... } block
   2. Paste it at the TOP of the array (newest first)
   3. Give it a unique id (e.g. "03", "04" ...)
   4. Fill in all fields
   5. Add comic episodes in the `episodes` array

   STRIP COLORS:
        Blue   → stripA:"#0284c7"  stripB:"#0ea5e9"
        Green  → stripA:"#059669"  stripB:"#10b981"
        Purple → stripA:"#7c3aed"  stripB:"#a855f7"
        Amber  → stripA:"#d97706"  stripB:"#f59e0b"
        Red    → stripA:"#dc2626" stripB:"#f87171"
        Orange → stripA:"#ea580c"  stripB:"#fb923c"
        Pink   → stripA:"#db2777"  stripB:"#f472b6"
═══════════════════════════════════════════════════════════════ */

const WEBCOMICS = [

    {
        id:          "01",
        title:       "Code & Coffee",
        description: "The daily struggles and wins of a developer's life — told through poorly drawn but deeply relatable comics.",
        author:      "Abdullah All Munan",
        status:      "Ongoing",
        genre:       "Comedy",
        coverImage:  "webcomic-coffee.png",
        stripA:      "#0284c7",
        stripB:      "#0ea5e9",
        episodes: [
            {
                episodeNum: 1,
                title:      "It Works on My Machine",
                description: "The timeless classic: when your code works perfectly... until it goes to production.",
                imageUrl:   "image.jpeg",
                date:       "May 1, 2026",
                content:    "A developer confidently submitting code, only to panic when it breaks in production. Classic."
            },
            {
                episodeNum: 2,
                title:      "Stack Overflow Savior",
                description: "Copy-paste debugging at its finest.",
                imageUrl:   "ep002.png",
                date:       "May 2, 2026",
                content:    "Developer frantically searches Stack Overflow for solutions, finds exact problem, copies answer without understanding."
            },
            {
                episodeNum: 3,
                title:      "The 3 AM Bug Fix",
                description: "Sleep is overrated anyway.",
                imageUrl:   "ep003.png",
                date:       "May 3, 2026",
                content:    "A coder at 3 AM discovering the bug was a missing semicolon. Worth it."
            },
            {
                episodeNum: 4,
                title:      "Meeting Culture",
                description: "Could have been an email.",
                imageUrl:   "ep004.png",
                date:       "May 4, 2026",
                content:    "Developer explaining why the meeting that took an hour could've been a 5-minute email."
            }
        ]
    },

    {
        id:          "02",
        title:       "Procrastinator's Tale",
        description: "A web developer's journey of assignments, deadlines, and last-minute heroics.",
        author:      "Abdullah All Munan",
        status:      "Ongoing",
        genre:       "Drama/Comedy",
        coverImage:  "webcomic-procrastinate.png",
        stripA:      "#059669",
        stripB:      "#10b981",
        episodes: [
            {
                episodeNum: 1,
                title:      "Two Weeks to Go",
                description: "Confidence at its peak.",
                imageUrl:   "ep001-p.png",
                date:       "May 5, 2026",
                content:    "Student receives assignment 2 weeks early. Thinks, 'Plenty of time!' Spoiler: It's not."
            },
            {
                episodeNum: 2,
                title:      "Three Days Left",
                description: "Reality check incoming.",
                imageUrl:   "ep002-p.png",
                date:       "May 6, 2026",
                content:    "With 3 days left, the student finally opens the project. Realizes they understood nothing."
            },
            {
                episodeNum: 3,
                title:      "The All-Nighter",
                description: "When coffee becomes your personality.",
                imageUrl:   "ep003-p.png",
                date:       "May 7, 2026",
                content:    "24 hours before deadline. Still coding. Hallucinating syntax errors."
            }
        ]
    },

    {
        id:          "03",
        title:       "Study Life Realities",
        description: "The unspoken truths of being a student in 2026.",
        author:      "Abdullah All Munan",
        status:      "Ongoing",
        genre:       "Comedy",
        coverImage:  "webcomic-study.png",
        stripA:      "#7c3aed",
        stripB:      "#a855f7",
        episodes: [
            {
                episodeNum: 1,
                title:      "Open Book Exam",
                description: "When having notes doesn't help.",
                imageUrl:   "ep001-s.png",
                date:       "May 8, 2026",
                content:    "Student brings 10 pages of notes to open book exam. Still forgets everything. Notes don't matter if you didn't understand it."
            }
        ]
    }

]; // ← DO NOT DELETE THIS LINE
