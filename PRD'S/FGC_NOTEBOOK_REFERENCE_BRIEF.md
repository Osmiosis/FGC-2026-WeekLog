# FGC Engineering Documentation — Reference Brief

**Purpose:** This is the standard the Notebook Prep pipeline measures Team Qatar's logged season
against. Claude Code reads this BEFORE it audits the WeekLog data, so its gap analysis is grounded in
what FIRST Global judges actually reward, not generic "good documentation."

**Status:** Seeded from public FIRST Global and FIRST engineering-documentation guidance (accurate as
of mid-2026). Sections marked `[VERIFY / ENRICH]` are where the team should paste real specifics from
the official FGC 2026 materials or mentors when available. Treat this brief as living; enrich it, do
not assume it is complete.

**Hard rule:** This brief tells the pipeline how to AUDIT and PROMPT, never how to WRITE the notebook.
The team writes the notebook. The pipeline finds gaps, structures raw material, and asks the questions
a judge would. AI-authored notebook prose is a liability, not a help.

---

## 1. The target award (FGC-specific)

FIRST Global's engineering-documentation award is the **Katherine Johnson Award for Engineering
Documentation**, given to teams that "demonstrate the journey they took in building their robot."

The operative word is **journey**. FGC rewards documented *process over the season*: how ideas were
chosen, tried, failed, and revised. It does NOT reward a glossy final-state description of the robot.
A rough-but-honest record of iteration beats a polished after-the-fact writeup.

`[VERIFY / ENRICH]` Paste the exact 2026 Katherine Johnson Award criteria and any published FGC
documentation guidelines / page limits here when the team has them. FGC's game manual and awards
materials are the authoritative source; this brief uses cross-program FIRST principles as a proxy.

## 2. What judges look for (the audit criteria)

These are the dimensions the pipeline's gap analysis should score coverage against. They come from
FIRST engineering-documentation guidance that is consistent across FIRST programs.

1. **Evidence of the engineering design process.** A visible loop of: define problem -> brainstorm ->
   select -> build -> test -> evaluate -> iterate. Judges want to see the loop repeat over the season,
   per subsystem.
2. **Lessons learned, implemented.** Not just "what we did" but "what we learned and then changed
   because of it."
3. **Trade-off / cost-benefit analysis.** Documented decisions where options were weighed. "We
   considered A and B, chose B because X." This is the single most award-relevant content and the
   thing teams most often fail to record.
4. **Mathematical / physical justification.** Design choices backed by numbers. The gold-standard
   example: not "we made the arm stronger" but "the polycarbonate arm failed at 10N, we switched to
   6061 aluminum which held 50N in testing." Every major decision should have a number behind it.
5. **Tests and test results.** Actual measurements from practice: cycle times, accuracy rates, jam
   frequency, climb success rate. Data, not adjectives.
6. **Complete record over time.** Dated entries across the whole build season showing continuity, not
   a burst of documentation right before the deadline.
7. **Drawings, CAD, captioned photos.** Visual evidence of iterations, each captioned so a judge
   understands it without the team present.
8. **Individual contributions documented.** Who did what. Judges value that every member contributed.
9. **Clarity and structure.** Clear headings, bullet points, diagrams, captioned images. A wall of
   text loses judges. Make it scannable.

## 3. What separates a strong notebook from a weak one

- **Strong:** shows the *why* behind every decision, with numbers. Records failures and what changed
  because of them. Reads as a season-long journey. Each subsystem has a traceable evolution.
- **Weak:** describes the final robot only. Lists what was built without why. Records successes but
  hides failures. Documentation clustered at the end (a "night before" notebook). Adjectives instead
  of data ("much faster", "more reliable" with no measurement).

The pipeline should treat the weak-notebook patterns as the specific things to FLAG.

## 4. FGC-specific context that shapes documentation

- FGC is international and alliance-based (your 3-robot regional alliance, plus the global alliance).
  Strategy documentation should reflect alliance play, not just your own robot in isolation.
- FGC uses a standardized REV-based kit; "design" is largely about how you combine and modify kit
  parts and any custom/3D-printed elements, so document those choices specifically.
- Beyond the robot, FGC values international collaboration, outreach, and the season's themed context
  (2026: Igniting Innovation, wildfire prevention / mitigation / recovery). Connecting the robot and
  team story to the theme is worth documenting.

`[VERIFY / ENRICH]` Add any FGC 2026 documentation submission specifics (format, length, deadline,
digital vs physical, cover-page rules) here from the official manual.

## 5. How the pipeline should use this brief

- **Gap analysis:** for each criterion in Section 2, check whether the WeekLog data contains evidence,
  and flag what's thin or missing (e.g. "trade-off analysis: only 1 documented decision found across
  8 meetings; judges expect several").
- **Decision-log extraction:** hunt specifically for Section 2.3 material (choices between options)
  and Section 2.4 material (numeric justification), surfacing candidates and flagging where the "why"
  or the number is missing.
- **Coverage against the journey standard:** check that documentation is spread across the season
  (Section 2.6), not clustered, and that each subsystem has a traceable arc (Section 3).
- **Never write the notebook.** Output raw material, gaps, and judge-style questions. The team writes.

## 6. Sources this brief is grounded in
- FIRST Global press materials naming the Katherine Johnson Award for Engineering Documentation and
  its "journey" framing.
- FIRST engineering-notebook judging guidance (Fully Developed notebook standards: detail, drawings,
  tests/results, problem solutions, complete design-process record).
- FIRST portfolio criteria: engineering-process evidence, lessons learned, trade-off analysis,
  mathematical analysis.
- FIRST community best-practice guidance on quantifying decisions and structuring for readability.

These are cross-program FIRST standards used as a proxy where FGC-specific published detail is thin.
Replace the `[VERIFY / ENRICH]` placeholders with official FGC 2026 sources as the team obtains them.
