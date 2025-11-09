# Workflow Domain Layer

This package translates the DDD specification in `docs/domain_design.rst` into executable aggregates, entities, and value objects that the rest of Browgent can reuse without depending on infrastructure concerns.

## Modules

| Type | Classes | Responsibility |
| --- | --- | --- |
| Value Objects | `Condition`, `Edge`, `DataBinding` | Capture immutable rules (edge activation and data flows) with equality semantics—no identifiers, comparison is by content. `Condition.type` is limited to the curated set (`expression`, `script`, `event`, `predicate`); `Edge.condition = null` means the route is always available. |
| Entities | `Node` | Describe workflow steps (business actions/decisions) complete with inputs/outputs. |
| Aggregates | `Workflow`, `WorkflowExecution` | Definition BC: DAG/structure invariants. Execution BC: track node executions, status transitions, and metrics. |
| Factories | *(none yet)* | — |
| Entities (Execution) | `NodeExecution` | Represents a single node run, including timestamps, outputs, and failure info. |
| Value Objects (Execution) | `ExecutionResult`, `Metric` | Capture workflow-level outcomes and typed metrics with scope/unit contracts. |
| Errors | `DomainError` derivatives | Provide explicit signaling for invariant violations, invalid transitions, duplicates, and lookups. |

Every constructor validates its inputs and freezes immutable structures to make illegal states unrepresentable.

## Example

```js
import {
  Workflow,
  WorkflowExecution,
  Node,
  Condition,
  Edge,
  DataBinding,
} from './index.js';

const workflow = new Workflow({
  id: 'lead-capture',
  name: 'Lead Capture',
  nodes: [
    new Node({ id: 'start', type: 'navigate', outputs: ['page'] }),
    new Node({ id: 'fill-form', inputs: ['page'], outputs: ['result'] }),
  ],
  edges: [
    new Edge({
      from: 'start',
      to: 'fill-form',
      condition: new Condition({ type: 'expression', expression: 'true' }),
    }),
  ],
  dataBindings: [
    new DataBinding({
      sourceNodeId: 'start',
      sourceOutput: 'page',
      targetNodeId: 'fill-form',
      targetInput: 'page',
    }),
  ],
});

const execution = new WorkflowExecution({ id: 'exec-1', workflowId: workflow.id });
execution.start();
execution.startNode('start');
execution.completeNode('start');
```

`Condition`, `Edge`, and `DataBinding` compare purely by their structural content—no metadata/ID fields—so aggregates can reason about duplicates without relying on surrogate identifiers. `Edge` exposes `isUnconditional` for clarity, and the aggregate enforces unique routes plus per-source priority uniqueness. This layer now focuses solely on workflow definition consistency; execution/observation concerns will be reintroduced once the Definition BC stabilises.
