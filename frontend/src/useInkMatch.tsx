import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  defaults,
  layoutDocument,
  validateSettings,
  type Settings,
} from "../../shared/layout";
import {
  exportPdf,
  getHealth,
  detectPaper,
  suggestLines,
  type Suggestions,
} from "./api";
import { readStored, writeStored } from "./storage";
import { NumberField } from "./features/editor/NumberField";
import { initialCorners, type PaperImage } from "./features/paper/PaperCrop";

type Workspace = {
  settings: Settings;
  source: string;
  paper: PaperImage | null;
  preset: string;
  orientation: string;
  custom: [number, number];
};
type SavedTemplate = { name: string; workspace: Workspace };
const initialWorkspace: Workspace = {
  settings: defaults,
  source: "A clear page, written with intention.\n\nx^2 + y^2 = z^2",
  paper: null,
  preset: "A4",
  orientation: "portrait",
  custom: [180, 240],
};
function legacySettings(): Workspace {
  try {
    const saved = JSON.parse(
      localStorage.getItem("inkmatch.stage1.template") ?? "null",
    ) as Record<string, unknown> | null;
    if (!saved) return initialWorkspace;
    const settings = { ...defaults };
    const map = {
      firstBaselineMm: "first_baseline_mm",
      lineSpacingMm: "line_spacing_mm",
      leftMarginMm: "left_margin_mm",
      rightMarginMm: "right_margin_mm",
      offsetXmm: "offset_x_mm",
      offsetYmm: "offset_y_mm",
    } as const;
    for (const [old, key] of Object.entries(map))
      if (typeof saved[old] === "number") settings[key] = saved[old];
    return {
      ...initialWorkspace,
      settings: validateSettings(settings).length ? defaults : settings,
    };
  } catch {
    return initialWorkspace;
  }
}

