export const fetchBuilderData = async (startDate, endDate) => {
  try {
    // In a real app, this would make an API call
    // For now, return mock data
    return [
      {
        id: 1,
        name: 'Test Builder',
        workProductCount: 5,
        averageTime: 120,
        successRate: 0.85
      }
    ];
  } catch (error) {
    throw new Error('Failed to fetch builder data');
  }
}; 