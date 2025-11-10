export default class ExecutionContext {
  constructor() {
    this.scopes = [new Map()];
    this.stepCounter = 0;
  }

  nextStepIndex() {
    const current = this.stepCounter;
    this.stepCounter += 1;
    return current;
  }

  pushScope() {
    this.scopes.push(new Map());
  }

  popScope() {
    if (this.scopes.length <= 1) {
      throw new Error('cannot pop root scope');
    }
    this.scopes.pop();
  }

  setVar(name, value) {
    const scope = this.scopes[this.scopes.length - 1];
    scope.set(name, value);
    return value;
  }

  getVar(name) {
    for (let i = this.scopes.length - 1; i >= 0; i -= 1) {
      if (this.scopes[i].has(name)) return this.scopes[i].get(name);
    }
    return undefined;
  }

  getVariablesSnapshot() {
    const result = {};
    for (const scope of this.scopes) {
      for (const [key, value] of scope.entries()) {
        result[key] = value;
      }
    }
    return result;
  }
}
