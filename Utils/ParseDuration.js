function ParseDurationString(input) {
  if (typeof input !== "string") {
    throw new Error("Duration must be a string");
  }

  const str = input.trim();
  if (!str) throw new Error("Duration cannot be empty");

  if (/^\d{1,7}(:\d{1,2}){1,2}$/.test(str)) {
    const parts = str.split(":").map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n) || n < 0)) {
      throw new Error(`Invalid timestamp: "${str}"`);
    }

    let h = 0,
      m = 0,
      s = 0;
    if (parts.length === 2) {
      [m, s] = parts;
    } else if (parts.length === 3) {
      [h, m, s] = parts;
    }

    if (m > 59 || s > 59) {
      throw new Error(`Invalid timestamp minutes/seconds in "${str}"`);
    }

    const ms = (h * 3600 + m * 60 + s) * 1000;
    _guardSafeInteger(ms, str);
    return ms;
  }

  const tokenRe = /(\d[\d_,]*(?:\.\d+)?)[\s]*([a-zA-Z]+)|\s+/g;
  let match;
  let foundAnyPair = false;
  let total = 0;

  while ((match = tokenRe.exec(str)) !== null) {
    if (!match[1] && !match[2]) continue;

    const rawNum = (match[1] || "").replace(/[_ ,]/g, "");
    const unitRaw = (match[2] || "").toLowerCase();

    if (!rawNum || !unitRaw) {
      throw new Error(
        `Duration must be in number + unit pairs (e.g., "2h 30m"). Offender: "${match[0].trim()}"`
      );
    }

    const n = parseFloat(rawNum);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`Invalid number in duration: "${rawNum}"`);
    }

    const unit = _normalizeUnit(unitRaw);
    if (!unit) {
      throw new Error(
        `Invalid time unit "${unitRaw}". Use one of: ms, s/sec/second(s), m/min/minute(s), h/hr/hour(s), d/day(s)`
      );
    }

    const ms = n * _unitToMs(unit);
    if (!Number.isFinite(ms)) {
      throw new Error(`Duration overflow for token "${match[0].trim()}"`);
    }

    total += ms;
    foundAnyPair = true;
  }

  if (!foundAnyPair) {
    throw new Error(
      `Could not parse duration: "${str}". Try formats like "2h 30m", "45s", "1500ms", or "01:30:00".`
    );
  }

  _guardSafeInteger(total, str);
  return Math.floor(total);
}

function _normalizeUnit(u) {
  switch (u) {
    case "ms":
    case "msec":
    case "msecs":
    case "millisecond":
    case "milliseconds":
      return "ms";
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return "s";
    case "m":
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return "m";
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return "h";
    case "d":
    case "day":
    case "days":
      return "d";
    default:
      return null;
  }
}

function _unitToMs(unit) {
  switch (unit) {
    case "ms":
      return 1;
    case "s":
      return 1000;
    case "m":
      return 60 * 1000;
    case "h":
      return 60 * 60 * 1000;
    case "d":
      return 24 * 60 * 60 * 1000;
    default:
      return NaN;
  }
}

function _guardSafeInteger(ms, ctx) {
  if (!Number.isFinite(ms) || ms < 0 || ms > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Duration out of range for "${ctx}"`);
  }
}

module.exports = { ParseDurationString };
