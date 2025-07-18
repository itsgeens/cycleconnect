import { format } from 'date-fns';

// Simple timezone mapping based on coordinates
// This is a basic implementation - in production you'd use a proper timezone API
export function getTimezoneFromCoordinates(lat: number, lon: number): string {
  // Map common coordinates to known timezones
  const timezoneMap: { [key: string]: string } = {
    // Australia
    'au': 'Australia/Sydney',
    // US timezones
    'us-east': 'America/New_York',
    'us-central': 'America/Chicago', 
    'us-mountain': 'America/Denver',
    'us-pacific': 'America/Los_Angeles',
    // Europe
    'eu-west': 'Europe/London',
    'eu-central': 'Europe/Paris',
    'eu-east': 'Europe/Moscow',
    // Asia
    'asia-east': 'Asia/Tokyo',
    'asia-southeast': 'Asia/Singapore',
    'asia-south': 'Asia/Kolkata',
  };

  // Determine region based on coordinates
  if (lat >= -50 && lat <= -10 && lon >= 110 && lon <= 155) {
    return timezoneMap['au'];
  } else if (lat >= 25 && lat <= 50 && lon >= -125 && lon <= -66) {
    if (lon >= -90) return timezoneMap['us-east'];
    if (lon >= -105) return timezoneMap['us-central'];
    if (lon >= -120) return timezoneMap['us-mountain'];
    return timezoneMap['us-pacific'];
  } else if (lat >= 35 && lat <= 70 && lon >= -10 && lon <= 40) {
    if (lon <= 0) return timezoneMap['eu-west'];
    if (lon <= 15) return timezoneMap['eu-central'];
    return timezoneMap['eu-east'];
  } else if (lat >= -10 && lat <= 50 && lon >= 95 && lon <= 145) {
    if (lon >= 135) return timezoneMap['asia-east'];
    if (lon >= 110) return timezoneMap['asia-southeast'];
    return timezoneMap['asia-south'];
  }
  
  // Fallback to user's local timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatDateInTimezone(date: Date | string, timezone: string, formatString: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  try {
    // Create a date object in the target timezone
    const timeInTimezone = new Date(dateObj.toLocaleString("en-US", { timeZone: timezone }));
    
    // For date formatting, use the timezone-adjusted date
    if (formatString === 'MMM d, yyyy') {
      return format(timeInTimezone, formatString);
    } else if (formatString === 'h:mm a') {
      return format(timeInTimezone, formatString);
    }
    
    return format(timeInTimezone, formatString);
  } catch (error) {
    console.warn('Error formatting date in timezone:', error);
    return format(dateObj, formatString);
  }
}

export function convertToTimezone(date: Date | string, timezone: string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  try {
    // Get the timezone offset in minutes
    const tempDate = new Date(dateObj.toLocaleString("en-US", { timeZone: timezone }));
    const diff = tempDate.getTime() - dateObj.getTime();
    return new Date(dateObj.getTime() + diff);
  } catch (error) {
    console.warn('Error converting to timezone:', error);
    return dateObj;
  }
}