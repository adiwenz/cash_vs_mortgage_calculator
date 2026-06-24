import { describe, test, expect } from 'vitest';
import { 
  buildTimelineRows, 
  getTimelineItemObjectKey, 
  doesItemBelongToObject,
  getObjectRowKey
} from './src/utils/timelineRowBuilder.js';
import { getTimelineItems } from './src/models/lifeTimeline/timelineSelectors.js';

describe('Expandable Object Swimlanes & Helpers', () => {
  const testInputs = {
    currentAge: 35,
    lifeExpectancy: 85,
    targetRetirementAge: 65,
    children: [
      { id: 'child-1', name: 'Emma', age: 5, includeCollege: false }
    ],
    lifeEvents: [
      { id: 'child-2', type: 'haveChild', name: 'Child: Liam', birthAge: 40, enabled: true },
      { id: 'buy-house-1', type: 'buyHouse', houseId: 'house-1', name: 'Primary Home Purchase', age: 38, homePrice: 500000, downPayment: 100000, loanTerm: 30, enabled: true },
      { id: 'buy-house-2', type: 'buyHouse', houseId: 'house-2', name: 'Vacation Home Purchase', age: 45, homePrice: 300000, downPayment: 300000, enabled: true },
      { id: 'promo-1', type: 'careerChange', name: 'Promotion', age: 42, enabled: true }
    ],
    houseAssets: [
      { id: 'house-1', name: 'Primary Home', purchasePrice: 500000, purchaseType: 'mortgage', hasMortgage: true, mortgage: { balance: 400000, interestRate: 6.5, monthlyPayment: 2500 } },
      { id: 'house-2', name: 'Vacation Home', purchasePrice: 300000, purchaseType: 'cash', hasMortgage: false }
    ],
    incomeList: [
      { id: 'salary-main', name: 'Salary', amount: 100000, startAge: 35, endAge: 65 }
    ],
    debtList: [
      { id: 'student-loan', name: 'Student Loan', balance: 20000, interestRate: 4.5, payment: 300, startAge: 35 }
    ]
  };

  test('1. getObjectRowKey returns stable key', () => {
    expect(getObjectRowKey('child', 'child-1')).toBe('child-child-1');
    expect(getObjectRowKey('housing', 'house-1')).toBe('housing-house-1');
  });

  test('2. buildTimelineRows generates correct categories and object rows', () => {
    const rows = buildTimelineRows(testInputs);
    
    // Total category headers (relationship, housing, children, education, debt, income, major-events, assets)
    const categories = rows.filter(r => r.type === 'category');
    expect(categories.length).toBe(8);

    // Children count & rows
    const childrenCategory = rows.find(r => r.id === 'children');
    expect(childrenCategory.count).toBe(2);
    const childRows = rows.filter(r => r.parent === 'children');
    expect(childRows.length).toBe(2);
    expect(childRows[0].label).toBe('Emma');
    expect(childRows[1].label).toBe('Liam');

    // Housing count & rows
    const housingCategory = rows.find(r => r.id === 'housing');
    expect(housingCategory.count).toBe(2);
    const houseRows = rows.filter(r => r.parent === 'housing');
    expect(houseRows.length).toBe(2);
    expect(houseRows[0].label).toBe('Primary Home');
    expect(houseRows[1].label).toBe('Vacation Home');

    // Income count & rows
    const incomeCategory = rows.find(r => r.id === 'income');
    expect(incomeCategory.count).toBe(2); // Salary, Promotion
    const incomeRows = rows.filter(r => r.parent === 'income');
    expect(incomeRows.length).toBe(2);

    // Debt count & rows
    const debtCategory = rows.find(r => r.id === 'debt');
    expect(debtCategory.count).toBe(2); // Student Loan, Primary Home Mortgage
    const debtRows = rows.filter(r => r.parent === 'debt');
    expect(debtRows.length).toBe(2);
    expect(debtRows.find(d => d.id === 'mortgage-house-1')).toBeDefined();
  });

  test('3. getTimelineItemObjectKey maps legacy and metadata fields correctly', () => {
    // Legacy child event patterns
    expect(getTimelineItemObjectKey({ id: 'event-child-point-mychild' })).toBe('child-mychild');
    expect(getTimelineItemObjectKey({ id: 'event-child-dependent-period-mychild' })).toBe('child-mychild');

    // Legacy house event patterns
    expect(getTimelineItemObjectKey({ id: 'event-buyhouse-point-buy-house-1' }, testInputs)).toBe('housing-house-1');
    expect(getTimelineItemObjectKey({ id: 'event-buyhouse-point-myhouse' }, testInputs)).toBe('housing-myhouse');
    expect(getTimelineItemObjectKey({ id: 'debt-period-mortgage-existing-house-1' })).toBe('debt-mortgage-house-1');

    // metadata-specific IDs
    expect(getTimelineItemObjectKey({ metadata: { childId: 'emma-id' } })).toBe('child-emma-id');
    expect(getTimelineItemObjectKey({ metadata: { houseId: 'primary-id' } })).toBe('housing-primary-id');
  });

  test('4. doesItemBelongToObject matches correctly', () => {
    const row = { type: 'object', objectType: 'child', objectId: 'child-1', rowKey: 'child-child-1' };
    const matchingItem = { id: 'event-child-point-child-1' };
    const nonMatchingItem = { id: 'event-child-point-child-2' };

    expect(doesItemBelongToObject(matchingItem, row)).toBe(true);
    expect(doesItemBelongToObject(nonMatchingItem, row)).toBe(false);
  });

  test('5. Item normalization & visibility under collapsed and expanded states', () => {
    const rawItems = getTimelineItems(testInputs);
    
    // Let's normalize the raw items
    const normalizedItems = rawItems.map(item => {
      const rowKey = getTimelineItemObjectKey(item, testInputs);
      let objectType = null;
      let objectId = null;
      if (rowKey) {
        const parts = rowKey.split('-');
        objectType = parts[0];
        objectId = parts.slice(1).join('-');
      }
      return {
        ...item,
        objectType,
        objectId,
        rowKey
      };
    });

    // Check children category items
    const childrenCategoryItems = normalizedItems.filter(item => item.category === 'children');
    
    // Expanded mode:
    // Category row shows only items with no rowKey
    const categoryExpandedItems = childrenCategoryItems.filter(item => !item.rowKey);
    expect(categoryExpandedItems.length).toBe(0); // All child items belong to specific children

    // Object swimlanes show only their items
    const emmaRowKey = getObjectRowKey('child', 'child-1');
    const emmaItems = childrenCategoryItems.filter(item => item.rowKey === emmaRowKey);
    expect(emmaItems.length).toBeGreaterThan(0);

    // Collapsed mode:
    // Category row shows all items
    const categoryCollapsedItems = childrenCategoryItems;
    expect(categoryCollapsedItems.length).toBeGreaterThan(0);
  });

  test('6. Renting assets are filtered out, only new houses shown, and house event keys match', () => {
    const inputsWithRenting = {
      ...testInputs,
      houseAssets: [
        { id: 'house-renting-id', name: 'Rented Apartment', purchaseType: 'rent', status: 'rent' },
        ...testInputs.houseAssets
      ]
    };

    const rows = buildTimelineRows(inputsWithRenting);
    const housingRows = rows.filter(r => r.parent === 'housing');

    // Should only contain Primary Home and Vacation Home (no Rented Apartment)
    expect(housingRows.length).toBe(2);
    expect(housingRows.some(r => r.id === 'house-renting-id')).toBe(false);

    // Timeline items for buyHouse should correctly resolve key to matching house row key
    const rawItems = getTimelineItems(inputsWithRenting);
    const buyHouseItem = rawItems.find(item => item.id.startsWith('event-buyhouse-point-'));
    expect(buyHouseItem).toBeDefined();

    const resolvedKey = getTimelineItemObjectKey(buyHouseItem, inputsWithRenting);
    expect(resolvedKey).toBe('housing-house-1');
  });
});
