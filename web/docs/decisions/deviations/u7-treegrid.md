# Anatomy tree as a treegrid

Chunk: U7, A1
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

The anatomy tree is a tree widget (`#tree`, rows with `aria-selected`) with the visibility button inside the row.

## New behaviour

APG Treegrid with the eye buttons in their own cells (see 0002). On a row, Right expands a collapsed row, otherwise moves to the first cell (a leaf's first cell is its eye, as legacy navigator.js:18); Left collapses an expanded row, otherwise moves to the parent. In a cell, Right and Left move between cells, and Left from the first cell returns to the row. Escape returns to the row; V toggles visibility (legacy, kept).

## Standard cited

WAI-ARIA APG Treegrid pattern; WCAG 2.2 SC 4.1.2 (an interactive control cannot nest inside a tree item's name).
