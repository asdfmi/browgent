import Ajv from 'ajv';
import fs from 'fs/promises';

export default class WorkflowValidator {
  constructor({ schemaUrl, ajvOptions } = {}) {
    this.schemaUrl = schemaUrl;
    this.ajv = new Ajv({ allErrors: true, strict: false, ...ajvOptions });
    this.validateFn = null;
  }

  async #ensureValidator() {
    if (!this.validateFn) {
      if (!this.schemaUrl) {
        throw new Error('workflow schema url is not configured');
      }
      const raw = await fs.readFile(this.schemaUrl, 'utf8');
      const schema = JSON.parse(raw);
      this.validateFn = this.ajv.compile(schema);
    }
    return this.validateFn;
  }

  async validate(workflow) {
    const validate = await this.#ensureValidator();
    const valid = validate(workflow);
    const errors = valid ? [] : (validate.errors ?? []).map((err) => ({
      path: err.instancePath || '/',
      message: err.message,
    }));
    return { valid, errors };
  }
}
