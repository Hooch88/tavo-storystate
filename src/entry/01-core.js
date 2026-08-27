(() => {
  "use strict";

  const PLUGIN_LABEL = "StoryState";
  const STATE_KEY = "storyState.state";
  const UI_COMMAND_KEY = "storyState.uiCommand";
  const SCAN_REQUEST_KEY = "storyState.scanRequest";
  const CONTEXT_PREVIEW_KEY = "storyState.contextPreview";
  const CONTINUATION_MAX = 6000;
  const CONTEXT_MAX_CHARS = 12000;
  const RECENT_RELEVANCE_MESSAGES = 8;

  function integer(value, min, max, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function text(value, max = 1200) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function namesForNpc(npc) {
    return [npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])]
      .map((value) => text(value, 100).toLowerCase())
      .filter(Boolean);
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function mentionedIn(input, npc) {
    const haystack = text(input, 12000).toLowerCase();
    return namesForNpc(npc).some((name) => {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}(?=$|[^a-z0-9])`, "i");
      return pattern.test(haystack);
    });
  }


  const AXIS_DEFINITIONS = {
    Trust: "Willingness to believe, rely on, and be vulnerable with the target.",
    Affinity: "How much the NPC likes the target and enjoys their company; warmth and goodwill, not romance by itself.",
    Respect: "How highly the NPC regards the target's judgment, competence, character, or standing.",
    Attraction: "Romantic or physical pull toward the target; it does not imply affection, trust, consent, or obedience.",
    Loyalty: "Willingness to remain aligned with, defend, or prioritize the target when doing so has a cost; it does not imply obedience."
  };

  const AXIS_GUIDANCE = {
    Trust: [
      "expects unreliability or danger; verifies claims and avoids dependence or vulnerable disclosure",
      "is guarded; checks claims and limits reliance or vulnerability",
      "is somewhat cautious; gives only limited benefit of the doubt",
      "has no strong trust bias yet",
      "generally gives reasonable benefit of the doubt and accepts limited reliance",
      "usually credits claims and is comfortable relying or disclosing when appropriate",
      "has very strong confidence and vulnerability while retaining independent judgment"
    ],
    Affinity: [
      "feels strong dislike or aversion; patience and desire for company are very low",
      "is negatively disposed; warmth and patience are limited",
      "is mildly cool or reluctant about closeness",
      "has no strong liking or dislike bias yet",
      "is somewhat warm and positively disposed",
      "strongly likes the target; shows patience, warmth, and interest in shared company",
      "feels exceptionally strong affection or goodwill without becoming blindly compliant"
    ],
    Respect: [
      "holds the target in very low regard and readily discounts their judgment or standing",
      "has low regard and is skeptical of the target's competence, credibility, or standing",
      "has somewhat limited regard and is not easily impressed",
      "has no strong respect bias yet",
      "takes the target somewhat seriously and gives their judgment added weight",
      "holds the target in high regard and is strongly inclined to take their competence or judgment seriously",
      "holds exceptional regard while still retaining independent judgment"
    ],
    Attraction: [
      "feels little or no romantic or physical pull",
      "has low romantic or physical interest",
      "has faint or uncertain romantic or physical interest",
      "has no strong attraction bias yet",
      "feels noticeable romantic or physical interest",
      "feels strong romantic or physical attraction and notices opportunities for closeness",
      "feels very intense romantic or physical attraction; this still never implies consent, affection, or obedience"
    ],
    Loyalty: [
      "has little commitment to the target and readily prioritizes other interests under pressure",
      "has weak commitment and may withdraw support when costs rise",
      "has limited commitment and weighs self-interest heavily",
      "has no strong loyalty bias yet",
      "is somewhat inclined to remain aligned and provide support",
      "is strongly inclined to stand by, defend, or prioritize the target when costs are reasonable",
      "has exceptional commitment and may accept substantial costs, but loyalty still does not mean obedience"
    ]
  };

  function axisGuidance(axisName, rawValue) {
    const value = integer(rawValue, 0, 10, 5);
    const bands = AXIS_GUIDANCE[axisName];
    if (!bands) return `${axisName} ${value}/10`;
    const index = value <= 1 ? 0 : value <= 3 ? 1 : value === 4 ? 2 : value === 5 ? 3 : value === 6 ? 4 : value <= 8 ? 5 : 6;
    return `${axisName} ${value}/10 — ${bands[index]}`;
  }

