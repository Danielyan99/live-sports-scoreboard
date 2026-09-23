import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { alertFor } from '../state/alertStore';
import { makeMatch } from '../test/factory';
import { Timeline } from './Timeline';

const goal = {
  id: 'g1',
  type: 'GOAL' as const,
  minute: 30,
  team: 'home' as const,
  player: 'Calloway',
  assist: 'Ingram',
};
const varCall = {
  id: 'v1',
  type: 'VAR' as const,
  minute: 31,
  team: 'home' as const,
  refId: 'g1',
  detail: 'Goal disallowed · Offside',
};

describe('Timeline', () => {
  it('shows a goal with its assist', () => {
    render(<Timeline match={makeMatch({ events: [goal], score: { home: 1, away: 0 } })} />);
    expect(screen.getByText('Calloway')).not.toHaveClass('line-through');
    expect(screen.getByText('assist Ingram')).toBeInTheDocument();
  });

  it('strikes through a goal that VAR overturned and shows the decision', () => {
    render(<Timeline match={makeMatch({ events: [goal, varCall] })} />);
    expect(screen.getByText('Calloway')).toHaveClass('line-through');
    expect(screen.getByText('Disallowed by VAR')).toBeInTheDocument();
    expect(screen.getByText('Goal disallowed · Offside')).toBeInTheDocument();
  });
});

describe('alertFor', () => {
  it('describes a goal with the current score', () => {
    const match = makeMatch({ score: { home: 1, away: 0 }, events: [goal] });
    expect(alertFor(match, goal)).toMatchObject({
      kind: 'goal',
      scoreline: 'Arsenal 1–0 Chelsea',
      detail: 'Calloway · assist Ingram',
      short: 'ARS 1–0 CHE',
    });
  });

  it('describes a VAR decision and ignores other events', () => {
    const match = makeMatch({ events: [goal, varCall] });
    expect(alertFor(match, varCall)).toMatchObject({ kind: 'var', detail: 'Goal disallowed · Offside' });
    expect(alertFor(match, { id: 'y', type: 'YELLOW', minute: 3, team: 'away' })).toBeNull();
  });
});
