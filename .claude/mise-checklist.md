# Review checklist

Answer every rule pass / fail / n-a against your diff before committing.

## Code

1. No leftover debug code. Grep the diff for print, console, and debugger statements, and for commented-out code.
2. Every new file has a test file named for it (`<name>.test.ts`) beside it, or the task cites a Test exception. List the new files.
3. No `REQ-*` identifiers in code, comments, tests, or strings. Grep the diff.
4. Nothing changed outside the task's Files to modify/create, the progress log excepted. Compare the diff's file list against the task.
5. Changed behavior has a test that fails without the change. Name it.

## Prose

6. Every comment explains why, or a non-obvious what. None restates the code. Read each added comment.
7. No colons, semicolons, or em-dashes inside comment or doc prose. Split into two sentences, or join with a comma, `so`, or `because`. A colon that introduces a code block, a table, or a list is fine. Grep the diff's added comment and Markdown lines for `;`, `—`, and `: `.
