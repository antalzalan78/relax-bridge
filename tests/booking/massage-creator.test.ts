import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCreatorSelection } from '../../src/lib/booking/massage-creator.ts';

test('calculates a 120-minute Relax Massage composition and its final price', () => {
  assert.deepEqual(
    calculateCreatorSelection({ base: 'relax', back: 30, face: 15, foot: 15 }),
    {
      base: 'relax',
      back: 30,
      face: 15,
      foot: 15,
      minutes: 120,
      priceEur: 150,
      serviceKey: 'relax',
    },
  );
});

test('allows the supported 120-minute back-base composition', () => {
  const result = calculateCreatorSelection({ base: 'back', face: 30, foot: 30 });
  assert.equal(result?.minutes, 120);
  assert.equal(result?.priceEur, 150);
  assert.equal(result?.serviceKey, 'neck-shoulder-back');
});

test('rejects duplicate back work and combinations longer than 120 minutes', () => {
  assert.equal(calculateCreatorSelection({ base: 'back', back: 30 }), null);
  assert.equal(
    calculateCreatorSelection({ base: 'relax', back: 30, face: 30, foot: 15 }),
    null,
  );
});

test('uses the supplied twenty-euro price for both 15-minute add-ons', () => {
  const face = calculateCreatorSelection({ base: 'relax', face: 15 });
  const foot = calculateCreatorSelection({ base: 'relax', foot: 15 });
  assert.equal(face?.priceEur, 85);
  assert.equal(foot?.priceEur, 85);
});
