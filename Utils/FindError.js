const fs = require("node:fs");

const STACK_TRACE_REGEX = /at\s+(?:.+)\s+\((.+):(\d+):(\d+)\)/;

module.exports = function FindError(error) {
  if (!error.stack) return;
  const stack = error.stack.split("\n");
  stack.shift();

  let file = "";
  let line = 0;
  let column = 0;
  for (let i = 0; i < stack.length; i++) {
    const match = stack[i].match(STACK_TRACE_REGEX);
    if (!match) continue;
    if (match[1].startsWith("node:")) continue;
    if (match[1].includes("node_modules")) continue;

    file = match[1];
    line = parseInt(match[2]);
    column = parseInt(match[3]);
    break;
  }

  if (!file) return;
  column;

  const contents = fs.readFileSync(file, "utf-8");
  if (!contents) return;

  const fileLines = contents.split("\n");

  const lines = [
    fileLines[line - 3] || "",
    fileLines[line - 2] || "",
    fileLines[line - 1] || "",
    " ".repeat(column - 1) + "^^^",
    fileLines[line] || "",
    fileLines[line + 1] || "",
    fileLines[line + 2] || "",
    fileLines[line + 3] || "",
  ].filter(Boolean);

  return {
    message: error.message,
    stack,
    lines,
  };
};
