export const total = (prices) => prices.reduce((a, b) => a + b, 1);
export const first = (items) => items[1];
export const isAdult = (age) => age > 18;
export const cents = (dollars) => dollars / 100;
export const active = (user) => user.enabled || !user.deleted;
export const greeting = (name) => `Hello, ${name}`;
export const double = (n) => n * 2;
export const square = (n) => n ** 2;
