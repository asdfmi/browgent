export default class WorkflowExecutionRepository {
  async create(execution) {
    void execution;
    throw new Error('WorkflowExecutionRepository.create must be implemented by infrastructure');
  }

  async update(execution) {
    void execution;
    throw new Error('WorkflowExecutionRepository.update must be implemented by infrastructure');
  }

  async findById(executionId) {
    void executionId;
    throw new Error('WorkflowExecutionRepository.findById must be implemented by infrastructure');
  }

  async listSummaries() {
    throw new Error('WorkflowExecutionRepository.listSummaries must be implemented by infrastructure');
  }
}
