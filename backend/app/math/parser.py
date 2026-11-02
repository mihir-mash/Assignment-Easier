from dataclasses import dataclass
import re


@dataclass(frozen=True)
class VisualToken:
    text: str
    source_start: int
    source_end: int
    kind: str
    scale: float = 1.0

    @property
    def source_range(self) -> tuple[int, int]:
        return (self.source_start, self.source_end)


_SUPERSCRIPTS = str.maketrans("0123456789+-=()", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾")
_SUBSCRIPTS = str.maketrans("0123456789+-=()", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎")
_EXPRESSION = re.compile(r"(?P<base>[^\s^_])(?P<operator>[^\s])(?P<value>[A-Za-z0-9()+\-=])")


def parse_visual_tokens(source_text: str, equation_mode: bool) -> list[VisualToken]:
    if not equation_mode:
        return [VisualToken(char, index, index + 1, "text") for index, char in enumerate(source_text)]

    tokens: list[VisualToken] = []
    index = 0
    while index < len(source_text):
        match = _EXPRESSION.match(source_text, index)
        if match:
            base, operator, value = match.group("base", "operator", "value")
            translated = value.translate(_SUPERSCRIPTS if operator == "^" else _SUBSCRIPTS)
            tokens.append(VisualToken(base, index, index + 1, "math"))
            tokens.append(VisualToken(translated, index + 2, index + 3, "math", 0.72))
            index += 3
            continue
        tokens.append(VisualToken(source_text[index], index, index + 1, "text"))
        index += 1
    return tokens
