// @flow

import flatten from '../utils/flatten';
import { hash, phash } from '../utils/hasher';
import generateName from '../utils/generateAlphabeticName';
import isStaticRules from '../utils/isStaticRules';
import StyleSheet from '../sheet';
import { IS_BROWSER } from '../constants';

import type { RuleSet } from '../types';

const isHMREnabled =
  process.env.NODE_ENV !== 'production' && typeof module !== 'undefined' && module.hot;

/*
 ComponentStyle is all the CSS-specific stuff, not
 the React-specific stuff.
 */
export default class ComponentStyle {
  rules: RuleSet;

  componentId: string;

  isStatic: boolean;

  baseHash: number;

  constructor(rules: RuleSet, componentId: string) {
    this.rules = rules;
    this.isStatic = !isHMREnabled && IS_BROWSER && isStaticRules(rules);
    this.componentId = componentId;
    this.baseHash = hash(componentId);

    // NOTE: This registers the componentId, which ensures a consistent order
    // for this component's styles compared to others
    StyleSheet.registerId(componentId);
  }

  /*
   * Flattens a rule set into valid CSS
   * Hashes it, wraps the whole chunk in a .hash1234 {}
   * Returns the hash to be injected on render()
   * */
  generateAndInjectStyles(executionContext: Object, styleSheet: StyleSheet) {
    const { componentId } = this;

    if (this.isStatic) {
      if (!styleSheet.hasNameForId(componentId, componentId)) {
        const cssStatic = flatten(this.rules, executionContext, styleSheet).join('');
        const cssStaticFormatted = styleSheet.options.stringifier(
          cssStatic,
          `.${componentId}`,
          undefined,
          componentId
        );

        styleSheet.insertRules(componentId, componentId, cssStaticFormatted);
      }

      return componentId;
    } else {
      const { length } = this.rules;

      let i = 0;
      let dynamicHash = this.baseHash;
      let css = '';

      for (i = 0; i < length; i++) {
        const partRule = this.rules[i];
        if (typeof partRule === 'string') {
          css += partRule;
        } else {
          const partChunk = flatten(partRule, executionContext, styleSheet);
          const partString = Array.isArray(partChunk) ? partChunk.join('') : partChunk;
          dynamicHash = phash(dynamicHash, partString + i);
          css += partString;
        }
      }

      const name = generateName(dynamicHash >>> 0);

      if (!styleSheet.hasNameForId(componentId, name)) {
        const cssFormatted = styleSheet.options.stringifier(
          css,
          `.${name}`,
          undefined,
          componentId
        );
        styleSheet.insertRules(componentId, name, cssFormatted);
      }

      return name;
    }
  }
}