export function useInkMatch() {
  const [workspace, setWorkspace] = useState<Workspace>(legacySettings);
  const [equationMode, setEquationMode] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [health, setHealth] = useState("Checking backend");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [templateName, setTemplateName] = useState("My paper");
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [exporting, setExporting] = useState(false);
  const uploadRevision = useRef(0);
  const lineRevision = useRef(0);
  const { settings, paper, source } = workspace;
  const effectiveSettings = useMemo(
    () => ({ ...settings, equation_mode: equationMode }),
    [settings, equationMode],
  );
  const layout = useMemo(
    () => layoutDocument(source, effectiveSettings),
    [source, effectiveSettings],
  );
  const acceptedImage =
    paper?.corrected &&
    Math.abs(
      paper.widthMm / paper.heightMm - settings.width_mm / settings.height_mm,
    ) < 0.001
      ? paper.corrected
      : null;

  useEffect(() => {
    let alive = true;
    getHealth()
      .then(() => {
        if (alive) setHealth("Local backend connected");
      })
      .catch(() => {
        if (alive) setHealth("Offline editing available");
      });
    Promise.all([
      readStored<Workspace>("draft"),
      readStored<SavedTemplate[]>("templates"),
    ])
      .then(([draft, saved]) => {
        if (!alive) return;
        if (draft?.settings)
          setWorkspace({
            ...initialWorkspace,
            ...draft,
            settings: { ...defaults, ...draft.settings, equation_mode: false },
          });
        if (Array.isArray(saved)) setTemplates(saved);
      })
      .catch(() => {
        if (alive)
          setNotice(
            "Browser storage is unavailable. Editing still works; saves may not persist.",
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
    if (!ready) return;
    const timer = setTimeout(() => {
      void writeStored("draft", {
        ...workspace,
        settings: { ...settings, equation_mode: false },
      }).catch((error) => setNotice(String(error)));
    }, 400);
    return () => clearTimeout(timer);
  }, [workspace, ready, settings]);
  useEffect(() => {
    lineRevision.current++;
    setSuggestions(null);
  }, [acceptedImage, settings.width_mm, settings.height_mm]);

  const updateSettings = (key: keyof Settings, value: number | string) =>
    setWorkspace((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  const updatePaper = (image: PaperImage) => {
    setWorkspace((current) => ({ ...current, paper: image }));
    setSuggestions(null);
  };
  const pageSize = (
    preset: string,
    orientation: string,
    custom: [number, number],
  ) => {
    const dimensions =
      preset === "A4"
        ? [210, 297]
        : preset === "Letter"
          ? [215.9, 279.4]
          : custom;
    const width = orientation === "landscape" ? dimensions[1] : dimensions[0];
    const height = orientation === "landscape" ? dimensions[0] : dimensions[1];
    setWorkspace((current) => ({
      ...current,
      preset,
      orientation,
      custom,
      settings: { ...current.settings, width_mm: width, height_mm: height },
    }));
    setSuggestions(null);
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const revision = ++uploadRevision.current;
    event.target.value = "";
    try {
      if (!["image/jpeg", "image/png"].includes(file.type))
        throw new Error("Choose a JPG, JPEG or PNG image.");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Image exceeds the 10 MB limit.");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error("Image is malformed or unsupported."));
        img.src = data;
      });
      if (
        Math.max(image.width, image.height) > 8000 ||
        image.width * image.height > 24000000 ||
        Math.min(image.width, image.height) < 100
      )
        throw new Error(
          "Image must be at least 100 pixels, at most 8,000 per side and 24 megapixels.",
        );
      if (revision !== uploadRevision.current) return;
      setNotice("Photo loaded. Looking for the four corners of the sheet...");
      let corners = initialCorners;
      let message =
        "Automatic detection is unavailable. Adjust all four corners manually, then start the backend to preview the crop.";
      try {
        const detected = await detectPaper(data);
        corners = detected.corners;
        message = detected.message;
      } catch {
        /* Manual selection remains available. */
      }
      if (revision !== uploadRevision.current) return;
      updatePaper({
        id: crypto.randomUUID(),
        original: data,
        corners,
        corrected: null,
        widthMm: settings.width_mm,
        heightMm: settings.height_mm,
      });
      setNotice(message);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not upload the image.",
      );
    }
  };
  const saveTemplate = async () => {
    if (validateSettings(settings).length) {
      setNotice("Correct the layout settings before saving.");
      return;
    }
    if (!templateName.trim()) {
      setNotice("Enter a template name.");
      return;
    }
    const saved = {
      name: templateName.trim(),
      workspace: {
        ...workspace,
        settings: { ...settings, equation_mode: false },
      },
    };
    const next = [
      ...templates.filter((template) => template.name !== saved.name),
      saved,
    ];
    try {
      await writeStored("templates", next);
      setTemplates(next);
      setNotice(
        "Template saved locally, including the original image and confirmed crop.",
      );
    } catch (error) {
      setNotice(String(error));
    }
  };
  const findLines = async () => {
    if (!acceptedImage) {
      setNotice("Accept the paper crop before suggesting printed lines.");
      return;
    }
    const revision = ++lineRevision.current;
    try {
      const result = await suggestLines(
        acceptedImage,
        settings.width_mm,
        settings.height_mm,
      );
      if (revision !== lineRevision.current) return;
      setSuggestions(result);
      setNotice(
        "Line suggestions ready for review. Existing settings have not changed.",
      );
    } catch {
      if (revision !== lineRevision.current) return;
      setNotice(
        "Line detection needs the local backend. Manual settings remain available.",
      );
    }
  };
  const download = async () => {
    setExporting(true);
    try {
      const blob = await exportPdf(source, effectiveSettings);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "inkmatch-ink-only.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        "PDF downloaded. Print at Actual size / 100% with fit-to-page disabled.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PDF export failed.");
    } finally {
      setExporting(false);
    }
  };
  const numeric = (
    key: keyof Settings,
    label: string,
    min = 0,
    max = 500,
    step = 0.5,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={Number(settings[key])}
      min={min}
      max={max}
      step={step}
      onChange={(value) => updateSettings(key, value)}
    />
  );

  return {
    workspace,
    setWorkspace,
    equationMode,
    setEquationMode,
    activeTab,
    setActiveTab,
    health,
    notice,
    setNotice,
    ready,
    templates,
    templateName,
    setTemplateName,
    suggestions,
    setSuggestions,
    exporting,
    settings,
    paper,
    source,
    effectiveSettings,
    layout,
    acceptedImage,
    updateSettings,
    updatePaper,
    pageSize,
    upload,
    saveTemplate,
    findLines,
    download,
    numeric,
  };
}
