import { describe, expect, it } from 'vitest';
import { employeeLocationKey, locationKeyFor, visibleInLocation } from '../locations';

describe('locations', () => {
  it('matches city spellings and aliases', () => {
    expect(locationKeyFor('Gurugram')).toBe('gurgaon');
    expect(locationKeyFor(' Bengaluru ')).toBe('bangalore');
    expect(locationKeyFor('Navi Mumbai')).toBe('navi-mumbai');
    expect(locationKeyFor('Atlantis')).toBeNull();
    expect(locationKeyFor('')).toBeNull();
  });

  it('takes the branch city first, then the branch name', () => {
    expect(employeeLocationKey({ city: 'Mohali', branch_name: 'Head office' })).toBe('mohali');
    expect(employeeLocationKey({ city: null, branch_name: 'gurgaon' })).toBe('gurgaon');
    expect(employeeLocationKey({ city: null, branch_name: 'Head office' })).toBeNull();
    expect(employeeLocationKey(null)).toBeNull();
  });

  it('shows everything to everyone unless limited', () => {
    expect(visibleInLocation(null, null)).toBe(true);
    expect(visibleInLocation([], 'mohali')).toBe(true);
    expect(visibleInLocation(['mohali'], 'mohali')).toBe(true);
    expect(visibleInLocation(['mohali'], 'gurgaon')).toBe(false);
    expect(visibleInLocation(['mohali'], null)).toBe(false);
  });
});
