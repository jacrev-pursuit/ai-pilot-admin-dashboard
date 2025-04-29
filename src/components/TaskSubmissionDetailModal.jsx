import React from 'react';
import { Modal, Button, Space, Typography, Tag, Alert } from 'antd';
import dayjs from 'dayjs';
import { getLetterGrade, getGradeColor } from '../utils/gradingUtils'; // Ensure path is correct

const { Title, Text, Paragraph } = Typography;

// Helper function to parse the 'analysis' JSON string (copied from AllTaskAnalysisView)
const parseAnalysis = (analysisString) => {
  if (!analysisString) return null;
  try {
    const cleanedString = analysisString
      .replace(/\n/g, '\n')
      .replace(/\t/g, '\t')
      .replace(/\\"/g, '\"');
    return JSON.parse(cleanedString);
  } catch (error) {
    console.error("Failed to parse analysis JSON:", error, "String:", analysisString);
    return {
        completion_score: null,
        criteria_met: [],
        areas_for_improvement: [],
        feedback: 'Error parsing analysis data.'
    };
  }
};

// Helper function to render analyzed content (copied from BuilderDetailsPage)
const renderAnalyzedContent = (content) => {
  if (!content) return '-';
  const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].type === 'link' && typeof parsed[0].content === 'string') {
      const url = parsed[0].content;
       if (urlRegex.test(url)) { 
         return <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>;
       } else {
         return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(parsed, null, 2)}</pre></Text>;
       }
    }
  } catch (e) {}
  if (typeof content === 'string' && urlRegex.test(content)) {
    return <a href={content} target="_blank" rel="noopener noreferrer">{content}</a>;
  }
  return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{content}</pre></Text>;
};

const TaskSubmissionDetailModal = ({ visible, onClose, record, type }) => {
  if (!visible || !record) return null;

  const analysis = parseAnalysis(record.analysis);

  // Determine title based on type
  const modalTitle = `${type === 'workProduct' ? 'Work Product' : 'Comprehension'} Submission Details - ${record.task_title || 'Task'}`;

  // Handle potential analysis parsing error
  if (!analysis || analysis.feedback === 'Error parsing analysis data.') {
    return (
      <Modal
        title={modalTitle}
        open={visible}
        onCancel={onClose}
        footer={[
          <Button key="back" onClick={onClose}>Close</Button>,
        ]}
        width={800}
      >
        <Alert message="Error" description="Could not parse analysis data for this record." type="error" showIcon />
      </Modal>
    );
  }

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose}>Close</Button>,
      ]}
      width={800}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* Display content similar to the modal in BuilderDetailsPage */}
        {analysis?.submission_summary && (
          <>
            <Text strong>Submission Summary:</Text>
            <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
              {analysis.submission_summary}
            </Paragraph>
          </>
        )}
        {analysis?.completion_score !== null && analysis?.completion_score !== undefined && (
           <Text strong>Score: {analysis.completion_score} ({getLetterGrade(analysis.completion_score)})</Text>
        )}
         {record.analyzed_content && (
            <>
                <Text strong>Analyzed Content:</Text>
                <div style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                   {renderAnalyzedContent(record.analyzed_content)}
                </div>
            </>
         )}
        {analysis?.criteria_met && analysis.criteria_met.length > 0 && (
          <>
            <Text strong>Criteria Met:</Text>
            <Space wrap size={[4, 8]}>
              {analysis.criteria_met.map((item, index) => <Tag color="green" key={`crit-${index}`}>{item}</Tag>)}
            </Space>
          </>
        )}
        {analysis?.areas_for_improvement && analysis.areas_for_improvement.length > 0 && (
          <>
            <Text strong>Areas for Improvement:</Text>
            <Space wrap size={[4, 8]}>
              {analysis.areas_for_improvement.map((item, index) => <Tag color="orange" key={`area-${index}`}>{item}</Tag>)}
            </Space>
          </>
        )}
        {analysis?.specific_findings && typeof analysis.specific_findings === 'object' && Object.keys(analysis.specific_findings).length > 0 && (
           <> 
             <Title level={5} style={{ marginTop: '16px', marginBottom: '8px' }}>Specific Findings:</Title>
             {Object.entries(analysis.specific_findings).map(([category, findings], catIndex) => (
               <div key={`find-cat-${catIndex}`} style={{ marginBottom: '12px', paddingLeft: '10px', borderLeft: '2px solid #eee' }}>
                 <Text strong>{category}:</Text>
                 {findings?.strengths && findings.strengths.length > 0 && (
                   <div style={{ marginTop: '4px' }}>
                     <Text>Strengths:</Text>
                     <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                       {findings.strengths.map((item, index) => <li key={`str-${catIndex}-${index}`}>{item}</li>)}
                     </ul>
                   </div>
                 )}
                 {findings?.weaknesses && findings.weaknesses.length > 0 && (
                   <div style={{ marginTop: '4px' }}>
                     <Text>Weaknesses:</Text>
                     <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                       {findings.weaknesses.map((item, index) => <li key={`weak-${catIndex}-${index}`}>{item}</li>)}
                     </ul>
                   </div>
                 )}
               </div>
             ))}
           </>
        )}
        {analysis?.feedback && (
          <>
            <Text strong>Feedback:</Text>
            <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
              {analysis.feedback}
            </Paragraph>
          </>
        )}
      </Space>
    </Modal>
  );
};

export default TaskSubmissionDetailModal; 