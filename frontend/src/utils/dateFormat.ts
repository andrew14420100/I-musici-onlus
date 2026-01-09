/**
 * Date formatting utilities
 * Display dates in DD-MM-YYYY format while keeping database format as YYYY-MM-DD
 */

/**
 * Format date from YYYY-MM-DD or ISO string to DD-MM-YYYY for display
 */
export const formatDateForDisplay = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) return '';
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Format date with time for display: DD-MM-YYYY HH:MM
 */
export const formatDateTimeForDisplay = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
};

/**
 * Format date for API (YYYY-MM-DD) - used when sending to backend
 */
export const formatDateForAPI = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date for API:', error);
    return '';
  }
};

/**
 * Parse DD-MM-YYYY string to Date object
 */
export const parseDateFromDisplay = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

/**
 * Convert DD-MM-YYYY to YYYY-MM-DD for API
 */
export const convertDisplayToAPI = (dateStr: string): string => {
  if (!dateStr) return '';
  
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    // Check if it's already in YYYY-MM-DD format
    if (parts[0].length === 4) return dateStr;
    
    // Convert DD-MM-YYYY to YYYY-MM-DD
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  } catch (error) {
    return dateStr;
  }
};

/**
 * Get today's date in DD-MM-YYYY format
 */
export const getTodayForDisplay = (): string => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Convert API date (YYYY-MM-DD or ISO) to DD-MM-YYYY for form input
 */
export const convertAPIToDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  
  try {
    // Handle ISO format
    const datePart = dateStr.split('T')[0];
    const parts = datePart.split('-');
    
    if (parts.length !== 3) return dateStr;
    
    // If it's already DD-MM-YYYY (day is first and has 2 digits, year is last with 4 digits)
    if (parts[0].length === 2 && parts[2].length === 4) return dateStr;
    
    // Convert YYYY-MM-DD to DD-MM-YYYY
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  } catch (error) {
    return dateStr;
  }
};
