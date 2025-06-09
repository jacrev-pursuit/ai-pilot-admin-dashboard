import React from 'react';

const PeerFeedbackChart = ({ 
  total_peer_feedback_count, 
  positive_feedback_count, 
  neutral_feedback_count, 
  negative_feedback_count,
  maxFeedbackCount = 100 // Add maxFeedbackCount prop for scaling
}) => {
  // Handle no feedback case
  if (!total_peer_feedback_count || total_peer_feedback_count === 0) {
    return <span style={{ color: '#7b8a99', fontStyle: 'italic' }}>No feedback</span>;
  }

  // Calculate percentages
  const positivePercent = (positive_feedback_count / total_peer_feedback_count) * 100;
  const neutralPercent = (neutral_feedback_count / total_peer_feedback_count) * 100;
  const negativePercent = (negative_feedback_count / total_peer_feedback_count) * 100;

  // Calculate bar width based on volume (scale between 60px and 120px)
  const minWidth = 60;
  const maxWidth = 120;
  const scaledWidth = minWidth + ((total_peer_feedback_count / maxFeedbackCount) * (maxWidth - minWidth));
  const barWidth = Math.min(maxWidth, Math.max(minWidth, scaledWidth));

  // Dashboard color scheme
  const colors = {
    positive: '#38761d',  // Green
    neutral: '#808080',   // Gray  
    negative: '#990000'   // Red
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Stacked horizontal bar */}
      <div 
        style={{ 
          display: 'flex', 
          width: `${barWidth}px`, 
          height: '20px', 
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid #2d3748'
        }}
      >
        {/* Positive segment */}
        {positivePercent > 0 && (
          <div 
            style={{ 
              backgroundColor: colors.positive, 
              width: `${positivePercent}%`,
              height: '100%'
            }} 
          />
        )}
        {/* Neutral segment */}
        {neutralPercent > 0 && (
          <div 
            style={{ 
              backgroundColor: colors.neutral, 
              width: `${neutralPercent}%`,
              height: '100%'
            }} 
          />
        )}
        {/* Negative segment */}
        {negativePercent > 0 && (
          <div 
            style={{ 
              backgroundColor: colors.negative, 
              width: `${negativePercent}%`,
              height: '100%'
            }} 
          />
        )}
      </div>

      {/* Total count - just the number */}
      <span style={{ 
        color: '#bfc9d1', 
        fontSize: '12px', 
        fontWeight: '500',
        minWidth: '20px',
        textAlign: 'left'
      }}>
        {total_peer_feedback_count}
      </span>
    </div>
  );
};

export default PeerFeedbackChart; 