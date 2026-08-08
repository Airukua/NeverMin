import { GraphInsightFlow, GraphInsightFlowStage } from './graphInsights';
import { t } from '../../i18n';

function escapeMermaidLabel(value: string): string {
  return value
    .replace(/"/g, '#quot;')
    .replace(/[[\]]/g, '')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 48);
}

export function mainFlowStageId(stage: GraphInsightFlowStage, index: number): string {
  const safe = stage.name.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24) || `n${index}`;
  return `S${index}_${safe}`;
}

export function uniqueMainFlowStages(flow: GraphInsightFlow): GraphInsightFlowStage[] {
  const stages =
    flow.stages.length > 0
      ? flow.stages
      : [
          {
            role: 'input' as const,
            name: flow.input,
            nodeId: flow.nodeIds[0] ?? 'input',
            filePath: '',
            startLine: 1,
            endLine: 1
          },
          ...flow.process.map((name, index) => ({
            role: 'process' as const,
            name,
            nodeId: flow.nodeIds[Math.min(index + 1, flow.nodeIds.length - 1)] ?? `p${index}`,
            filePath: '',
            startLine: 1,
            endLine: 1
          })),
          {
            role: 'output' as const,
            name: flow.output,
            nodeId: flow.nodeIds[flow.nodeIds.length - 1] ?? 'output',
            filePath: '',
            startLine: 1,
            endLine: 1
          }
        ];

  const uniqueStages: GraphInsightFlowStage[] = [];
  const seen = new Set<string>();
  for (const stage of stages) {
    const key = `${stage.role}:${stage.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueStages.push(stage);
  }
  return uniqueStages;
}

/**
 * Bangun flowchart Mermaid LR ala arsitektur:
 * Input → proses-proses → Output (kotak aksi di tengah).
 */
export function buildMainFlowMermaid(flow: GraphInsightFlow): string {
  const uniqueStages = uniqueMainFlowStages(flow);

  if (uniqueStages.length === 0) {
    return ['flowchart LR', `  empty["${t('graph.flow.mermaidEmpty')}"]`].join('\n');
  }

  const lines: string[] = [
    'flowchart LR',
    '  classDef actor fill:#1f2937,stroke:#64748b,color:#e2e8f0,rx:6,ry:6',
    '  classDef action fill:#111827,stroke:#94a3b8,color:#cbd5e1,rx:4,ry:4'
  ];

  const ids = uniqueStages.map((stage, index) => mainFlowStageId(stage, index));
  uniqueStages.forEach((stage, index) => {
    const label = escapeMermaidLabel(stage.name);
    const id = ids[index];
    if (stage.role === 'input' || stage.role === 'output') {
      lines.push(`  ${id}["${label}"]`);
      lines.push(`  class ${id} actor`);
    } else {
      lines.push(`  ${id}["${label}"]`);
      lines.push(`  class ${id} action`);
    }
  });

  for (let index = 0; index < ids.length - 1; index += 1) {
    lines.push(`  ${ids[index]} --> ${ids[index + 1]}`);
  }

  return lines.join('\n');
}
