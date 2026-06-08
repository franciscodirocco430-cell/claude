// Server-side message moderation - pure regex functions
// Client never inserts to messages directly; all messages go through /api/moderate-message

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

// Phone number patterns (various international formats)
export function isPhoneNumber(text: string): boolean {
  const patterns = [
    // US/Canada: +1 (555) 555-5555 or (555) 555-5555 or 555-555-5555
    /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
    // International: +44 20 7946 0958, +61 2 9876 5432
    /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/,
    // Compact numeric strings that look like phone numbers (10+ digits)
    /\b\d{10,15}\b/,
    // With extensions: 555-555-5555 ext 123
    /\d{3}[\s.-]\d{3}[\s.-]\d{4}\s*(ext|x|#)\.?\s*\d+/i,
  ];
  return patterns.some((p) => p.test(text));
}

// Email patterns
export function isEmail(text: string): boolean {
  const pattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  return pattern.test(text);
}

// External URL patterns - allows Google Meet URLs
export function isExternalUrl(text: string): boolean {
  // Allowed patterns (platform-internal or trusted meeting links)
  const allowedPatterns = [
    /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i,
    /meet\.google\.com\/\S+/i,
    /calendar\.google\.com/i,
  ];

  // Check if the URL is in the allowed list
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlPattern);
  if (!urls) return false;

  for (const url of urls) {
    const isAllowed = allowedPatterns.some((p) => p.test(url));
    if (!isAllowed) return true; // Found an external URL that's not allowed
  }

  return false;
}

// Social handle patterns (@username style)
export function isSocialHandle(text: string): boolean {
  const patterns = [
    // Twitter/Instagram/TikTok handle @username
    /(?:^|[\s,])\@[a-zA-Z0-9_]{2,30}(?:\s|$|[,.])/,
    // Telegram: @username or t.me/username
    /t\.me\/[a-zA-Z0-9_]{2,}/i,
    // Discord: username#1234 or discord.gg/...
    /[a-zA-Z0-9_]{2,}#\d{4}/,
    /discord\.gg\/\S+/i,
    // LinkedIn: linkedin.com/in/...
    /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i,
    // WhatsApp: wa.me/...
    /wa\.me\/\d+/i,
    // Skype: skype:username
    /skype:[a-zA-Z0-9._-]+/i,
  ];
  return patterns.some((p) => p.test(text));
}

export function moderateContent(text: string): ModerationResult {
  if (isEmail(text)) {
    return {
      allowed: false,
      reason: "Messages cannot contain email addresses. Use the platform for all communications.",
    };
  }

  if (isPhoneNumber(text)) {
    return {
      allowed: false,
      reason: "Messages cannot contain phone numbers. Use the platform for all communications.",
    };
  }

  if (isSocialHandle(text)) {
    return {
      allowed: false,
      reason: "Messages cannot contain social media handles or external contact info. Keep communications on-platform.",
    };
  }

  if (isExternalUrl(text)) {
    return {
      allowed: false,
      reason: "External URLs are not allowed in messages. Google Meet links are permitted for video calls.",
    };
  }

  return { allowed: true };
}
