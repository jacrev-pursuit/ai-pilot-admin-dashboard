import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

// Mock the child components
jest.mock('./Sidebar', () => () => <div data-testid="mock-sidebar">Sidebar</div>);
jest.mock('./Header', () => () => <div data-testid="mock-header">Header</div>);
jest.mock('./MainContent', () => () => <div data-testid="mock-main-content">Main Content</div>);

describe('Dashboard Component', () => {
  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  it('renders without crashing', () => {
    renderDashboard();
    expect(screen.getByTestId('mock-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('mock-header')).toBeInTheDocument();
    expect(screen.getByTestId('mock-main-content')).toBeInTheDocument();
  });

  it('has the correct layout structure', () => {
    renderDashboard();
    const dashboardContainer = screen.getByTestId('dashboard-container');
    expect(dashboardContainer).toHaveClass('flex', 'h-screen', 'bg-gray-100');
  });
}); 