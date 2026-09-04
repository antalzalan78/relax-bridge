import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateHomeServiceSelection,
  calculateHomeServicePrice,
  homeServiceTravelFeeEur,
} from '../../src/lib/booking/home-service.ts';

test('calculates one Home Service treatment without preparation time', () => {
  assert.deepEqual(
    calculateHomeServiceSelection([{ key: 'relax', minutes: 60 }]),
    {
      treatmentMinutes: 60,
      preparationMinutes: 0,
      reservedMinutes: 60,
    },
  );
  assert.equal(homeServiceTravelFeeEur, 15);
});

test('adds the travel fee once per Home Service booking', () => {
  assert.equal(calculateHomeServicePrice([65]), 80);
  assert.equal(calculateHomeServicePrice([65, 70]), 150);
  assert.equal(calculateHomeServicePrice([65, 65, 65]), 210);
  assert.equal(calculateHomeServicePrice([]), null);
});

test('adds 15 minutes of preparation time between Home Service guests', () => {
  assert.deepEqual(
    calculateHomeServiceSelection([
      { key: 'relax', minutes: 90 },
      { key: 'neck-shoulder-back', minutes: 60 },
    ]),
    {
      treatmentMinutes: 150,
      preparationMinutes: 15,
      reservedMinutes: 165,
    },
  );

  assert.deepEqual(
    calculateHomeServiceSelection([
      { key: 'relax', minutes: 60 },
      { key: 'neck-shoulder-back', minutes: 60 },
      { key: 'relax', minutes: 60 },
    ]),
    {
      treatmentMinutes: 180,
      preparationMinutes: 30,
      reservedMinutes: 210,
    },
  );

  assert.deepEqual(
    calculateHomeServiceSelection([
      { key: 'neck-shoulder-back', minutes: 30 },
      { key: 'neck-shoulder-back', minutes: 30 },
    ]),
    {
      treatmentMinutes: 60,
      preparationMinutes: 15,
      reservedMinutes: 75,
    },
  );
});

test('rejects unsupported treatments and combinations over 180 massage minutes', () => {
  assert.equal(
    calculateHomeServiceSelection([
      { key: 'relax', minutes: 90 },
      { key: 'relax', minutes: 90 },
      { key: 'neck-shoulder-back', minutes: 60 },
    ]),
    null,
  );
  assert.equal(
    calculateHomeServiceSelection([
      { key: 'neck-shoulder-back', minutes: 90 },
    ]),
    null,
  );
  assert.equal(
    calculateHomeServiceSelection([
      { key: 'neck-shoulder-back', minutes: 30 },
    ]),
    null,
  );
  assert.equal(calculateHomeServiceSelection([]), null);
});
