# Wardvale UGC prompt system

One master prompt that onboards **any of the 21 vertical packs** into a UGC-style
short video (TikTok / Reels / Shorts, 9:16). Paste it into an AI UGC tool
(Arcads, HeyGen, Veo 3, Sora) or hand it to a human creator as the brief.
Fill the `{{slots}}` from the vertical library in `ugc-vertical-briefs.md` —
every slot value there is grounded in the real agent catalog, so no script can
promise something the product doesn't do.

---

## The master prompt

```
You are writing (or performing) a UGC-style short video ad: one real-looking
business owner talking to their phone camera, 9:16 vertical, 30-45 seconds,
handheld, imperfect lighting, natural speech with contractions.

THE PRODUCT — Wardvale: AI agents that do a small business's follow-up work as
DRAFTS the owner approves. It reads real activity (inbox, calendar, reviews,
invoices) and drafts the replies, nudges, and asks the owner never gets to.
The owner approves everything from one queue — usually with coffee, in minutes.

THE SPEAKER — {{persona}}
(a {{industry}} owner; we catch them in a real moment, not a studio)

THE PAIN — open on it, lived not explained: {{pain_moment}}

HOOK (first 3 seconds, pattern interrupt — pick one):
1. {{hook_1}}
2. {{hook_2}}
3. {{hook_3}}

THE TURN — "so I set up Wardvale" (or a natural variant). Then show, like
you're flipping through your phone, exactly three automations by name:

- {{automation_1_name}} — {{automation_1_line}}
- {{automation_2_name}} — {{automation_2_line}}
- {{automation_3_name}} — {{automation_3_line}}

THE RITUAL — the emotional payoff is control, not magic: every morning there's
a queue of drafts; the owner reads, tweaks maybe one, approves. Some version of
"nothing goes out without my OK" MUST be spoken — it is the brand's spine.

CTA — soft and curious, never hype: {{cta}}
(default: "It's called Wardvale. The demo dashboard is free to poke around.")

ON-SCREEN TEXT — {{on_screen_text}}
B-ROLL — {{broll}} (everything shootable inside a real {{industry}} business)
TONE — {{brand_tone}}

HARD RULES (non-negotiable):
- NO invented numbers. No dollar amounts, percentages, hours saved, client
  counts, or "booked X% more". Sell the mechanic and the feeling.
- This is a demo/day-in-the-life, NOT a results testimonial. The speaker shows
  what the product does; they never claim measured outcomes.
- Agents DRAFT; the owner approves. Never imply anything sends itself.
- No Instagram/TikTok DM automation. No "replaces your staff".
- Regulated verticals (clinic, law firm, med spa, veterinary, insurance,
  accounting, childcare): extra buttoned-up; "I review every single one" is a
  feature line, and no moment may resemble medical/legal advice.
- Banned words: leverage, streamline, game-changer, revolutionize, seamless,
  unlock, empower, "AI-powered".
```

---

## How to use it

1. Pick the vertical in `ugc-vertical-briefs.md` (21 pre-filled briefs, one per
   pack — persona, pain moment, 3 hooks, 3 automation beats, captions, b-roll,
   CTA, all using that pack's real agents).
2. Drop the brief's values into the `{{slots}}` above.
3. Generate 3 variants (one per hook), test, keep the winner per vertical.

## Compliance notes (read before publishing)

- **Actors must be disclosed as dramatizations.** UGC performed by actors or AI
  avatars cannot present fabricated results or pose as real customers — that's
  FTC endorsement territory. The scripts here are built as *demos* ("here's
  what it does"), which is the safe shape; keep them that way when editing.
- The no-invented-numbers rule isn't just brand hygiene — Wardvale's whole
  positioning is receipts-over-claims. An ad with a made-up "$3k/month saved"
  would contradict the product's own trust bar.
- AI-generated presenters should follow the platform's synthetic-media
  disclosure rules (TikTok and Meta both require labeling).
