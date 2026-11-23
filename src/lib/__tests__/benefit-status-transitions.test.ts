// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import {
  transitionAddPartialCompletion,
  transitionFullCompletion,
  transitionResetCompletion,
  transitionToggleCompletion,
} from '../benefit-status-transitions';

const baseStatus = {
  isCompleted: false,
  usedAmount: 25,
  benefit: { maxAmount: 100 },
};

describe('benefit status transitions', () => {
  it('adds partial completion and completes when reaching max amount', () => {
    expect(transitionAddPartialCompletion(baseStatus, 50)).toMatchObject({
      usedAmount: 75,
      isCompleted: false,
      completedAt: null,
    });

    expect(transitionAddPartialCompletion(baseStatus, 100)).toMatchObject({
      usedAmount: 100,
      isCompleted: true,
    });
  });

  it('sets full completion, reset, and toggle states', () => {
    const completedAt = new Date('2026-05-01T00:00:00.000Z');
    expect(transitionFullCompletion(baseStatus, completedAt)).toEqual({
      usedAmount: 100,
      isCompleted: true,
      completedAt,
    });

    expect(transitionResetCompletion()).toEqual({
      usedAmount: 0,
      isCompleted: false,
      completedAt: null,
    });

    expect(transitionToggleCompletion(baseStatus, completedAt)).toEqual({
      usedAmount: 100,
      isCompleted: true,
      completedAt,
    });
    expect(transitionToggleCompletion({ ...baseStatus, isCompleted: true }, completedAt)).toEqual({
      usedAmount: 0,
      isCompleted: false,
      completedAt: null,
    });
  });
});
