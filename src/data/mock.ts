import type { Chat, Model } from "../types";

export const MODELS: Model[] = [
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    description: "Balanced speed and intelligence",
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    description: "Most capable for complex tasks",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Fast multimodal reasoning",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o mini",
    description: "Lightweight and economical",
  },
];

export const CHATS: Chat[] = [
  {
    id: "c1",
    title: "Design a landing page",
    timestamp: "2h ago",
    messages: [
      {
        id: "m1",
        role: "user",
        content:
          "I need a landing page for a developer tool. Minimal, dark, with a strong hero. Where should I start?",
      },
      {
        id: "m2",
        role: "assistant",
        content:
          "Start with the hero: one sharp headline that states the outcome, a single-sentence subhead, and one primary CTA. Keep the palette to a near-black background with a single accent. Everything below the fold should support that one promise — social proof, then a short feature triplet, then the CTA again.",
      },
      {
        id: "m3",
        role: "user",
        content: "What about typography?",
      },
      {
        id: "m4",
        role: "assistant",
        content:
          "Pair a confident display face for the headline with a neutral, highly legible body font. Use generous line-height (1.5–1.6) for body copy and tighten the headline tracking slightly. Limit yourself to two weights to keep it disciplined.",
      },
    ],
  },
  {
    id: "c2",
    title: "Summarize this PDF",
    timestamp: "5h ago",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Can you summarize the attached quarterly report in five bullets?",
      },
      {
        id: "m2",
        role: "assistant",
        content:
          "Here's the gist: revenue grew 18% QoQ, driven mostly by enterprise renewals; gross margin held steady at 71%; churn dipped to 2.1%; the team shipped two major features ahead of schedule; and guidance for next quarter was raised modestly.",
      },
    ],
  },
  {
    id: "c3",
    title: "Python script review",
    timestamp: "Yesterday",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Review this script for performance — it's processing ~2M rows and feels slow.",
      },
      {
        id: "m2",
        role: "assistant",
        content:
          "The bottleneck is the row-by-row loop. Vectorize with pandas or process in chunks, avoid repeated DataFrame.append (build a list then concat once), and cache the lookups you're recomputing inside the loop. That alone should cut runtime by an order of magnitude.",
      },
    ],
  },
  {
    id: "c4",
    title: "Plan a trip to Japan",
    timestamp: "2d ago",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Two weeks in Japan in spring. First time. Help me outline a route.",
      },
      {
        id: "m2",
        role: "assistant",
        content:
          "A classic first-timer loop: Tokyo (4 nights) → day trip to Hakone → Kyoto (4 nights) with a day in Nara → Osaka (2 nights) → back via Kanazawa or Hiroshima. Spring means cherry blossoms, so book accommodation early and keep one or two days flexible to chase the bloom.",
      },
    ],
  },
  {
    id: "c5",
    title: "Explain quantum computing",
    timestamp: "3d ago",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Explain quantum computing like I'm a software engineer.",
      },
      {
        id: "m2",
        role: "assistant",
        content:
          "Think of a qubit as a bit that, until measured, holds a probability amplitude across 0 and 1 simultaneously (superposition). Entanglement links qubits so their states correlate. Algorithms like Grover's or Shor's exploit interference to amplify correct answers and cancel wrong ones — you're programming probabilities, not deterministic gates.",
      },
    ],
  },
];
