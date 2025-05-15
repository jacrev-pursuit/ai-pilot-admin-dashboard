// src/utils/gradingUtils.js

// Helper function to convert numeric score to letter grade (using 0-100 scale)
export const getLetterGrade = (score) => {
  // Handle null/undefined/NaN first
  if (score === null || score === undefined) return 'F';
  const numScore = parseFloat(score);
  if (isNaN(numScore)) return 'F';

  // Handle specific score = 0 case
  if (numScore === 0) return 'Document Access Error';

  // Handle grade ranges (0-100 scale)
  if (numScore >= 93) return 'A+';
  if (numScore >= 85) return 'A';
  if (numScore >= 80) return 'A-';
  if (numScore >= 70) return 'B+';
  if (numScore >= 60) return 'B';
  if (numScore >= 50) return 'B-';
  if (numScore >= 40) return 'C+';
  return 'C';
};

// Helper function to get color for letter grade
export const getGradeColor = (grade) => {
  if (grade === 'F') return 'red';
  if (grade === 'Document Access Error') return 'red'; // Color for the error state
  if (grade === 'N/A') return 'default';

  const firstChar = grade.charAt(0);
  if (firstChar === 'A') return 'green';
  if (firstChar === 'B') return 'cyan';
  if (firstChar === 'C') return 'orange';
  // if (firstChar === 'D') return 'red'; // No D grade currently

  return 'default'; // Fallback color
}; 

// Helper function to get CSS class for grade tag (dark theme)
export const getGradeTagClass = (grade) => {
  if (!grade) return '';
  const normalized = grade.replace('+', 'plus').replace('-', 'minus').replace(/\s/g, '').toUpperCase();
  if (normalized === 'APLUS') return 'grade-tag-Aplus';
  if (normalized === 'A') return 'grade-tag-A';
  if (normalized === 'AMINUS') return 'grade-tag-Aminus';
  if (normalized === 'BPLUS') return 'grade-tag-Bplus';
  if (normalized === 'B') return 'grade-tag-B';
  if (normalized === 'BMINUS') return 'grade-tag-Bminus';
  if (normalized === 'CPLUS') return 'grade-tag-Cplus';
  if (normalized === 'C') return 'grade-tag-C';
  if (normalized === 'CMINUS') return 'grade-tag-Cminus';
  if (normalized === 'F') return 'grade-tag-F';
  return '';
}; 