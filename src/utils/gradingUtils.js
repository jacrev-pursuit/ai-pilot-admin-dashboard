// src/utils/gradingUtils.js

// Helper function to convert numeric score to letter grade
export const getLetterGrade = (score) => {
  if (score === null || score === undefined) return 'F';

  const numScore = parseFloat(score);
  if (isNaN(numScore)) return 'F';

  // Any valid submission gets at least a C (Adjust logic as needed)
  if (numScore >= 0.9) return 'A+';
  if (numScore >= 0.8) return 'A';
  if (numScore >= 0.75) return 'A-';
  if (numScore >= 0.7) return 'B+';
  if (numScore >= 0.6) return 'B';
  if (numScore >= 0.55) return 'B-';
  if (numScore >= 0.5) return 'C+';
  return 'C'; // Minimum grade for any submission
};

// Helper function to get color for letter grade
export const getGradeColor = (grade) => {
  if (grade === 'N/A' || grade === 'F') return 'red';

  const firstChar = grade.charAt(0);
  if (firstChar === 'A') return 'green';
  if (firstChar === 'B') return 'cyan';
  if (firstChar === 'C') return 'orange';
  // if (firstChar === 'D') return 'red'; // No D grade currently

  return 'default'; // Fallback color
}; 