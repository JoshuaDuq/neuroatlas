from __future__ import annotations

import sys
import tomllib
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
# Autodoc imports brain_model from this checkout, not from an installed copy;
# the Pygments styles live beside this file.
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

# ---------------------------------------------------------------------------
# Project metadata
# ---------------------------------------------------------------------------
project = "Planum"
author = "Joshua Duquette"
copyright = "2026, Joshua Duquette"
# The Python package's version, so the site cannot name another one. The
# viewer's web/package.json is private and versioned separately, and is not used.
with (PROJECT_ROOT / "pyproject.toml").open("rb") as handle:
    version = release = tomllib.load(handle)["project"]["version"]

# ---------------------------------------------------------------------------
# Extensions
# ---------------------------------------------------------------------------
extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.mathjax",
    "sphinx.ext.intersphinx",
    "myst_parser",
    "sphinx_copybutton",
]

# ---------------------------------------------------------------------------
# Source / build
# ---------------------------------------------------------------------------
source_suffix = {".md": "markdown"}
exclude_patterns = [
    "_build",
    "superpowers",
    "Thumbs.db",
    ".DS_Store",
]

# ---------------------------------------------------------------------------
# Napoleon (docstring style)
# ---------------------------------------------------------------------------
napoleon_numpy_docstring = True
napoleon_google_docstring = True
napoleon_use_param = True
napoleon_use_rtype = True
napoleon_preprocess_types = True

# ---------------------------------------------------------------------------
# Autodoc
# ---------------------------------------------------------------------------
autodoc_typehints = "description"
autodoc_member_order = "bysource"
autodoc_preserve_defaults = True
toc_object_entries_show_parents = "hide"

# ---------------------------------------------------------------------------
# MyST (Markdown support)
# ---------------------------------------------------------------------------
myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "dollarmath",
    "amsmath",
    "substitution",
]
myst_heading_anchors = 4
myst_substitutions = {"release": release}

# ---------------------------------------------------------------------------
# Intersphinx
# ---------------------------------------------------------------------------
intersphinx_mapping = {
    "python": ("https://docs.python.org/3", None),
    "numpy": ("https://numpy.org/doc/stable", None),
    "scipy": ("https://docs.scipy.org/doc/scipy", None),
    "nibabel": ("https://nipy.org/nibabel", None),
}

# ---------------------------------------------------------------------------
# HTML output: furo, coloured from the viewer's own tokens (web/src/styles/tokens.css)
# ---------------------------------------------------------------------------
html_theme = "furo"
html_title = "Planum"
html_baseurl = "https://joshuaduq.github.io/neuroatlas/docs/"
html_static_path = ["_static"]
html_css_files = ["custom.css"]
html_permalinks_icon = "#"
html_show_sphinx = False
html_favicon = "_static/favicon.svg"
templates_path = ["_templates"]
highlight_language = "none"
pygments_style = "planum_style.Light"
pygments_dark_style = "planum_style.Dark"
copybutton_prompt_text = r"\$ |>>> |\.\.\. "
copybutton_prompt_is_regexp = True
copybutton_line_continuation_character = "\\"

html_theme_options = {
    # Light: --surface-base, --surface-navigation, --text-primary, --accent, ...
    "light_css_variables": {
        "color-background-primary": "#ffffff",
        "color-background-secondary": "#f8f9fa",
        "color-background-hover": "#f3f5f6",
        "color-background-border": "#e2e6e9",
        "color-foreground-primary": "#20272c",
        "color-foreground-secondary": "#515b63",
        "color-foreground-muted": "#667078",
        "color-foreground-border": "#7f8a94",
        "color-brand-primary": "#156b6d",
        "color-brand-content": "#156b6d",
        "color-brand-visited": "#0d5557",
        "color-highlight-on-target": "#e8f3f2",
        "color-highlighted-background": "#e8f3f2",
        "color-admonition-background": "#f8f9fa",
        "color-api-name": "#156b6d",
        "color-api-pre-name": "#667078",
        "color-api-background": "#f8f9fa",
        "color-api-background-hover": "#f3f5f6",
        "color-accent-surface": "#e8f3f2",
        "color-on-accent": "#ffffff",
        "color-primary-fill": "#156b6d",
        "color-primary-fill-hover": "#0d5557",
        "color-danger": "#a61b1b",
        "font-stack": '"Source Sans 3 Variable", -apple-system, "Segoe UI", sans-serif',
        "font-stack--monospace": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
    # Dark: the graphite variant of tokens.css.
    "dark_css_variables": {
        "color-background-primary": "#1b1d20",
        "color-background-secondary": "#18191c",
        "color-background-hover": "#25272b",
        "color-background-border": "#303338",
        "color-foreground-primary": "#e9ebee",
        "color-foreground-secondary": "#b6bcc3",
        "color-foreground-muted": "#9ba2aa",
        "color-foreground-border": "#6d737b",
        "color-brand-primary": "#7fd0cc",
        "color-brand-content": "#7fd0cc",
        "color-brand-visited": "#a3e0dc",
        "color-highlight-on-target": "#25272b",
        "color-highlighted-background": "#1f3637",
        "color-admonition-background": "#18191c",
        "color-api-name": "#7fd0cc",
        "color-api-pre-name": "#9ba2aa",
        "color-api-background": "#18191c",
        "color-api-background-hover": "#25272b",
        "color-accent-surface": "#1f3637",
        "color-on-accent": "#ffffff",
        "color-primary-fill": "#2a7678",
        "color-primary-fill-hover": "#24686a",
        "color-danger": "#f1928f",
    },
    "sidebar_hide_name": True,
    "navigation_with_keys": False,
    "top_of_page_buttons": ["view"],
    "source_repository": "https://github.com/JoshuaDuq/neuroatlas",
    "source_branch": "main",
    "source_directory": "docs/",
}

html_context = {"viewer_url": "https://joshuaduq.github.io/neuroatlas/"}


def _drop_tuple_aliases(app, what, name, obj, options, lines):
    """Remove the "Alias for field number N" text that NamedTuple fields carry."""
    lines[:] = [line for line in lines if not line.startswith("Alias for field number")]


def setup(app):
    app.connect("autodoc-process-docstring", _drop_tuple_aliases)
