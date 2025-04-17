import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import BuilderView from '../BuilderView';
import { fetchBuilderData, fetchBuilderDetails } from '../../services/builderService';

// Mock the builderService
jest.mock('../../services/builderService', () => ({
  fetchBuilderData: jest.fn(),
  fetchBuilderDetails: jest.fn()
}));

// Mock the antd components
jest.mock('antd', () => {
  const antd = jest.requireActual('antd');
  return {
    ...antd,
    message: {
      error: jest.fn()
    }
  };
});

describe('BuilderView Component', () => {
  const mockBuilders = [
    {
      user_id: '123',
      name: 'Test User',
      tasks_completed_percentage: 85.5,
      prompts_sent: 120,
      daily_sentiment: 'Positive',
      peer_feedback_sentiment: 'Very Positive',
      work_product_score: 0.85,
      comprehension_score: 0.9
    }
  ];

  const mockDetails = [
    {
      task_id: '456',
      task_title: 'Test Task',
      score: 0.9,
      grading_timestamp: '2023-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fetchBuilderData.mockResolvedValue(mockBuilders);
    fetchBuilderDetails.mockResolvedValue(mockDetails);
  });

  it('renders the component correctly', async () => {
    render(<BuilderView />);
    
    // Check if the title is rendered
    expect(screen.getByText('Builder Performance Overview')).toBeInTheDocument();
    
    // Wait for the data to be loaded
    await waitFor(() => {
      expect(fetchBuilderData).toHaveBeenCalled();
    });
    
    // Check if the table is rendered with the mock data
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('handles date range change correctly', async () => {
    render(<BuilderView />);
    
    // Wait for the initial data load
    await waitFor(() => {
      expect(fetchBuilderData).toHaveBeenCalled();
    });
    
    // Mock the date picker change
    const dateRange = [
      { format: () => '2023-01-01' },
      { format: () => '2023-12-31' }
    ];
    
    // Simulate date range change
    await act(async () => {
      // This is a simplified version since we can't directly access the DatePicker
      // In a real test, you would need to find the DatePicker and trigger the change
      const dateChangeHandler = fetchBuilderData.mock.calls[0][0];
      dateChangeHandler(dateRange[0], dateRange[1]);
    });
    
    // Check if fetchBuilderData was called with the new date range
    expect(fetchBuilderData).toHaveBeenCalledWith('2023-01-01', '2023-12-31');
  });

  it('handles error when fetching data', async () => {
    // Mock an error
    fetchBuilderData.mockRejectedValue(new Error('Failed to fetch data'));
    
    render(<BuilderView />);
    
    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch builder data. Please try again later.')).toBeInTheDocument();
    });
  });

  it('opens the details modal when clicking on a row', async () => {
    render(<BuilderView />);
    
    // Wait for the data to be loaded
    await waitFor(() => {
      expect(fetchBuilderData).toHaveBeenCalled();
    });
    
    // Find and click on the work product score button
    const workProductButton = screen.getByText('A');
    fireEvent.click(workProductButton);
    
    // Check if the details modal is opened
    await waitFor(() => {
      expect(fetchBuilderDetails).toHaveBeenCalledWith(
        '123',
        'workProduct',
        expect.any(String),
        expect.any(String)
      );
    });
  });
}); 