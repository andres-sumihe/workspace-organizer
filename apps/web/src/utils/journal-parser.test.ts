import { describe, it, expect } from 'vitest';
import { parseContentForSuggestions } from './journal-parser';

describe('parseContentForSuggestions - Smart Content Cleaning', () => {
  it('should extract autofill data and clean content', () => {
    const input = 'Testing API #banknotes Tomorrow priority: Low due: Next Tuesday';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    // Should extract all fields
    expect(result.hashtags).toEqual(['banknotes']);
    expect(result.suggestedPriority).toBe('low');
    expect(result.suggestedDate).toBeDefined(); // Tomorrow
    expect(result.suggestedDueDate).toBeDefined(); // Next Tuesday

    // Should clean content but KEEP hashtags (removed on save separately)
    expect(result.cleanedContent).toBe('Testing API #banknotes');
  });

  it('should handle prepositions before dates', () => {
    const input = 'Fixed bug in login by Tomorrow';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    expect(result.suggestedDate).toBeDefined();
    // Should remove "by Tomorrow" not just "Tomorrow"
    expect(result.cleanedContent).toBe('Fixed bug in login');
  });

  it('should handle "on" preposition', () => {
    const input = 'Meeting with team on next Monday';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    expect(result.suggestedDate).toBeDefined();
    expect(result.cleanedContent).toBe('Meeting with team');
  });

  it('should handle "at" preposition', () => {
    const input = 'Deploy to production at 3pm';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    expect(result.suggestedDate).toBeDefined();
    expect(result.cleanedContent).toBe('Deploy to production');
  });

  it('should handle "before" preposition', () => {
    const input = 'Review code before Friday';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    expect(result.suggestedDate).toBeDefined();
    expect(result.cleanedContent).toBe('Review code');
  });

  it('should handle "after" preposition', () => {
    const input = 'Start new feature after tomorrow';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    expect(result.suggestedDate).toBeDefined();
    expect(result.cleanedContent).toBe('Start new feature');
  });

  it('should handle content with only priority', () => {
    const input = 'Fix login bug #dev priority: High';
    const result = parseContentForSuggestions(input);

    expect(result.hashtags).toEqual(['dev']);
    expect(result.suggestedPriority).toBe('high');
    expect(result.cleanedContent).toBe('Fix login bug #dev');
  });

  it('should handle content with only due date', () => {
    const input = 'Review PR due: Friday';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    expect(result.suggestedDueDate).toBeDefined();
    expect(result.cleanedContent).toBe('Review PR');
  });

  it('should handle plain content without any directives', () => {
    const input = 'Simple task description';
    const result = parseContentForSuggestions(input);

    expect(result.hashtags).toEqual([]);
    expect(result.suggestedDate).toBeUndefined();
    expect(result.suggestedDueDate).toBeUndefined();
    expect(result.suggestedPriority).toBeUndefined();
    expect(result.cleanedContent).toBe('Simple task description');
  });

  it('should preserve multiple hashtags', () => {
    const input = 'Complex task #dev #urgent #backend by tomorrow';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    expect(result.hashtags).toEqual(['dev', 'urgent', 'backend']);
    expect(result.cleanedContent).toBe('Complex task #dev #urgent #backend');
  });

  it('should handle complex multi-directive content', () => {
    const input = 'Deploy to production #devops #release on next Monday priority: High due: Friday';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    expect(result.hashtags).toEqual(['devops', 'release']);
    expect(result.suggestedPriority).toBe('high');
    expect(result.suggestedDate).toBeDefined(); // next Monday
    expect(result.suggestedDueDate).toBeDefined(); // Friday
    expect(result.cleanedContent).toBe('Deploy to production #devops #release');
  });

  it('should clean up extra whitespace', () => {
    const input = 'Task    with    spaces   by   tomorrow   priority:   low';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    // Should normalize whitespace to single spaces
    expect(result.cleanedContent).toBe('Task with spaces');
  });

  it('should NOT modify content during typing - content stays intact', () => {
    // This test documents the behavior: parseContentForSuggestions returns 
    // cleanedContent but does NOT modify the original input.
    // The caller decides when to use cleanedContent (on save, not while typing)
    const input = 'Typing in progress... by tomorrow ';
    const result = parseContentForSuggestions(input, new Date('2026-01-12'));

    // The input is NOT modified, parser just provides cleaned version
    expect(input).toBe('Typing in progress... by tomorrow ');
    // cleanedContent is available for use on save
    expect(result.cleanedContent).toBe('Typing in progress...');
  });
});
