import { CheckCircle2, Circle, CircleDot, ListChecks, XCircle } from 'lucide-react';
import type { AgentTodoItem } from '@shared/types';

interface AgentPlanPanelProps {
  todos: AgentTodoItem[];
  isRunning: boolean;
}

export function AgentPlanPanel({ todos, isRunning }: AgentPlanPanelProps): JSX.Element {
  const completedCount = todos.filter((todo) => todo.status === 'completed').length;

  return (
    <section className="panel agent-plan-panel">
      <div className="agent-plan-header">
        <div>
          <span className="eyebrow">Plan</span>
          <h2>Agent checklist</h2>
        </div>
        <span className={`plan-count ${isRunning ? 'active' : ''}`}>
          <ListChecks size={14} />
          {todos.length ? `${completedCount}/${todos.length}` : 'idle'}
        </span>
      </div>

      <div className="agent-plan-list">
        {todos.length ? (
          todos.map((todo) => (
            <div className={`agent-plan-row ${todo.status}`} key={todo.id}>
              {iconForStatus(todo.status)}
              <p>{todo.content}</p>
              {todo.priority ? <span>{todo.priority}</span> : null}
            </div>
          ))
        ) : (
          <p className="empty-copy">
            Grok task plans will appear here when the agent publishes todo updates during a run.
          </p>
        )}
      </div>
    </section>
  );
}

function iconForStatus(status: AgentTodoItem['status']): JSX.Element {
  if (status === 'completed') {
    return <CheckCircle2 size={14} />;
  }

  if (status === 'in_progress') {
    return <CircleDot size={14} />;
  }

  if (status === 'cancelled') {
    return <XCircle size={14} />;
  }

  return <Circle size={14} />;
}
