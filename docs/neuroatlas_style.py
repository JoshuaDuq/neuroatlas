"""Pygments styles drawn from viewer/styles/tokens.css: teal and one slate, on neutral greys."""

from pygments.style import Style
from pygments.token import (
    Comment,
    Error,
    Generic,
    Keyword,
    Name,
    Number,
    Operator,
    String,
    Token,
)


def _rules(ink, quiet, accent, string, danger):
    return {
        Token: ink,
        Comment: f"italic {quiet}",
        Keyword: f"bold {accent}",
        Keyword.Constant: accent,
        Operator.Word: f"bold {accent}",
        Name.Builtin: accent,
        Name.Function: f"bold {ink}",
        Name.Class: f"bold {ink}",
        Name.Decorator: accent,
        Number: accent,
        String: string,
        Generic.Deleted: danger,
        Generic.Error: danger,
        Generic.Heading: f"bold {ink}",
        Generic.Prompt: quiet,
        Error: danger,
    }


class Light(Style):
    background_color = "#f7f8f9"
    styles = _rules("#1c242b", "#5d6872", "#156b6d", "#3f6285", "#a61b1b")


class Dark(Style):
    background_color = "#18191c"
    styles = _rules("#e9ebee", "#9ba2aa", "#7fd0cc", "#9bb7d4", "#f1928f")
