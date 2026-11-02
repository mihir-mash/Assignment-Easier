from pydantic import BaseModel, ConfigDict, Field, model_validator


class LayoutRequest(BaseModel):
    model_config = ConfigDict(extra='forbid',allow_inf_nan=False)
    source_text: str = Field(default='',max_length=20000)
    equation_mode: bool = False
    width_mm: float = Field(default=210,ge=50,le=1000)
    height_mm: float = Field(default=297,ge=50,le=1000)
    font_size_mm: float = Field(default=5,ge=1,le=20)
    letter_spacing_mm: float = Field(default=.15,ge=0,le=5)
    word_spacing_mm: float = Field(default=.6,ge=0,le=15)
    first_baseline_mm: float = Field(default=40,ge=1,le=999)
    line_spacing_mm: float = Field(default=8,ge=2,le=50)
    left_margin_mm: float = Field(default=20,ge=0,le=500)
    right_margin_mm: float = Field(default=20,ge=0,le=500)
    header_margin_mm: float = Field(default=25,ge=0,le=500)
    footer_margin_mm: float = Field(default=18,ge=0,le=500)
    ink_color: str = Field(default='#263832',pattern=r'^#[0-9a-fA-F]{6}$')
    slant_deg: float = Field(default=0,ge=-25,le=25)
    offset_x_mm: float = Field(default=0,ge=-30,le=30)
    offset_y_mm: float = Field(default=0,ge=-30,le=30)

    @model_validator(mode='after')
    def validate_geometry(self) -> 'LayoutRequest':
        if self.left_margin_mm+self.right_margin_mm+self.font_size_mm*2 >= self.width_mm:
            raise ValueError('Margins leave too little writing width.')
        if self.first_baseline_mm < self.header_margin_mm+self.font_size_mm or self.first_baseline_mm+self.font_size_mm*.3 > self.height_mm-self.footer_margin_mm:
            raise ValueError('First baseline must fit between the header and footer with room for letters.')
        if self.line_spacing_mm < self.font_size_mm*1.25:
            raise ValueError('Line spacing must be at least 1.25 times writing size.')
        return self


class LayoutRunResponse(BaseModel):
    text: str
    draw_text: str
    x_mm: float
    baseline_y_mm: float
    width_mm: float
    font_size_mm: float
    source_range: tuple[int,int]
    kind: str
    ink_color: str
    slant_deg: float


class LayoutPageResponse(BaseModel):
    page_index: int
    width_mm: float
    height_mm: float
    runs: list[LayoutRunResponse]
    warnings: list[str]


class LayoutResponse(BaseModel):
    pages: list[LayoutPageResponse]
    warnings: list[str]
