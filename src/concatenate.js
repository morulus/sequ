import isNotProduction from 'is-not-production';
import isArray from 'lodash/isArray';
import isFunction from 'lodash/isFunction';
import { isFactory, getDisplayName } from './internals/helpers';
import { RESOLVER, ONERROR } from './internals/constants';

export function defaultResolver(unit, stack, context) {
  return [unit.apply(context, stack.slice().reverse())];
}

function arrayUnitResolver(unit, stack) {
  if (isFunction(unit)) {
    return defaultResolver(unit, stack);
  }
  return unit;
}

function resolveArray(unit, stack) {
  if (unit.length === 0) {
    return stack;
  }
  let nextStack = stack.slice();
  for (let i = 0; i < unit.length; i++) {
    nextStack = nextStack.concat(arrayUnitResolver(unit[i], stack));
  }
  return nextStack;
}

export function resolveUnit(unit, stack, context) {
  if (isFunction(unit)) {
    return (unit[RESOLVER] || defaultResolver)(unit, stack, context);
  } else if (isArray(unit)) {
    return resolveArray(unit, stack);
  }
  return [unit];
}

function reflow(units, args, context) {
  let stack = args.slice();
  stack.reverse();
  let i = 0;
  try {
    for (; i < units.length; i++) {
      stack = resolveUnit(units[i], stack, context);
    }
  } catch (e) {
    e.compositeUnit = {
      fn: units[i],
      name: units[i].name,
    };
    // Search for error handler
    i++;
    for (; i < units.length; i++) {
      if (units[i][ONERROR]) {
        stack = resolveUnit(units[i][ONERROR], stack.concat([e]), context);
        return reflow(units.slice(i + 1), stack.slice().reverse(), context);
      }
    }
    throw e;
  }
  return stack.pop();
}

export default function concatenate(...units) {
  if (isNotProduction) {
    units
      .filter(isFactory)
      .forEach((factory) => {
        throw TypeError(`${getDisplayName(factory)} can\`t be a part of chain`);
      });
  }
  return function flow(...args) {
    return reflow(units, args, this);
  };
}