/**
 * Convert 24-hour time format to 12-hour format with AM/PM
 * @param {string} time24 - Time in 24-hour format (e.g., "14:30", "09:00")
 * @returns {string} Time in 12-hour format (e.g., "2:30 PM", "9:00 AM")
 */
export const formatTime12Hour = (time24) => {
  if (!time24) return "";
  
  // Handle various input formats
  const timeStr = String(time24).trim();
  
  // Match HH:MM or H:MM format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return timeStr; // Return original if format is invalid
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  
  // Determine AM/PM
  const period = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  if (hours === 0) {
    hours = 12; // Midnight (00:00) becomes 12 AM
  } else if (hours > 12) {
    hours = hours - 12; // 13:00 becomes 1 PM
  }
  
  const result = `${hours}:${minutes} ${period}`;
  console.log(`[Time Format] Converting ${time24} → ${result}`); // Debug log
  return result;
};

/**
 * Format a time range from 24-hour to 12-hour format
 * @param {string} startTime - Start time in 24-hour format
 * @param {string} endTime - End time in 24-hour format
 * @param {string} separator - Separator between times (default: " – ")
 * @returns {string} Formatted time range (e.g., "9:00 AM – 5:00 PM")
 */
export const formatTimeRange = (startTime, endTime, separator = " – ") => {
  if (!startTime || !endTime) return "";
  return `${formatTime12Hour(startTime)}${separator}${formatTime12Hour(endTime)}`;
};
