/**
 * Safely parses a JSON string, attempting to handle non-standard values like NaN.
 * Replaces `: NaN` with `: null` before parsing.
 * @param {string | null | undefined} jsonString The JSON string to parse.
 * @returns {object | null} The parsed object, or null if parsing fails or input is invalid.
 */
export const parseAnalysis = (jsonString) => {
  if (!jsonString || typeof jsonString !== 'string') {
    // console.warn('parseAnalysis received invalid input:', jsonString);
    return null;
  }

  try {
    // Replace occurrences of : NaN, : Infinity, : -Infinity which are invalid JSON
    const cleanedJsonString = jsonString.replace(/: ?NaN/g, ': null')
                                      .replace(/: ?Infinity/g, ': "Infinity"') // Or handle as needed
                                      .replace(/: ?-Infinity/g, ': "-Infinity"'); // Or handle as needed

    return JSON.parse(cleanedJsonString);
  } catch (error) {
    console.error("Failed to parse analysis JSON:", error, "Original String:", jsonString);
    // Attempt to find the specific syntax error location if possible
    if (error instanceof SyntaxError && error.message.includes('position')) {
      const position = parseInt(error.message.match(/position (\d+)/)?.[1], 10);
      if (!isNaN(position)) {
        const context = jsonString.substring(Math.max(0, position - 20), Math.min(jsonString.length, position + 20));
        console.error(`Syntax error near position ${position}: ...${context}...`);
      }
    }
    return null; // Return null if parsing fails
  }
}; 