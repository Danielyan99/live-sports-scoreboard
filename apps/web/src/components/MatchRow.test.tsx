import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { makeMatch } from '../test/factory';
import { MatchRow } from './MatchRow';

const renderRow = (match = makeMatch()) =>
  render(
    <MemoryRouter>
      <MatchRow match={match} />
    </MemoryRouter>,
  );

describe('MatchRow', () => {
  it('renders teams, score and minute', () => {
    renderRow(makeMatch({ score: { home: 2, away: 1 }, minute: 67 }));

    const row = screen.getByTestId('match-row');
    expect(row).toHaveAttribute('href', '/match/m1');
    expect(row).toHaveTextContent('Arsenal');
    expect(row).toHaveTextContent('Chelsea');
    expect(row).toHaveTextContent("67'");
    expect(row).toHaveAccessibleName(/Arsenal FC 2 vs 1 Chelsea FC/);
  });

  it('does not highlight on first render', () => {
    renderRow(makeMatch({ score: { home: 1, away: 0 } }));
    expect(screen.getByTestId('match-row')).not.toHaveAttribute('data-scored');
  });

  it('highlights the row and the scoring side when the score changes', () => {
    const { rerender } = renderRow();
    rerender(
      <MemoryRouter>
        <MatchRow match={makeMatch({ score: { home: 0, away: 1 }, version: 2 })} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('match-row')).toHaveAttribute('data-scored', 'true');
    const highlighted = document.querySelectorAll('[data-highlight]');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toHaveTextContent('1');
  });

  it('shows kickoff time instead of a score before the match starts', () => {
    renderRow(makeMatch({ status: 'SCHEDULED', minute: null }));
    expect(screen.getByTestId('match-row')).toHaveTextContent('vs');
  });
});
