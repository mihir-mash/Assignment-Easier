export type PromptCategoryId =
  | "lowercase"
  | "uppercase"
  | "digits"
  | "symbols"
  | "combinations"
  | "words"
  | "sentences";
export type PromptLabelType = "character" | "combination" | "word" | "sentence";
export type PromptContext = "isolated" | "in_word" | "in_sentence";
export type Prompt = {
  id: string;
  text: string;
  labelType: PromptLabelType;
  context: PromptContext;
  alignment: "exact" | "unaligned";
};
export type PromptCategory = {
  id: PromptCategoryId;
  label: string;
  description: string;
  prompts: Prompt[];
};

const characterPrompts = (values: string[], context: PromptContext) =>
  values.map(
    (text, index): Prompt => ({
      id: `${context}-${text.codePointAt(0)?.toString(16) ?? index}`,
      text,
      labelType: "character",
      context,
      alignment: "exact",
    }),
  );
const words = [
  "hello",
  "book",
  "coffee",
  "minimum",
  "letter",
  "little",
  "different",
  "school",
  "beautiful",
  "writing",
  "handwriting",
  "application",
  "engineering",
];
const sentences = [
  "The quick brown fox jumps over the lazy dog.",
  "Handwriting changes naturally depending on the words and letters around it.",
  "Today I am writing notes using my own handwriting.",
  "Good writing should look natural rather than perfectly uniform.",
  "Pack my box with five dozen liquor jugs.",
  "Bright stars shimmer quietly above the old stone bridge.",
  "Please bring two fresh notebooks, a pencil, and a small ruler.",
  "Every careful stroke gives each sentence its own rhythm.",
];

export const promptCategories: PromptCategory[] = [
  {
    id: "lowercase",
    label: "Lowercase letters",
    description: "Write each lowercase character on its own.",
    prompts: characterPrompts(
      "abcdefghijklmnopqrstuvwxyz".split(""),
      "isolated",
    ),
  },
  {
    id: "uppercase",
    label: "Uppercase letters",
    description: "Write each uppercase character on its own.",
    prompts: characterPrompts(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
      "isolated",
    ),
  },
  {
    id: "digits",
    label: "Numbers",
    description: "Write each digit on its own.",
    prompts: characterPrompts("0123456789".split(""), "isolated"),
  },
  {
    id: "symbols",
    label: "Punctuation and symbols",
    description: "Write each mark on its own.",
    prompts: characterPrompts(
      [
        ".",
        ",",
        "!",
        "?",
        ":",
        ";",
        "'",
        '"',
        "(",
        ")",
        "[",
        "]",
        "{",
        "}",
        "-",
        "+",
        "=",
        "/",
        "%",
        "&",
        "@",
        "#",
        "×",
        "÷",
        "≤",
        "≥",
        "≠",
        "±",
        "√",
        "∞",
        "°",
        "_",
        "^",
        "<",
        ">",
        "*",
        "|",
      ],
      "isolated",
    ),
  },
  {
    id: "combinations",
    label: "Letter combinations",
    description: "Write each pair together as one prompted sample.",
    prompts: "th he in er an re on at en nd ti es or te of ed is it al ar"
      .split(" ")
      .map(
        (text): Prompt => ({
          id: `combo-${text}`,
          text,
          labelType: "combination",
          context: "isolated",
          alignment: "exact",
        }),
      ),
  },
  {
    id: "words",
    label: "Words",
    description:
      "Write a whole word. Its letters are not individually aligned.",
    prompts: words.map(
      (text): Prompt => ({
        id: `word-${text}`,
        text,
        labelType: "word",
        context: "in_word",
        alignment: "unaligned",
      }),
    ),
  },
  {
    id: "sentences",
    label: "Sentences",
    description:
      "Write a full sentence. Its letters are not individually aligned.",
    prompts: sentences.map(
      (text, index): Prompt => ({
        id: `sentence-${index + 1}`,
        text,
        labelType: "sentence",
        context: "in_sentence",
        alignment: "unaligned",
      }),
    ),
  },
];

export const allPrompts = promptCategories.flatMap(
  (category) => category.prompts,
);

export function promptIndex(
  categoryId: PromptCategoryId,
  promptId: string,
): number {
  return allPrompts.findIndex(
    (prompt) =>
      prompt.id === promptId &&
      promptCategories
        .find((category) => category.id === categoryId)
        ?.prompts.includes(prompt),
  );
}

export function contextualExamplesFor(character: string): Prompt[] {
  const contextual: Prompt[] = [];
  for (const category of promptCategories) {
    for (const prompt of category.prompts) {
      if (
        prompt.context !== "isolated" &&
        prompt.text.toLowerCase().includes(character.toLowerCase())
      )
        contextual.push(prompt);
    }
  }
  return contextual;
}
