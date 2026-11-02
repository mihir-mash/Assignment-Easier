"""Compatibility adapter for the shared equation parser."""
from dataclasses import dataclass
from app.layout.engine import run_shared


@dataclass(frozen=True)
class VisualToken:
    text: str
    source_start: int
    source_end: int
    kind: str
    scale: float = 1

    @property
    def source_range(self) -> tuple[int,int]:
        return self.source_start,self.source_end


def parse_visual_tokens(source_text: str, equation_mode: bool) -> list[VisualToken]:
    tokens = run_shared({'action':'parse','source_text':source_text,'equation_mode':equation_mode})
    return [VisualToken(token['text'],*token['source_range'],token['kind'],token['scale']) for token in tokens]
