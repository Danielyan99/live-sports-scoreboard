import type { LeagueResults, MatchResult } from '@scoreboard/shared';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { initialState, useMatchStore } from '../state/matchStore';
import { makeMatch } from '../test/factory';
import { RecentResults } from './RecentResults';

const result = (overrides: Partial<MatchResult> = {}): MatchResult => {
  const { home, away } = makeMatch();
  return {
    id: 'r1',
    league: 'PL',
    matchday: 5,
    kickoff: '2026-09-19T14:00:00Z',
    home,
    away,
    score: { home: 2, away: 1 },
    halfTime: { home: 0, away: 1 },
    referee: 'Main Ref',
    ...overrides,
  };
};

const leagueResults = (league: 'PL' | 'PD', results: MatchResult[]): LeagueResults => ({
  league,
  matchday: results[0]?.matchday ?? 1,
  results,
  fetchedAt: '2026-09-23T12:00:00Z',
});

describe('RecentResults', () => {
  beforeEach(() => useMatchStore.setState(initialState));

  it('renders nothing until results arrive', () => {
    const { container } = render(<RecentResults leagues={['PL', 'PD']} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the matchday, final and half-time scores, and referee', () => {
    useMatchStore.getState().setResults([leagueResults('PL', [result()])]);
    render(<RecentResults leagues={['PL', 'PD']} />);

    expect(screen.getByText(/Matchday 5/)).toBeInTheDocument();
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('2–1');
    expect(row).toHaveTextContent('HT 0–1');
    expect(row).toHaveAccessibleName(/Referee: Main Ref/);
  });

  it('only shows leagues in the current filter', () => {
    useMatchStore
      .getState()
      .setResults([
        leagueResults('PL', [result()]),
        leagueResults('PD', [result({ id: 'r2', league: 'PD', matchday: 7 })]),
      ]);
    render(<RecentResults leagues={['PD']} />);

    expect(screen.getByText(/Matchday 7/)).toBeInTheDocument();
    expect(screen.queryByText(/Matchday 5/)).not.toBeInTheDocument();
  });
});
