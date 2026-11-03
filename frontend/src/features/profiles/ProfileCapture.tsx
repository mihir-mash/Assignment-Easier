import { useEffect, useMemo, useRef, useState } from "react";
import { readStored, writeStored } from "../../storage";
import { CaptureCanvas, type CaptureCanvasHandle } from "./CaptureCanvas";
import {
  createProfile,
  createProfileSample,
  getProfile,
  listProfileSamples,
  normalizeStrokeData,
  type ProfileSampleSummary,
  type SampleCreatePayload,
  type StrokeData,
} from "./api";
import {
  emptyStrokeData,
  type CaptureDraft,
  type CompletedCapture,
} from "./captureTypes";
import { allPrompts, promptCategories, type PromptCategoryId } from "./prompts";

const DRAFT_KEY = "stylus-capture-draft";
const epochNow = () => performance.timeOrigin + performance.now();

function recoveredDraft(draft: CaptureDraft): CaptureDraft {
  const raw = draft.rawStrokeData;
  const activeIndex = raw.strokes.findIndex(
    (stroke) => stroke.end_timestamp === null,
  );
  if (activeIndex < 0) return draft;
  const strokes = raw.strokes.map((stroke, index) =>
    index === activeIndex
      ? {
          ...stroke,
          end_timestamp:
            stroke.points.at(-1)?.timestamp ?? stroke.start_timestamp,
          interrupted: true,
        }
      : stroke,
  );
  const timestamp = strokes[activeIndex].end_timestamp ?? 0;
  return {
    ...draft,
    rawStrokeData: {
      ...raw,
      strokes,
      events: [
        ...raw.events,
        { type: "session_interrupted", stroke_index: activeIndex, timestamp },
      ],
    },
    paused: true,
    finished: false,
  };
}

function renderSamplePreview(raw: StrokeData): string {
  const canvas = document.createElement("canvas");
  const aspect = raw.canvas.width_px / Math.max(1, raw.canvas.height_px);
  canvas.width = 600;
  canvas.height = Math.max(
    220,
    Math.min(440, Math.round(600 / Math.max(0.7, aspect))),
  );
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Sample preview could not be rendered in this browser.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#244c37";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of raw.strokes) {
    if (stroke.points.length === 0) continue;
    context.beginPath();
    context.moveTo(
      stroke.points[0].x * canvas.width,
      stroke.points[0].y * canvas.height,
    );
    for (const point of stroke.points.slice(1))
      context.lineTo(point.x * canvas.width, point.y * canvas.height);
    context.stroke();
  }
  return canvas.toDataURL("image/png");
}

function pointsIn(raw: StrokeData) {
  return raw.strokes.reduce((total, stroke) => total + stroke.points.length, 0);
}

function makePayload(capture: CompletedCapture): SampleCreatePayload {
  const prompt = capture.prompt;
  return {
    source_type: "stylus",
    prompt_text: prompt.text,
    label_type: prompt.labelType,
    label_text: prompt.text,
    context: prompt.context,
    repetition_number: capture.repetitionNumber,
    label_alignment: prompt.alignment,
    dimensions: capture.rawStrokeData.canvas,
    processing_status: "pending",
    quality_indicators: {},
    stroke_data: capture.rawStrokeData,
  };
}

