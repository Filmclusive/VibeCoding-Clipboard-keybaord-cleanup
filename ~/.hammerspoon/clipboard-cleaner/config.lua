local M = {}

local function escapeForLuaPattern(text)
  if not text then
    return ""
  end
  return text:gsub("([%^%$%(%)%%%.%[%]%*%+%-%?])", "%%%1")
end

-- Helpers exported for users who want to add phrase removal rules.
function M.literalPhrase(text)
  return {
    pattern = escapeForLuaPattern(text),
    raw = text,
    type = "literal"
  }
end

function M.regexPhrase(pattern)
  return {
    pattern = pattern,
    raw = pattern,
    type = "regex"
  }
end

M.enabled = true

M.menuTitles = {
  on = "CLN",
  off = "OFF"
}

-- Apps listed by bundle ID or localized name. Add app bundle IDs from /Applications/<App>.app/Contents/Info.plist.
M.excludedApps = {
  "com.todesktop.230313mzl4w4u92", -- Cursor (may change per install)
  "com.microsoft.VSCode",
  "com.googlecode.iterm2",
  "com.apple.Terminal",
  "com.finaldraft.FinalDraft",
  "1Password 8" -- Example an app that only exposes a name, not bundle ID
}

M.rules = {
  collapseRepeatedSpaces = true,
  collapseExtraBlankLines = true,
  removeTrailingSpacesBeforeNewline = true,
  normalizeNbsp = true,
  removeZeroWidthSpaces = true,
  trimLeadingAndTrailing = false,

  -- Add or edit removal phrases below. Use literalPhrase for exact text, regexPhrase when you need patterns.
  removePhrases = {
    -- Example literal entry to drop "[DRAFT]" from any clipboard text:
    -- M.literalPhrase("[DRAFT]")

    -- Example regex-driven removal (Lua patterns):
    -- M.regexPhrase("%s*\[COPY\]\s*")
  }
}

return M
