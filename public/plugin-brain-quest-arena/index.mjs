import { jsx, jsxs, Fragment } from "react/jsx-runtime";
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useState, useEffect, useMemo, useCallback, useRef } = React;
  const { Zap, Heart, Target, Award, RotateCcw, ArrowLeft } = icons;
  const HOLE_COUNT = 6;
  const ROUND_TIME = 60;
  const START_HP = 5;
  const WIN_THRESHOLD = 3;
  const LEVEL_POINTS = [3, 2, 1];
  const helpers = () => {
    var _a;
    return (_a = sdk.shared.getState()) == null ? void 0 : _a.bqHelpers;
  };
  const backToTree = () => {
    var _a;
    const bq = (_a = sdk.shared.getState()) == null ? void 0 : _a.bq;
    if (bq) sdk.shared.setState({ bq: { ...bq, challenge: false, phase: "map" } });
    sdk.useHostStore.setState({ activeId: "plugin-brain-quest" });
  };
  const freshGame = () => ({
    phase: "playing",
    score: 0,
    hp: START_HP,
    combo: 0,
    maxCombo: 0,
    timeLeft: ROUND_TIME,
    correct: 0,
    wrong: 0,
    questionText: "",
    questionTermId: "",
    holeTermIds: []
  });
  const useGame = sdk.create(() => ({
    phase: "menu",
    mode: "whack-term",
    score: 0,
    hp: START_HP,
    combo: 0,
    maxCombo: 0,
    timeLeft: ROUND_TIME,
    correct: 0,
    wrong: 0,
    questionText: "",
    questionTermId: "",
    holeTermIds: []
  }));
  const colors = {
    hole: "#1e293b",
    holeRim: "#334155",
    pop: "#3b82f6",
    popCorrect: "#22c55e",
    popWrong: "#ef4444",
    hp: "#ef4444",
    muted: "#64748b"
  };
  const jparse = (s, fb) => {
    try {
      return JSON.parse(s);
    } catch {
      return fb;
    }
  };
  const useBq = () => sdk.shared((s) => s == null ? void 0 : s.bq);
  function Arena() {
    const bq = useBq();
    const treeId = (bq == null ? void 0 : bq.treeId) || "";
    const postId = (bq == null ? void 0 : bq.postId) || "";
    const isChallenge = !!(bq == null ? void 0 : bq.challenge);
    const lexicon = store.useChildren(treeId, "lexicon");
    const node = store.usePost(postId);
    const { phase } = useGame();
    const nodeId = (bq == null ? void 0 : bq.nodeId) || "";
    const gameLexicon = useMemo(() => {
      if (!isChallenge || !nodeId || lexicon.length < 4) return lexicon;
      const filtered = lexicon.filter((l) => {
        const nodes = jparse(String(l.data.nodes || "[]"), []);
        return nodes.includes(nodeId);
      });
      return filtered.length >= 4 ? filtered : lexicon;
    }, [lexicon, nodeId, isChallenge]);
    if (!treeId) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Otwórz BrainQuest i wybierz drzewo wiedzy" });
    if (gameLexicon.length < 4) return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Placeholder, { text: "Za mało terminów — załaduj drzewo w BrainQuest" }),
      /* @__PURE__ */ jsxs(ui.Button, { outline: true, onClick: backToTree, children: [
        /* @__PURE__ */ jsx(ArrowLeft, { size: 16 }),
        " Wróć do drzewa"
      ] })
    ] }) });
    if (isChallenge && phase === "menu") return /* @__PURE__ */ jsx(ChallengeIntro, { node, lexicon: gameLexicon });
    if (phase === "menu") return /* @__PURE__ */ jsx(MenuScreen, { lexicon: gameLexicon });
    if (phase === "playing") return /* @__PURE__ */ jsx(GameScreen, { lexicon: gameLexicon });
    return /* @__PURE__ */ jsx(SummaryScreen, {});
  }
  function ChallengeIntro({ node, lexicon }) {
    const title = node ? String(node.data.title) : "???";
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(ui.Stage, { children: /* @__PURE__ */ jsx(
      ui.StageLayout,
      {
        top: /* @__PURE__ */ jsxs(ui.Stack, { gap: "md", children: [
          /* @__PURE__ */ jsx(ui.StepHeading, { title, subtitle: `Traf ${WIN_THRESHOLD}x by odblokować` }),
          /* @__PURE__ */ jsxs(ui.Stats, { children: [
            /* @__PURE__ */ jsx(ui.Stat, { title: "Terminy", value: lexicon.length }),
            /* @__PURE__ */ jsx(ui.Stat, { title: "Życia", value: START_HP }),
            /* @__PURE__ */ jsx(ui.Stat, { title: "Czas", value: `${ROUND_TIME}s` })
          ] })
        ] }),
        bottom: /* @__PURE__ */ jsxs(ui.Stack, { children: [
          /* @__PURE__ */ jsx(ui.Button, { size: "lg", color: "primary", block: true, onClick: () => useGame.setState(freshGame()), children: "DO BOJU!" }),
          /* @__PURE__ */ jsxs(ui.Button, { size: "lg", outline: true, block: true, onClick: backToTree, children: [
            /* @__PURE__ */ jsx(ArrowLeft, { size: 14 }),
            " Wróć"
          ] })
        ] })
      }
    ) }) });
  }
  function MenuScreen({ lexicon }) {
    const { mode } = useGame();
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(ui.Stage, { children: /* @__PURE__ */ jsx(
      ui.StageLayout,
      {
        top: /* @__PURE__ */ jsxs(ui.Stack, { gap: "md", children: [
          /* @__PURE__ */ jsx(ui.StepHeading, { title: "Whack-a-Term!", subtitle: "Trening wolny" }),
          /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
            /* @__PURE__ */ jsx(ui.Text, { bold: true, children: "Tryb gry" }),
            /* @__PURE__ */ jsx(ui.Tabs, { tabs: [
              { id: "whack-term", label: "Definicja → Termin" },
              { id: "whack-def", label: "Termin → Definicja" }
            ], active: mode, onChange: (id) => useGame.setState({ mode: id }) })
          ] }) }),
          /* @__PURE__ */ jsxs(ui.Stats, { children: [
            /* @__PURE__ */ jsx(ui.Stat, { title: "Terminy", value: lexicon.length }),
            /* @__PURE__ */ jsx(ui.Stat, { title: "Czas", value: `${ROUND_TIME}s` }),
            /* @__PURE__ */ jsx(ui.Stat, { title: "Życia", value: START_HP })
          ] })
        ] }),
        bottom: /* @__PURE__ */ jsx(ui.Button, { size: "lg", color: "primary", block: true, onClick: () => useGame.setState(freshGame()), children: "Start!" })
      }
    ) }) });
  }
  function GameScreen({ lexicon }) {
    const { score, hp, combo, timeLeft, mode } = useGame();
    const bq = useBq();
    const isChallenge = !!(bq == null ? void 0 : bq.challenge);
    const [holes, setHoles] = useState(() => Array(HOLE_COUNT).fill(null));
    const [question, setQuestion] = useState(null);
    const [shakeHole, setShakeHole] = useState(null);
    const gameActive = useRef(true);
    const timerRef = useRef(null);
    const usedRecently = useRef(/* @__PURE__ */ new Set());
    const pickRandom = useCallback(() => {
      const pool = lexicon.filter((l) => !usedRecently.current.has(l.id));
      const source = pool.length >= 4 ? pool : lexicon;
      return source[Math.floor(Math.random() * source.length)];
    }, [lexicon]);
    const endGame = useCallback((reason) => {
      var _a;
      gameActive.current = false;
      clearInterval(timerRef.current);
      const state = useGame.getState();
      if (isChallenge && state.correct >= WIN_THRESHOLD && (bq == null ? void 0 : bq.postId)) {
        (_a = helpers()) == null ? void 0 : _a.unlockNode(bq.postId);
        sdk.log(`Węzeł odblokowany! (${state.correct} trafień)`, "ok");
      }
      useGame.setState({ phase: "summary", ...reason === "time" ? { timeLeft: 0 } : { hp: 0 } });
    }, [isChallenge, bq]);
    const nextQuestion = useCallback(() => {
      if (!gameActive.current) return;
      const correct = pickRandom();
      usedRecently.current.add(correct.id);
      if (usedRecently.current.size > Math.floor(lexicon.length * 0.6)) usedRecently.current.clear();
      const distractors = [...lexicon.filter((l) => l.id !== correct.id)].sort(() => Math.random() - 0.5).slice(0, HOLE_COUNT - 1);
      const allTerms = [correct, ...distractors].sort(() => Math.random() - 0.5);
      const termName = String(correct.data.term);
      const def = String(correct.data.definition);
      const quiz = jparse(String(correct.data.quiz || "{}"), {});
      const texts = mode === "whack-term" ? [
        quiz.question || def,
        quiz.hint || def,
        def
      ].filter((v, i, a) => a.indexOf(v) === i) : [termName];
      setQuestion({ termId: correct.id, texts, level: 0 });
      useGame.setState({ questionText: texts[0], questionTermId: correct.id, holeTermIds: allTerms.map((t) => t.id) });
      setHoles(Array(HOLE_COUNT).fill(null));
      const indices = Array.from({ length: HOLE_COUNT }, (_, i) => i).sort(() => Math.random() - 0.5);
      allTerms.forEach((t, i) => {
        if (i >= HOLE_COUNT) return;
        setTimeout(() => {
          if (!gameActive.current) return;
          setHoles((prev) => {
            const next = [...prev];
            next[indices[i]] = {
              termId: t.id,
              term: mode === "whack-term" ? String(t.data.term) : String(t.data.definition).slice(0, 50),
              visible: true,
              hit: false,
              wrong: false
            };
            return next;
          });
        }, 200 + Math.random() * 800);
      });
    }, [lexicon, mode, pickRandom]);
    const whack = useCallback((idx) => {
      var _a;
      const hole = holes[idx];
      if (!hole || !hole.visible || hole.hit || hole.wrong || !question) return;
      if (hole.termId === question.termId) {
        setHoles((prev) => {
          const n = [...prev];
          n[idx] = { ...hole, hit: true };
          return n;
        });
        const newCombo = useGame.getState().combo + 1;
        const levelPts = LEVEL_POINTS[question.level] || 1;
        useGame.setState((s) => ({
          score: s.score + levelPts * (1 + Math.floor(newCombo / 3)),
          combo: newCombo,
          maxCombo: Math.max(s.maxCombo, newCombo),
          correct: s.correct + 1
        }));
        (_a = helpers()) == null ? void 0 : _a.discover(hole.termId);
        setTimeout(() => {
          if (gameActive.current) nextQuestion();
        }, 600);
      } else {
        setHoles((prev) => {
          const n = [...prev];
          n[idx] = { ...hole, wrong: true };
          return n;
        });
        setShakeHole(idx);
        setTimeout(() => setShakeHole(null), 400);
        const newHp = useGame.getState().hp - 1;
        if (newHp <= 0) {
          useGame.setState({ hp: 0, combo: 0, wrong: useGame.getState().wrong + 1 });
          endGame("dead");
        } else {
          useGame.setState((s) => ({ hp: newHp, combo: 0, wrong: s.wrong + 1 }));
        }
      }
    }, [holes, question, nextQuestion, endGame]);
    useEffect(() => {
      gameActive.current = true;
      nextQuestion();
      timerRef.current = setInterval(() => {
        const t = useGame.getState().timeLeft;
        if (t <= 1) {
          endGame("time");
          return;
        }
        useGame.setState({ timeLeft: t - 1 });
      }, 1e3);
      return () => {
        gameActive.current = false;
        clearInterval(timerRef.current);
      };
    }, []);
    const progress = isChallenge ? Math.min(useGame.getState().correct / WIN_THRESHOLD, 1) : null;
    const holeStyle = (hole, i) => ({
      aspectRatio: "7/5",
      background: !(hole == null ? void 0 : hole.visible) ? colors.hole : hole.hit ? colors.popCorrect : hole.wrong ? colors.popWrong : colors.pop,
      borderRadius: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: (hole == null ? void 0 : hole.visible) && !hole.hit && !hole.wrong ? "pointer" : "default",
      border: `3px solid ${!(hole == null ? void 0 : hole.visible) ? colors.holeRim : hole.hit ? "#16a34a" : hole.wrong ? "#dc2626" : "#2563eb"}`,
      transition: "all 0.15s ease",
      transform: shakeHole === i ? "translateX(4px)" : (hole == null ? void 0 : hole.visible) ? "scale(1.05)" : "scale(0.95)",
      opacity: (hole == null ? void 0 : hole.visible) ? 1 : 0.4,
      padding: "8px",
      textAlign: "center",
      userSelect: "none"
    });
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(ui.Stage, { children: /* @__PURE__ */ jsx(
      ui.StageLayout,
      {
        top: /* @__PURE__ */ jsxs(ui.Stack, { gap: "md", children: [
          /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
            /* @__PURE__ */ jsxs(ui.Row, { gap: "sm", children: [
              /* @__PURE__ */ jsxs(ui.Badge, { color: "warning", children: [
                score,
                " pkt"
              ] }),
              combo > 1 && /* @__PURE__ */ jsxs(ui.Badge, { color: "accent", children: [
                "x",
                combo,
                "!"
              ] })
            ] }),
            /* @__PURE__ */ jsxs(ui.Badge, { color: timeLeft <= 10 ? "error" : "info", children: [
              timeLeft,
              "s"
            ] }),
            /* @__PURE__ */ jsx(ui.Row, { gap: "sm", children: Array.from({ length: START_HP }, (_, i) => /* @__PURE__ */ jsx("span", { style: { color: i < hp ? colors.hp : colors.muted }, children: /* @__PURE__ */ jsx(Heart, { size: 16 }) }, i)) })
          ] }),
          progress !== null && /* @__PURE__ */ jsx("div", { style: { background: "#1e293b", borderRadius: "8px", height: "8px", overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: { width: `${progress * 100}%`, height: "100%", background: progress >= 1 ? "#22c55e" : "#f59e0b", transition: "width 0.3s ease" } }) }),
          /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
            /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
              /* @__PURE__ */ jsxs(ui.Row, { gap: "sm", children: [
                /* @__PURE__ */ jsx(ui.Text, { size: "xs", muted: true, children: mode === "whack-term" ? "Znajdź termin:" : "Znajdź definicję:" }),
                question && /* @__PURE__ */ jsxs(ui.Badge, { color: question.level === 0 ? "accent" : question.level === 1 ? "warning" : "neutral", children: [
                  "+",
                  LEVEL_POINTS[question.level] || 1,
                  " pkt"
                ] })
              ] }),
              question && mode === "whack-term" && question.level < question.texts.length - 1 && /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "ghost", onClick: () => setQuestion((q) => {
                if (!q) return q;
                const next = { ...q, level: q.level + 1 };
                useGame.setState({ questionText: next.texts[next.level] });
                return next;
              }), children: "💡 Łatwiejsze" })
            ] }),
            /* @__PURE__ */ jsx(ui.Heading, { title: question ? question.texts[question.level] : "..." })
          ] }) }),
          /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", width: "100%" }, children: Array.from({ length: HOLE_COUNT }, (_, idx) => {
            const hole = holes[idx];
            return /* @__PURE__ */ jsx("div", { style: holeStyle(hole, idx), onClick: () => whack(idx), children: (hole == null ? void 0 : hole.visible) ? /* @__PURE__ */ jsx("span", { style: { color: "#fff", fontSize: "13px", fontWeight: 600, lineHeight: 1.2 }, children: hole.term }) : /* @__PURE__ */ jsx("span", { style: { color: colors.muted, fontSize: "24px" }, children: "?" }) }, idx);
          }) })
        ] })
      }
    ) }) });
  }
  function SummaryScreen() {
    const { score, correct, wrong, maxCombo, hp } = useGame();
    const bq = useBq();
    const isChallenge = !!(bq == null ? void 0 : bq.challenge);
    const won = correct >= WIN_THRESHOLD;
    const node = store.usePost((bq == null ? void 0 : bq.postId) || "");
    const nodeTitle = node ? String(node.data.title) : "";
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(ui.Stage, { children: /* @__PURE__ */ jsx(
      ui.StageLayout,
      {
        top: /* @__PURE__ */ jsxs(ui.Stack, { gap: "md", children: [
          /* @__PURE__ */ jsx(
            ui.StepHeading,
            {
              title: isChallenge ? won ? "Odblokowano!" : "Spróbuj ponownie" : hp <= 0 ? "Koniec żyć!" : "Czas minął!",
              subtitle: isChallenge ? won ? `„${nodeTitle}" odblokowany!` : `Potrzeba ${WIN_THRESHOLD} trafień` : "Podsumowanie"
            }
          ),
          /* @__PURE__ */ jsxs(ui.Stats, { children: [
            /* @__PURE__ */ jsx(ui.Stat, { title: "Wynik", value: score }),
            /* @__PURE__ */ jsx(ui.Stat, { title: "Trafione", value: correct, color: "success" }),
            /* @__PURE__ */ jsx(ui.Stat, { title: "Pudła", value: wrong, color: "error" }),
            /* @__PURE__ */ jsx(ui.Stat, { title: "Max combo", value: maxCombo })
          ] }),
          /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
            /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
              /* @__PURE__ */ jsx(ui.Text, { children: "Celność" }),
              /* @__PURE__ */ jsxs(ui.Text, { bold: true, children: [
                correct + wrong > 0 ? Math.round(correct / (correct + wrong) * 100) : 0,
                "%"
              ] })
            ] }),
            isChallenge && /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
              /* @__PURE__ */ jsx(ui.Text, { children: "Próg" }),
              /* @__PURE__ */ jsxs(ui.Badge, { color: won ? "success" : "error", children: [
                correct,
                "/",
                WIN_THRESHOLD
              ] })
            ] })
          ] }) })
        ] }),
        bottom: /* @__PURE__ */ jsx(ui.Stack, { children: isChallenge ? /* @__PURE__ */ jsxs(Fragment, { children: [
          !won && /* @__PURE__ */ jsxs(ui.Button, { size: "lg", color: "primary", block: true, onClick: () => useGame.setState(freshGame()), children: [
            /* @__PURE__ */ jsx(RotateCcw, { size: 16 }),
            " Ponów"
          ] }),
          /* @__PURE__ */ jsxs(ui.Button, { size: "lg", color: won ? "primary" : void 0, outline: !won, block: true, onClick: () => {
            useGame.setState({ phase: "menu" });
            backToTree();
          }, children: [
            /* @__PURE__ */ jsx(ArrowLeft, { size: 16 }),
            " Drzewo"
          ] })
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(ui.Button, { size: "lg", color: "primary", block: true, onClick: () => useGame.setState(freshGame()), children: [
            /* @__PURE__ */ jsx(RotateCcw, { size: 16 }),
            " Jeszcze raz!"
          ] }),
          /* @__PURE__ */ jsx(ui.Button, { size: "lg", outline: true, block: true, onClick: () => useGame.setState({ phase: "menu" }), children: "Menu" })
        ] }) })
      }
    ) }) });
  }
  function CheatSheet() {
    const { phase, holeTermIds } = useGame();
    const bq = useBq();
    const treeId = (bq == null ? void 0 : bq.treeId) || "";
    (bq == null ? void 0 : bq.postId) || "";
    const discoveries = store.usePosts("discovery");
    const lexicon = store.useChildren(treeId, "lexicon");
    const discoveredSet = useMemo(
      () => new Set(discoveries.map((d) => String(d.data.termId))),
      [discoveries]
    );
    const discovered = useMemo(() => {
      if (!holeTermIds || holeTermIds.length === 0) return [];
      const holeSet = new Set(holeTermIds);
      return lexicon.filter((l) => holeSet.has(l.id) && discoveredSet.has(l.id)).map((l) => ({
        id: l.id,
        term: String(l.data.term || ""),
        definition: String(l.data.definition || "")
      }));
    }, [lexicon, holeTermIds, discoveredSet]);
    if (phase !== "playing") return null;
    return /* @__PURE__ */ jsx(ui.Box, { header: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(ui.Cell, { onClick: backToTree, children: /* @__PURE__ */ jsx(ArrowLeft, { size: 14 }) }),
      /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Odkryte terminy" })
    ] }), body: /* @__PURE__ */ jsx(ui.Stack, { gap: "sm", children: discovered.map((t) => /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { gap: "xs", children: [
      /* @__PURE__ */ jsx(ui.Text, { size: "xs", bold: true, children: t.term }),
      /* @__PURE__ */ jsx(ui.Text, { size: "xs", muted: true, children: t.definition })
    ] }) }, t.id)) }), grow: true });
  }
  function Progress() {
    const bq = useBq();
    const treeId = (bq == null ? void 0 : bq.treeId) || "";
    const nodes = store.useChildren(treeId, "node");
    if (!treeId) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz drzewo" });
    const str = (n) => Math.min((Number(n.data.hits) || 0) / 5, 1);
    const d = nodes.filter((n) => Number(n.data.hits) > 0);
    return /* @__PURE__ */ jsx(ui.Box, { header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Postęp" }), body: d.length === 0 ? /* @__PURE__ */ jsx(ui.Placeholder, { text: "Odkrywaj węzły na mapie", children: /* @__PURE__ */ jsx(Award, { size: 32 }) }) : /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { title: "Odkryte", value: `${d.length}/${nodes.length}` }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Opanowane", value: `${nodes.filter((n) => str(n) >= 1).length}` })
      ] }),
      d.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8).map((n) => /* @__PURE__ */ jsxs(ui.Row, { gap: "sm", children: [
        str(n) >= 1 ? /* @__PURE__ */ jsx(Award, { size: 12 }) : /* @__PURE__ */ jsx(Zap, { size: 12 }),
        /* @__PURE__ */ jsx(ui.Text, { size: "sm", children: String(n.data.title) })
      ] }, n.id))
    ] }), grow: true });
  }
  sdk.registerView("bqa.left", { slot: "left", component: CheatSheet });
  sdk.registerView("bqa.center", { slot: "center", component: Arena });
  sdk.registerView("bqa.right", { slot: "right", component: Progress });
  return { id: "plugin-brain-quest-arena", label: "BQ Arena", icon: Zap, version: "0.4.0" };
};
export {
  plugin as default
};