export function ProfileCapture() {
  const [draft, setDraftState] = useState<CaptureDraft | null>(null);
  const draftRef = useRef<CaptureDraft | null>(null);
  const canvasRef = useRef<CaptureCanvasHandle>(null);
  const persistenceChain = useRef<Promise<void>>(Promise.resolve());
  const [profileName, setProfileName] = useState("My handwriting");
  const [serverSamples, setServerSamples] = useState<ProfileSampleSummary[]>(
    [],
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const setDraft = (next: CaptureDraft | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const persist = async (next: CaptureDraft) => {
    setDraft(next);
    try {
      await writeStored(DRAFT_KEY, next);
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Capture progress could not be saved.",
      );
      return false;
    }
  };

  useEffect(() => {
    let alive = true;
    void readStored<CaptureDraft>(DRAFT_KEY)
      .then(async (saved) => {
        if (!alive) return;
        if (saved?.version === 1 && saved.profileId) {
          const restored = recoveredDraft(saved);
          setDraft(restored);
          setProfileName(restored.profileName);
          if (restored !== saved) {
            await writeStored(DRAFT_KEY, restored);
            setNotice(
              "Your unfinished sample was recovered and marked interrupted. Resume when ready.",
            );
          }
          try {
            await getProfile(restored.profileId);
            const existing = await listProfileSamples(restored.profileId);
            if (alive) setServerSamples(existing);
          } catch {
            if (alive)
              setNotice(
                "Recovered local progress. The profile service is unavailable; pending samples remain on this device.",
              );
          }
        }
      })
      .catch((error) => {
        if (alive)
          setNotice(
            error instanceof Error
              ? error.message
              : "Saved capture progress could not be opened.",
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !draft) return;
    const snapshot = draft;
    persistenceChain.current = persistenceChain.current
      .catch(() => undefined)
      .then(() => writeStored(DRAFT_KEY, snapshot))
      .catch((error) => {
        setNotice(
          error instanceof Error
            ? error.message
            : "Capture progress could not be saved.",
        );
      });
  }, [ready, draft]);

  useEffect(
    () => () => {
      canvasRef.current?.interrupt("session_interrupted");
      const latest = draftRef.current;
      if (latest) {
        const interrupted = { ...latest, paused: true };
        draftRef.current = interrupted;
        persistenceChain.current = persistenceChain.current
          .catch(() => undefined)
          .then(() => writeStored(DRAFT_KEY, interrupted))
          .catch(() => undefined);
      }
    },
    [],
  );

  const promptPosition = useMemo(() => {
    if (!draft) return 0;
    const position = allPrompts.findIndex(
      (prompt) => prompt.id === draft.promptId,
    );
    return Math.max(0, position);
  }, [draft]);
  const currentPrompt = draft
    ? (allPrompts.find((prompt) => prompt.id === draft.promptId) ??
      allPrompts[0])
    : null;
  const deduplicatedServerSamples = serverSamples.filter(
    (sample) =>
      !draft?.completedSamples.some(
        (completed) => completed.serverId === sample.id,
      ),
  );
  const categoryCounts = new Map<PromptCategoryId, number>();
  for (const category of promptCategories) {
    const promptTexts = new Set(
      category.prompts.map((prompt) => `${prompt.labelType}:${prompt.text}`),
    );
    const localCount =
      draft?.completedSamples.filter((sample) =>
        promptTexts.has(`${sample.prompt.labelType}:${sample.prompt.text}`),
      ).length ?? 0;
    const remoteCount = deduplicatedServerSamples.filter((sample) =>
      promptTexts.has(
        `${sample.label_type}:${sample.label_text ?? sample.prompt_text ?? ""}`,
      ),
    ).length;
    categoryCounts.set(category.id, localCount + remoteCount);
  }

  const beginCapture = async () => {
    if (!profileName.trim()) {
      setNotice("Enter a profile name to begin.");
      return;
    }
    setBusy(true);
    try {
      const profile = await createProfile(profileName.trim());
      const initial: CaptureDraft = {
        version: 1,
        profileId: profile.id,
        profileName: profile.name,
        categoryId: promptCategories[0].id,
        promptId: allPrompts[0].id,
        captureStartedAt: epochNow(),
        rawStrokeData: emptyStrokeData(),
        completedSamples: [],
        skippedPromptIds: [],
        penOnly: true,
        paused: false,
        finished: false,
      };
      if (await persist(initial))
        setNotice("Profile saved locally. Start with the prompt shown.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The handwriting profile could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };

  const updateCurrentData = (rawStrokeData: StrokeData) => {
    const latest = draftRef.current;
    if (latest) setDraft({ ...latest, rawStrokeData });
  };

  const saveCurrent = async (): Promise<boolean> => {
    const latest = draftRef.current;
    const prompt =
      latest && allPrompts.find((item) => item.id === latest.promptId);
    if (!latest || !prompt) return false;
    if (!pointsIn(latest.rawStrokeData)) {
      setNotice("Write the prompt before saving this sample.");
      return false;
    }
    let previewDataUrl: string;
    try {
      previewDataUrl = renderSamplePreview(latest.rawStrokeData);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Sample preview could not be created.",
      );
      return false;
    }
    const duplicateCount = [
      ...latest.completedSamples.filter(
        (sample) => sample.promptId === prompt.id,
      ),
      ...deduplicatedServerSamples.filter(
        (sample) =>
          sample.label_type === prompt.labelType &&
          sample.label_text === prompt.text,
      ),
    ].length;
    const capture: CompletedCapture = {
      localId: crypto.randomUUID(),
      serverId: null,
      promptId: prompt.id,
      prompt,
      repetitionNumber: duplicateCount + 1,
      capturedAt: new Date().toISOString(),
      previewDataUrl,
      rawStrokeData: latest.rawStrokeData,
      normalization: null,
      syncStatus: "pending",
    };
    const resetData = emptyStrokeData(
      latest.rawStrokeData.canvas.width_px,
      latest.rawStrokeData.canvas.height_px,
    );
    const next: CaptureDraft = {
      ...latest,
      captureStartedAt: epochNow(),
      rawStrokeData: resetData,
      completedSamples: [...latest.completedSamples, capture],
      paused: false,
      finished: false,
    };
    if (!(await persist(next))) return false;
    setNotice(
      `Sample ${capture.repetitionNumber} saved on this device. Checking quality locally...`,
    );
    setBusy(true);
    try {
      const normalization = await normalizeStrokeData(capture.rawStrokeData);
      const saved = await createProfileSample(latest.profileId, {
        ...makePayload(capture),
        processing_status: normalization.quality.problems.length
          ? "needs_review"
          : "processed",
        quality_indicators: {
          problems: normalization.quality.problems,
          bbox: normalization.bounding_box,
          stroke_count: normalization.stroke_count,
          duration_ms: normalization.duration_ms,
          has_pressure: normalization.has_pressure,
          has_timing: normalization.has_timing,
        },
      });
      const completed = {
        ...capture,
        serverId: saved.id,
        normalization,
        syncStatus: "saved" as const,
      };
      const after = draftRef.current;
      if (after) {
        await persist({
          ...after,
          completedSamples: after.completedSamples.map((sample) =>
            sample.localId === capture.localId ? completed : sample,
          ),
        });
      }
      setServerSamples((items) => [
        ...items,
        {
          id: saved.id,
          profile_id: latest.profileId,
          prompt_text: prompt.text,
          label_type: prompt.labelType,
          label_text: prompt.text,
          context: prompt.context,
          repetition_number: capture.repetitionNumber,
          label_alignment: prompt.alignment,
        },
      ]);
      if (normalization.quality.problems.length) {
        setNotice(
          `Sample saved. ${normalization.quality.problems.map((problem) => problem.message).join(" ")}`,
        );
      } else {
        setNotice(
          `Sample ${capture.repetitionNumber} saved. Repeat this prompt or continue to the next one.`,
        );
      }
    } catch (error) {
      setNotice(
        `Sample saved on this device. The local profile service could not sync it: ${error instanceof Error ? error.message : "try again later."}`,
      );
    } finally {
      setBusy(false);
    }
    return true;
  };

  const syncPending = async () => {
    const latest = draftRef.current;
    if (!latest) return;
    setBusy(true);
    for (const capture of latest.completedSamples.filter(
      (sample) => sample.syncStatus === "pending",
    )) {
      try {
        const normalization = await normalizeStrokeData(capture.rawStrokeData);
        const saved = await createProfileSample(latest.profileId, {
          ...makePayload(capture),
          processing_status: normalization.quality.problems.length
            ? "needs_review"
            : "processed",
          quality_indicators: { problems: normalization.quality.problems },
        });
        const current = draftRef.current;
        if (!current) continue;
        const completed = {
          ...capture,
          serverId: saved.id,
          normalization,
          syncStatus: "saved" as const,
        };
        await persist({
          ...current,
          completedSamples: current.completedSamples.map((sample) =>
            sample.localId === capture.localId ? completed : sample,
          ),
        });
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "A sample is still waiting to sync.",
        );
        break;
      }
    }
    setBusy(false);
    if (
      !draftRef.current?.completedSamples.some(
        (sample) => sample.syncStatus === "pending",
      )
    )
      setNotice("All saved samples are synced with the local profile service.");
  };

  const moveTo = async (nextPosition: number, skipped = false) => {
    const latest = draftRef.current;
    if (!latest) return;
    if (pointsIn(latest.rawStrokeData) && !(await saveCurrent())) return;
    const bounded = (nextPosition + allPrompts.length) % allPrompts.length;
    const prompt = allPrompts[bounded];
    const category = promptCategories.find((item) =>
      item.prompts.some((entry) => entry.id === prompt.id),
    )!;
    const afterSave = draftRef.current ?? latest;
    const next = {
      ...afterSave,
      categoryId: category.id,
      promptId: prompt.id,
      captureStartedAt: epochNow(),
      rawStrokeData: emptyStrokeData(
        afterSave.rawStrokeData.canvas.width_px,
        afterSave.rawStrokeData.canvas.height_px,
      ),
      skippedPromptIds: skipped
        ? [...new Set([...afterSave.skippedPromptIds, latest.promptId])]
        : afterSave.skippedPromptIds,
    };
    await persist(next);
  };

  const choosePrompt = async (
    categoryId: PromptCategoryId,
    promptId: string,
  ) => {
    const index = allPrompts.findIndex((prompt) => prompt.id === promptId);
    if (index >= 0) await moveTo(index);
    const latest = draftRef.current;
    if (latest && latest.categoryId !== categoryId) {
      const prompt = allPrompts[index];
      await persist({ ...latest, categoryId, promptId: prompt.id });
    }
  };

  const repeatPrompt = async () => {
    const position = promptPosition;
    if (pointsIn(draftRef.current?.rawStrokeData ?? emptyStrokeData())) {
      if (!(await saveCurrent())) return;
    } else {
      const latest = draftRef.current;
      if (latest) {
        await persist({
          ...latest,
          rawStrokeData: emptyStrokeData(
            latest.rawStrokeData.canvas.width_px,
            latest.rawStrokeData.canvas.height_px,
          ),
          captureStartedAt: epochNow(),
        });
      }
    }
    setNotice("Ready for another separate sample of this prompt.");
    if (position !== promptPosition) return;
  };

  const pause = () => {
    canvasRef.current?.interrupt("session_interrupted");
    const latest = draftRef.current;
    if (latest) void persist({ ...latest, paused: true });
  };

  const clearCurrent = () => {
    canvasRef.current?.interrupt("session_interrupted");
    const latest = draftRef.current;
    if (!latest) return;
    void persist({
      ...latest,
      rawStrokeData: emptyStrokeData(
        latest.rawStrokeData.canvas.width_px,
        latest.rawStrokeData.canvas.height_px,
      ),
      captureStartedAt: epochNow(),
    });
    setNotice("Current prompt cleared. Completed samples are unchanged.");
  };

  const undoStroke = () => {
    canvasRef.current?.interrupt("session_interrupted");
    const latest = draftRef.current;
    if (!latest || latest.rawStrokeData.strokes.length === 0) return;
    const lastIndex = latest.rawStrokeData.strokes.length - 1;
    const strokes = latest.rawStrokeData.strokes.slice(0, lastIndex);
    const remainingTypes = [
      ...new Set(strokes.map((stroke) => stroke.pointer_type)),
    ];
    void persist({
      ...latest,
      rawStrokeData: {
        ...latest.rawStrokeData,
        strokes,
        events: latest.rawStrokeData.events.filter(
          (event) => event.stroke_index < lastIndex,
        ),
        pointer_type:
          remainingTypes.length === 1 ? remainingTypes[0] : "unknown",
      },
    });
    setNotice("Last stroke removed.");
  };

  const finishSession = async () => {
    if (
      pointsIn(draftRef.current?.rawStrokeData ?? emptyStrokeData()) &&
      !(await saveCurrent())
    )
      return;
    const latest = draftRef.current;
    if (latest) await persist({ ...latest, paused: true, finished: true });
    setNotice("Session saved. Your progress is ready when you return.");
  };

  const togglePenOnly = (enabled: boolean) => {
    const latest = draftRef.current;
    if (latest) void persist({ ...latest, penOnly: enabled });
  };

  if (!ready)
    return (
      <div className="profile-capture-loading" role="status">
        Loading saved handwriting progress...
      </div>
    );

  if (!draft)
    return (
      <>
        <aside className="control-panel">
          <p className="eyebrow">Stage 2 · guided capture</p>
          <h2>Start a handwriting profile</h2>
          <p className="help">
            Samples and processing stay on this device and the local InkMatch
            service.
          </p>
          <label className="field">
            Profile name
            <input
              value={profileName}
              maxLength={100}
              onChange={(event) => setProfileName(event.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void beginCapture()}
          >
            {busy ? "Creating profile..." : "Create profile and begin"}
          </button>
          {notice && (
            <p role="status" className="capture-message">
              {notice}
            </p>
          )}
        </aside>
        <div className="preview-area capture-intro">
          <h2>A sample at a time</h2>
          <p>
            Write the prompt on the canvas. Each repetition is saved separately
            with its original strokes and a preview image.
          </p>
          <p>
            Mouse input is available for testing. The app does not detect or
            claim that a pen is connected.
          </p>
        </div>
      </>
    );

  if (!currentPrompt) return null;
  const completedCount =
    draft.completedSamples.length + deduplicatedServerSamples.length;
  const pendingCount = draft.completedSamples.filter(
    (sample) => sample.syncStatus === "pending",
  ).length;
  const currentPointCount = pointsIn(draft.rawStrokeData);
  const currentCategory =
    promptCategories.find((category) => category.id === draft.categoryId) ??
    promptCategories[0];

  return (
    <>
      <aside className="control-panel capture-sidebar">
        <p className="eyebrow">Stage 2 · guided capture</p>
        <h2>{draft.profileName}</h2>
        <p className="help">
          One prompt, one sample. Words and sentences stay unaligned to
          individual letters.
        </p>
        <label className="pen-toggle">
          <input
            type="checkbox"
            checked={draft.penOnly}
            onChange={(event) => togglePenOnly(event.target.checked)}
          />
          <span>
            <strong>Pen only</strong>
            <small>
              Touch is ignored. Mouse remains available for testing.
            </small>
          </span>
        </label>
        <label className="field">
          Current category
          <select
            value={draft.categoryId}
            onChange={(event) => {
              const category = promptCategories.find(
                (item) => item.id === event.target.value,
              );
              if (category)
                void choosePrompt(category.id, category.prompts[0].id);
            }}
          >
            {promptCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <div className="capture-progress-label">
          <span>
            Prompt {promptPosition + 1} of {allPrompts.length}
          </span>
          <span>{completedCount} samples</span>
        </div>
        <progress
          value={promptPosition + 1}
          max={allPrompts.length}
          aria-label="Prompt progress"
        />
        <p className="help">
          {currentCategory.label}: {categoryCounts.get(currentCategory.id) ?? 0}{" "}
          samples saved across {currentCategory.prompts.length} prompts.
        </p>
        <details className="prompt-library">
          <summary>Prompt library and category progress</summary>
          {promptCategories.map((category) => (
            <details key={category.id}>
              <summary>
                {category.label} · {categoryCounts.get(category.id) ?? 0}{" "}
                samples
              </summary>
              <p className="help">{category.description}</p>
              <div className="prompt-list">
                {category.prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    className={
                      prompt.id === draft.promptId ? "selected-prompt" : ""
                    }
                    onClick={() => void choosePrompt(category.id, prompt.id)}
                  >
                    {prompt.text}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </details>
        {pendingCount > 0 && (
          <button disabled={busy} onClick={() => void syncPending()}>
            Retry {pendingCount} pending sample{pendingCount === 1 ? "" : "s"}
          </button>
        )}
        {notice && (
          <p className="capture-message" role="status">
            {notice}
          </p>
        )}
        {draft.finished ? (
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void persist({ ...draft, paused: false, finished: false })
            }
          >
            Resume session
          </button>
        ) : draft.paused ? (
          <button
            className="primary"
            disabled={busy}
            onClick={() => void persist({ ...draft, paused: false })}
          >
            Resume capture
          </button>
        ) : (
          <button disabled={busy} onClick={pause}>
            Pause capture
          </button>
        )}
        <button disabled={busy} onClick={() => void finishSession()}>
          Finish session
        </button>
      </aside>

      <div className="preview-area capture-main">
        <div className="capture-prompt-heading">
          <div>
            <p className="eyebrow">{currentCategory.label}</p>
            <h2 className="capture-prompt">{currentPrompt.text}</h2>
            <p className="help">
              Write naturally inside the box. {currentCategory.description}
            </p>
          </div>
          <span className="badge">
            {currentPrompt.labelType} ·{" "}
            {currentPrompt.context.replaceAll("_", " ")}
          </span>
        </div>
        <div className={`capture-board${draft.paused ? " is-paused" : ""}`}>
          <CaptureCanvas
            ref={canvasRef}
            value={draft.rawStrokeData}
            captureStartedAt={draft.captureStartedAt}
            penOnly={draft.penOnly}
            paused={draft.paused || busy}
            onChange={updateCurrentData}
          />
          {(draft.paused || busy) && (
            <p className="capture-pause-overlay">
              {busy
                ? "Saving this sample..."
                : "Capture paused. Resume when ready."}
            </p>
          )}
        </div>
        <div className="capture-actions">
          <button
            disabled={busy}
            onClick={() => void moveTo(promptPosition - 1)}
          >
            Previous
          </button>
          <button disabled={busy} onClick={() => void repeatPrompt()}>
            Repeat prompt
          </button>
          <button disabled={busy || !currentPointCount} onClick={undoStroke}>
            Undo last stroke
          </button>
          <button disabled={busy || !currentPointCount} onClick={clearCurrent}>
            Clear current sample
          </button>
          <button
            disabled={busy}
            onClick={() => void moveTo(promptPosition + 1, true)}
          >
            Skip prompt
          </button>
          <button
            disabled={busy}
            onClick={() => void moveTo(promptPosition + 1)}
          >
            Next
          </button>
          <button
            className="primary"
            disabled={busy || !currentPointCount || draft.paused}
            onClick={() => void saveCurrent()}
          >
            Save sample
          </button>
        </div>
        <div className="capture-saved-heading">
          <h3>Saved samples</h3>
          <span>{completedCount}</span>
        </div>
        {draft.completedSamples.length > 0 ? (
          <div className="capture-sample-strip">
            {draft.completedSamples
              .slice(-12)
              .reverse()
              .map((sample) => (
                <figure key={sample.localId} className="capture-sample-card">
                  <img
                    src={sample.previewDataUrl}
                    alt={`Stroke preview for ${sample.prompt.text}`}
                  />
                  <figcaption>
                    {sample.prompt.text} · sample {sample.repetitionNumber} ·{" "}
                    {sample.syncStatus === "saved" ? "saved" : "on this device"}
                  </figcaption>
                  {sample.normalization?.quality.problems.map((problem) => (
                    <small key={problem.code}>{problem.message}</small>
                  ))}
                </figure>
              ))}
          </div>
        ) : (
          <p className="help">No samples saved in this session yet.</p>
        )}
      </div>
    </>
  );
}
