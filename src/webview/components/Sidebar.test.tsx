import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders navigation items', () => {
    const onSelect = jest.fn();
    render(<Sidebar active="storymap" onSelect={onSelect} />);
    
    expect(screen.getByTitle('Story Map')).toBeInTheDocument();
    expect(screen.getByTitle('Code Diary')).toBeInTheDocument();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('calls onSelect when an item is clicked', () => {
    const onSelect = jest.fn();
    render(<Sidebar active="storymap" onSelect={onSelect} />);
    
    fireEvent.click(screen.getByTitle('Code Diary'));
    expect(onSelect).toHaveBeenCalledWith('diary');
  });

  it('renders a sticky footer', () => {
    const onSelect = jest.fn();
    const { container } = render(<Sidebar active="storymap" onSelect={onSelect} />);
    
    const footer = container.querySelector('.mandala-sidebar-footer');
    expect(footer).toBeInTheDocument();
  });
});
