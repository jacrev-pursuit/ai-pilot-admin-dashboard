import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

const renderSidebar = () => {
  return render(
    <BrowserRouter>
      <Sidebar />
    </BrowserRouter>
  );
};

describe('Sidebar Component', () => {
  it('renders all navigation items', () => {
    renderSidebar();
    
    // Check if all main navigation items are present
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders user profile section', () => {
    renderSidebar();
    
    // Check if user profile elements are present
    expect(screen.getByAltText('User avatar')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('toggles mobile menu when hamburger button is clicked', () => {
    renderSidebar();
    
    const hamburgerButton = screen.getByLabelText('Toggle menu');
    const sidebar = screen.getByTestId('sidebar');
    
    // Initial state - sidebar should be visible on desktop
    expect(sidebar).toHaveClass('translate-x-0');
    
    // Click hamburger button
    fireEvent.click(hamburgerButton);
    
    // Sidebar should be hidden
    expect(sidebar).toHaveClass('-translate-x-full');
    
    // Click hamburger button again
    fireEvent.click(hamburgerButton);
    
    // Sidebar should be visible again
    expect(sidebar).toHaveClass('translate-x-0');
  });
}); 