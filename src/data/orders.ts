import { faker } from '@faker-js/faker';
import { DateFormat, formatDate } from '@utils/date';

/** The "Place order" form. */
export interface OrderDetails {
  name: string;
  country: string;
  city: string;
  card: string;
  month: string;
  year: string;
}

/** A complete, valid order with random data; override any field per test. */
export function orderDetails(overrides: Partial<OrderDetails> = {}): OrderDetails {
  const expiry = faker.date.future({ years: 5 });
  return {
    name: faker.person.fullName(),
    country: faker.location.country(),
    city: faker.location.city(),
    card: faker.finance.creditCardNumber({ issuer: '4##############L' }), // 16-digit Visa, valid checksum
    month: formatDate(expiry, DateFormat.CARD_MONTH),
    year: formatDate(expiry, DateFormat.CARD_YEAR),
    ...overrides,
  };
}
