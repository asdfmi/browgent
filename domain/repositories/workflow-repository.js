export default class WorkflowRepository {
  async save(params) {
    void params;
    throw new Error('WorkflowRepository.save must be implemented by infrastructure');
  }

  async findById(workflowId) {
    void workflowId;
    throw new Error('WorkflowRepository.findById must be implemented by infrastructure');
  }

  async listSummaries() {
    throw new Error('WorkflowRepository.listSummaries must be implemented by infrastructure');
  }
}
