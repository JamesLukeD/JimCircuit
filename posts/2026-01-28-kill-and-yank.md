---
title: "Kill and Yank: The Original Cut and Paste"
slug: kill-and-yank
date: 2026-01-28
summary: "Before 'cut and paste' there was 'kill and yank' - a piece of computing lore from the UNIX era."
videoUrl: ""
tags:
  - Lore
  - Terminal
  - Linux
keywords:
  - kill and yank
  - cut and paste history
  - emacs kill ring
  - unix history
  - ctrl+k ctrl+y
  - terminal lore
---

Did you know during the era of UNIX there was no such thing as the term "cut and copy"? Those phrases were popularized much later during the rise of the GUI. During the 1970s, the original term was associated a bit more graphically to **"Kill and Yank"** — specifically via tools like Emacs and the Bash shell. A classic piece of lore.

## The Kill Ring

When a line is "Killed" using the commands `Ctrl+K`, it is then removed and added into a **kill ring**. No, not the gulag...

This is essentially a type of buffer which in turn can be "Yanked" out of the ~~gulag~~ kill ring and reestablished back into the terminal with the commands `Ctrl+Y`.

## The Commands

| Action | Shortcut | What it does |
|--------|----------|--------------|
| Kill | `Ctrl+K` | Removes text from cursor to end of line, stores in kill ring |
| Yank | `Ctrl+Y` | Pastes the most recent kill |
| Yank Pop | `Alt+Y` | Cycle through older kills (after yanking) |

## Conclusion

So don't feel bad next time you kill and yank a line of code. No syntax was (permanently) harmed in the making of this article... I don't think.
